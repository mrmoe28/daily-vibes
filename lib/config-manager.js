const fs = require('fs-extra');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config.json');
    this.config = this.loadConfig();
    this.loadEnvironmentVariables();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return fs.readJsonSync(this.configPath);
      }
    } catch (error) {
      console.warn('Could not load config file:', error.message);
    }

    // Default configuration
    return {
      server: {
        port: 3000,
        host: 'localhost',
        cors: {
          origin: '*',
          credentials: true
        }
      },
      database: {
        type: 'sqlite',
        path: './data/app.db',
        backup: {
          enabled: true,
          interval: 24 * 60 * 60 * 1000, // 24 hours
          keepCount: 7
        }
      },
      security: {
        jwtSecret: 'your-secret-key-change-in-production',
        encryptionKey: null,
        bcryptRounds: 12,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // limit each IP to 100 requests per windowMs
        }
      },
      upload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: ['image/*', 'application/pdf', 'text/*'],
        uploadDir: './uploads',
        maxFiles: 10
      },
      logging: {
        level: 'info',
        file: {
          enabled: false,
          path: './logs/app.log',
          maxSize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        }
      },
      features: {
        userRegistration: true,
        fileUpload: true,
        apiKeys: true,
        sessions: true
      }
    };
  }

  loadEnvironmentVariables() {
    // Override config with environment variables
    const envMappings = {
      'PORT': 'server.port',
      'HOST': 'server.host',
      'JWT_SECRET': 'security.jwtSecret',
      'ENCRYPTION_KEY': 'security.encryptionKey',
      'LOG_LEVEL': 'logging.level',
      'DB_PATH': 'database.path',
      'UPLOAD_DIR': 'upload.uploadDir',
      'MAX_FILE_SIZE': 'upload.maxFileSize',
      'CORS_ORIGIN': 'server.cors.origin'
    };

    for (const [envKey, configPath] of Object.entries(envMappings)) {
      if (process.env[envKey]) {
        this.setNestedValue(configPath, process.env[envKey]);
      }
    }

    // Convert string values to appropriate types
    this.convertTypes();
  }

  setNestedValue(path, value) {
    const keys = path.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  getNestedValue(path) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  convertTypes() {
    // Convert string values to appropriate types
    if (typeof this.config.server.port === 'string') {
      this.config.server.port = parseInt(this.config.server.port, 10);
    }
    
    if (typeof this.config.upload.maxFileSize === 'string') {
      this.config.upload.maxFileSize = parseInt(this.config.upload.maxFileSize, 10);
    }
    
    if (typeof this.config.security.bcryptRounds === 'string') {
      this.config.security.bcryptRounds = parseInt(this.config.security.bcryptRounds, 10);
    }
    
    if (typeof this.config.security.sessionTimeout === 'string') {
      this.config.security.sessionTimeout = parseInt(this.config.security.sessionTimeout, 10);
    }
  }

  get(path) {
    return this.getNestedValue(path);
  }

  set(path, value) {
    this.setNestedValue(path, value);
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }

  getPublicConfig() {
    // Return only public configuration (no secrets)
    const publicConfig = {
      server: {
        port: this.config.server.port,
        host: this.config.server.host
      },
      upload: {
        maxFileSize: this.config.upload.maxFileSize,
        allowedTypes: this.config.upload.allowedTypes,
        maxFiles: this.config.upload.maxFiles
      },
      features: this.config.features
    };

    return publicConfig;
  }

  async save() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, this.config, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  async reload() {
    this.config = this.loadConfig();
    this.loadEnvironmentVariables();
  }

  // Validate configuration
  validate() {
    const errors = [];

    // Check required fields
    if (!this.config.security.jwtSecret || this.config.security.jwtSecret === 'your-secret-key-change-in-production') {
      errors.push('JWT_SECRET should be set to a secure value');
    }

    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Server port must be between 1 and 65535');
    }

    if (this.config.upload.maxFileSize <= 0) {
      errors.push('Max file size must be greater than 0');
    }

    if (this.config.security.bcryptRounds < 10 || this.config.security.bcryptRounds > 14) {
      errors.push('BCrypt rounds should be between 10 and 14');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get configuration for specific service
  getServerConfig() {
    return {
      port: this.config.server.port,
      host: this.config.server.host,
      cors: this.config.server.cors
    };
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getUploadConfig() {
    return this.config.upload;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  getFeaturesConfig() {
    return this.config.features;
  }

  // Check if feature is enabled
  isFeatureEnabled(feature) {
    return this.config.features[feature] === true;
  }

  // Update configuration
  async updateConfig(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
    
    this.convertTypes();
    return await this.save();
  }
}

module.exports = { ConfigManager };
