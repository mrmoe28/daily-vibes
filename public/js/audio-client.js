// Real-time Audio Client for OpenAI Realtime API integration
class RealtimeAudioClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isRecording = false;
        this.isPlaying = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.audioQueue = [];
        this.currentAudioSource = null;
        
        // Event handlers
        this.onMessage = null;
        this.onAudioResponse = null;
        this.onConnectionChange = null;
        this.onError = null;
        
        // Audio settings
        this.audioFormat = 'pcm16';
        this.sampleRate = 24000;
        this.bufferSize = 4096;
        
        this.setupAudioContext();
    }

    /**
     * Setup Web Audio API context
     */
    async setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            console.log('Audio context initialized:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state
            });
        } catch (error) {
            console.error('Failed to setup audio context:', error);
        }
    }

    /**
     * Connect to WebSocket server
     */
    async connect(userId = 'anonymous') {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/api/realtime-audio?userId=${userId}`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            // Set a connection timeout
            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.warn('WebSocket connection timeout');
                    this.ws?.close();
                    this.onError?.('Connection timeout. Please check your network and try again.');
                }
            }, 10000); // 10 second timeout

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.onConnectionChange?.(true);
                // Wait a moment before initializing session to ensure server is ready
                setTimeout(() => this.initializeSession(), 500);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                clearTimeout(connectionTimeout);
                this.isConnected = false;
                this.onConnectionChange?.(false);
                this.cleanup();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(connectionTimeout);
                this.onError?.('Failed to connect to audio service. Please try again.');
            };
            
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.onError?.('Failed to connect to audio service');
        }
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.cleanup();
    }

    /**
     * Initialize session with OpenAI
     */
    initializeSession() {
        if (!this.isConnected) return;

        const sessionConfig = {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful calendar assistant. Help users schedule, modify, and query their calendar events using natural conversation. Be concise and friendly.',
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
                silence_duration_ms: 500
            }
        };

        this.sendMessage({
            type: 'session.update',
            data: sessionConfig
        });
    }

    /**
     * Start recording audio
     */
    async startRecording() {
        try {
            if (this.isRecording) return;

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create audio processor
            const source = this.audioContext.createMediaStreamSource(stream);
            const processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
            
            processor.onaudioprocess = (event) => {
                if (this.isRecording && this.isConnected) {
                    const inputBuffer = event.inputBuffer;
                    const inputData = inputBuffer.getChannelData(0);
                    
                    // Convert Float32Array to Int16Array (PCM16)
                    const pcm16Data = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcm16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
                    }
                    
                    // Convert to base64 for transmission
                    const buffer = new ArrayBuffer(pcm16Data.length * 2);
                    const view = new DataView(buffer);
                    for (let i = 0; i < pcm16Data.length; i++) {
                        view.setInt16(i * 2, pcm16Data[i], true);
                    }
                    
                    const base64Audio = this.arrayBufferToBase64(buffer);
                    
                    this.sendMessage({
                        type: 'input_audio_buffer.append',
                        data: { audio: base64Audio }
                    });
                }
            };

            source.connect(processor);
            processor.connect(this.audioContext.destination);

            this.mediaRecorder = { source, processor, stream };
            this.isRecording = true;
            
            console.log('Started recording audio');
            return true;
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.onError?.('Failed to access microphone');
            return false;
        }
    }

    /**
     * Stop recording audio
     */
    stopRecording() {
        if (!this.isRecording) return;

        try {
            if (this.mediaRecorder) {
                this.mediaRecorder.processor.disconnect();
                this.mediaRecorder.source.disconnect();
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                this.mediaRecorder = null;
            }

            this.isRecording = false;
            
            // Commit the audio buffer
            this.sendMessage({
                type: 'input_audio_buffer.commit'
            });

            console.log('Stopped recording audio');
            
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    }

    /**
     * Send message to server
     */
    sendMessage(message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Handle messages from server
     */
    handleServerMessage(message) {
        const { type } = message;

        switch (type) {
            case 'session.created':
                console.log('OpenAI session created');
                break;

            case 'session.updated':
                console.log('OpenAI session updated');
                break;

            case 'input_audio_buffer.committed':
                console.log('Audio buffer committed');
                // Create response to start AI processing
                this.sendMessage({
                    type: 'response.create'
                });
                break;

            case 'response.audio.delta':
                this.handleAudioDelta(message);
                break;

            case 'response.audio.done':
                console.log('Audio response completed');
                break;

            case 'response.text.delta':
                this.onMessage?.(message.delta, false);
                break;

            case 'response.text.done':
                this.onMessage?.(message.text, true);
                break;

            case 'conversation.item.created':
                console.log('Conversation item created:', message.item?.type);
                break;

            case 'error':
                console.error('Server error:', message.error);
                this.onError?.(message.error?.message || 'Server error');
                break;

            default:
                console.log('Received message:', type);
        }
    }

    /**
     * Handle audio delta from server
     */
    async handleAudioDelta(message) {
        try {
            if (message.delta) {
                const audioData = this.base64ToArrayBuffer(message.delta);
                await this.playAudio(audioData);
                this.onAudioResponse?.(message.delta);
            }
        } catch (error) {
            console.error('Error handling audio delta:', error);
        }
    }

    /**
     * Play audio data
     */
    async playAudio(audioBuffer) {
        try {
            if (!this.audioContext) return;

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Decode audio data
            const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
            
            // Create audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            source.connect(this.audioContext.destination);
            
            // Play audio
            source.start();
            this.currentAudioSource = source;
            this.isPlaying = true;
            
            source.onended = () => {
                this.isPlaying = false;
                this.currentAudioSource = null;
            };
            
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }

    /**
     * Stop current audio playback
     */
    stopAudio() {
        if (this.currentAudioSource) {
            this.currentAudioSource.stop();
            this.currentAudioSource = null;
            this.isPlaying = false;
        }
    }

    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopRecording();
        this.stopAudio();
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            recording: this.isRecording,
            playing: this.isPlaying,
            audioContext: this.audioContext?.state || 'not-initialized'
        };
    }

    /**
     * Check if audio is supported
     */
    static isSupported() {
        const hasWebSocket = 'WebSocket' in window;
        const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;
        const hasMediaDevices = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        
        return {
            supported: hasWebSocket && hasAudioContext && hasMediaDevices,
            webSocket: hasWebSocket,
            audioContext: hasAudioContext,
            mediaDevices: hasMediaDevices
        };
    }
}

// Make available globally
window.RealtimeAudioClient = RealtimeAudioClient;