// Advanced Natural Language Parser for Calendar Events
const { Logger } = require('./logger');

class NLPParser {
    constructor() {
        this.logger = new Logger();
        
        // Time expressions and patterns
        this.timePatterns = {
            // Absolute times
            ABSOLUTE_TIME: [
                /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/g,  // 3:30 PM
                /(\d{1,2})\s*(am|pm|AM|PM)/g,           // 3 PM
                /(\d{1,2})\.(\d{2})/g,                  // 15.30
                /(\d{1,2}):(\d{2})/g                    // 15:30
            ],
            
            // Relative times
            RELATIVE_TIME: [
                /in\s+(\d+)\s+(hour|hr|minute|min)s?/gi,
                /(\d+)\s+(hour|hr|minute|min)s?\s+from\s+now/gi,
                /(next|this)\s+(morning|afternoon|evening|night)/gi,
                /(early|late)\s+(morning|afternoon|evening)/gi
            ],
            
            // Named times
            NAMED_TIME: {
                'noon': '12:00',
                'midnight': '00:00',
                'morning': '09:00',
                'afternoon': '14:00', 
                'evening': '18:00',
                'night': '20:00',
                'breakfast': '08:00',
                'lunch': '12:00',
                'dinner': '18:00',
                'lunchtime': '12:00',
                'dinnertime': '18:00'
            }
        };
        
        // Date expressions
        this.datePatterns = {
            RELATIVE_DAYS: {
                'today': 0,
                'tomorrow': 1,
                'yesterday': -1,
                'day after tomorrow': 2,
                'next week': 7,
                'next month': 30
            },
            
            WEEKDAYS: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            
            MONTHS: [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ],
            
            DATE_FORMATS: [
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
                /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
                /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
                /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/ // Month DD, YYYY
            ]
        };
        
        // Duration patterns
        this.durationPatterns = [
            /(\d+)\s*(hour|hr)s?\s*(?:and\s*)?(\d+)?\s*(minute|min)s?/gi,
            /(\d+)\s*(hour|hr)s?/gi,
            /(\d+)\s*(minute|min)s?/gi,
            /(?:for\s+)?(\d+)\s*h(?:our)?s?/gi,
            /(half|quarter)\s*(hour|hr)/gi,
            /(all\s+day|full\s+day)/gi
        ];
        
        // Intent keywords
        this.intentKeywords = {
            CREATE: [
                'schedule', 'add', 'create', 'set up', 'book', 'plan', 'make', 'arrange', 
                'put', 'place', 'insert', 'new', 'meeting', 'appointment', 'event'
            ],
            MODIFY: [
                'change', 'move', 'reschedule', 'update', 'edit', 'modify', 'shift', 
                'postpone', 'delay', 'advance', 'push', 'pull', 'adjust'
            ],
            DELETE: [
                'cancel', 'delete', 'remove', 'clear', 'drop', 'eliminate', 'scratch'
            ],
            QUERY: [
                'what', 'when', 'show', 'list', 'tell', 'find', 'search', 'display',
                'free', 'available', 'busy', 'have', 'check', 'look', 'see'
            ]
        };
        
        // Common event types and their patterns
        this.eventTypes = {
            MEETING: ['meeting', 'call', 'conference', 'session', 'discussion', 'standup', 'sync'],
            MEAL: ['lunch', 'dinner', 'breakfast', 'coffee', 'drink', 'meal'],
            APPOINTMENT: ['appointment', 'visit', 'checkup', 'consultation'],
            PERSONAL: ['workout', 'gym', 'exercise', 'run', 'yoga', 'personal', 'break'],
            TRAVEL: ['flight', 'travel', 'trip', 'vacation', 'drive'],
            WORK: ['work', 'project', 'deadline', 'presentation', 'review'],
            SOCIAL: ['party', 'celebration', 'birthday', 'wedding', 'date', 'hangout']
        };
        
        // Location indicators
        this.locationIndicators = ['at', 'in', 'on', 'from', 'to', 'via'];
        
        // Participant indicators
        this.participantIndicators = ['with', 'and', 'including', 'plus'];
    }

    /**
     * Parse natural language input and extract structured information
     */
    parse(input) {
        const result = {
            intent: this.extractIntent(input),
            entities: this.extractEntities(input),
            confidence: 0,
            rawInput: input
        };
        
        result.confidence = this.calculateConfidence(result);
        
        // Clean and validate extracted data
        result.entities = this.validateAndCleanEntities(result.entities);
        
        return result;
    }

    /**
     * Extract intent from the input
     */
    extractIntent(input) {
        const lower = input.toLowerCase();
        let intentScores = {};
        
        // Score each intent based on keyword matches
        for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
            let score = 0;
            keywords.forEach(keyword => {
                // Exact word match
                if (lower.includes(' ' + keyword + ' ') || lower.startsWith(keyword + ' ') || lower.endsWith(' ' + keyword)) {
                    score += 2;
                }
                // Partial match
                else if (lower.includes(keyword)) {
                    score += 1;
                }
            });
            intentScores[intent] = score;
        }
        
        // Find highest scoring intent
        let maxScore = 0;
        let detectedIntent = 'CREATE'; // Default intent
        
        for (const [intent, score] of Object.entries(intentScores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedIntent = intent;
            }
        }
        
        // Special cases for question words
        if (lower.match(/^(what|when|where|who|how|which)/)) {
            detectedIntent = 'QUERY';
        }
        
        // If no clear intent and contains time/date, assume CREATE
        if (maxScore === 0 && (this.extractDateTime(input).date || this.extractDateTime(input).time)) {
            detectedIntent = 'CREATE';
        }
        
        return detectedIntent;
    }

    /**
     * Extract entities from input
     */
    extractEntities(input) {
        const entities = {};
        
        // Extract date and time
        const dateTime = this.extractDateTime(input);
        if (dateTime.date) entities.date = dateTime.date;
        if (dateTime.time) entities.time = dateTime.time;
        if (dateTime.endTime) entities.endTime = dateTime.endTime;
        
        // Extract duration
        const duration = this.extractDuration(input);
        if (duration) entities.duration = duration;
        
        // Extract title/subject
        const title = this.extractTitle(input);
        if (title) entities.title = title;
        
        // Extract participants
        const participants = this.extractParticipants(input);
        if (participants.length > 0) entities.participants = participants;
        
        // Extract location
        const location = this.extractLocation(input);
        if (location) entities.location = location;
        
        // Extract event type
        const eventType = this.extractEventType(input);
        if (eventType) entities.eventType = eventType;
        
        // Extract priority
        const priority = this.extractPriority(input);
        if (priority) entities.priority = priority;
        
        // Extract recurrence
        const recurrence = this.extractRecurrence(input);
        if (recurrence) entities.recurrence = recurrence;
        
        return entities;
    }

    /**
     * Extract date and time information
     */
    extractDateTime(input) {
        const result = { date: null, time: null, endTime: null };
        const lower = input.toLowerCase();
        
        // Extract date
        result.date = this.extractDate(input);
        
        // Extract time
        const timeResult = this.extractTime(input);
        result.time = timeResult.startTime;
        result.endTime = timeResult.endTime;
        
        return result;
    }

    /**
     * Extract date from input
     */
    extractDate(input) {
        const lower = input.toLowerCase();
        const today = new Date();
        
        // Check for relative day expressions
        for (const [phrase, daysOffset] of Object.entries(this.datePatterns.RELATIVE_DAYS)) {
            if (lower.includes(phrase)) {
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysOffset);
                return targetDate.toISOString().split('T')[0];
            }
        }
        
        // Check for next [weekday]
        const nextWeekdayMatch = lower.match(/next\s+(\w+day)/);
        if (nextWeekdayMatch) {
            const targetWeekday = nextWeekdayMatch[1];
            const dayIndex = this.datePatterns.WEEKDAYS.indexOf(targetWeekday);
            if (dayIndex !== -1) {
                const daysUntil = (dayIndex - today.getDay() + 7) % 7 || 7;
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysUntil);
                return targetDate.toISOString().split('T')[0];
            }
        }
        
        // Check for this [weekday]
        const thisWeekdayMatch = lower.match(/this\s+(\w+day)/);
        if (thisWeekdayMatch) {
            const targetWeekday = thisWeekdayMatch[1];
            const dayIndex = this.datePatterns.WEEKDAYS.indexOf(targetWeekday);
            if (dayIndex !== -1) {
                let daysUntil = dayIndex - today.getDay();
                if (daysUntil <= 0) daysUntil += 7; // Next week if already passed
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysUntil);
                return targetDate.toISOString().split('T')[0];
            }
        }
        
        // Check for just weekday names (Monday, Tuesday, etc.)
        for (let i = 0; i < this.datePatterns.WEEKDAYS.length; i++) {
            const dayName = this.datePatterns.WEEKDAYS[i];
            if (lower.includes(dayName)) {
                let daysUntil = i - today.getDay();
                if (daysUntil <= 0) daysUntil += 7; // Next week if already passed or today
                const targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + daysUntil);
                return targetDate.toISOString().split('T')[0];
            }
        }
        
        // Check for explicit date formats
        for (const pattern of this.datePatterns.DATE_FORMATS) {
            const match = input.match(pattern);
            if (match) {
                return this.parseExplicitDate(match);
            }
        }
        
        // Check for month and day
        const monthDayMatch = lower.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
        if (monthDayMatch) {
            const monthName = monthDayMatch[1];
            const day = parseInt(monthDayMatch[2]);
            const monthIndex = this.datePatterns.MONTHS.indexOf(monthName);
            
            if (monthIndex !== -1 && day >= 1 && day <= 31) {
                const year = today.getFullYear();
                const targetDate = new Date(year, monthIndex, day);
                
                // If the date has passed this year, assume next year
                if (targetDate < today) {
                    targetDate.setFullYear(year + 1);
                }
                
                return targetDate.toISOString().split('T')[0];
            }
        }
        
        return null;
    }

    /**
     * Extract time from input
     */
    extractTime(input) {
        const result = { startTime: null, endTime: null };
        
        // Check for named times first
        const lower = input.toLowerCase();
        for (const [name, time] of Object.entries(this.timePatterns.NAMED_TIME)) {
            if (lower.includes(name)) {
                result.startTime = time;
                break;
            }
        }
        
        // Check for simple time patterns like "1pm", "2am"
        if (!result.startTime) {
            const simpleTimeMatch = input.match(/\b(\d{1,2})\s*(am|pm|AM|PM)\b/);
            if (simpleTimeMatch) {
                let hours = parseInt(simpleTimeMatch[1]);
                const period = simpleTimeMatch[2].toLowerCase();
                
                if (period === 'pm' && hours < 12) hours += 12;
                if (period === 'am' && hours === 12) hours = 0;
                
                result.startTime = `${hours.toString().padStart(2, '0')}:00`;
            }
        }
        
        // Check for absolute time patterns
        if (!result.startTime) {
            for (const pattern of this.timePatterns.ABSOLUTE_TIME) {
                pattern.lastIndex = 0; // Reset regex state
                let match;
                while ((match = pattern.exec(input)) !== null) {
                    const timeStr = this.parseTimeMatch(match);
                    if (timeStr) {
                        result.startTime = timeStr;
                        break;
                    }
                }
                if (result.startTime) break;
            }
        }
        
        // Look for time ranges (e.g., "from 2pm to 4pm", "2-4pm")
        const rangePatterns = [
            /from\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\s+to\s+(\d{1,2}):?(\d{2})?\s*(am|pm)/gi,
            /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/gi
        ];
        
        for (const pattern of rangePatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(input);
            if (match) {
                result.startTime = this.parseTimeMatch([match[0], match[1], match[2], match[3]]);
                result.endTime = this.parseTimeMatch([match[0], match[4], match[5], match[6]]);
                break;
            }
        }
        
        // Handle relative times
        if (!result.startTime) {
            for (const pattern of this.timePatterns.RELATIVE_TIME) {
                pattern.lastIndex = 0;
                const match = pattern.exec(input);
                if (match) {
                    result.startTime = this.parseRelativeTime(match);
                    break;
                }
            }
        }
        
        return result;
    }

    /**
     * Parse time match into HH:MM format
     */
    parseTimeMatch(match) {
        if (!match) return null;
        
        // Handle different match patterns
        let hours, minutes, period;
        
        if (match.length >= 4) {
            hours = parseInt(match[1]);
            minutes = match[2] ? parseInt(match[2]) : 0;
            period = match[3] ? match[3].toLowerCase() : null;
        } else if (match.length >= 2) {
            // Try to parse the full match string
            const timeStr = match[0];
            const timeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
            const timeMatch = timeRegex.exec(timeStr);
            if (timeMatch) {
                hours = parseInt(timeMatch[1]);
                minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
            } else {
                return null;
            }
        } else {
            return null;
        }
        
        // Convert 12-hour to 24-hour format
        if (period) {
            if (period === 'pm' && hours < 12) {
                hours += 12;
            } else if (period === 'am' && hours === 12) {
                hours = 0;
            }
        }
        
        // Validate time
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        return null;
    }

    /**
     * Parse relative time expressions
     */
    parseRelativeTime(match) {
        const now = new Date();
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        if (unit.includes('hour')) {
            now.setHours(now.getHours() + value);
        } else if (unit.includes('minute')) {
            now.setMinutes(now.getMinutes() + value);
        }
        
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    /**
     * Extract duration from input
     */
    extractDuration(input) {
        const lower = input.toLowerCase();
        
        // Handle special cases
        if (lower.includes('all day') || lower.includes('full day')) {
            return 480; // 8 hours in minutes
        }
        
        if (lower.includes('half hour') || lower.includes('30 minutes')) {
            return 30;
        }
        
        if (lower.includes('quarter hour') || lower.includes('15 minutes')) {
            return 15;
        }
        
        // Parse duration patterns
        for (const pattern of this.durationPatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(input);
            if (match) {
                return this.parseDurationMatch(match);
            }
        }
        
        return null;
    }

    /**
     * Parse duration match into minutes
     */
    parseDurationMatch(match) {
        const value1 = parseInt(match[1]);
        const unit1 = match[2] ? match[2].toLowerCase() : '';
        const value2 = match[3] ? parseInt(match[3]) : 0;
        const unit2 = match[4] ? match[4].toLowerCase() : '';
        
        let totalMinutes = 0;
        
        // First value
        if (unit1.includes('hour')) {
            totalMinutes += value1 * 60;
        } else if (unit1.includes('minute')) {
            totalMinutes += value1;
        }
        
        // Second value (for "2 hours 30 minutes" format)
        if (value2 > 0) {
            if (unit2.includes('minute')) {
                totalMinutes += value2;
            }
        }
        
        return totalMinutes > 0 ? totalMinutes : null;
    }

    /**
     * Extract title from input
     */
    extractTitle(input) {
        let title = input;
        
        // Remove time expressions
        title = title.replace(/\b(at|from|to|until|@)\s+\d{1,2}:?\d*\s*(am|pm)?/gi, '');
        title = title.replace(/\b\d{1,2}:?\d*\s*(am|pm)/gi, '');
        
        // Remove date expressions
        title = title.replace(/\b(today|tomorrow|yesterday|next\s+\w+|this\s+\w+)\b/gi, '');
        title = title.replace(/\b\w+day\b/gi, '');
        title = title.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '');
        
        // Remove duration expressions
        title = title.replace(/\b\d+\s+(hour|hr|minute|min)s?\b/gi, '');
        title = title.replace(/\b(for|lasting|duration)\s+\d+\s+(hour|hr|minute|min)s?\b/gi, '');
        
        // Remove location expressions
        title = title.replace(/\b(at|in|on)\s+[A-Z][A-Za-z\s]+/gi, '');
        
        // Remove participant expressions
        title = title.replace(/\b(with|and)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\b/gi, '');
        
        // Remove intent keywords
        const allIntentKeywords = Object.values(this.intentKeywords).flat();
        allIntentKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            title = title.replace(regex, '');
        });
        
        // Clean up and format
        title = title.replace(/\s+/g, ' ').trim();
        title = title.replace(/^(a|an|the)\s+/i, '');
        
        // Remove leading/trailing punctuation
        title = title.replace(/^[^\w]+|[^\w]+$/g, '');
        
        // Capitalize first letter
        if (title && title.length > 0) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        
        // If title is too short or empty, try to infer from event type
        if (!title || title.length < 2) {
            const eventType = this.extractEventType(input);
            if (eventType) {
                title = eventType.charAt(0).toUpperCase() + eventType.slice(1);
            } else {
                title = 'New Event';
            }
        }
        
        return title;
    }

    /**
     * Extract participants from input
     */
    extractParticipants(input) {
        const participants = [];
        
        // Look for "with" pattern
        const withPattern = /\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)/gi;
        let match;
        while ((match = withPattern.exec(input)) !== null) {
            const names = match[1].split(/\s+and\s+/);
            names.forEach(name => {
                name = name.trim();
                if (name && !participants.includes(name)) {
                    participants.push(name);
                }
            });
        }
        
        // Look for email addresses
        const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
        while ((match = emailPattern.exec(input)) !== null) {
            if (!participants.includes(match[0])) {
                participants.push(match[0]);
            }
        }
        
        return participants;
    }

    /**
     * Extract location from input
     */
    extractLocation(input) {
        // Look for location indicators followed by location names
        for (const indicator of this.locationIndicators) {
            const pattern = new RegExp(`\\b${indicator}\\s+([A-Z][A-Za-z0-9\\s,.-]+?)(?:\\s+(at|on|with|for|from|to)|$)`, 'g');
            const match = pattern.exec(input);
            
            if (match) {
                const location = match[1].trim();
                // Filter out time expressions that might be caught
                if (!location.match(/\d+:?\d*\s*(am|pm)?/i) && location.length > 2) {
                    return location;
                }
            }
        }
        
        return null;
    }

    /**
     * Extract event type from input
     */
    extractEventType(input) {
        const lower = input.toLowerCase();
        
        for (const [type, keywords] of Object.entries(this.eventTypes)) {
            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    return type.toLowerCase();
                }
            }
        }
        
        return null;
    }

    /**
     * Extract priority from input
     */
    extractPriority(input) {
        const lower = input.toLowerCase();
        
        if (lower.includes('urgent') || lower.includes('asap') || lower.includes('high priority') || lower.includes('important')) {
            return 'high';
        }
        
        if (lower.includes('low priority') || lower.includes('optional') || lower.includes('if possible')) {
            return 'low';
        }
        
        return 'medium'; // default
    }

    /**
     * Extract recurrence pattern from input
     */
    extractRecurrence(input) {
        const lower = input.toLowerCase();
        
        if (lower.includes('daily') || lower.includes('every day')) {
            return { type: 'daily', interval: 1 };
        }
        
        if (lower.includes('weekly') || lower.includes('every week')) {
            return { type: 'weekly', interval: 1 };
        }
        
        if (lower.includes('monthly') || lower.includes('every month')) {
            return { type: 'monthly', interval: 1 };
        }
        
        if (lower.includes('yearly') || lower.includes('annually') || lower.includes('every year')) {
            return { type: 'yearly', interval: 1 };
        }
        
        // Check for "every X days/weeks/months"
        const intervalMatch = lower.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
        if (intervalMatch) {
            const interval = parseInt(intervalMatch[1]);
            const unit = intervalMatch[2];
            return { type: unit + 'ly', interval };
        }
        
        return null;
    }

    /**
     * Parse explicit date match
     */
    parseExplicitDate(match) {
        // Handle different date formats
        if (match[0].includes('/')) {
            // MM/DD/YYYY or DD/MM/YYYY
            const parts = match[0].split('/');
            if (parts.length === 3) {
                const year = parseInt(parts[2]);
                const month = parseInt(parts[0]) - 1; // JS months are 0-based
                const day = parseInt(parts[1]);
                return new Date(year, month, day).toISOString().split('T')[0];
            }
        } else if (match[0].includes('-')) {
            // YYYY-MM-DD
            return match[0];
        } else if (match[1] && this.datePatterns.MONTHS.includes(match[1].toLowerCase())) {
            // Month DD, YYYY
            const monthName = match[1].toLowerCase();
            const day = parseInt(match[2]);
            const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
            const monthIndex = this.datePatterns.MONTHS.indexOf(monthName);
            
            return new Date(year, monthIndex, day).toISOString().split('T')[0];
        }
        
        return null;
    }

    /**
     * Validate and clean extracted entities
     */
    validateAndCleanEntities(entities) {
        const cleaned = { ...entities };
        
        // Validate date
        if (cleaned.date) {
            const date = new Date(cleaned.date);
            if (isNaN(date.getTime())) {
                delete cleaned.date;
            }
        }
        
        // Validate time
        if (cleaned.time) {
            const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
            if (!timePattern.test(cleaned.time)) {
                delete cleaned.time;
            }
        }
        
        // Validate duration (must be positive number)
        if (cleaned.duration !== undefined && (cleaned.duration <= 0 || isNaN(cleaned.duration))) {
            delete cleaned.duration;
        }
        
        // Clean title
        if (cleaned.title) {
            cleaned.title = cleaned.title.trim();
            if (cleaned.title.length === 0) {
                cleaned.title = 'New Event';
            }
        }
        
        // Validate participants
        if (cleaned.participants) {
            cleaned.participants = cleaned.participants.filter(p => p && p.trim().length > 0);
            if (cleaned.participants.length === 0) {
                delete cleaned.participants;
            }
        }
        
        return cleaned;
    }

    /**
     * Calculate confidence score for the parsing result
     */
    calculateConfidence(result) {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for recognized intent
        if (result.intent !== 'UNKNOWN') {
            confidence += 0.2;
        }
        
        // Boost confidence for each extracted entity
        const entityCount = Object.keys(result.entities).length;
        confidence += entityCount * 0.1;
        
        // Boost confidence for critical entities
        if (result.entities.date) confidence += 0.1;
        if (result.entities.time) confidence += 0.1;
        if (result.entities.title && result.entities.title !== 'New Event') confidence += 0.1;
        
        // Cap confidence at 1.0
        return Math.min(confidence, 1.0);
    }
}

module.exports = { NLPParser };