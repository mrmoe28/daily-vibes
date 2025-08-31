// Memory Service for AI Assistant Context and Learning
const { Logger } = require('./logger');

class MemoryService {
    constructor(database) {
        this.database = database;
        this.logger = new Logger();
        
        // In-memory caches for fast access
        this.userContextCache = new Map();
        this.conversationCache = new Map();
        this.learningPatterns = new Map();
        
        // Memory expiration times
        this.CONTEXT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
        this.CONVERSATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
        
        // Memory categories for organization
        this.MEMORY_CATEGORIES = {
            PERSONAL: 'personal',        // Name, preferences, timezone
            BEHAVIORAL: 'behavioral',    // Scheduling patterns, habits
            CONTEXTUAL: 'contextual',   // Recent conversations, current context
            PREFERENCES: 'preferences', // Settings, defaults
            RELATIONSHIPS: 'relationships' // Frequent contacts, meeting partners
        };
        
        // Start periodic cleanup
        this.startCleanup();
    }

    /**
     * Store memory for a user with categorization and relevance scoring
     */
    async storeMemory(userId, key, value, category = 'contextual', relevanceScore = 1.0) {
        try {
            const memory = {
                user_id: userId,
                memory_key: key,
                memory_value: typeof value === 'string' ? value : JSON.stringify(value),
                category: category,
                relevance_score: relevanceScore,
                created_at: new Date(),
                last_accessed: new Date(),
                access_count: 1
            };
            
            await this.database.storeUserMemory(memory);
            
            // Update cache
            const cacheKey = `${userId}:${key}`;
            this.userContextCache.set(cacheKey, {
                ...memory,
                expires_at: Date.now() + this.CONTEXT_CACHE_TTL
            });
            
            this.logger.debug(`Stored memory for user ${userId}: ${key}`);
            return true;
            
        } catch (error) {
            this.logger.error('Error storing memory:', error);
            return false;
        }
    }

    /**
     * Retrieve memory for a user
     */
    async getMemory(userId, key) {
        const cacheKey = `${userId}:${key}`;
        
        // Check cache first
        const cached = this.userContextCache.get(cacheKey);
        if (cached && cached.expires_at > Date.now()) {
            // Update access statistics
            cached.access_count++;
            cached.last_accessed = new Date();
            this.updateAccessStats(userId, key, cached.access_count);
            
            return typeof cached.memory_value === 'string' ? 
                   cached.memory_value : JSON.parse(cached.memory_value);
        }
        
        try {
            const memory = await this.database.getUserMemory(userId, key);
            if (memory) {
                // Cache for future use
                this.userContextCache.set(cacheKey, {
                    ...memory,
                    expires_at: Date.now() + this.CONTEXT_CACHE_TTL
                });
                
                // Update access statistics
                await this.updateAccessStats(userId, key, memory.access_count + 1);
                
                return typeof memory.memory_value === 'string' ? 
                       memory.memory_value : JSON.parse(memory.memory_value);
            }
            
            return null;
            
        } catch (error) {
            this.logger.error('Error retrieving memory:', error);
            return null;
        }
    }

    /**
     * Get all memories for a user by category
     */
    async getMemoriesByCategory(userId, category, limit = 50) {
        try {
            const memories = await this.database.getUserMemoriesByCategory(userId, category, limit);
            return memories.map(memory => ({
                key: memory.memory_key,
                value: typeof memory.memory_value === 'string' ? 
                       memory.memory_value : JSON.parse(memory.memory_value),
                relevance: memory.relevance_score,
                lastAccessed: memory.last_accessed,
                accessCount: memory.access_count
            }));
        } catch (error) {
            this.logger.error('Error retrieving memories by category:', error);
            return [];
        }
    }

    /**
     * Store conversation with intelligent context extraction
     */
    async storeConversation(userId, message, response, intent, entities, sessionId = null) {
        try {
            const conversation = {
                user_id: userId,
                session_id: sessionId,
                user_message: message,
                assistant_response: response,
                intent: intent,
                entities: JSON.stringify(entities),
                context_score: this.calculateContextScore(message, intent, entities),
                created_at: new Date()
            };
            
            const conversationId = await this.database.storeConversation(conversation);
            
            // Extract and store relevant context
            await this.extractAndStoreContext(userId, message, intent, entities);
            
            // Update conversation cache
            const cacheKey = `conv:${userId}:${sessionId || 'default'}`;
            let conversations = this.conversationCache.get(cacheKey) || [];
            conversations.push(conversation);
            
            // Keep only last 20 conversations in cache
            if (conversations.length > 20) {
                conversations = conversations.slice(-20);
            }
            
            this.conversationCache.set(cacheKey, conversations);
            
            return conversationId;
            
        } catch (error) {
            this.logger.error('Error storing conversation:', error);
            return null;
        }
    }

    /**
     * Get recent conversations for context
     */
    async getConversationHistory(userId, sessionId = null, limit = 10) {
        const cacheKey = `conv:${userId}:${sessionId || 'default'}`;
        
        // Check cache first
        const cached = this.conversationCache.get(cacheKey);
        if (cached) {
            return cached.slice(-limit);
        }
        
        try {
            const conversations = await this.database.getConversationHistory(userId, sessionId, limit);
            
            // Cache the results
            this.conversationCache.set(cacheKey, conversations);
            setTimeout(() => this.conversationCache.delete(cacheKey), this.CONVERSATION_CACHE_TTL);
            
            return conversations;
            
        } catch (error) {
            this.logger.error('Error retrieving conversation history:', error);
            return [];
        }
    }

    /**
     * Learn from user patterns and update behavioral memories
     */
    async learnFromPatterns(userId) {
        try {
            // Analyze scheduling patterns
            const schedulePatterns = await this.analyzeSchedulingPatterns(userId);
            if (schedulePatterns.preferredTimes.length > 0) {
                await this.storeMemory(
                    userId, 
                    'preferred_meeting_times', 
                    schedulePatterns.preferredTimes,
                    this.MEMORY_CATEGORIES.BEHAVIORAL,
                    0.8
                );
            }
            
            // Analyze typical meeting durations
            if (schedulePatterns.typicalDuration) {
                await this.storeMemory(
                    userId,
                    'typical_meeting_duration',
                    schedulePatterns.typicalDuration,
                    this.MEMORY_CATEGORIES.BEHAVIORAL,
                    0.7
                );
            }
            
            // Analyze frequent participants
            if (schedulePatterns.frequentParticipants.length > 0) {
                await this.storeMemory(
                    userId,
                    'frequent_meeting_participants',
                    schedulePatterns.frequentParticipants,
                    this.MEMORY_CATEGORIES.RELATIONSHIPS,
                    0.6
                );
            }
            
            // Learn language patterns
            const languagePatterns = await this.analyzeLanguagePatterns(userId);
            if (Object.keys(languagePatterns).length > 0) {
                await this.storeMemory(
                    userId,
                    'language_patterns',
                    languagePatterns,
                    this.MEMORY_CATEGORIES.BEHAVIORAL,
                    0.5
                );
            }
            
            return true;
            
        } catch (error) {
            this.logger.error('Error learning from patterns:', error);
            return false;
        }
    }

    /**
     * Get contextual recommendations based on memory
     */
    async getContextualRecommendations(userId, currentIntent, currentEntities) {
        try {
            const recommendations = {
                suggestedTimes: [],
                suggestedParticipants: [],
                suggestedDurations: [],
                languageHelp: []
            };
            
            // Get behavioral memories
            const behavioralMemories = await this.getMemoriesByCategory(userId, this.MEMORY_CATEGORIES.BEHAVIORAL);
            
            // Suggest preferred times
            const preferredTimes = behavioralMemories.find(m => m.key === 'preferred_meeting_times');
            if (preferredTimes && currentIntent === 'CREATE_EVENT' && !currentEntities.time) {
                recommendations.suggestedTimes = preferredTimes.value;
            }
            
            // Suggest typical duration
            const typicalDuration = behavioralMemories.find(m => m.key === 'typical_meeting_duration');
            if (typicalDuration && currentIntent === 'CREATE_EVENT' && !currentEntities.duration) {
                recommendations.suggestedDurations = [typicalDuration.value];
            }
            
            // Get relationship memories
            const relationshipMemories = await this.getMemoriesByCategory(userId, this.MEMORY_CATEGORIES.RELATIONSHIPS);
            const frequentParticipants = relationshipMemories.find(m => m.key === 'frequent_meeting_participants');
            if (frequentParticipants && currentIntent === 'CREATE_EVENT' && (!currentEntities.participants || currentEntities.participants.length === 0)) {
                recommendations.suggestedParticipants = frequentParticipants.value.slice(0, 3); // Top 3
            }
            
            return recommendations;
            
        } catch (error) {
            this.logger.error('Error getting contextual recommendations:', error);
            return {};
        }
    }

    /**
     * Extract and store relevant context from conversation
     */
    async extractAndStoreContext(userId, message, intent, entities) {
        try {
            // Store names mentioned
            if (entities.participants) {
                for (const participant of entities.participants) {
                    await this.storeMemory(
                        userId,
                        `contact:${participant.toLowerCase()}`,
                        participant,
                        this.MEMORY_CATEGORIES.RELATIONSHIPS,
                        0.6
                    );
                }
            }
            
            // Store location preferences
            if (entities.location) {
                await this.storeMemory(
                    userId,
                    `location:${entities.location.toLowerCase()}`,
                    entities.location,
                    this.MEMORY_CATEGORIES.PREFERENCES,
                    0.5
                );
            }
            
            // Store time preferences
            if (entities.time) {
                const hour = parseInt(entities.time.split(':')[0]);
                const timeCategory = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
                
                const currentCount = await this.getMemory(userId, `time_preference:${timeCategory}`) || 0;
                await this.storeMemory(
                    userId,
                    `time_preference:${timeCategory}`,
                    currentCount + 1,
                    this.MEMORY_CATEGORIES.BEHAVIORAL,
                    0.7
                );
            }
            
            // Store event type patterns
            if (entities.title) {
                const eventType = this.categorizeEventType(entities.title);
                if (eventType) {
                    const currentCount = await this.getMemory(userId, `event_type:${eventType}`) || 0;
                    await this.storeMemory(
                        userId,
                        `event_type:${eventType}`,
                        currentCount + 1,
                        this.MEMORY_CATEGORIES.BEHAVIORAL,
                        0.6
                    );
                }
            }
            
        } catch (error) {
            this.logger.error('Error extracting context:', error);
        }
    }

    /**
     * Analyze scheduling patterns from user's event history
     */
    async analyzeSchedulingPatterns(userId) {
        try {
            const events = await this.database.getUserEvents(userId, 30); // Last 30 days
            
            const patterns = {
                preferredTimes: [],
                typicalDuration: null,
                frequentParticipants: []
            };
            
            if (events.length === 0) return patterns;
            
            // Analyze preferred times
            const timeFrequency = {};
            const durationFrequency = {};
            const participantFrequency = {};
            
            events.forEach(event => {
                // Time patterns
                if (event.event_time) {
                    const hour = parseInt(event.event_time.split(':')[0]);
                    timeFrequency[hour] = (timeFrequency[hour] || 0) + 1;
                }
                
                // Duration patterns
                if (event.duration) {
                    durationFrequency[event.duration] = (durationFrequency[event.duration] || 0) + 1;
                }
                
                // Participant patterns (if stored in description or title)
                const text = `${event.title} ${event.description || ''}`.toLowerCase();
                const names = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) || [];
                names.forEach(name => {
                    participantFrequency[name] = (participantFrequency[name] || 0) + 1;
                });
            });
            
            // Get top preferred times
            const sortedTimes = Object.entries(timeFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([hour]) => `${hour.padStart(2, '0')}:00`);
            
            patterns.preferredTimes = sortedTimes;
            
            // Get most common duration
            const mostCommonDuration = Object.entries(durationFrequency)
                .sort(([,a], [,b]) => b - a)[0];
            
            if (mostCommonDuration) {
                patterns.typicalDuration = parseInt(mostCommonDuration[0]);
            }
            
            // Get frequent participants
            patterns.frequentParticipants = Object.entries(participantFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([name]) => name);
            
            return patterns;
            
        } catch (error) {
            this.logger.error('Error analyzing scheduling patterns:', error);
            return { preferredTimes: [], typicalDuration: null, frequentParticipants: [] };
        }
    }

    /**
     * Analyze language patterns from conversation history
     */
    async analyzeLanguagePatterns(userId) {
        try {
            const conversations = await this.getConversationHistory(userId, null, 50);
            const patterns = {};
            
            conversations.forEach(conv => {
                // Extract common phrases and terms
                const words = conv.user_message.toLowerCase().split(/\s+/);
                words.forEach(word => {
                    if (word.length > 3 && !this.isCommonWord(word)) {
                        patterns[word] = (patterns[word] || 0) + 1;
                    }
                });
            });
            
            // Keep only frequently used terms
            Object.keys(patterns).forEach(word => {
                if (patterns[word] < 3) delete patterns[word];
            });
            
            return patterns;
            
        } catch (error) {
            this.logger.error('Error analyzing language patterns:', error);
            return {};
        }
    }

    /**
     * Calculate context score for conversation relevance
     */
    calculateContextScore(message, intent, entities) {
        let score = 1.0;
        
        // Higher score for specific intents
        if (intent !== 'UNKNOWN') score += 0.5;
        
        // Higher score for rich entities
        const entityCount = Object.keys(entities).length;
        score += entityCount * 0.2;
        
        // Higher score for longer, more detailed messages
        if (message.length > 50) score += 0.3;
        
        return Math.min(score, 5.0); // Cap at 5.0
    }

    /**
     * Categorize event type from title
     */
    categorizeEventType(title) {
        const lower = title.toLowerCase();
        
        if (lower.includes('meeting') || lower.includes('call') || lower.includes('conference')) {
            return 'meeting';
        }
        if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('coffee')) {
            return 'meal';
        }
        if (lower.includes('appointment') || lower.includes('visit')) {
            return 'appointment';
        }
        if (lower.includes('workout') || lower.includes('gym') || lower.includes('exercise')) {
            return 'fitness';
        }
        if (lower.includes('travel') || lower.includes('trip') || lower.includes('flight')) {
            return 'travel';
        }
        
        return 'general';
    }

    /**
     * Check if word is common/stop word
     */
    isCommonWord(word) {
        const commonWords = ['the', 'and', 'for', 'with', 'can', 'you', 'please', 'schedule', 'meeting', 'event'];
        return commonWords.includes(word);
    }

    /**
     * Update access statistics for memory optimization
     */
    async updateAccessStats(userId, key, newAccessCount) {
        try {
            await this.database.updateMemoryAccessStats(userId, key, newAccessCount, new Date());
        } catch (error) {
            this.logger.error('Error updating access stats:', error);
        }
    }

    /**
     * Clean up old and irrelevant memories
     */
    async cleanupMemories() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago
            
            // Remove old contextual memories with low relevance
            await this.database.deleteOldMemories(cutoffDate, this.MEMORY_CATEGORIES.CONTEXTUAL, 2.0);
            
            // Clear expired caches
            for (const [key, value] of this.userContextCache.entries()) {
                if (value.expires_at && value.expires_at < Date.now()) {
                    this.userContextCache.delete(key);
                }
            }
            
            this.logger.info('Memory cleanup completed');
            
        } catch (error) {
            this.logger.error('Error during memory cleanup:', error);
        }
    }

    /**
     * Start periodic cleanup process
     */
    startCleanup() {
        // Clean up every hour
        setInterval(() => {
            this.cleanupMemories();
        }, 60 * 60 * 1000);
        
        // Clean up caches every 15 minutes
        setInterval(() => {
            this.userContextCache.clear();
        }, 15 * 60 * 1000);
    }

    /**
     * Export user memories for backup/transfer
     */
    async exportUserMemories(userId) {
        try {
            const memories = await this.database.getAllUserMemories(userId);
            return {
                userId,
                exportDate: new Date(),
                memories: memories.map(memory => ({
                    key: memory.memory_key,
                    value: memory.memory_value,
                    category: memory.category,
                    relevance: memory.relevance_score,
                    createdAt: memory.created_at
                }))
            };
        } catch (error) {
            this.logger.error('Error exporting user memories:', error);
            return null;
        }
    }

    /**
     * Import user memories from backup
     */
    async importUserMemories(userId, memoriesData) {
        try {
            for (const memory of memoriesData.memories) {
                await this.storeMemory(
                    userId,
                    memory.key,
                    memory.value,
                    memory.category,
                    memory.relevance
                );
            }
            
            this.logger.info(`Imported ${memoriesData.memories.length} memories for user ${userId}`);
            return true;
            
        } catch (error) {
            this.logger.error('Error importing user memories:', error);
            return false;
        }
    }
}

module.exports = { MemoryService };