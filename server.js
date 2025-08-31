const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const DatabaseService = require('./lib/database-neon');
const { EncryptionService } = require('./lib/encryption');
const { UserManager } = require('./lib/user-manager');
const { Logger } = require('./lib/logger');
const { ConfigManager } = require('./lib/config-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
let database, encryption, userManager, logger, configManager;
let servicesInitialized = false;

async function initializeServices() {
  if (servicesInitialized) {
    return;
  }
  
  try {
    logger = new Logger();
    configManager = new ConfigManager();
    encryption = new EncryptionService();
    database = new DatabaseService();
    await database.initialize();
    userManager = new UserManager(database, encryption);
    
    servicesInitialized = true;
    logger.info('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    throw error;
  }
}

// Middleware to ensure services are initialized
async function ensureServices(req, res, next) {
  try {
    await initializeServices();
    next();
  } catch (error) {
    console.error('Service initialization failed:', error);
    res.status(500).json({ error: 'Service initialization failed' });
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files - works both locally and on Vercel
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Explicit routes for static files (fallback for Vercel)
app.get('/js/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'js', 'app.js'));
});

app.get('/css/main.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'css', 'main.css'));
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Routes

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await initializeServices();
    const dbHealthy = database ? await database.healthCheck() : false;
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy,
        encryption: !!encryption,
        userManager: !!userManager
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const result = await userManager.createUser({ email, password, name });
    res.json({ success: true, user: result });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await userManager.authenticate(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await userManager.verifyToken(token);
    res.json({ success: true, user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// File upload endpoint
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${file.filename}`
    }));
    
    // Store file metadata in database
    for (const file of files) {
      await database.storeFile({
        ...file,
        userId: req.body.userId || 'default'
      });
    }
    
    res.json({ success: true, files });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// User data endpoints
app.get('/api/user/data', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const data = await database.getUserData(userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Get user data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.post('/api/user/data', async (req, res) => {
  try {
    const { userId = 'default', key, value } = req.body;
    await database.setUserData(userId, key, value);
    res.json({ success: true });
  } catch (error) {
    logger.error('Set user data error:', error);
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
  const config = configManager.getPublicConfig();
  res.json({ success: true, config });
});

// Task Management endpoints

// Create a new task
app.post('/api/tasks', ensureServices, async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const { title, description, priority, category, status, dueDate, dueTime, dueDateTime } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const taskData = {
      id: taskId,
      userId,
      title,
      description,
      priority: priority || 'medium',
      category: category || 'personal',
      status: status || 'todo',
      dueDate,
      dueTime,
      dueDateTime
    };

    const result = await database.createTask(taskData);
    res.json({ success: true, task: result });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// Get all tasks for a user
app.get('/api/tasks', ensureServices, async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const status = req.query.status;
    const withAttachments = req.query.withAttachments === 'true';
    
    let tasks;
    if (withAttachments) {
      tasks = await database.getTasksWithAttachments(userId, status);
    } else {
      tasks = await database.getUserTasks(userId, status);
    }
    
    res.json({ success: true, tasks });
  } catch (error) {
    logger.error('Get tasks error:', { 
      message: error.message, 
      userId, 
      status, 
      withAttachments,
      stack: error.stack 
    });
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// Get a specific task
app.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await database.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ success: true, task });
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to retrieve task' });
  }
});

// Update a task
app.put('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    // Convert camelCase to snake_case for database fields
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.dueTime !== undefined) dbUpdates.due_time = updates.dueTime;
    if (updates.dueDateTime !== undefined) dbUpdates.due_datetime = updates.dueDateTime;
    
    const result = await database.updateTask(taskId, dbUpdates);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    logger.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
app.delete('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await database.deleteTask(taskId);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get task statistics
app.get('/api/tasks/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await database.getTaskStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Get task stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve task statistics' });
  }
});

// Get tasks by date range
app.get('/api/tasks/date-range/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const tasks = await database.getTasksByDateRange(userId, startDate, endDate);
    res.json({ success: true, tasks });
  } catch (error) {
    logger.error('Get tasks by date range error:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks by date range' });
  }
});

// Add attachment to task
app.post('/api/tasks/:taskId/attachments/:fileId', async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    await database.addTaskAttachment(taskId, parseInt(fileId));
    res.json({ success: true, message: 'Attachment added successfully' });
  } catch (error) {
    logger.error('Add task attachment error:', error);
    res.status(500).json({ error: 'Failed to add attachment' });
  }
});

// Remove attachment from task
app.delete('/api/tasks/:taskId/attachments/:fileId', async (req, res) => {
  try {
    const { taskId, fileId } = req.params;
    await database.removeTaskAttachment(taskId, parseInt(fileId));
    res.json({ success: true, message: 'Attachment removed successfully' });
  } catch (error) {
    logger.error('Remove task attachment error:', error);
    res.status(500).json({ error: 'Failed to remove attachment' });
  }
});

// Calendar Event Management endpoints

// Create a new event
app.post('/api/events', ensureServices, async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const { title, description, date, time, type, color, location, allDay, recurring, recurringType } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ error: 'Event title and date are required' });
    }

    const eventId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const eventData = {
      id: eventId,
      userId,
      title,
      description,
      date,
      time: allDay ? null : time,
      type: type || 'other',
      color: color || 'blue',
      location,
      allDay: !!allDay,
      recurring: !!recurring,
      recurringType
    };

    const result = await database.createEvent(eventData);
    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

// Get all events for a user
app.get('/api/events', ensureServices, async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    let events;
    if (startDate && endDate) {
      events = await database.getEventsByDateRange(userId, startDate, endDate);
    } else {
      events = await database.getUserEvents(userId);
    }
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

// Update an event
app.put('/api/events/:eventId', ensureServices, async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;
    
    const eventData = {
      title: updates.title,
      description: updates.description,
      date: updates.date,
      time: updates.allDay ? null : updates.time,
      type: updates.type || 'other',
      color: updates.color || 'blue',
      location: updates.location,
      allDay: !!updates.allDay,
      recurring: !!updates.recurring,
      recurringType: updates.recurringType
    };
    
    const result = await database.updateEvent(eventId, eventData);
    
    if (!result) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete an event
app.delete('/api/events/:eventId', ensureServices, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await database.deleteEvent(eventId);
    
    if (!result) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Server error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// Serve uploaded files
app.use('/uploads', express.static('./uploads'));

// Start server
async function startServer() {
  try {
    await initializeServices();
  } catch (error) {
    console.error('Failed to initialize services during startup:', error);
    // Don't exit in serverless environments, let individual routes handle initialization
  }
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Daily Vibe is ready on port ${PORT}!`);
    console.log('📱 Open your browser to:');
    console.log(`   http://localhost:${PORT}`);
    console.log('\n✨ Your task management app is waiting for you!\n');
  });
}

// Export for serverless environments
module.exports = app;

// Start server if running directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}