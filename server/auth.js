const authStore = require('./auth-store');

// Define the proxy configuration
const PROXY_CONFIG = {
  baseUrl: 'https://auth.sveinbjorn.dev',
  redirectUri: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com/auth_callback' 
    : 'http://127.0.0.1:3000/auth_callback'
};

// Check if user is authenticated and refresh token if needed
async function ensureAuthenticated(req, res, next) {
  const tokens = authStore.getTokens();
  
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Check if token needs refresh (5 minutes buffer)
  if (tokens.expiresAt - 300000 < Date.now()) {
    try {
      const refreshedTokens = await refreshAccessToken(tokens);
      if (refreshedTokens) {
        authStore.setTokens(refreshedTokens);
      } else {
        // If refresh fails, clear tokens
        authStore.clearTokens();
        return res.status(401).json({ error: 'Authentication expired' });
      }
    } catch (error) {
      // If refresh fails, clear tokens
      authStore.clearTokens();
      return res.status(401).json({ error: 'Authentication expired' });
    }
  }
  
  req.tokens = authStore.getTokens();
  next();
}

async function refreshAccessToken(tokens) {
  if (!tokens || !tokens.refreshToken) {
    console.error('Cannot refresh: missing refresh token');
    return null;
  }

  try {
    const response = await fetch(`${PROXY_CONFIG.baseUrl}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refreshToken })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Refresh token failed: ${data.error || response.status}`);
      return null;
    }
    
    // Return updated tokens
    return {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

function isAuthenticated() {
  const tokens = authStore.getTokens();
  return !!tokens;
}

function getAccessToken() {
  const tokens = authStore.getTokens();
  if (!tokens) return null;
  return tokens.accessToken;
}

module.exports = {
  PROXY_CONFIG,
  ensureAuthenticated,
  refreshAccessToken,
  isAuthenticated,
  getAccessToken,
  authStore
};