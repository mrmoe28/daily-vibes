// AI Assistant Chat API Endpoint
const { AIAssistant } = require('../../lib/ai-assistant');
const { MemoryService } = require('../../lib/memory-service');
const { NLPParser } = require('../../lib/nlp-parser');

let aiAssistant = null;
let memoryService = null;
let nlpParser = null;

// Initialize services
function initializeServices(database) {
  if (!aiAssistant) {
    aiAssistant = new AIAssistant(database);
    memoryService = new MemoryService(database);
    nlpParser = new NLPParser();
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
    const { message, sessionId = null } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user ID from token or use default
    const userId = req.user?.id || 'default';

    // Initialize database and services
    const DatabaseService = require('../../lib/database-neon');
    const database = new DatabaseService();
    await database.initialize();
    
    initializeServices(database);

    // First, try NLP parsing for quick response
    const nlpResult = nlpParser.parse(message);
    
    // If NLP parsing has high confidence and clear intent, handle directly
    if (nlpResult.confidence > 0.8 && nlpResult.intent !== 'UNKNOWN') {
      const response = await handleDirectIntent(nlpResult, userId, database);
      
      // Store conversation
      await memoryService.storeConversation(
        userId, 
        message, 
        response.text, 
        nlpResult.intent, 
        nlpResult.entities, 
        sessionId
      );
      
      return res.json({
        success: true,
        response: response.text,
        action: response.action,
        data: response.data,
        intent: nlpResult.intent,
        entities: nlpResult.entities,
        confidence: nlpResult.confidence,
        source: 'nlp'
      });
    }

    // For complex queries or low confidence, use AI Assistant
    const aiResponse = await aiAssistant.processMessage(userId, message, sessionId);
    
    if (!aiResponse.success) {
      return res.status(400).json({
        error: aiResponse.error,
        originalMessage: message
      });
    }

    // Execute action if needed
    if (aiResponse.action) {
      const actionResult = await executeAction(aiResponse.action, aiResponse.data, userId, database);
      aiResponse.actionResult = actionResult;
    }

    return res.json({
      success: true,
      response: aiResponse.response,
      action: aiResponse.action,
      data: aiResponse.data,
      actionResult: aiResponse.actionResult,
      intent: aiResponse.intent,
      entities: aiResponse.entities,
      source: 'ai'
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({
      error: 'I had trouble processing your request. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle direct intent from NLP parser
 */
async function handleDirectIntent(nlpResult, userId, database) {
  const { intent, entities } = nlpResult;

  switch (intent) {
    case 'CREATE':
      return handleCreateEvent(entities, userId, database);
    
    case 'QUERY':
      return handleQuerySchedule(entities, userId, database);
    
    case 'MODIFY':
      return handleModifyEvent(entities, userId, database);
    
    case 'DELETE':
      return handleDeleteEvent(entities, userId, database);
    
    default:
      return {
        text: "I understand you want to " + intent.toLowerCase() + " something, but I need more details. Can you be more specific?",
        action: null,
        data: entities
      };
  }
}

/**
 * Handle event creation
 */
async function handleCreateEvent(entities, userId, database) {
  // Validate required fields
  if (!entities.date) {
    return {
      text: "What day would you like to schedule this event?",
      action: 'REQUEST_DATE',
      data: entities
    };
  }

  if (!entities.time) {
    return {
      text: "What time should the event start?",
      action: 'REQUEST_TIME',
      data: entities
    };
  }

  // Create the event
  const eventData = {
    id: generateEventId(),
    user_id: userId,
    title: entities.title || 'New Event',
    description: entities.description || '',
    date: entities.date,
    time: entities.time || '09:00',
    type: entities.eventType || 'other',
    location: entities.location || null,
    all_day: entities.duration >= 480, // 8+ hours = all day
    created_at: new Date()
  };

  try {
    const createdEvent = await database.createCalendarEvent(eventData);
    
    const eventDate = new Date(entities.date + 'T' + entities.time);
    const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return {
      text: `Perfect! I've scheduled "${entities.title}" for ${dateStr} at ${timeStr}.`,
      action: 'EVENT_CREATED',
      data: { event: createdEvent, original: entities }
    };

  } catch (error) {
    console.error('Error creating event:', error);
    return {
      text: "I had trouble creating that event. Please try again.",
      action: 'ERROR',
      data: { error: error.message }
    };
  }
}

/**
 * Handle schedule queries
 */
async function handleQuerySchedule(entities, userId, database) {
  try {
    let startDate, endDate;
    
    if (entities.date) {
      startDate = entities.date;
      endDate = entities.date;
    } else {
      // Default to today
      startDate = new Date().toISOString().split('T')[0];
      endDate = startDate;
    }
    
    const events = await database.getEventsByDateRange(userId, startDate, endDate);
    
    if (events.length === 0) {
      const dayStr = startDate === endDate ? 
        new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) :
        'that period';
      
      return {
        text: `You have no events scheduled for ${dayStr}. Would you like to add something?`,
        action: 'SHOW_EMPTY_SCHEDULE',
        data: { startDate, endDate }
      };
    }
    
    let responseText = `Here's your schedule:\n\n`;
    for (const event of events) {
      const eventTime = event.time ? 
        new Date('2000-01-01T' + event.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) :
        'All day';
      responseText += `• ${event.title} at ${eventTime}\n`;
      if (event.location) responseText += `  📍 ${event.location}\n`;
    }
    
    return {
      text: responseText,
      action: 'SHOW_SCHEDULE',
      data: { events, startDate, endDate }
    };

  } catch (error) {
    console.error('Error querying schedule:', error);
    return {
      text: "I had trouble checking your schedule. Please try again.",
      action: 'ERROR',
      data: { error: error.message }
    };
  }
}

/**
 * Handle event modifications
 */
async function handleModifyEvent(entities, userId, database) {
  return {
    text: "I'd be happy to help you modify an event. Which event would you like to change?",
    action: 'REQUEST_EVENT_SELECTION',
    data: entities
  };
}

/**
 * Handle event deletion
 */
async function handleDeleteEvent(entities, userId, database) {
  return {
    text: "I can help you cancel an event. Which event would you like to remove?",
    action: 'REQUEST_EVENT_SELECTION',
    data: entities
  };
}

/**
 * Execute actions based on AI response
 */
async function executeAction(action, data, userId, database) {
  switch (action) {
    case 'CONFIRM_CREATE_EVENT':
      return await createEventFromData(data, userId, database);
    
    case 'SHOW_SCHEDULE':
      return await getScheduleData(data, userId, database);
    
    case 'REQUEST_DATE':
    case 'REQUEST_TIME':
    case 'REQUEST_EVENT_SELECTION':
      // These actions require user interaction, no backend execution needed
      return { type: 'user_input_required', data };
    
    default:
      return { type: 'no_action', message: 'No action required' };
  }
}

/**
 * Create event from AI-parsed data
 */
async function createEventFromData(data, userId, database) {
  try {
    const eventData = {
      id: generateEventId(),
      user_id: userId,
      title: data.title || 'New Event',
      description: data.description || '',
      date: data.date,
      time: data.time || '09:00',
      type: data.eventType || 'other',
      location: data.location || null,
      all_day: data.duration >= 480,
      created_at: new Date()
    };

    const createdEvent = await database.createCalendarEvent(eventData);
    
    return {
      type: 'event_created',
      event: createdEvent,
      success: true
    };

  } catch (error) {
    console.error('Error creating event from data:', error);
    return {
      type: 'error',
      success: false,
      error: error.message
    };
  }
}

/**
 * Get schedule data for display
 */
async function getScheduleData(data, userId, database) {
  try {
    const events = await database.getEventsByDateRange(userId, data.startDate, data.endDate);
    
    return {
      type: 'schedule_data',
      events: events,
      dateRange: {
        start: data.startDate,
        end: data.endDate
      },
      success: true
    };

  } catch (error) {
    console.error('Error getting schedule data:', error);
    return {
      type: 'error',
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate unique event ID
 */
function generateEventId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}