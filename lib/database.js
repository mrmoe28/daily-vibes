const { Pool } = require('pg');
const Database = require('sqlite3').Database;
const path = require('path');
const fs = require('fs-extra');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.db = null;
    this.dbType = 'postgres'; // Default to postgres
  }

  async initialize() {
    try {
      const databaseUrl = process.env.DATABASE_URL || 'sqlite://./data/app.db';
      
      if (databaseUrl.startsWith('sqlite://')) {
        // SQLite configuration
        this.dbType = 'sqlite';
        const dbPath = databaseUrl.replace('sqlite://', '');
        
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        await fs.ensureDir(dir);
        
        this.db = new Database(dbPath);
        console.log('SQLite database connected successfully');
      } else {
        // PostgreSQL configuration
        this.dbType = 'postgres';
        this.pool = new Pool({
          connectionString: databaseUrl,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test the connection
        await this.pool.query('SELECT 1');
        console.log('PostgreSQL database connected successfully');
      }
      
      await this.createTables();
      return true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    let tables;
    
    if (this.dbType === 'sqlite') {
      tables = [
        // Users table - SQLite version
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password_hash TEXT,
          name TEXT,
          api_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Files table - SQLite version
        `CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT DEFAULT 'default',
          filename TEXT NOT NULL,
          originalname TEXT,
          mimetype TEXT,
          size INTEGER,
          path TEXT,
          url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // User data table - SQLite version
        `CREATE TABLE IF NOT EXISTS user_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, key)
        )`,

        // Sessions table - SQLite version
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tasks table - SQLite version
        `CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          category TEXT NOT NULL DEFAULT 'personal',
          status TEXT NOT NULL DEFAULT 'todo',
          due_date DATE,
          due_time TIME,
          due_datetime DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,

        // Task attachments table - SQLite version
        `CREATE TABLE IF NOT EXISTS task_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          file_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        )`
      ];
    } else {
      tables = [
        // Users table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          password_hash TEXT,
          name TEXT,
          api_key TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,

        // Files table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          user_id TEXT DEFAULT 'default',
          filename TEXT NOT NULL,
          originalname TEXT,
          mimetype TEXT,
          size INTEGER,
          path TEXT,
          url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,

        // User data table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS user_data (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, key)
        )`,

        // Sessions table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tasks table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS tasks (
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
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,

        // Task attachments table - PostgreSQL version
        `CREATE TABLE IF NOT EXISTS task_attachments (
          id SERIAL PRIMARY KEY,
          task_id TEXT NOT NULL,
          file_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        )`
      ];
    }

    for (const sql of tables) {
      await this.query(sql);
    }
  }

  // Database helper methods
  async query(sql, params = []) {
    try {
      if (this.dbType === 'sqlite') {
        // Convert PostgreSQL-style parameters ($1, $2) to SQLite-style (?)
        let convertedSql = sql;
        for (let i = params.length; i >= 1; i--) {
          convertedSql = convertedSql.replace(new RegExp('\\$' + i, 'g'), '?');
        }
        // Remove RETURNING clauses which SQLite doesn't support
        convertedSql = convertedSql.replace(/RETURNING \*/gi, '');
        
        return new Promise((resolve, reject) => {
          if (convertedSql.trim().toUpperCase().startsWith('SELECT')) {
            this.db.all(convertedSql, params, (err, rows) => {
              if (err) reject(err);
              else resolve({ rows });
            });
          } else {
            this.db.run(convertedSql, params, function(err) {
              if (err) reject(err);
              else resolve({ rows: [], rowCount: this.changes, insertId: this.lastID });
            });
          }
        });
      } else {
        const result = await this.pool.query(sql, params);
        return result;
      }
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    return await this.query(sql, params);
  }

  // User methods
  async createUser(userData) {
    const { id, email, passwordHash, name, apiKey } = userData;
    const sql = `
      INSERT INTO users (id, email, password_hash, name, api_key)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    return this.query(sql, [id, email, passwordHash, name, apiKey]);
  }

  async getUserByEmail(email) {
    return this.get('SELECT * FROM users WHERE email = $1', [email]);
  }

  async getUserById(id) {
    return this.get('SELECT * FROM users WHERE id = $1', [id]);
  }

  async updateUser(id, updates) {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const sql = `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`;
    return this.query(sql, values);
  }

  // File methods
  async storeFile(fileData) {
    const { userId, filename, originalname, mimetype, size, path, url } = fileData;
    const sql = `
      INSERT INTO files (user_id, filename, originalname, mimetype, size, path, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    return this.query(sql, [userId, filename, originalname, mimetype, size, path, url]);
  }

  async getUserFiles(userId) {
    return this.all('SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  }

  async deleteFile(fileId) {
    return this.query('DELETE FROM files WHERE id = $1', [fileId]);
  }

  // User data methods (key-value store)
  async getUserData(userId, key = null) {
    if (key) {
      return this.get('SELECT * FROM user_data WHERE user_id = $1 AND key = $2', [userId, key]);
    }
    return this.all('SELECT * FROM user_data WHERE user_id = $1', [userId]);
  }

  async setUserData(userId, key, value) {
    const sql = `
      INSERT INTO user_data (user_id, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT(user_id, key) 
      DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return this.query(sql, [userId, key, value]);
  }

  async deleteUserData(userId, key) {
    return this.query('DELETE FROM user_data WHERE user_id = $1 AND key = $2', [userId, key]);
  }

  // Session methods
  async createSession(sessionData) {
    const { id, userId, token, expiresAt } = sessionData;
    const sql = `
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    return this.query(sql, [id, userId, token, expiresAt]);
  }

  async getSession(token) {
    return this.get('SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()', [token]);
  }

  async deleteSession(token) {
    return this.query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  async cleanExpiredSessions() {
    return this.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  }

  // Task management methods
  async createTask(taskData) {
    const { 
      id, 
      userId = 'default', 
      title, 
      description, 
      priority = 'medium', 
      category = 'personal', 
      status = 'todo',
      dueDate,
      dueTime,
      dueDateTime
    } = taskData;

    const sql = `
      INSERT INTO tasks (id, user_id, title, description, priority, category, status, due_date, due_time, due_datetime)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    return this.query(sql, [id, userId, title, description, priority, category, status, dueDate, dueTime, dueDateTime]);
  }

  async getTaskById(taskId) {
    return this.get('SELECT * FROM tasks WHERE id = $1', [taskId]);
  }

  async getUserTasks(userId, status = null) {
    let sql = 'SELECT * FROM tasks WHERE user_id = $1';
    let params = [userId];
    
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    return this.all(sql, params);
  }

  async updateTask(taskId, updates) {
    const allowedFields = ['title', 'description', 'priority', 'category', 'status', 'due_date', 'due_time', 'due_datetime'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(taskId);

    const sql = `
      UPDATE tasks 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length}
      RETURNING *
    `;
    return this.query(sql, values);
  }

  async deleteTask(taskId) {
    // First delete any attachments
    await this.query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
    // Then delete the task
    return this.query('DELETE FROM tasks WHERE id = $1', [taskId]);
  }

  async getTasksWithAttachments(userId, status = null) {
    if (this.dbType === 'sqlite') {
      // SQLite version with json_group_array
      let sql = `
        SELECT 
          t.*,
          CASE 
            WHEN COUNT(f.id) > 0 THEN json_group_array(
              json_object(
                'id', f.id,
                'filename', f.filename,
                'originalname', f.originalname,
                'url', f.url,
                'size', f.size,
                'mimetype', f.mimetype
              )
            )
            ELSE json_array()
          END as attachments
        FROM tasks t
        LEFT JOIN task_attachments ta ON t.id = ta.task_id
        LEFT JOIN files f ON ta.file_id = f.id
        WHERE t.user_id = $1
      `;
      
      let params = [userId];
      
      if (status) {
        sql += ' AND t.status = $2';
        params.push(status);
      }
      
      sql += ' GROUP BY t.id ORDER BY t.created_at DESC';
      
      const tasks = await this.all(sql, params);
      
      // Process attachments for each task
      return tasks.map(task => ({
        ...task,
        attachments: task.attachments ? JSON.parse(task.attachments) : []
      }));
    } else {
      // PostgreSQL version with json_agg
      let sql = `
        SELECT 
          t.*,
          COALESCE(
            json_agg(
              CASE 
                WHEN f.id IS NOT NULL THEN json_build_object(
                  'id', f.id,
                  'filename', f.filename,
                  'originalname', f.originalname,
                  'url', f.url,
                  'size', f.size,
                  'mimetype', f.mimetype
                )
                ELSE NULL
              END
            ) FILTER (WHERE f.id IS NOT NULL),
            '[]'::json
          ) as attachments
        FROM tasks t
        LEFT JOIN task_attachments ta ON t.id = ta.task_id
        LEFT JOIN files f ON ta.file_id = f.id
        WHERE t.user_id = $1
      `;
      
      let params = [userId];
      
      if (status) {
        sql += ' AND t.status = $2';
        params.push(status);
      }
      
      sql += ' GROUP BY t.id ORDER BY t.created_at DESC';
      
      const tasks = await this.all(sql, params);
      
      return tasks.map(task => ({
        ...task,
        attachments: Array.isArray(task.attachments) ? task.attachments : []
      }));
    }
  }

  async addTaskAttachment(taskId, fileId) {
    const sql = `
      INSERT INTO task_attachments (task_id, file_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    return this.query(sql, [taskId, fileId]);
  }

  async removeTaskAttachment(taskId, fileId) {
    return this.query('DELETE FROM task_attachments WHERE task_id = $1 AND file_id = $2', [taskId, fileId]);
  }

  async getTasksByDateRange(userId, startDate, endDate) {
    const sql = `
      SELECT * FROM tasks 
      WHERE user_id = $1 
      AND due_date BETWEEN $2 AND $3
      ORDER BY due_date, due_time
    `;
    return this.all(sql, [userId, startDate, endDate]);
  }

  async getTaskStats(userId) {
    const sql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM tasks 
      WHERE user_id = $1 
      GROUP BY status
    `;
    const results = await this.all(sql, [userId]);
    
    // Convert to object format
    const stats = {
      total: 0,
      todo: 0,
      progress: 0,
      completed: 0
    };
    
    results.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });
    
    return stats;
  }
}

module.exports = { DatabaseService };