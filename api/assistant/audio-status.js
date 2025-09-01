// Audio Status API Endpoint
const { RealtimeAudioService } = require('../../lib/realtime-audio-service');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initializeAudioService();

    const stats = audioService.getStats();
    const openaiApiKeySet = !!process.env.OPENAI_API_KEY;

    return res.json({
      success: true,
      audioEnabled: true,
      openaiConfigured: openaiApiKeySet,
      websocketEndpoint: '/api/realtime-audio',
      stats: stats,
      supportedFormats: ['pcm16', 'g711_ulaw', 'g711_alaw'],
      maxConnections: 100
    });

  } catch (error) {
    console.error('Audio status error:', error);
    return res.status(500).json({
      success: false,
      audioEnabled: false,
      error: 'Failed to get audio status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};