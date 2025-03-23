const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class AuthStore {
  // Update the constructor to use global.electronApp if available
  constructor() {
    // Use global.electronApp for Electron environments
    const electronApp = global.electronApp || require('electron').app;
    this.userDataPath = electronApp.getPath('userData');
    this.tokenPath = path.join(this.userDataPath, 'reddit-tokens.json');
    this.encryptionKey = this.getEncryptionKey();
    this.tokens = this.loadTokens();
  }

  // Generate or retrieve a consistent encryption key
  getEncryptionKey() {
    const keyPath = path.join(this.userDataPath, 'key');
    
    try {
      // Try to load existing key
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      }
      
      // Generate new key if it doesn't exist
      const key = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, key);
      return key;
    } catch (error) {
      console.error('Error with encryption key:', error);
      // Fallback to a derived key if file operations fail
      return crypto.createHash('sha256').update('reddkit-secret-key').digest('hex');
    }
  }

  // Simple encryption for token storage
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to unencrypted if encryption fails
    }
  }

  // Decryption for stored tokens
  decrypt(text) {
    try {
      const parts = text.split(':');
      if (parts.length !== 2) return text; // Not encrypted or invalid format
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return text; // Return original text if decryption fails
    }
  }

  // Load tokens from file
  loadTokens() {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const encryptedData = fs.readFileSync(this.tokenPath, 'utf8');
        const decryptedData = this.decrypt(encryptedData);
        return JSON.parse(decryptedData);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
    return null;
  }

  // Save tokens to file
  saveTokens(tokens) {
    try {
      if (!tokens) {
        // If tokens is null, remove the file
        if (fs.existsSync(this.tokenPath)) {
          fs.unlinkSync(this.tokenPath);
        }
        this.tokens = null;
        return;
      }
      
      const encryptedData = this.encrypt(JSON.stringify(tokens));
      
      // Ensure directory exists
      fs.mkdirSync(this.userDataPath, { recursive: true });
      
      // Write tokens to file
      fs.writeFileSync(this.tokenPath, encryptedData);
      this.tokens = tokens;
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  // Get current tokens
  getTokens() {
    return this.tokens;
  }

  // Set new tokens
  setTokens(tokens) {
    this.saveTokens(tokens);
  }

  // Clear tokens (logout)
  clearTokens() {
    this.saveTokens(null);
  }
}

module.exports = new AuthStore();