// Vercel Serverless Function for Realtime Audio WebSocket
const { RealtimeAudioService } = require('../lib/realtime-audio-service');

let audioService = null;

// Initialize service (this will be shared across requests)
function initializeAudioService() {
  if (!audioService) {
    audioService = new RealtimeAudioService();
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    initializeAudioService();

    // Handle WebSocket upgrade for Vercel
    if (req.headers.upgrade === 'websocket') {
      // In Vercel, WebSocket upgrades need special handling
      // For now, return connection info for the client to handle
      return res.json({
        message: 'WebSocket endpoint ready',
        endpoint: '/api/realtime-audio',
        protocol: 'wss',
        note: 'Vercel WebSocket support is limited. Consider using Socket.IO or alternative real-time solution.'
      });
    }

    // Handle regular HTTP requests
    if (req.method === 'GET') {
      const stats = audioService ? audioService.getStats() : { connections: 0, sessions: 0 };
      const openaiApiKeySet = !!process.env.OPENAI_API_KEY;

      return res.json({
        success: true,
        audioEnabled: openaiApiKeySet,
        openaiConfigured: openaiApiKeySet,
        websocketEndpoint: '/api/realtime-audio',
        stats: stats,
        supportedFormats: ['pcm16', 'g711_ulaw', 'g711_alaw'],
        maxConnections: 10, // Limited for serverless
        note: 'Running in serverless mode with limited WebSocket support'
      });
    }

    if (req.method === 'POST') {
      // Handle connection test
      if (req.body && req.body.action === 'test') {
        return res.json({
          success: true,
          message: 'Audio service is running',
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          serverless: true
        });
      }

      return res.status(400).json({ error: 'Invalid request' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Realtime audio API error:', error);
    return res.status(500).json({
      success: false,
      audioEnabled: false,
      error: 'Audio service error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};