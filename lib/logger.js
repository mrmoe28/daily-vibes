class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  _shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message
    };

    if (data) {
      logEntry.data = data;
    }

    return JSON.stringify(logEntry);
  }

  error(message, data = null) {
    if (this._shouldLog('error')) {
      console.error(this._formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this._shouldLog('warn')) {
      console.warn(this._formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this._shouldLog('info')) {
      console.log(this._formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this._shouldLog('debug')) {
      console.log(this._formatMessage('debug', message, data));
    }
  }

  // Log HTTP requests
  logRequest(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
      };

      if (res.statusCode >= 400) {
        this.error(`${req.method} ${req.url} - ${res.statusCode}`, logData);
      } else {
        this.info(`${req.method} ${req.url} - ${res.statusCode}`, logData);
      }
    });

    next();
  }

  // Log database operations
  logDatabase(operation, table, duration, success = true) {
    const message = `Database ${operation} on ${table}`;
    const data = {
      operation,
      table,
      duration: `${duration}ms`,
      success
    };

    if (success) {
      this.debug(message, data);
    } else {
      this.error(message, data);
    }
  }

  // Log authentication events
  logAuth(event, userId, success = true) {
    const message = `Authentication ${event}`;
    const data = {
      event,
      userId,
      success,
      timestamp: new Date().toISOString()
    };

    if (success) {
      this.info(message, data);
    } else {
      this.warn(message, data);
    }
  }

  // Log file operations
  logFile(operation, filename, size = null, success = true) {
    const message = `File ${operation}: ${filename}`;
    const data = {
      operation,
      filename,
      size: size ? `${size} bytes` : null,
      success
    };

    if (success) {
      this.info(message, data);
    } else {
      this.error(message, data);
    }
  }

  // Log system events
  logSystem(event, details = null) {
    const message = `System ${event}`;
    const data = {
      event,
      details,
      timestamp: new Date().toISOString()
    };

    this.info(message, data);
  }

  // Log performance metrics
  logPerformance(operation, duration, metadata = null) {
    const message = `Performance: ${operation}`;
    const data = {
      operation,
      duration: `${duration}ms`,
      metadata
    };

    if (duration > 1000) {
      this.warn(message, data);
    } else {
      this.debug(message, data);
    }
  }

  // Get current log level
  getLogLevel() {
    return this.logLevel;
  }

  // Set log level
  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    } else {
      this.error(`Invalid log level: ${level}`);
    }
  }
}

module.exports = { Logger };
