const axios = require('axios');
const crypto = require('crypto');

// In-memory session store (use a database in production)
const sessions = {};

const generateAppToken = () => crypto.randomBytes(32).toString('hex');

exports.login = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  sessions[state] = { createdAt: Date.now() };
  
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.append('client_id', process.env.REDDIT_CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('redirect_uri', "https://auth.sveinbjorn.dev/callback");
  authUrl.searchParams.append('duration', 'permanent');
  authUrl.searchParams.append('scope', 'identity subscribe read mysubreddits');
  
  res.redirect(authUrl.toString());
};

exports.callback = async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error || !state || !sessions[state]) {
    // Replace custom protocol with your app's error route
    return res.redirect('http://localhost:3000/auth-error');
  }
  
  try {
    // Exchange code for Reddit tokens
    const tokenResponse = await axios.post('https://www.reddit.com/api/v1/access_token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: "https://auth.sveinbjorn.dev/callback"
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    // Generate an app token for your app
    const appToken = generateAppToken();
    
    // Store the Reddit tokens mapped to your app token
    sessions[appToken] = {
      redditAccessToken: tokenResponse.data.access_token,
      redditRefreshToken: tokenResponse.data.refresh_token,
      expiresAt: Date.now() + (tokenResponse.data.expires_in * 1000)
    };
    
    // Clean up the state entry
    delete sessions[state];
    
    // Replace custom protocol with your app's callback route
    res.redirect(`http://localhost:3000/auth_callback?token=${appToken}`);
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('http://localhost:3000/auth-error');
  }
};

exports.refresh = async (req, res) => {
  const { appToken } = req.body;
  
  if (!appToken || !sessions[appToken]) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const session = sessions[appToken];
  
  try {
    const response = await axios.post('https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.redditRefreshToken
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    
    // Update the session with new tokens
    session.redditAccessToken = response.data.access_token;
    session.expiresAt = Date.now() + (response.data.expires_in * 1000);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// Make sessions available to other modules
exports.sessions = sessions;
