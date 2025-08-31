const { neon } = require('@neondatabase/serverless');

class DatabaseService {
  constructor() {
    this.sql = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Initialize Neon client with timeout configuration
      this.sql = neon(process.env.DATABASE_URL, {
        fetchOptions: {
          cache: 'no-store'
        }
      });
      
      console.log('Neon serverless database connected successfully');
      
      // Test connection with a simple query first
      await this.sql`SELECT 1 as test`;
      
      await this.createTables();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      // Create users table
      await this.sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          avatar TEXT,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create tasks table (without foreign key constraint for flexibility)
      await this.sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          category TEXT NOT NULL DEFAULT 'personal',
          status TEXT NOT NULL DEFAULT 'todo',
          due_date DATE,
          due_time TIME,
          due_datetime TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create files table
      await this.sql`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          user_id TEXT DEFAULT 'default',
          filename TEXT NOT NULL,
          originalname TEXT,
          mimetype TEXT,
          size INTEGER,
          path TEXT,
          url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create file_attachments table
      await this.sql`
        CREATE TABLE IF NOT EXISTS file_attachments (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          original_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create calendar_events table
      await this.sql`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          title TEXT NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          time TIME,
          type TEXT DEFAULT 'other',
          color TEXT DEFAULT 'blue',
          location TEXT,
          all_day BOOLEAN DEFAULT FALSE,
          recurring BOOLEAN DEFAULT FALSE,
          recurring_type TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_context table for AI memory
      await this.sql`
        CREATE TABLE IF NOT EXISTS user_context (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          context_key TEXT NOT NULL,
          context_value TEXT,
          category TEXT DEFAULT 'contextual',
          relevance_score DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_accessed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 1,
          UNIQUE(user_id, context_key)
        )
      `;

      // Create conversations table for AI chat history
      await this.sql`
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          session_id TEXT,
          user_message TEXT NOT NULL,
          assistant_response TEXT NOT NULL,
          intent TEXT,
          entities JSONB DEFAULT '{}',
          context_score DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create ai_events_log table for tracking AI-generated events
      await this.sql`
        CREATE TABLE IF NOT EXISTS ai_events_log (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          natural_query TEXT NOT NULL,
          parsed_intent TEXT,
          parsed_entities JSONB DEFAULT '{}',
          event_id TEXT,
          success BOOLEAN DEFAULT FALSE,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_feedback table for AI improvement
      await this.sql`
        CREATE TABLE IF NOT EXISTS user_feedback (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          conversation_id INTEGER,
          feedback_type TEXT NOT NULL, -- 'positive', 'negative', 'correction'
          feedback_text TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
      `;

      // Create indexes for performance
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON user_context(user_id)
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_user_context_category ON user_context(category)
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_ai_events_log_user_id ON ai_events_log(user_id)
      `;

      console.log('Database tables created/verified successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Task management methods
  async createTask(taskData) {
    try {
      const result = await this.sql`
        INSERT INTO tasks (
          id, user_id, title, description, priority, category, status,
          due_date, due_time, due_datetime, created_at, updated_at
        ) VALUES (
          ${taskData.id}, ${taskData.userId}, ${taskData.title}, ${taskData.description},
          ${taskData.priority}, ${taskData.category}, ${taskData.status},
          ${taskData.dueDate}, ${taskData.dueTime}, ${taskData.dueDateTime},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async getUserTasks(userId = 'default', status = null) {
    try {
      let tasks;
      if (status) {
        tasks = await this.sql`
          SELECT * FROM tasks 
          WHERE user_id = ${userId} AND status = ${status}
          ORDER BY created_at DESC
        `;
      } else {
        tasks = await this.sql`
          SELECT * FROM tasks 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `;
      }

      return tasks;
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      throw error;
    }
  }

  async getTasksWithAttachments(userId = 'default', status = null) {
    try {
      let tasks;
      if (status) {
        tasks = await this.sql`
          SELECT t.*, 
                 COALESCE(
                   json_agg(
                     json_build_object(
                       'id', fa.id,
                       'original_name', fa.original_name,
                       'filename', fa.filename,
                       'file_path', fa.file_path,
                       'file_size', fa.file_size,
                       'mime_type', fa.mime_type,
                       'created_at', fa.created_at
                     ) ORDER BY fa.created_at
                   ) FILTER (WHERE fa.id IS NOT NULL), 
                   '[]'
                 ) as attachments
          FROM tasks t
          LEFT JOIN file_attachments fa ON t.id = fa.task_id
          WHERE t.user_id = ${userId} AND t.status = ${status}
          GROUP BY t.id, t.user_id, t.title, t.description, t.priority, t.category, t.status, 
                   t.due_date, t.due_time, t.due_datetime, t.created_at, t.updated_at
          ORDER BY t.created_at DESC
        `;
      } else {
        tasks = await this.sql`
          SELECT t.*, 
                 COALESCE(
                   json_agg(
                     json_build_object(
                       'id', fa.id,
                       'original_name', fa.original_name,
                       'filename', fa.filename,
                       'file_path', fa.file_path,
                       'file_size', fa.file_size,
                       'mime_type', fa.mime_type,
                       'created_at', fa.created_at
                     ) ORDER BY fa.created_at
                   ) FILTER (WHERE fa.id IS NOT NULL), 
                   '[]'
                 ) as attachments
          FROM tasks t
          LEFT JOIN file_attachments fa ON t.id = fa.task_id
          WHERE t.user_id = ${userId}
          GROUP BY t.id, t.user_id, t.title, t.description, t.priority, t.category, t.status, 
                   t.due_date, t.due_time, t.due_datetime, t.created_at, t.updated_at
          ORDER BY t.created_at DESC
        `;
      }

      return tasks;
    } catch (error) {
      console.error('Error fetching tasks with attachments:', error);
      throw error;
    }
  }

  async updateTask(taskId, taskData) {
    try {
      const result = await this.sql`
        UPDATE tasks 
        SET 
          title = ${taskData.title},
          description = ${taskData.description},
          priority = ${taskData.priority},
          category = ${taskData.category},
          status = ${taskData.status},
          due_date = ${taskData.dueDate},
          due_time = ${taskData.dueTime},
          due_datetime = ${taskData.dueDateTime},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${taskId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(taskId) {
    try {
      const result = await this.sql`
        DELETE FROM tasks 
        WHERE id = ${taskId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  async updateTaskStatus(taskId, status) {
    try {
      const result = await this.sql`
        UPDATE tasks 
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${taskId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  }

  // User management methods
  async createUser(userData) {
    try {
      const result = await this.sql`
        INSERT INTO users (id, email, password_hash, name, avatar, preferences)
        VALUES (${userData.id}, ${userData.email}, ${userData.passwordHash}, 
                ${userData.name}, ${userData.avatar}, ${JSON.stringify(userData.preferences || {})})
        RETURNING id, email, name, avatar, preferences, created_at
      `;

      return result[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const result = await this.sql`
        SELECT * FROM users WHERE email = ${email}
      `;

      return result[0];
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const result = await this.sql`
        SELECT id, email, name, avatar, preferences, created_at 
        FROM users WHERE id = ${userId}
      `;

      return result[0];
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  // File attachment methods
  async addTaskAttachment(attachmentData) {
    try {
      const result = await this.sql`
        INSERT INTO file_attachments (id, task_id, original_name, filename, file_path, file_size, mime_type)
        VALUES (${attachmentData.id}, ${attachmentData.taskId}, ${attachmentData.originalName},
                ${attachmentData.filename}, ${attachmentData.filePath}, ${attachmentData.fileSize}, ${attachmentData.mimeType})
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error adding task attachment:', error);
      throw error;
    }
  }

  async getTaskAttachments(taskId) {
    try {
      const attachments = await this.sql`
        SELECT * FROM file_attachments WHERE task_id = ${taskId}
      `;

      return attachments;
    } catch (error) {
      console.error('Error fetching task attachments:', error);
      throw error;
    }
  }

  async removeTaskAttachment(attachmentId) {
    try {
      const result = await this.sql`
        DELETE FROM file_attachments WHERE id = ${attachmentId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error removing task attachment:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.sql`SELECT 1 as health`;
      return result[0].health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Calendar event management methods
  async createEvent(eventData) {
    try {
      const result = await this.sql`
        INSERT INTO calendar_events (
          id, user_id, title, description, date, time, type, color,
          location, all_day, recurring, recurring_type, created_at, updated_at
        ) VALUES (
          ${eventData.id}, ${eventData.userId}, ${eventData.title}, ${eventData.description},
          ${eventData.date}, ${eventData.time}, ${eventData.type}, ${eventData.color},
          ${eventData.location}, ${eventData.allDay}, ${eventData.recurring}, ${eventData.recurringType},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async getUserEvents(userId = 'default') {
    try {
      const events = await this.sql`
        SELECT * FROM calendar_events
        WHERE user_id = ${userId}
        ORDER BY date ASC, time ASC
      `;

      return events;
    } catch (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }
  }

  async updateEvent(eventId, eventData) {
    try {
      const result = await this.sql`
        UPDATE calendar_events
        SET
          title = ${eventData.title},
          description = ${eventData.description},
          date = ${eventData.date},
          time = ${eventData.time},
          type = ${eventData.type},
          color = ${eventData.color},
          location = ${eventData.location},
          all_day = ${eventData.allDay},
          recurring = ${eventData.recurring},
          recurring_type = ${eventData.recurringType},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${eventId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId) {
    try {
      const result = await this.sql`
        DELETE FROM calendar_events
        WHERE id = ${eventId}
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  async getEventsByDateRange(userId, startDate, endDate) {
    try {
      const events = await this.sql`
        SELECT * FROM calendar_events
        WHERE user_id = ${userId}
        AND date >= ${startDate}
        AND date <= ${endDate}
        ORDER BY date ASC, time ASC
      `;

      return events;
    } catch (error) {
      console.error('Error fetching events by date range:', error);
      throw error;
    }
  }

  // Additional task methods
  async getTaskById(taskId) {
    try {
      const result = await this.sql`
        SELECT * FROM tasks WHERE id = ${taskId}
      `;
      return result[0];
    } catch (error) {
      console.error('Error fetching task by ID:', error);
      throw error;
    }
  }

  async getTaskStats(userId) {
    try {
      const stats = await this.sql`
        SELECT 
          status,
          COUNT(*) as count
        FROM tasks 
        WHERE user_id = ${userId}
        GROUP BY status
      `;
      return stats;
    } catch (error) {
      console.error('Error fetching task stats:', error);
      throw error;
    }
  }

  async getTasksByDateRange(userId, startDate, endDate) {
    try {
      const tasks = await this.sql`
        SELECT * FROM tasks 
        WHERE user_id = ${userId}
        AND due_date >= ${startDate}
        AND due_date <= ${endDate}
        ORDER BY due_date ASC
      `;
      return tasks;
    } catch (error) {
      console.error('Error fetching tasks by date range:', error);
      throw error;
    }
  }

  async addTaskAttachment(taskId, fileId) {
    try {
      const result = await this.sql`
        INSERT INTO file_attachments (id, task_id, original_name, filename, file_path)
        SELECT ${Date.now().toString(36) + Math.random().toString(36).substr(2)}, ${taskId}, filename, filename, path
        FROM files WHERE id = ${fileId}
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error adding task attachment:', error);
      throw error;
    }
  }

  async removeTaskAttachment(taskId, fileId) {
    try {
      const result = await this.sql`
        DELETE FROM file_attachments 
        WHERE task_id = ${taskId} AND id = ${fileId}
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error removing task attachment:', error);
      throw error;
    }
  }

  // User data methods
  async getUserData(userId) {
    try {
      const result = await this.sql`
        SELECT preferences FROM users WHERE id = ${userId}
      `;
      return result[0]?.preferences || {};
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  }

  async setUserData(userId, key, value) {
    try {
      await this.sql`
        UPDATE users 
        SET preferences = preferences || ${JSON.stringify({[key]: value})}
        WHERE id = ${userId}
      `;
    } catch (error) {
      console.error('Error setting user data:', error);
      throw error;
    }
  }

  async storeFile(fileData) {
    try {
      const result = await this.sql`
        INSERT INTO files (
          filename, originalname, mimetype, size, path, url, user_id
        ) VALUES (
          ${fileData.filename}, ${fileData.originalname}, ${fileData.mimetype},
          ${fileData.size}, ${fileData.path}, ${fileData.url}, ${fileData.userId}
        )
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error storing file:', error);
      throw error;
    }
  }

  // Cleanup method (not needed for serverless, but kept for compatibility)
  async close() {
    // Neon serverless connections are automatically managed
    console.log('Neon serverless connection cleanup completed');
  }

  // AI Assistant Methods

  // User context and memory methods
  async storeUserMemory(memory) {
    try {
      const result = await this.sql`
        INSERT INTO user_context (
          user_id, context_key, context_value, category, relevance_score, 
          created_at, last_accessed, access_count
        ) VALUES (
          ${memory.user_id}, ${memory.memory_key}, ${memory.memory_value}, 
          ${memory.category}, ${memory.relevance_score}, ${memory.created_at}, 
          ${memory.last_accessed}, ${memory.access_count}
        )
        ON CONFLICT (user_id, context_key)
        DO UPDATE SET
          context_value = EXCLUDED.context_value,
          relevance_score = EXCLUDED.relevance_score,
          last_accessed = EXCLUDED.last_accessed,
          access_count = user_context.access_count + 1
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error('Error storing user memory:', error);
      throw error;
    }
  }

  async getUserMemory(userId, key) {
    try {
      const result = await this.sql`
        SELECT * FROM user_context 
        WHERE user_id = ${userId} AND context_key = ${key}
      `;
      return result[0] || null;
    } catch (error) {
      console.error('Error retrieving user memory:', error);
      throw error;
    }
  }

  async getUserMemoriesByCategory(userId, category, limit = 50) {
    try {
      const result = await this.sql`
        SELECT * FROM user_context 
        WHERE user_id = ${userId} AND category = ${category}
        ORDER BY relevance_score DESC, last_accessed DESC
        LIMIT ${limit}
      `;
      return result;
    } catch (error) {
      console.error('Error retrieving memories by category:', error);
      throw error;
    }
  }

  async getAllUserMemories(userId) {
    try {
      const result = await this.sql`
        SELECT * FROM user_context 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return result;
    } catch (error) {
      console.error('Error retrieving all user memories:', error);
      throw error;
    }
  }

  async updateMemoryAccessStats(userId, key, accessCount, lastAccessed) {
    try {
      await this.sql`
        UPDATE user_context 
        SET access_count = ${accessCount}, last_accessed = ${lastAccessed}
        WHERE user_id = ${userId} AND context_key = ${key}
      `;
    } catch (error) {
      console.error('Error updating memory access stats:', error);
      throw error;
    }
  }

  async deleteOldMemories(cutoffDate, category, minRelevance) {
    try {
      const result = await this.sql`
        DELETE FROM user_context 
        WHERE created_at < ${cutoffDate} 
          AND category = ${category} 
          AND relevance_score < ${minRelevance}
      `;
      return result.length;
    } catch (error) {
      console.error('Error deleting old memories:', error);
      throw error;
    }
  }

  // Conversation methods
  async storeConversation(conversation) {
    try {
      const result = await this.sql`
        INSERT INTO conversations (
          user_id, session_id, user_message, assistant_response, 
          intent, entities, context_score, created_at
        ) VALUES (
          ${conversation.user_id}, ${conversation.session_id}, 
          ${conversation.user_message}, ${conversation.assistant_response}, 
          ${conversation.intent}, ${JSON.stringify(conversation.entities)}, 
          ${conversation.context_score}, ${conversation.created_at}
        )
        RETURNING id
      `;
      return result[0].id;
    } catch (error) {
      console.error('Error storing conversation:', error);
      throw error;
    }
  }

  async getConversationHistory(userId, sessionId = null, limit = 10) {
    try {
      let result;
      if (sessionId) {
        result = await this.sql`
          SELECT * FROM conversations 
          WHERE user_id = ${userId} AND session_id = ${sessionId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
      } else {
        result = await this.sql`
          SELECT * FROM conversations 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
      }
      return result.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      throw error;
    }
  }

  // AI events tracking
  async logAIEvent(eventLog) {
    try {
      const result = await this.sql`
        INSERT INTO ai_events_log (
          user_id, natural_query, parsed_intent, parsed_entities, 
          event_id, success, error_message, created_at
        ) VALUES (
          ${eventLog.user_id}, ${eventLog.natural_query}, 
          ${eventLog.parsed_intent}, ${JSON.stringify(eventLog.parsed_entities)}, 
          ${eventLog.event_id}, ${eventLog.success}, 
          ${eventLog.error_message}, CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
      return result[0].id;
    } catch (error) {
      console.error('Error logging AI event:', error);
      throw error;
    }
  }

  // User feedback methods
  async storeFeedback(feedback) {
    try {
      const result = await this.sql`
        INSERT INTO user_feedback (
          user_id, conversation_id, feedback_type, feedback_text, created_at
        ) VALUES (
          ${feedback.user_id}, ${feedback.message_id}, 
          ${feedback.feedback}, ${feedback.feedback_text || null}, 
          ${feedback.created_at}
        )
        RETURNING id
      `;
      return result[0].id;
    } catch (error) {
      console.error('Error storing feedback:', error);
      throw error;
    }
  }

  // Helper methods for AI
  async getUserContext(userId) {
    try {
      const memories = await this.sql`
        SELECT context_key, context_value, category, relevance_score
        FROM user_context 
        WHERE user_id = ${userId}
        ORDER BY relevance_score DESC, last_accessed DESC
        LIMIT 50
      `;

      const preferences = await this.sql`
        SELECT preferences FROM users WHERE id = ${userId}
      `;

      return {
        userId,
        memories: memories.reduce((acc, memory) => {
          acc[memory.context_key] = {
            value: memory.context_value,
            category: memory.category,
            relevance: memory.relevance_score
          };
          return acc;
        }, {}),
        preferences: preferences[0]?.preferences || {}
      };
    } catch (error) {
      console.error('Error retrieving user context:', error);
      return { userId, memories: {}, preferences: {} };
    }
  }

  async getUserEvents(userId, daysBack = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const result = await this.sql`
        SELECT * FROM calendar_events 
        WHERE user_id = ${userId} AND date >= ${cutoffDate.toISOString().split('T')[0]}
        ORDER BY date DESC, time DESC
      `;
      return result;
    } catch (error) {
      console.error('Error retrieving user events:', error);
      throw error;
    }
  }

  async getEventsByDateRange(userId, startDate, endDate) {
    try {
      const result = await this.sql`
        SELECT * FROM calendar_events 
        WHERE user_id = ${userId} 
          AND date >= ${startDate} 
          AND date <= ${endDate}
        ORDER BY date ASC, time ASC
      `;
      return result;
    } catch (error) {
      console.error('Error retrieving events by date range:', error);
      throw error;
    }
  }

  async updateUserPreference(userId, key, value) {
    try {
      // First, get current preferences
      const currentPrefs = await this.sql`
        SELECT preferences FROM users WHERE id = ${userId}
      `;
      
      const preferences = currentPrefs[0]?.preferences || {};
      preferences[key] = value;
      
      await this.sql`
        UPDATE users 
        SET preferences = ${JSON.stringify(preferences)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    } catch (error) {
      console.error('Error updating user preference:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;