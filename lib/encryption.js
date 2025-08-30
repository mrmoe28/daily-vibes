const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // Use environment variable for encryption key, or generate a default one
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateDefaultKey();
    this.algorithm = 'aes-256-gcm';
  }

  generateDefaultKey() {
    // Generate a default key based on some system properties
    // In production, you should use a proper environment variable
    const systemInfo = require('os').hostname() + require('os').platform();
    return crypto.scryptSync(systemInfo, 'salt', 32);
  }

  encrypt(text) {
    if (!text) return null;
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted
      });
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const data = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(data.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateUUID() {
    return crypto.randomUUID();
  }

  // Generate a secure API key
  generateApiKey() {
    const prefix = 'sk';
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(24).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `${prefix}_${timestamp}_${random}`;
  }

  // Hash data with SHA256
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Create HMAC signature
  createHmac(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Verify HMAC signature
  verifyHmac(data, signature, secret) {
    const expectedSignature = this.createHmac(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = { EncryptionService };