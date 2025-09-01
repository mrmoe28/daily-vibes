# Real-Time Audio Conversation Features

## Overview
Daily Vibes now includes real-time audio conversation capabilities powered by OpenAI's Realtime API. Users can have natural voice conversations with the calendar assistant for scheduling and managing events.

## Features Implemented

### 🎙️ Voice Recording
- **Click the microphone button** in the chat widget to start voice recording
- **Visual feedback** with pulsing red recording indicator and audio waves
- **Auto-stop** when you click the button again
- **Smart audio processing** with noise suppression and echo cancellation

### 🔊 Real-Time Audio Response
- **Instant AI voice responses** using OpenAI's advanced voice synthesis
- **Natural conversation flow** with interruption handling
- **Multiple voice options** (default: Alloy voice)

### 🌐 WebSocket Integration
- **Low-latency communication** via WebSocket connection
- **Real-time audio streaming** for seamless conversations
- **Automatic reconnection** if connection is lost

### 🎨 Enhanced UI
- **Visual status indicators**: Listening, Processing, Connected states
- **Audio wave animation** during voice interaction
- **Connecting spinner** while establishing connection
- **Toast notifications** for user feedback

## Setup Requirements

### 1. OpenAI API Key
You need an OpenAI API key with access to the Realtime API:

```bash
# Add to your .env file
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Browser Support
The audio features require modern browser support for:
- **WebSocket** (all modern browsers)
- **Web Audio API** (Chrome, Firefox, Safari, Edge)
- **MediaDevices API** (for microphone access)

### 3. HTTPS (Production)
For production deployment, HTTPS is required for microphone access.

## Usage

### Starting a Voice Conversation
1. Open the Calendar Assistant chat widget
2. Click the **microphone button** (🎙️)
3. Allow microphone permissions when prompted
4. Wait for "Listening..." status
5. Speak naturally about your calendar needs
6. Click the **stop button** when finished

### Sample Voice Commands
- "Schedule a meeting with John tomorrow at 2 PM"
- "What do I have planned for next week?"
- "Move my 3 PM appointment to 4 PM"
- "Cancel my meeting on Friday"
- "Show me my free time tomorrow"

### Audio Status Endpoint
Check audio service status:
```bash
GET /api/assistant/audio-status
```

Response:
```json
{
  "success": true,
  "audioEnabled": true,
  "openaiConfigured": true,
  "websocketEndpoint": "/api/realtime-audio",
  "stats": {
    "activeConnections": 0,
    "openaiConnections": 0
  }
}
```

## Technical Implementation

### Architecture
- **Frontend**: `RealtimeAudioClient` class handles WebRTC audio recording/playback
- **Backend**: `RealtimeAudioService` manages WebSocket connections to OpenAI
- **Integration**: Enhanced `AIChatWidget` with audio UI controls

### Files Modified/Added
- `lib/realtime-audio-service.js` - Core audio service
- `public/js/audio-client.js` - Frontend audio client
- `public/js/app.js` - Enhanced chat widget with audio
- `public/index.html` - Audio UI elements and styling
- `server.js` - WebSocket server integration

### Audio Processing
- **Format**: PCM16 audio at 24kHz sample rate
- **Recording**: Real-time audio chunks sent via WebSocket
- **Playback**: Streamed audio responses played through Web Audio API
- **Voice Activity Detection**: Server-side VAD with configurable thresholds

## Troubleshooting

### Common Issues
1. **"Voice input not supported"** - Browser lacks required APIs
2. **"Failed to connect to audio service"** - Check server WebSocket endpoint
3. **"Microphone access denied"** - Grant browser permissions
4. **No audio response** - Verify OpenAI API key is valid

### Debug Mode
Enable debug logging in browser console:
```javascript
// Check audio support
RealtimeAudioClient.isSupported()

// Get connection status
window.aiChat.audioClient?.getStatus()
```

## Performance Considerations

### Optimization Features
- **Audio compression** for efficient WebSocket transmission
- **Connection pooling** for multiple simultaneous users
- **Automatic cleanup** of idle connections
- **Error recovery** with graceful fallbacks

### Scaling
- **WebSocket connections**: Up to 100 concurrent users
- **Audio processing**: Client-side to reduce server load
- **Memory management**: Automatic cleanup of audio buffers

## Future Enhancements
- Voice commands for direct calendar actions
- Multi-language support
- Voice training for better recognition
- Audio conversation history
- Integration with external calendar systems