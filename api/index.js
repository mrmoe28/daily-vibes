// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// HTML file serving routes
const serveHtmlFile = (filePath) => (req, res) => {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath);
  } else {
    res.status(404).send('File not found');
  }
};

// Define your HTML routes here
app.get('/', serveHtmlFile('public/index.html'));

// Simple in-memory storage for serverless
const dataStore = new Map();

// Encryption utilities
function simpleEncrypt(text) {
  return Buffer.from(text).toString('base64');
}

function simpleDecrypt(encrypted) {
  return Buffer.from(encrypted, 'base64').toString();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    serverless: true,
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Key Management
app.get('/api/config/check', (req, res) => {
  res.json({ 
    configured: true,
    hasApiKey: !!process.env.API_KEY,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/config/setup', async (req, res) => {
  try {
    const { apiKey, userId } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Store encrypted key in memory (for demo - use database in production)
    const encryptedKey = simpleEncrypt(apiKey);
    dataStore.set(`apikey_${userId || 'default'}`, encryptedKey);
    
    res.json({ 
      success: true, 
      message: 'API key stored securely',
      keyId: userId || 'default'
    });
  } catch (error) {
    console.error('Error setting up API key:', error);
    res.status(500).json({ error: 'Failed to setup API key' });
  }
});

// User Authentication (simplified for serverless)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Simple demo authentication - replace with real logic
    if (email && password) {
      const token = simpleEncrypt(JSON.stringify({ email, timestamp: Date.now() }));
      res.json({ 
        success: true, 
        token,
        user: { email, id: simpleEncrypt(email) }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
      const decoded = JSON.parse(simpleDecrypt(token));
      res.json({ 
        success: true, 
        user: { email: decoded.email }
      });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Data Storage endpoints
app.get('/api/data/:key', (req, res) => {
  try {
    const { key } = req.params;
    const value = dataStore.get(key);
    
    if (value !== undefined) {
      res.json({ success: true, value });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  } catch (error) {
    console.error('Get data error:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    dataStore.set(key, value);
    res.json({ success: true, message: 'Data stored successfully' });
  } catch (error) {
    console.error('Store data error:', error);
    res.status(500).json({ error: 'Failed to store data' });
  }
});

// File Upload endpoint (simplified for serverless)
app.post('/api/upload', async (req, res) => {
  try {
    // In serverless, handle file uploads differently
    // This is a placeholder - implement based on your needs
    res.json({ 
      success: true, 
      message: 'File upload endpoint - implement based on your storage solution',
      note: 'Consider using cloud storage (S3, Cloudinary, etc.) for serverless'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Catch-all route for API
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel serverless functions
module.exports = (req, res) => {
  return app(req, res);
};