const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const axios = require('axios');

// Simple auth store singleton
let tokens = null;
const TOKEN_FILE = path.join(os.tmpdir(), 'reddkit-tokens.json');

// Safely access Electron store methods without logging errors for expected conditions
function safeElectronAccess(method, key, defaultValue = null) {
  // Skip entirely if electronApp doesn't exist
  if (!global.electronApp) {
    return defaultValue;
  }
  
  try {
    if (typeof global.electronApp[method] === 'function') {
      return global.electronApp[method](key);
    } else if (global.electronApp.store && 
               typeof global.electronApp.store[method] === 'function') {
      return global.electronApp.store[method](key);
    }
  } catch (err) {
    // Only log at debug level for expected conditions
    console.debug(`Safe electron access failed for ${method}(${key})`, err.message);
  }
  return defaultValue;
}

// Get token from different possible storage locations
function getStoredToken(key) {
  // Try different possible methods
  return safeElectronAccess('getStoredValue', key) || 
         safeElectronAccess('getValue', key) || 
         safeElectronAccess('get', key) || 
         null;
}

// Store token in different possible storage locations
function setStoredToken(key, value) {
  try {
    if (global.electronApp) {
      if (typeof global.electronApp.setStoreValue === 'function') {
        global.electronApp.setStoreValue(key, value);
        return true;
      } else if (global.electronApp.store && typeof global.electronApp.store.set === 'function') {
        global.electronApp.store.set(key, value);
        return true;
      }
    }
  } catch (err) {
    console.error(`Failed to store value for ${key}:`, err.message);
  }
  return false;
}

// Get encryption key for sensitive data
function getEncryptionKey() {
  try {
    const userDataPath = global.electronApp ? 
      global.electronApp.getPath('userData') : 
      path.join(os.homedir(), '.reddkit');
    
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    const keyPath = path.join(userDataPath, 'key');
    
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

// Load tokens from file system
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load tokens from file:', err);
  }
  return null;
}

// Save tokens to file system
function saveTokens(tokenData) {
  try {
    if (!tokenData) {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      return;
    }
    
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData), 'utf8');
  } catch (err) {
    console.error('Failed to save tokens to file:', err);
  }
}

// Get tokens - from memory or file
function getTokens() {
  if (!tokens) {
    tokens = loadTokens();
  }
  
  // Check for electron app storage using safe access methods
  if (!tokens && global.electronApp) {
    // Only attempt to get tokens from Electron if we're in an Electron environment
    try {
      const storedToken = getStoredToken('accessToken');
      const storedRefreshToken = getStoredToken('refreshToken');
      const storedExpiresAt = getStoredToken('expiresAt');
      
      if (storedToken) {
        tokens = {
          accessToken: storedToken,
          refreshToken: storedRefreshToken,
          expiresAt: storedExpiresAt ? parseInt(storedExpiresAt) : null
        };
      }
    } catch (err) {
      // Only log this at debug level since it's expected behavior
      console.debug('Could not access electron store:', err.message);
    }
  }
  
  return tokens;
}

// Set tokens
function setTokens(tokenData) {
  tokens = tokenData;
  
  // Save to file for persistence
  saveTokens(tokenData);
  
  // Also save to electron app if available
  if (tokenData) {
    setStoredToken('accessToken', tokenData.accessToken);
    setStoredToken('refreshToken', tokenData.refreshToken);
    if (tokenData.expiresAt) {
      setStoredToken('expiresAt', tokenData.expiresAt.toString());
    }
  }
}

// Clear tokens
function clearTokens() {
  tokens = null;
  
  // Clear file
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (err) {
    console.error('Failed to delete token file:', err);
  }
  
  // Clear from electron app
  setStoredToken('accessToken', null);
  setStoredToken('refreshToken', null);
  setStoredToken('expiresAt', null);
}

// Refresh access token using refresh token
async function refreshAccessToken(tokens) {
  try {
    if (!tokens || !tokens.refreshToken) {
      console.error('No refresh token available');
      return null;
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    if (!clientId) {
      console.error('Missing Reddit Client ID');
      return null;
    }

    const response = await axios({
      method: 'POST',
      url: 'https://www.reddit.com/api/v1/access_token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:`).toString('base64')}`
      },
      data: `grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refreshToken)}`,
      timeout: 10000
    });

    if (response.data && response.data.access_token) {
      const newTokens = {
        accessToken: response.data.access_token,
        refreshToken: tokens.refreshToken,  // Keep the same refresh token
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };
      return newTokens;
    } else {
      console.error('Invalid response from token refresh');
      return null;
    }
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    return null;
  }
}

module.exports = {
  getTokens,
  setTokens,
  clearTokens,
  getEncryptionKey,
  refreshAccessToken
};