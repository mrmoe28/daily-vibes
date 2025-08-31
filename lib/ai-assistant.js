// AI Assistant Service for Natural Language Calendar Management
const { EncryptionService } = require('./encryption');
const { Logger } = require('./logger');

class AIAssistant {
    constructor(database, openaiApiKey = null) {
        this.database = database;
        this.logger = new Logger();
        this.encryption = new EncryptionService();
        this.apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
        
        // Intent patterns for natural language understanding
        this.intents = {
            CREATE_EVENT: {
                patterns: ['schedule', 'add', 'create', 'set up', 'book', 'plan', 'make', 'arrange'],
                entities: ['date', 'time', 'title', 'duration', 'description', 'participants']
            },
            MODIFY_EVENT: {
                patterns: ['change', 'move', 'reschedule', 'update', 'edit', 'modify', 'postpone'],
                entities: ['event_id', 'new_date', 'new_time', 'new_title']
            },
            DELETE_EVENT: {
                patterns: ['cancel', 'delete', 'remove', 'clear'],
                entities: ['event_id', 'date', 'title']
            },
            QUERY_SCHEDULE: {
                patterns: ['what', 'when', 'show', 'list', 'free', 'available', 'busy', 'have'],
                entities: ['date_range', 'category', 'time_period']
            },
            REMINDER: {
                patterns: ['remind', 'alert', 'notify'],
                entities: ['event_id', 'time_before', 'method']
            }
        };

        // Context memory for conversation continuity
        this.conversationContext = new Map();
        
        // User memory cache
        this.userMemoryCache = new Map();
    }

    /**
     * Process natural language input and return structured response
     */
    async processMessage(userId, message, sessionId = null) {
        try {
            // Load user context and memory
            const userContext = await this.getUserContext(userId);
            const conversationHistory = await this.getConversationHistory(userId, sessionId);
            
            // Detect intent from message
            const intent = this.detectIntent(message);
            
            // Extract entities from message
            const entities = await this.extractEntities(message, intent);
            
            // Generate appropriate response based on intent
            const response = await this.generateResponse(intent, entities, userContext);
            
            // Store conversation in history
            await this.storeConversation(userId, message, response, intent, entities);
            
            // Update user context if needed
            await this.updateUserContext(userId, entities);
            
            return {
                success: true,
                intent: intent,
                entities: entities,
                response: response.text,
                action: response.action,
                data: response.data
            };
            
        } catch (error) {
            this.logger.error('Error processing AI message:', error);
            return {
                success: false,
                error: 'I had trouble understanding that. Could you rephrase it?',
                originalMessage: message
            };
        }
    }

    /**
     * Detect the user's intent from their message
     */
    detectIntent(message) {
        const lowerMessage = message.toLowerCase();
        let highestScore = 0;
        let detectedIntent = 'UNKNOWN';
        
        for (const [intentName, intentData] of Object.entries(this.intents)) {
            let score = 0;
            for (const pattern of intentData.patterns) {
                if (lowerMessage.includes(pattern)) {
                    score += 1;
                }
            }
            
            if (score > highestScore) {
                highestScore = score;
                detectedIntent = intentName;
            }
        }
        
        // If no clear intent, try to infer from question words
        if (detectedIntent === 'UNKNOWN') {
            if (lowerMessage.startsWith('what') || lowerMessage.startsWith('when') || 
                lowerMessage.includes('show') || lowerMessage.includes('list')) {
                detectedIntent = 'QUERY_SCHEDULE';
            }
        }
        
        return detectedIntent;
    }

    /**
     * Extract entities (dates, times, titles, etc.) from the message
     */
    async extractEntities(message, intent) {
        const entities = {};
        
        // Extract date and time using various patterns
        const dateTime = this.extractDateTime(message);
        if (dateTime.date) entities.date = dateTime.date;
        if (dateTime.time) entities.time = dateTime.time;
        if (dateTime.duration) entities.duration = dateTime.duration;
        
        // Extract event title/description
        const title = this.extractTitle(message, intent);
        if (title) entities.title = title;
        
        // Extract participants (people mentioned)
        const participants = this.extractParticipants(message);
        if (participants.length > 0) entities.participants = participants;
        
        // Extract location if mentioned
        const location = this.extractLocation(message);
        if (location) entities.location = location;
        
        return entities;
    }

    /**
     * Extract date and time from natural language
     */
    extractDateTime(message) {
        const result = { date: null, time: null, duration: null };
        const lower = message.toLowerCase();
        
        // Common date patterns
        const today = new Date();
        
        // Tomorrow
        if (lower.includes('tomorrow')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            result.date = tomorrow.toISOString().split('T')[0];
        }
        // Today
        else if (lower.includes('today')) {
            result.date = today.toISOString().split('T')[0];
        }
        // Next week
        else if (lower.includes('next week')) {
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            result.date = nextWeek.toISOString().split('T')[0];
        }
        // Next Monday, Tuesday, etc.
        else {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            for (let i = 0; i < days.length; i++) {
                if (lower.includes('next ' + days[i])) {
                    const daysUntil = (i - today.getDay() + 7) % 7 || 7;
                    const targetDate = new Date(today);
                    targetDate.setDate(targetDate.getDate() + daysUntil);
                    result.date = targetDate.toISOString().split('T')[0];
                    break;
                }
            }
        }
        
        // Time patterns
        const timeRegex = /(\d{1,2})\s*(:|\.)?(\d{2})?\s*(am|pm|AM|PM)?/g;
        const timeMatch = timeRegex.exec(message);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
            const period = timeMatch[4]?.toLowerCase();
            
            if (period === 'pm' && hours < 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
            
            result.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        // Common time expressions
        if (lower.includes('noon')) result.time = '12:00';
        if (lower.includes('midnight')) result.time = '00:00';
        if (lower.includes('morning') && !result.time) result.time = '09:00';
        if (lower.includes('afternoon') && !result.time) result.time = '14:00';
        if (lower.includes('evening') && !result.time) result.time = '18:00';
        
        // Duration patterns
        const durationRegex = /(\d+)\s*(hour|hr|minute|min)/gi;
        const durationMatch = durationRegex.exec(message);
        if (durationMatch) {
            const value = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            if (unit.includes('hour')) {
                result.duration = value * 60; // Convert to minutes
            } else {
                result.duration = value;
            }
        }
        
        return result;
    }

    /**
     * Extract event title from the message
     */
    extractTitle(message, intent) {
        // Remove common intent words to isolate the title
        let title = message;
        
        // Remove time-related phrases
        title = title.replace(/tomorrow|today|next week|next \w+day/gi, '');
        title = title.replace(/at \d+:?\d*\s*(am|pm)?/gi, '');
        title = title.replace(/\d+\s*(hour|hr|minute|min)s?/gi, '');
        
        // Remove intent keywords
        const intentKeywords = this.intents[intent]?.patterns || [];
        for (const keyword of intentKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            title = title.replace(regex, '');
        }
        
        // Clean up extra spaces and common words
        title = title.replace(/\s+/g, ' ').trim();
        title = title.replace(/^(a|an|the|my|for|with)\s+/i, '');
        
        // Capitalize first letter
        if (title) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        
        return title || 'New Event';
    }

    /**
     * Extract participants from the message
     */
    extractParticipants(message) {
        const participants = [];
        
        // Look for "with" followed by names
        const withRegex = /with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
        let match;
        while ((match = withRegex.exec(message)) !== null) {
            participants.push(match[1]);
        }
        
        // Look for email addresses
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        while ((match = emailRegex.exec(message)) !== null) {
            participants.push(match[0]);
        }
        
        return participants;
    }

    /**
     * Extract location from the message
     */
    extractLocation(message) {
        // Look for "at" or "in" followed by a location
        const locationRegex = /(?:at|in)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:at|on|for|with)|$)/;
        const match = locationRegex.exec(message);
        
        if (match) {
            // Filter out time-related words that might be caught
            const location = match[1].trim();
            if (!location.match(/\d+:?\d*\s*(am|pm)?/i)) {
                return location;
            }
        }
        
        return null;
    }

    /**
     * Generate appropriate response based on intent and entities
     */
    async generateResponse(intent, entities, userContext) {
        switch (intent) {
            case 'CREATE_EVENT':
                return this.generateCreateEventResponse(entities, userContext);
                
            case 'QUERY_SCHEDULE':
                return this.generateQueryResponse(entities, userContext);
                
            case 'MODIFY_EVENT':
                return this.generateModifyResponse(entities, userContext);
                
            case 'DELETE_EVENT':
                return this.generateDeleteResponse(entities, userContext);
                
            case 'REMINDER':
                return this.generateReminderResponse(entities, userContext);
                
            default:
                return {
                    text: "I'm not sure what you'd like me to do. You can ask me to schedule events, show your calendar, or modify existing events.",
                    action: null,
                    data: null
                };
        }
    }

    /**
     * Generate response for creating an event
     */
    generateCreateEventResponse(entities, userContext) {
        // Validate required entities
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
        
        // Build confirmation message
        const eventDate = new Date(entities.date + 'T' + entities.time);
        const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        let confirmMsg = `I'll schedule "${entities.title}" for ${dateStr} at ${timeStr}`;
        
        if (entities.duration) {
            confirmMsg += ` (${entities.duration} minutes)`;
        }
        
        if (entities.participants && entities.participants.length > 0) {
            confirmMsg += ` with ${entities.participants.join(', ')}`;
        }
        
        if (entities.location) {
            confirmMsg += ` at ${entities.location}`;
        }
        
        confirmMsg += '. Is this correct?';
        
        return {
            text: confirmMsg,
            action: 'CONFIRM_CREATE_EVENT',
            data: entities
        };
    }

    /**
     * Generate response for querying schedule
     */
    async generateQueryResponse(entities, userContext) {
        const userId = userContext.userId;
        
        // Determine date range for query
        let startDate, endDate;
        
        if (entities.date) {
            startDate = entities.date;
            endDate = entities.date;
        } else {
            // Default to today
            startDate = new Date().toISOString().split('T')[0];
            endDate = startDate;
        }
        
        // Query events from database
        const events = await this.database.getEventsByDateRange(userId, startDate, endDate);
        
        if (events.length === 0) {
            return {
                text: `You have no events scheduled for ${startDate === endDate ? 'that day' : 'that period'}.`,
                action: 'SHOW_EMPTY_SCHEDULE',
                data: { startDate, endDate }
            };
        }
        
        // Format events list
        let responseText = `Here are your events:\n\n`;
        for (const event of events) {
            const eventTime = new Date(event.event_date + 'T' + event.event_time);
            responseText += `• ${event.title} at ${eventTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}\n`;
        }
        
        return {
            text: responseText,
            action: 'SHOW_SCHEDULE',
            data: { events, startDate, endDate }
        };
    }

    /**
     * Generate response for modifying an event
     */
    generateModifyResponse(entities, userContext) {
        if (!entities.event_id && !entities.title) {
            return {
                text: "Which event would you like to modify?",
                action: 'REQUEST_EVENT_SELECTION',
                data: entities
            };
        }
        
        return {
            text: "I'll help you modify that event. What changes would you like to make?",
            action: 'MODIFY_EVENT',
            data: entities
        };
    }

    /**
     * Generate response for deleting an event
     */
    generateDeleteResponse(entities, userContext) {
        if (!entities.event_id && !entities.title) {
            return {
                text: "Which event would you like to cancel?",
                action: 'REQUEST_EVENT_SELECTION',
                data: entities
            };
        }
        
        return {
            text: `Are you sure you want to cancel "${entities.title || 'this event'}"?`,
            action: 'CONFIRM_DELETE_EVENT',
            data: entities
        };
    }

    /**
     * Generate response for setting reminders
     */
    generateReminderResponse(entities, userContext) {
        const timeBefore = entities.time_before || '15 minutes';
        
        return {
            text: `I'll set a reminder ${timeBefore} before the event.`,
            action: 'SET_REMINDER',
            data: entities
        };
    }

    /**
     * Get user context and preferences
     */
    async getUserContext(userId) {
        // Check cache first
        if (this.userMemoryCache.has(userId)) {
            return this.userMemoryCache.get(userId);
        }
        
        try {
            const context = await this.database.getUserContext(userId);
            
            // Cache for 5 minutes
            this.userMemoryCache.set(userId, context);
            setTimeout(() => this.userMemoryCache.delete(userId), 5 * 60 * 1000);
            
            return context;
        } catch (error) {
            this.logger.error('Error fetching user context:', error);
            return { userId, preferences: {} };
        }
    }

    /**
     * Get conversation history for context
     */
    async getConversationHistory(userId, sessionId) {
        try {
            const history = await this.database.getConversationHistory(userId, sessionId, 10);
            return history || [];
        } catch (error) {
            this.logger.error('Error fetching conversation history:', error);
            return [];
        }
    }

    /**
     * Store conversation in database
     */
    async storeConversation(userId, message, response, intent, entities) {
        try {
            await this.database.storeConversation({
                user_id: userId,
                message: message,
                response: response.text,
                intent: intent,
                entities: JSON.stringify(entities),
                created_at: new Date()
            });
        } catch (error) {
            this.logger.error('Error storing conversation:', error);
        }
    }

    /**
     * Update user context based on conversation
     */
    async updateUserContext(userId, entities) {
        try {
            // Update user preferences based on patterns
            if (entities.time) {
                await this.database.updateUserPreference(userId, 'preferred_meeting_time', entities.time);
            }
            
            if (entities.duration) {
                await this.database.updateUserPreference(userId, 'typical_meeting_duration', entities.duration);
            }
            
            // Clear cache to force refresh
            this.userMemoryCache.delete(userId);
            
        } catch (error) {
            this.logger.error('Error updating user context:', error);
        }
    }

    /**
     * Clear conversation context for a user
     */
    clearContext(userId, sessionId = null) {
        const key = sessionId ? `${userId}-${sessionId}` : userId;
        this.conversationContext.delete(key);
    }

    /**
     * Train the assistant with user feedback
     */
    async trainWithFeedback(userId, messageId, feedback) {
        try {
            await this.database.storeFeedback({
                user_id: userId,
                message_id: messageId,
                feedback: feedback,
                created_at: new Date()
            });
            
            // Use feedback to improve future responses
            if (feedback === 'negative') {
                // Log for manual review
                this.logger.info(`Negative feedback received for message ${messageId}`);
            }
            
        } catch (error) {
            this.logger.error('Error storing feedback:', error);
        }
    }
}

module.exports = { AIAssistant };