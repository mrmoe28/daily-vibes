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
    }

    /**
     * Initialize WebSocket server
     */
    createWebSocketServer(server) {
        const wss = new WebSocket.Server({ 
            server,
            path: '/api/realtime-audio'
        });

        wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            this.logger.info(`New audio client connected: ${clientId}`);
            
            // Store client connection
            this.connections.set(clientId, {
                ws,
                isActive: true,
                startTime: Date.now(),
                userId: this.extractUserId(req)
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
     * Connect to OpenAI Realtime API
     */
    async connectToOpenAI(clientId) {
        try {
            if (this.openaiConnections.has(clientId)) {
                return this.openaiConnections.get(clientId);
            }

            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            this.logger.info(`Connecting to OpenAI Realtime API for client ${clientId}`);
            
            const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            return new Promise((resolve, reject) => {
                openaiWs.on('open', () => {
                    this.logger.info(`Connected to OpenAI Realtime API for ${clientId}`);
                    
                    // Store connection
                    this.openaiConnections.set(clientId, openaiWs);
                    
                    // Set up OpenAI message forwarding
                    this.setupOpenAIHandlers(openaiWs, clientId);
                    
                    resolve(openaiWs);
                });

                openaiWs.on('error', (error) => {
                    this.logger.error(`OpenAI WebSocket error for ${clientId}:`, error.message || error);
                    this.sendError(clientId, `OpenAI connection failed: ${error.message || 'Unknown error'}`);
                    reject(error);
                });

                openaiWs.on('close', (code, reason) => {
                    this.logger.info(`OpenAI connection closed for ${clientId}, code: ${code}, reason: ${reason}`);
                    this.openaiConnections.delete(clientId);
                    if (code !== 1000) {
                        this.sendError(clientId, `OpenAI connection closed unexpectedly: ${code} ${reason}`);
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
            
            case 'response.audio.delta':
                // Audio response chunk - forward to client for playback
                break;
            
            case 'response.audio.done':
                this.logger.info(`Audio response completed for ${clientId}`);
                break;
            
            case 'conversation.item.created':
                this.logger.info(`Conversation item created for ${clientId}`);
                break;
            
            case 'error':
                this.logger.error(`OpenAI error for ${clientId}:`, message);
                break;
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
    }

    /**
     * Create a response
     */
    async createResponse(clientId, responseConfig) {
        const openaiWs = await this.ensureOpenAIConnection(clientId);
        
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
     * Ensure OpenAI connection exists
     */
    async ensureOpenAIConnection(clientId) {
        let openaiWs = this.openaiConnections.get(clientId);
        
        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
            openaiWs = await this.connectToOpenAI(clientId);
        }
        
        return openaiWs;
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
     * Clean up connection
     */
    cleanupConnection(clientId) {
        // Close OpenAI connection
        const openaiWs = this.openaiConnections.get(clientId);
        if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
        this.openaiConnections.delete(clientId);

        // Remove client connection
        const connection = this.connections.get(clientId);
        if (connection) {
            connection.isActive = false;
            if (connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.close();
            }
        }
        this.connections.delete(clientId);
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
     * Get connection statistics
     */
    getStats() {
        return {
            activeConnections: this.connections.size,
            openaiConnections: this.openaiConnections.size,
            connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
                id,
                userId: conn.userId,
                connected: Date.now() - conn.startTime,
                active: conn.isActive
            }))
        };
    }
}

module.exports = { RealtimeAudioService };