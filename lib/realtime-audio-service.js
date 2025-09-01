// Real-time Audio Service for OpenAI Realtime API integration
const WebSocket = require('ws');
const OpenAI = require('openai');
const { Logger } = require('./logger');

class RealtimeAudioService {
    constructor(openaiApiKey = null) {
        this.apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
        this.logger = new Logger();
        this.connections = new Map(); // Track client connections
        this.openaiConnections = new Map(); // Track OpenAI connections
        this.activeResponses = new Map(); // Track active OpenAI responses
        this.reconnectAttempts = new Map(); // Track reconnection attempts
        this.connectionRateLimit = new Map(); // Track connection attempts per IP/user
        this.connectionLocks = new Map(); // Prevent concurrent connections per client
        this.sessionTimers = new Map(); // Track session renewal timers
        this.sessionStartTimes = new Map(); // Track when sessions started
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxConnectionsPerMinute = 10; // Rate limit per client
        this.sessionDurationLimit = 55 * 60 * 1000; // 55 minutes in ms (before OpenAI 60min limit)
        this.sessionRenewalWarning = 50 * 60 * 1000; // 50 minutes - warn user
    }

    /**
     * Initialize WebSocket server
     */
    createWebSocketServer(server) {
        console.log('Creating WebSocket server on path: /api/realtime-audio');
        
        const wss = new WebSocket.Server({ 
            server,
            path: '/api/realtime-audio'
        });

        console.log('WebSocket server created, waiting for connections...');

        wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const userId = this.extractUserId(req);
            const clientIp = req.socket.remoteAddress;
            const rateLimitKey = userId !== 'anonymous' ? `user_${userId}` : `ip_${clientIp}`;
            
            // Check rate limiting
            if (!this.checkRateLimit(rateLimitKey)) {
                this.logger.warn(`Rate limit exceeded for ${rateLimitKey}`);
                ws.close(1008, 'Rate limit exceeded');
                return;
            }
            
            this.logger.info(`New audio client connected: ${clientId} (${rateLimitKey})`);
            
            // Store client connection
            this.connections.set(clientId, {
                ws,
                isActive: true,
                startTime: Date.now(),
                userId: userId,
                rateLimitKey: rateLimitKey
            });

            // Set up client message handlers
            this.setupClientHandlers(ws, clientId);

            // Clean up on disconnect
            ws.on('close', () => {
                this.logger.info(`Audio client disconnected: ${clientId}`);
                this.cleanupConnection(clientId);
            });

            ws.on('error', (error) => {
                this.logger.error(`WebSocket error for ${clientId}:`, error);
                this.cleanupConnection(clientId);
            });
        });

        wss.on('error', (error) => {
            console.error('WebSocket Server Error:', error);
            this.logger.error('WebSocket Server Error:', error);
        });

        wss.on('listening', () => {
            console.log('WebSocket server is listening');
        });

        this.logger.info('Real-time audio WebSocket server initialized');
        return wss;
    }

    /**
     * Set up message handlers for client WebSocket
     */
    setupClientHandlers(ws, clientId) {
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleClientMessage(clientId, message);
            } catch (error) {
                this.logger.error(`Error handling client message for ${clientId}:`, error);
                this.sendError(clientId, 'Invalid message format');
            }
        });
    }

    /**
     * Handle incoming messages from client
     */
    async handleClientMessage(clientId, message) {
        const { type, data } = message;
        const connection = this.connections.get(clientId);

        if (!connection || !connection.isActive) {
            this.logger.warn(`Message received for inactive connection: ${clientId}`);
            return;
        }

        switch (type) {
            case 'session.update':
                await this.updateSession(clientId, data);
                break;
            
            case 'input_audio_buffer.append':
                await this.appendAudioBuffer(clientId, data);
                break;
            
            case 'input_audio_buffer.commit':
                await this.commitAudioBuffer(clientId);
                break;
            
            case 'response.create':
                await this.createResponse(clientId, data);
                break;
            
            case 'conversation.item.create':
                await this.createConversationItem(clientId, data);
                break;
            
            case 'response.cancel':
                await this.cancelResponse(clientId);
                break;
            
            default:
                this.logger.warn(`Unknown message type: ${type}`);
                this.sendError(clientId, `Unknown message type: ${type}`);
        }
    }

    /**
     * Connect to OpenAI Realtime API with exponential backoff
     */
    async connectToOpenAI(clientId) {
        try {
            // Check if connection already exists and is open
            const existingWs = this.openaiConnections.get(clientId);
            if (existingWs && existingWs.readyState === WebSocket.OPEN) {
                return existingWs;
            }

            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // Check reconnection attempts
            const attempts = this.reconnectAttempts.get(clientId) || 0;
            if (attempts >= this.maxReconnectAttempts) {
                const error = new Error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${clientId}`);
                this.logger.error(`Connection limit reached for ${clientId}`);
                this.sendError(clientId, 'Maximum connection attempts reached. Please refresh and try again.');
                throw error;
            }

            // Apply exponential backoff if this is a retry
            if (attempts > 0) {
                const delay = this.reconnectDelay * Math.pow(2, attempts - 1);
                this.logger.info(`Waiting ${delay}ms before retry ${attempts + 1} for ${clientId}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            this.logger.info(`Connecting to OpenAI Realtime API for client ${clientId} (attempt ${attempts + 1})`);
            
            // Increment attempt counter
            this.reconnectAttempts.set(clientId, attempts + 1);
            
            const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            return new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    openaiWs.close();
                    reject(new Error('OpenAI connection timeout'));
                }, 10000); // 10 second timeout

                openaiWs.on('open', () => {
                    clearTimeout(connectionTimeout);
                    this.logger.info(`Connected to OpenAI Realtime API for ${clientId}`);
                    
                    // Reset reconnection attempts on successful connection
                    this.reconnectAttempts.delete(clientId);
                    
                    // Store connection and track session start time
                    this.openaiConnections.set(clientId, openaiWs);
                    this.sessionStartTimes.set(clientId, Date.now());
                    
                    // Set up OpenAI message forwarding
                    this.setupOpenAIHandlers(openaiWs, clientId);
                    
                    // Set up session renewal timer
                    this.setupSessionRenewal(clientId);
                    
                    resolve(openaiWs);
                });

                openaiWs.on('error', (error) => {
                    clearTimeout(connectionTimeout);
                    this.logger.error(`OpenAI WebSocket error for ${clientId} (attempt ${attempts + 1}):`, error.message || error);
                    
                    // Don't immediately retry on error - let the calling code handle retries
                    const errorMessage = attempts >= this.maxReconnectAttempts - 1 ? 
                        'Failed to connect to AI service after multiple attempts' :
                        `OpenAI connection failed: ${error.message || 'Unknown error'}`;
                    
                    this.sendError(clientId, errorMessage);
                    reject(error);
                });

                openaiWs.on('close', (code, reason) => {
                    clearTimeout(connectionTimeout);
                    this.logger.info(`OpenAI connection closed for ${clientId}, code: ${code}, reason: ${reason}`);
                    this.openaiConnections.delete(clientId);
                    
                    if (code !== 1000) {
                        // Only send error if this wasn't a normal close
                        const errorMessage = `OpenAI connection closed unexpectedly: ${code} ${reason}`;
                        this.sendError(clientId, errorMessage);
                    }
                });
            });
        } catch (error) {
            this.logger.error(`Failed to connect to OpenAI for ${clientId}:`, error);
            throw error;
        }
    }

    /**
     * Set up OpenAI WebSocket message handlers
     */
    setupOpenAIHandlers(openaiWs, clientId) {
        openaiWs.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.forwardToClient(clientId, message);
                
                // Handle specific OpenAI events
                this.handleOpenAIMessage(clientId, message);
            } catch (error) {
                this.logger.error(`Error processing OpenAI message for ${clientId}:`, error);
            }
        });
    }

    /**
     * Handle OpenAI specific messages
     */
    handleOpenAIMessage(clientId, message) {
        const { type } = message;

        switch (type) {
            case 'session.created':
                this.logger.info(`OpenAI session created for ${clientId}`);
                break;
            
            case 'response.created':
                this.logger.info(`Response created for ${clientId}`);
                break;
            
            case 'response.audio.delta':
                // Audio response chunk - forward to client for playback
                break;
            
            case 'response.audio.done':
                this.logger.info(`Audio response completed for ${clientId}`);
                break;
            
            case 'response.done':
                this.logger.info(`Full response completed for ${clientId}`);
                // Clear active response
                this.activeResponses.delete(clientId);
                break;
            
            case 'conversation.item.created':
                this.logger.info(`Conversation item created for ${clientId}`);
                break;
            
            case 'response.function_call_arguments.delta':
                this.logger.debug(`Function call arguments delta for ${clientId}`);
                break;
            
            case 'response.function_call_arguments.done':
                this.logger.info(`Function call arguments completed for ${clientId}`);
                // Handle function calls here if needed
                this.handleFunctionCall(clientId, message);
                break;
            
            case 'input_audio_buffer.speech_started':
                this.logger.debug(`Speech started for ${clientId}`);
                break;
            
            case 'input_audio_buffer.speech_stopped':
                this.logger.debug(`Speech stopped for ${clientId}`);
                break;
            
            case 'error':
                this.logger.error(`OpenAI error for ${clientId}:`, message);
                // Clear active response on error
                this.activeResponses.delete(clientId);
                
                // Handle session expiration specifically
                if (message.error?.code === 'session_expired') {
                    this.logger.warn(`Session expired for ${clientId}, attempting renewal`);
                    this.handleSessionExpiration(clientId);
                } else {
                    // Send more detailed error to client for other errors
                    this.sendError(clientId, `AI service error: ${message.error?.message || 'Unknown error'}`);
                }
                break;
            
            default:
                this.logger.debug(`Unhandled OpenAI message type for ${clientId}: ${type}`);
                break;
        }
    }

    /**
     * Handle function calls from OpenAI
     */
    async handleFunctionCall(clientId, message) {
        try {
            const { name, arguments: args } = message;
            
            switch (name) {
                case 'create_calendar_event':
                    await this.handleCreateEvent(clientId, args);
                    break;
                    
                case 'query_calendar_events':
                    await this.handleQueryEvents(clientId, args);
                    break;
                    
                default:
                    this.logger.warn(`Unknown function call: ${name}`);
                    this.sendError(clientId, `Unknown function: ${name}`);
            }
        } catch (error) {
            this.logger.error(`Error handling function call for ${clientId}:`, error);
            this.sendError(clientId, 'Error processing calendar request');
        }
    }

    /**
     * Handle create calendar event function call
     */
    async handleCreateEvent(clientId, args) {
        try {
            // TODO: Integrate with actual calendar service
            this.logger.info(`Creating event for ${clientId}:`, args);
            
            // For now, just log the request and send success response
            // In a full implementation, this would call the calendar API
            const response = {
                type: 'response.create',
                response: {
                    modalities: ['text'],
                    instructions: `Event "${args.title}" scheduled for ${args.date} at ${args.time}`
                }
            };
            
            this.forwardToClient(clientId, response);
        } catch (error) {
            this.logger.error(`Error creating event for ${clientId}:`, error);
            throw error;
        }
    }

    /**
     * Handle query calendar events function call
     */
    async handleQueryEvents(clientId, args) {
        try {
            // TODO: Integrate with actual calendar service
            this.logger.info(`Querying events for ${clientId}:`, args);
            
            // For now, just log the request and send mock response
            const response = {
                type: 'response.create', 
                response: {
                    modalities: ['text'],
                    instructions: `Looking up events for ${args.start_date}${args.end_date ? ' to ' + args.end_date : ''}`
                }
            };
            
            this.forwardToClient(clientId, response);
        } catch (error) {
            this.logger.error(`Error querying events for ${clientId}:`, error);
            throw error;
        }
    }

    /**
     * Setup session renewal timer to prevent 60-minute expiration
     */
    setupSessionRenewal(clientId) {
        // Clear any existing timer
        this.clearSessionTimer(clientId);
        
        // Set up warning timer (50 minutes)
        const warningTimer = setTimeout(() => {
            this.sendSessionWarning(clientId);
        }, this.sessionRenewalWarning);
        
        // Set up renewal timer (55 minutes)
        const renewalTimer = setTimeout(() => {
            this.renewSession(clientId);
        }, this.sessionDurationLimit);
        
        this.sessionTimers.set(clientId, {
            warningTimer,
            renewalTimer
        });
        
        this.logger.info(`Session renewal timers set for ${clientId}`);
    }

    /**
     * Send session expiration warning to client
     */
    sendSessionWarning(clientId) {
        const connection = this.connections.get(clientId);
        if (connection && connection.isActive) {
            this.forwardToClient(clientId, {
                type: 'session.warning',
                message: 'Your session will expire in 10 minutes. Your conversation will automatically continue with a new session.',
                timeRemaining: 10 * 60 * 1000 // 10 minutes in ms
            });
            this.logger.info(`Sent session warning to ${clientId}`);
        }
    }

    /**
     * Renew session before expiration
     */
    async renewSession(clientId) {
        try {
            this.logger.info(`Renewing session for ${clientId}`);
            
            // Close old connection gracefully
            const oldConnection = this.openaiConnections.get(clientId);
            if (oldConnection && oldConnection.readyState === WebSocket.OPEN) {
                oldConnection.close(1000, 'Session renewal');
            }
            
            // Clear old session data
            this.openaiConnections.delete(clientId);
            this.sessionStartTimes.delete(clientId);
            this.clearSessionTimer(clientId);
            
            // Create new connection
            const newConnection = await this.connectToOpenAI(clientId);
            
            // Notify client of successful renewal
            this.forwardToClient(clientId, {
                type: 'session.renewed',
                message: 'Session renewed successfully. You can continue your conversation.',
                timestamp: Date.now()
            });
            
            this.logger.info(`Session renewed successfully for ${clientId}`);
            
        } catch (error) {
            this.logger.error(`Failed to renew session for ${clientId}:`, error);
            this.sendError(clientId, 'Session renewal failed. Please refresh the page.');
        }
    }

    /**
     * Clear session timers
     */
    clearSessionTimer(clientId) {
        const timers = this.sessionTimers.get(clientId);
        if (timers) {
            clearTimeout(timers.warningTimer);
            clearTimeout(timers.renewalTimer);
            this.sessionTimers.delete(clientId);
        }
    }

    /**
     * Handle session expiration by attempting immediate renewal
     */
    async handleSessionExpiration(clientId) {
        try {
            this.logger.info(`Handling session expiration for ${clientId}`);
            
            // Clear expired session data
            this.openaiConnections.delete(clientId);
            this.sessionStartTimes.delete(clientId);
            this.clearSessionTimer(clientId);
            this.activeResponses.delete(clientId);
            
            // Attempt to create new session
            await this.renewSession(clientId);
            
        } catch (error) {
            this.logger.error(`Failed to handle session expiration for ${clientId}:`, error);
            this.sendError(clientId, 'Your session has expired. Please refresh the page to continue.');
        }
    }

    /**
     * Update session configuration
     */
    async updateSession(clientId, sessionConfig) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        const defaultConfig = {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful calendar assistant. Help users schedule, modify, and query their calendar events using natural conversation.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
                model: 'whisper-1'
            },
            turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200
            },
            tools: [
                {
                    type: 'function',
                    name: 'create_calendar_event',
                    description: 'Create a new calendar event',
                    parameters: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            date: { type: 'string' },
                            time: { type: 'string' },
                            duration: { type: 'number' },
                            description: { type: 'string' }
                        },
                        required: ['title', 'date', 'time']
                    }
                },
                {
                    type: 'function',
                    name: 'query_calendar_events',
                    description: 'Query calendar events for a date range',
                    parameters: {
                        type: 'object',
                        properties: {
                            start_date: { type: 'string' },
                            end_date: { type: 'string' }
                        },
                        required: ['start_date']
                    }
                }
            ]
        };

        const mergedConfig = { ...defaultConfig, ...sessionConfig };
        
        openaiWs.send(JSON.stringify({
            type: 'session.update',
            session: mergedConfig
        }));
    }

    /**
     * Append audio data to input buffer
     */
    async appendAudioBuffer(clientId, audioData) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioData.audio
        }));
    }

    /**
     * Commit audio buffer for processing
     */
    async commitAudioBuffer(clientId) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
        }));

        // Only create response if there's no active response
        if (!this.activeResponses.has(clientId)) {
            this.createResponse(clientId);
        }
    }

    /**
     * Create a response
     */
    async createResponse(clientId, responseConfig) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        // Mark response as active
        this.activeResponses.set(clientId, true);
        
        openaiWs.send(JSON.stringify({
            type: 'response.create',
            response: responseConfig || {}
        }));
    }

    /**
     * Create conversation item
     */
    async createConversationItem(clientId, item) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        openaiWs.send(JSON.stringify({
            type: 'conversation.item.create',
            item: item
        }));
    }

    /**
     * Cancel current response
     */
    async cancelResponse(clientId) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
        openaiWs.send(JSON.stringify({
            type: 'response.cancel'
        }));
    }

    /**
     * Ensure OpenAI connection exists with retry logic and connection locking
     */
    async ensureOpenAIConnection(clientId) {
        let openaiWs = this.openaiConnections.get(clientId);
        
        // Return existing connection if it's open
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            return openaiWs;
        }
        
        // Check if there's already a connection attempt in progress
        if (this.connectionLocks.has(clientId)) {
            this.logger.info(`Connection attempt already in progress for ${clientId}, waiting...`);
            const existingPromise = this.connectionLocks.get(clientId);
            try {
                return await existingPromise;
            } catch (error) {
                // If the existing attempt failed, we'll retry below
                this.logger.warn(`Existing connection attempt failed for ${clientId}, will retry`);
            }
        }
        
        // Remove stale connection if it exists
        if (openaiWs) {
            this.openaiConnections.delete(clientId);
        }
        
        // Check if we've exceeded max attempts
        const attempts = this.reconnectAttempts.get(clientId) || 0;
        if (attempts >= this.maxReconnectAttempts) {
            throw new Error(`Cannot establish OpenAI connection for ${clientId}: maximum attempts exceeded`);
        }
        
        // Create connection promise and store it to prevent concurrent attempts
        const connectionPromise = this.connectToOpenAI(clientId);
        this.connectionLocks.set(clientId, connectionPromise);
        
        try {
            openaiWs = await connectionPromise;
            return openaiWs;
        } catch (error) {
            // If this was the last attempt, clean up
            if (attempts >= this.maxReconnectAttempts - 1) {
                this.reconnectAttempts.delete(clientId);
                this.cleanupConnection(clientId);
            }
            throw error;
        } finally {
            // Always remove the connection lock when done
            this.connectionLocks.delete(clientId);
        }
    }

    /**
     * Forward message to client
     */
    forwardToClient(clientId, message) {
        const connection = this.connections.get(clientId);
        
        if (connection && connection.isActive && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error to client
     */
    sendError(clientId, error) {
        const connection = this.connections.get(clientId);
        
        if (connection && connection.isActive && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify({
                type: 'error',
                error: {
                    type: 'server_error',
                    message: error
                }
            }));
        }
    }

    /**
     * Clean up connection and all associated resources
     */
    cleanupConnection(clientId) {
        this.logger.info(`Cleaning up connection for ${clientId}`);
        
        // Close OpenAI connection gracefully
        const openaiWs = this.openaiConnections.get(clientId);
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close(1000, 'Client disconnected');
        }
        this.openaiConnections.delete(clientId);

        // Clear session timers and tracking
        this.clearSessionTimer(clientId);
        this.sessionStartTimes.delete(clientId);

        // Clear active response
        this.activeResponses.delete(clientId);

        // Clear reconnection attempts
        this.reconnectAttempts.delete(clientId);

        // Clear connection locks
        this.connectionLocks.delete(clientId);

        // Remove client connection
        const connection = this.connections.get(clientId);
        if (connection) {
            connection.isActive = false;
            if (connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.close();
            }
        }
        this.connections.delete(clientId);
        
        this.logger.info(`Connection cleanup completed for ${clientId}`);
    }

    /**
     * Generate unique client ID with session isolation
     */
    generateClientId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const sessionId = Math.random().toString(36).substr(2, 5);
        return `client_${timestamp}_${random}_${sessionId}`;
    }

    /**
     * Extract user ID from request
     */
    extractUserId(req) {
        // Extract from query params, headers, or JWT token
        return req.url?.includes('userId=') ? 
            new URLSearchParams(req.url.split('?')[1]).get('userId') : 
            'anonymous';
    }

    /**
     * Check rate limiting for client
     */
    checkRateLimit(rateLimitKey) {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        if (!this.connectionRateLimit.has(rateLimitKey)) {
            this.connectionRateLimit.set(rateLimitKey, []);
        }
        
        const attempts = this.connectionRateLimit.get(rateLimitKey);
        
        // Remove old attempts outside the window
        while (attempts.length > 0 && attempts[0] < windowStart) {
            attempts.shift();
        }
        
        // Check if rate limit exceeded
        if (attempts.length >= this.maxConnectionsPerMinute) {
            return false;
        }
        
        // Add current attempt
        attempts.push(now);
        return true;
    }

    /**
     * Get comprehensive connection statistics with session monitoring
     */
    getStats() {
        const now = Date.now();
        
        // Calculate session ages and renewal needs
        const sessionStats = Array.from(this.sessionStartTimes.entries()).map(([clientId, startTime]) => {
            const age = now - startTime;
            const needsRenewal = age > this.sessionRenewalWarning;
            const nearExpiration = age > this.sessionDurationLimit;
            
            return {
                clientId,
                age,
                needsRenewal,
                nearExpiration,
                ageMinutes: Math.floor(age / 60000)
            };
        });
        
        return {
            // Basic connection counts
            activeConnections: this.connections.size,
            openaiConnections: this.openaiConnections.size,
            reconnectionAttempts: this.reconnectAttempts.size,
            rateLimitEntries: this.connectionRateLimit.size,
            connectionLocks: this.connectionLocks.size,
            
            // Session monitoring
            activeSessions: this.sessionStartTimes.size,
            sessionsNeedingRenewal: sessionStats.filter(s => s.needsRenewal).length,
            sessionsNearExpiration: sessionStats.filter(s => s.nearExpiration).length,
            activeSessionTimers: this.sessionTimers.size,
            
            // Health indicators
            averageSessionAge: sessionStats.length > 0 ? 
                Math.floor(sessionStats.reduce((sum, s) => sum + s.age, 0) / sessionStats.length / 60000) : 0,
            healthStatus: this.getHealthStatus(sessionStats),
            
            // Detailed connection info
            connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
                id,
                userId: conn.userId,
                connected: Date.now() - conn.startTime,
                active: conn.isActive,
                reconnectAttempts: this.reconnectAttempts.get(id) || 0,
                locked: this.connectionLocks.has(id),
                hasSession: this.sessionStartTimes.has(id),
                sessionAge: this.sessionStartTimes.has(id) ? 
                    Math.floor((now - this.sessionStartTimes.get(id)) / 60000) : null
            })),
            
            // Session details
            sessions: sessionStats
        };
    }

    /**
     * Get overall health status
     */
    getHealthStatus(sessionStats) {
        const nearExpirationCount = sessionStats.filter(s => s.nearExpiration).length;
        const highReconnectCount = Array.from(this.reconnectAttempts.values()).filter(count => count >= 2).length;
        
        if (nearExpirationCount > 0) {
            return 'warning_sessions_expiring';
        }
        
        if (highReconnectCount > 0) {
            return 'warning_connection_issues';
        }
        
        if (this.connections.size === 0) {
            return 'idle';
        }
        
        return 'healthy';
    }
}

module.exports = { RealtimeAudioService };