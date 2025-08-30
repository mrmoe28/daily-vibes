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

      this.sql = neon(process.env.DATABASE_URL);
      console.log('Neon serverless database connected successfully');
      
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

  async getUserTasks(userId = 'default') {
    try {
      const tasks = await this.sql`
        SELECT * FROM tasks 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;

      return tasks;
    } catch (error) {
      console.error('Error fetching user tasks:', error);
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

  // Cleanup method (not needed for serverless, but kept for compatibility)
  async close() {
    // Neon serverless connections are automatically managed
    console.log('Neon serverless connection cleanup completed');
  }
}

module.exports = DatabaseService;