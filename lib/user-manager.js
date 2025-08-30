const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class UserManager {
  constructor(database, encryption) {
    this.database = database;
    this.encryption = encryption;
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }

  async createUser({ email, password, name }) {
    try {
      // Check if user already exists
      const existingUser = await this.database.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Generate user ID and API key
      const userId = uuidv4();
      const apiKey = this.encryption.generateApiKey();

      // Create user
      await this.database.run(
        'INSERT INTO users (id, email, password_hash, name, api_key) VALUES (?, ?, ?, ?, ?)',
        [userId, email, passwordHash, name, apiKey]
      );

      // Return user without password
      return {
        id: userId,
        email,
        name,
        apiKey
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async authenticate(email, password) {
    try {
      // Find user by email
      const user = await this.database.get(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Store session
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await this.database.run(
        'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, token, expiresAt.toISOString()]
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          apiKey: user.api_key
        }
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      // Check if token exists in sessions
      const session = await this.database.get(
        'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
        [token, new Date().toISOString()]
      );

      if (!session) {
        throw new Error('Invalid or expired token');
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Get user data
      const user = await this.database.get(
        'SELECT id, email, name, api_key FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const user = await this.database.get(
        'SELECT id, email, name, api_key, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async updateUser(userId, updates) {
    try {
      const allowedFields = ['name', 'email'];
      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateValues.push(userId);
      
      await this.database.run(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      return await this.getUserById(userId);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      // Delete user sessions
      await this.database.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
      
      // Delete user data
      await this.database.run('DELETE FROM user_data WHERE user_id = ?', [userId]);
      
      // Delete user files
      await this.database.run('DELETE FROM files WHERE user_id = ?', [userId]);
      
      // Delete user
      await this.database.run('DELETE FROM users WHERE id = ?', [userId]);

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  async logout(token) {
    try {
      await this.database.run('DELETE FROM sessions WHERE token = ?', [token]);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions() {
    try {
      await this.database.run('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }
}

module.exports = { UserManager };
