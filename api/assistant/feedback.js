// AI Assistant Feedback API
const { MemoryService } = require('../../lib/memory-service');

let memoryService = null;

function initializeService(database) {
  if (!memoryService) {
    memoryService = new MemoryService(database);
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversationId, feedbackType, feedbackText = null } = req.body;
    
    if (!conversationId || !feedbackType) {
      return res.status(400).json({ 
        error: 'Conversation ID and feedback type are required' 
      });
    }

    if (!['positive', 'negative', 'correction'].includes(feedbackType)) {
      return res.status(400).json({ 
        error: 'Feedback type must be positive, negative, or correction' 
      });
    }

    // Initialize database and services
    const DatabaseService = require('../../lib/database-neon');
    const database = new DatabaseService();
    await database.initialize();
    
    initializeService(database);

    // Get user ID from token or use default
    const userId = req.user?.id || 'default';

    // Store the feedback
    const feedback = {
      user_id: userId,
      message_id: conversationId,
      feedback: feedbackType,
      feedback_text: feedbackText,
      created_at: new Date()
    };

    const feedbackId = await database.storeFeedback(feedback);

    // Learn from the feedback if it's a correction
    if (feedbackType === 'correction' && feedbackText) {
      await handleCorrectionFeedback(userId, conversationId, feedbackText, database);
    }

    // Update user's feedback patterns in memory
    await updateFeedbackPatterns(userId, feedbackType);

    return res.json({
      success: true,
      message: 'Thank you for your feedback! I\'ll use it to improve.',
      feedbackId: feedbackId,
      feedbackType: feedbackType
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({
      error: 'Failed to process feedback',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle correction feedback to improve future responses
 */
async function handleCorrectionFeedback(userId, conversationId, correction, database) {
  try {
    // Get the original conversation
    const conversations = await database.getConversationHistory(userId, null, 50);
    const targetConversation = conversations.find(c => c.id === parseInt(conversationId));
    
    if (!targetConversation) {
      console.warn(`Conversation ${conversationId} not found for correction`);
      return;
    }

    // Extract learning points from the correction
    const learningPoints = extractLearningPoints(targetConversation, correction);
    
    // Store learning points in memory with high relevance
    for (const point of learningPoints) {
      await memoryService.storeMemory(
        userId,
        point.key,
        point.value,
        'behavioral',
        0.9 // High relevance for corrections
      );
    }

    console.log(`Processed correction feedback for user ${userId}: ${learningPoints.length} learning points`);

  } catch (error) {
    console.error('Error handling correction feedback:', error);
  }
}

/**
 * Extract learning points from correction feedback
 */
function extractLearningPoints(conversation, correction) {
  const learningPoints = [];
  const originalMessage = conversation.user_message.toLowerCase();
  const correctionLower = correction.toLowerCase();

  // Learn from time corrections
  const timeCorrections = extractTimeCorrections(originalMessage, correctionLower);
  learningPoints.push(...timeCorrections);

  // Learn from date corrections
  const dateCorrections = extractDateCorrections(originalMessage, correctionLower);
  learningPoints.push(...dateCorrections);

  // Learn from title/description corrections
  const titleCorrections = extractTitleCorrections(originalMessage, correctionLower);
  learningPoints.push(...titleCorrections);

  // Learn from participant corrections
  const participantCorrections = extractParticipantCorrections(originalMessage, correctionLower);
  learningPoints.push(...participantCorrections);

  // General language pattern learning
  learningPoints.push({
    key: `correction_pattern_${Date.now()}`,
    value: {
      original: originalMessage,
      correction: correctionLower,
      timestamp: new Date()
    }
  });

  return learningPoints;
}

/**
 * Extract time-related corrections
 */
function extractTimeCorrections(original, correction) {
  const corrections = [];
  
  // Look for time mentions in correction
  const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)/gi;
  let match;
  
  while ((match = timePattern.exec(correction)) !== null) {
    const correctedTime = match[0];
    corrections.push({
      key: 'time_preference_correction',
      value: {
        original: original,
        correctedTime: correctedTime,
        context: 'user_correction'
      }
    });
  }

  return corrections;
}

/**
 * Extract date-related corrections
 */
function extractDateCorrections(original, correction) {
  const corrections = [];
  
  // Look for date mentions in correction
  const dateKeywords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  dateKeywords.forEach(keyword => {
    if (correction.includes(keyword)) {
      corrections.push({
        key: 'date_preference_correction',
        value: {
          original: original,
          correctedDate: keyword,
          context: 'user_correction'
        }
      });
    }
  });

  return corrections;
}

/**
 * Extract title/description corrections
 */
function extractTitleCorrections(original, correction) {
  const corrections = [];
  
  // Look for explicit title corrections
  if (correction.includes('title') || correction.includes('called') || correction.includes('named')) {
    corrections.push({
      key: 'title_preference_correction',
      value: {
        original: original,
        correction: correction,
        context: 'title_correction'
      }
    });
  }

  return corrections;
}

/**
 * Extract participant corrections
 */
function extractParticipantCorrections(original, correction) {
  const corrections = [];
  
  // Look for names in correction (basic pattern)
  const namePattern = /\b[A-Z][a-z]+\b/g;
  const names = correction.match(namePattern) || [];
  
  if (names.length > 0) {
    corrections.push({
      key: 'participant_preference_correction',
      value: {
        original: original,
        correctedParticipants: names,
        context: 'participant_correction'
      }
    });
  }

  return corrections;
}

/**
 * Update user's feedback patterns in memory
 */
async function updateFeedbackPatterns(userId, feedbackType) {
  try {
    // Get current feedback stats
    const currentStats = await memoryService.getMemory(userId, 'feedback_stats') || {
      positive: 0,
      negative: 0,
      correction: 0,
      total: 0
    };

    // Update stats
    currentStats[feedbackType] = (currentStats[feedbackType] || 0) + 1;
    currentStats.total = (currentStats.total || 0) + 1;

    // Store updated stats
    await memoryService.storeMemory(
      userId,
      'feedback_stats',
      currentStats,
      'behavioral',
      0.8
    );

    // Store recent feedback trend
    const recentFeedback = await memoryService.getMemory(userId, 'recent_feedback') || [];
    recentFeedback.push({
      type: feedbackType,
      timestamp: new Date()
    });

    // Keep only last 20 feedback entries
    if (recentFeedback.length > 20) {
      recentFeedback.splice(0, recentFeedback.length - 20);
    }

    await memoryService.storeMemory(
      userId,
      'recent_feedback',
      recentFeedback,
      'contextual',
      0.7
    );

    console.log(`Updated feedback patterns for user ${userId}: ${feedbackType}`);

  } catch (error) {
    console.error('Error updating feedback patterns:', error);
  }
}