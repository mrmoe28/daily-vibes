// AI Assistant Memory Management API
const { MemoryService } = require('../../lib/memory-service');

let memoryService = null;

function initializeService(database) {
  if (!memoryService) {
    memoryService = new MemoryService(database);
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize database and services
    const DatabaseService = require('../../lib/database-neon');
    const database = new DatabaseService();
    await database.initialize();
    
    initializeService(database);

    // Get user ID from token or use default
    const userId = req.user?.id || 'default';

    switch (req.method) {
      case 'GET':
        return await handleGetMemories(req, res, userId);
      
      case 'POST':
        return await handleStoreMemory(req, res, userId);
      
      case 'PUT':
        return await handleUpdateMemory(req, res, userId);
      
      case 'DELETE':
        return await handleDeleteMemory(req, res, userId);
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Memory API error:', error);
    return res.status(500).json({
      error: 'Failed to process memory request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle GET requests - retrieve memories
 */
async function handleGetMemories(req, res, userId) {
  try {
    const { category, key, export: exportData } = req.query;
    
    // Export all memories
    if (exportData === 'true') {
      const exportedData = await memoryService.exportUserMemories(userId);
      return res.json({
        success: true,
        data: exportedData
      });
    }
    
    // Get specific memory by key
    if (key) {
      const memory = await memoryService.getMemory(userId, key);
      return res.json({
        success: true,
        memory: memory
      });
    }
    
    // Get memories by category
    if (category) {
      const memories = await memoryService.getMemoriesByCategory(userId, category, 50);
      return res.json({
        success: true,
        memories: memories,
        category: category
      });
    }
    
    // Get all categories summary
    const categories = ['personal', 'behavioral', 'contextual', 'preferences', 'relationships'];
    const memorySummary = {};
    
    for (const cat of categories) {
      const memories = await memoryService.getMemoriesByCategory(userId, cat, 10);
      memorySummary[cat] = memories;
    }
    
    return res.json({
      success: true,
      summary: memorySummary
    });

  } catch (error) {
    console.error('Error getting memories:', error);
    return res.status(500).json({ error: 'Failed to retrieve memories' });
  }
}

/**
 * Handle POST requests - store new memory
 */
async function handleStoreMemory(req, res, userId) {
  try {
    const { key, value, category = 'contextual', relevanceScore = 1.0 } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({ error: 'Key and value are required' });
    }
    
    const success = await memoryService.storeMemory(userId, key, value, category, relevanceScore);
    
    if (success) {
      return res.json({
        success: true,
        message: 'Memory stored successfully',
        key,
        category
      });
    } else {
      return res.status(500).json({ error: 'Failed to store memory' });
    }

  } catch (error) {
    console.error('Error storing memory:', error);
    return res.status(500).json({ error: 'Failed to store memory' });
  }
}

/**
 * Handle PUT requests - update existing memory
 */
async function handleUpdateMemory(req, res, userId) {
  try {
    const { key, value, category, relevanceScore } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    // Check if memory exists
    const existingMemory = await memoryService.getMemory(userId, key);
    if (!existingMemory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    // Update the memory
    const success = await memoryService.storeMemory(
      userId, 
      key, 
      value || existingMemory, 
      category || 'contextual', 
      relevanceScore || 1.0
    );
    
    if (success) {
      return res.json({
        success: true,
        message: 'Memory updated successfully',
        key
      });
    } else {
      return res.status(500).json({ error: 'Failed to update memory' });
    }

  } catch (error) {
    console.error('Error updating memory:', error);
    return res.status(500).json({ error: 'Failed to update memory' });
  }
}

/**
 * Handle DELETE requests - delete memory or clear categories
 */
async function handleDeleteMemory(req, res, userId) {
  try {
    const { key, category, clearAll } = req.body;
    
    if (clearAll === true) {
      // Clear all memories (dangerous operation)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 1); // Future date to delete all
      
      const deletedCount = await memoryService.deleteOldMemories(cutoffDate, 'contextual', 0);
      
      return res.json({
        success: true,
        message: `Cleared ${deletedCount} memories`,
        deletedCount
      });
    }
    
    if (category) {
      // Clear memories by category
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 1);
      
      const deletedCount = await memoryService.deleteOldMemories(cutoffDate, category, 0);
      
      return res.json({
        success: true,
        message: `Cleared ${deletedCount} ${category} memories`,
        deletedCount,
        category
      });
    }
    
    if (key) {
      // Delete specific memory by key
      // Note: We need to add a deleteMemory method to MemoryService
      return res.status(501).json({ error: 'Delete by key not yet implemented' });
    }
    
    return res.status(400).json({ error: 'No deletion criteria specified' });

  } catch (error) {
    console.error('Error deleting memory:', error);
    return res.status(500).json({ error: 'Failed to delete memory' });
  }
}