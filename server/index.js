const dotenv = require('dotenv');
dotenv.config(); // This loads the .env file into process.env

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const authStore = require('./auth-store');

let snudown;
(async () => {
  snudown = await import('snudown-js');
})();

const app = express();
let server = null;

// Function to find an available port
function findAvailablePort(startPort, callback) {
  const server = net.createServer();
  server.listen(startPort, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => {
      callback(port);
    });
  });
  
  server.on('error', () => {
    findAvailablePort(startPort + 1, callback);
  });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// Reddit API utilities
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'electron-reddit-app/1.0.0';

async function fetchFromReddit(url, params = {}) {
  try {
    return await axios.get(url, {
      params,
      headers: { 'User-Agent': REDDIT_USER_AGENT }
    });
  } catch (error) {
    console.error(`Error fetching from Reddit (${url}):`, error.message);
    throw error;
  }
}

// Routes
// Subreddit search
app.get('/api/subreddits/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  try {
    const response = await fetchFromReddit('https://www.reddit.com/subreddits/search.json', {
      q: query,
      limit: 25
    });
    
    const subreddits = response.data.data.children.map(child => ({
      id: child.data.id,
      name: child.data.display_name,
      title: child.data.title,
      description: child.data.public_description,
      subscribers: child.data.subscribers,
      created: child.data.created_utc,
      nsfw: child.data.over18
    }));
    
    // If it's an HTMX request, return HTML
    if (req.headers['hx-request'] === 'true') {
      if (subreddits.length === 0) {
        return res.send('<div class="no-results">No subreddits found</div>');
      }
      
      let html = '';
      subreddits.forEach(sr => {
        html += `
          <div class="subreddit-item" data-name="${sr.name}">
            <div class="subreddit-header">
              <div class="subreddit-name">
                r/${sr.name}
                ${sr.nsfw ? '<span class="nsfw-tag">NSFW</span>' : ''}
              </div>
              <div class="subreddit-stats">
                ${formatSubscribers(sr.subscribers)} subscribers
              </div>
            </div>
            <div class="subreddit-description">
              ${sr.description || 'No description available'}
            </div>
          </div>
        `;
      });
      
      return res.send(html);
    }
    
    // Otherwise return JSON
    return res.json(subreddits);
  } catch (error) {
    console.error('Error searching subreddits:', error);
    return res.status(500).json({ error: 'Failed to fetch subreddits' });
  }
});

// Subreddit details
app.get('/api/subreddit/:name', async (req, res) => {
  const name = req.params.name;
  
  try {
    const response = await fetchFromReddit(`https://www.reddit.com/r/${name}/about.json`);
    const data = response.data.data;
    
    // Handle HTMX requests separately
    if (req.headers['hx-request'] === 'true') {
      const html = `
        <div class="subreddit-detail-card">
          <h2>r/${data.display_name}</h2>
          <div class="subreddit-banner" style="background-color: ${data.primary_color || '#ccc'}">
            ${data.banner_img ? `<img src="${data.banner_img}" alt="Banner">` : ''}
          </div>
          <div class="subreddit-stats">
            <div><strong>${formatSubscribers(data.subscribers)}</strong> subscribers</div>
            <div><strong>${formatNumber(data.active_user_count)}</strong> online</div>
            <div>Created <strong>${formatDate(data.created_utc)}</strong></div>
          </div>
          <p class="subreddit-description">${data.public_description || data.description || 'No description'}</p>
          <button class="select-button" 
                  hx-post="/api/select-subreddit" 
                  hx-vals='{"name": "${data.display_name}"}'
                  hx-swap="none">
            Select This Subreddit
          </button>
        </div>
      `;
      
      return res.send(html);
    }
    
    return res.json(data);
  } catch (error) {
    console.error(`Error fetching subreddit ${name}:`, error);
    return res.status(500).json({ error: 'Failed to fetch subreddit details' });
  }
});

// Handle subreddit selection
app.post('/api/select-subreddit', (req, res) => {
  const { name } = req.body;
  console.log(`Selected subreddit: ${name}`);
  
  // Send a success response with HX-Trigger to notify UI
  res.setHeader('HX-Trigger', JSON.stringify({
    subredditSelected: { name }
  }));
  
  res.status(200).send();
});

// Subreddit posts
app.get('/api/r/:subreddit/posts', async (req, res) => {
  const subredditName = req.params.subreddit;
  const sort = req.query.sort || 'hot';
  const after = req.query.after || null;
  
  try {
    // Set up the request parameters
    const params = { limit: 25 };
    if (after) params.after = after;
    
    console.log(`Fetching posts for r/${subredditName} (${sort}) with params:`, params);
    
    const response = await fetchFromReddit(`https://www.reddit.com/r/${subredditName}/${sort}.json`, params);
    
    // Map the posts data
    const posts = response.data.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      score: child.data.score,
      numComments: child.data.num_comments,
      created: child.data.created_utc,
      permalink: child.data.permalink,
      url: child.data.url,
      domain: child.data.domain,
      selftext: child.data.selftext,
      thumbnail: child.data.thumbnail
    }));
    
    console.log(`Returning ${posts.length} posts with after: ${response.data.data.after}`);
    
    // Return in the pagination format
    return res.json({
      posts: posts,
      after: response.data.data.after,
      before: response.data.data.before
    });
  } catch (error) {
    console.error(`Error fetching posts for r/${subredditName}:`, error);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Universal post/comments handler
app.get('/api/post/*', async (req, res) => {
  const path = req.path.replace('/api/post', '');
  
  // Determine if this is a comments request
  const isCommentsRequest = path.endsWith('/comments') || req.query.get_comments === 'true';
  
  // Clean the permalink
  let permalink = path;
  if (permalink.endsWith('/comments')) {
    permalink = permalink.substring(0, permalink.length - 9);
  }
  
  console.log(`Request for ${isCommentsRequest ? 'comments' : 'post details'} at: ${permalink}`);
  
  try {
    const response = await fetchFromReddit(`https://www.reddit.com${permalink}.json`);
    
    // Check response structure
    if (!response.data || !Array.isArray(response.data) || response.data.length < (isCommentsRequest ? 2 : 1)) {
      console.error("Invalid response structure from Reddit");
      return res.status(500).json({ error: 'Invalid response from Reddit API' });
    }
    
    if (isCommentsRequest) {
      return res.json(parseComments(response.data[1]?.data?.children || []));
    } else {
      const postData = response.data[0]?.data?.children[0]?.data;
      
      if (!postData) {
        return res.status(500).json({ error: 'Post data not found' });
      }
      
      return res.json({
        id: postData.id,
        title: postData.title,
        author: postData.author,
        score: postData.score,
        upvoteRatio: postData.upvote_ratio,
        numComments: postData.num_comments,
        created: postData.created_utc,
        permalink: postData.permalink,
        url: postData.url,
        domain: postData.domain,
        selftext: postData.selftext,
        isVideo: postData.is_video
      });
    }
  } catch (error) {
    console.error(`Error fetching data:`, error.message);
    return res.status(500).json({ 
      error: `Failed to fetch ${isCommentsRequest ? 'comments' : 'post details'}: ${error.message}` 
    });
  }
});

// Helper functions
// Truncate text to a specified length
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Parse comments recursively
function parseComments(comments, depth = 0, maxDepth = 3) {
  if (!Array.isArray(comments) || depth > maxDepth) return [];
  
  return comments
    .filter(child => child && child.kind === 't1') // Only include comments (type t1)
    .map(child => {
      if (!child.data) return null;
      
      const data = child.data;
      
      // Extract replies, checking the correct structure
      let replies = [];
      if (data.replies && 
          typeof data.replies === 'object' && 
          data.replies.data && 
          Array.isArray(data.replies.data.children)) {
        replies = parseComments(data.replies.data.children, depth + 1, maxDepth);
      }
      
      return {
        id: data.id || '',
        author: data.author || '[deleted]',
        body: processCommentBody(data.body || '[removed]'),
        score: data.score || 0,
        created: data.created_utc || 0,
        depth: depth,
        replies: replies
      };
    })
    .filter(comment => comment !== null);
}

// Format subscriber counts
function formatSubscribers(count) {
  if (!count) return '0';
  
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
}

// Format numbers with commas
function formatNumber(num) {
  return num ? num.toLocaleString() : '0';
}

// Format dates
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

// Format dates with time
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Format post scores
function formatPostScore(score) {
  if (score >= 10000) {
    return (score / 1000).toFixed(1) + 'k';
  }
  return score.toString();
}

// Format relative time
function formatTimeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - timestamp;
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + ' days ago';
  if (seconds < 31536000) return Math.floor(seconds / 2592000) + ' months ago';
  return Math.floor(seconds / 31536000) + ' years ago';
}

function processCommentBody(body) {
  if (!body) return '';
  
  // Use the snudown library for proper Reddit markdown rendering
  try {
    return snudown.markdown(body);
  } catch (error) {
    console.error('Error processing comment body:', error);
    // Fallback to basic sanitization if snudown fails
    return body
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

const REDDIT_CONFIG = {
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  redirectUri: process.env.REDDIT_REDIRECT_URI || 'http://127.0.0.1:3000/authorize_callback',
  userAgent: process.env.REDDIT_USER_AGENT || 'ReddKit/1.0.0'
};

function validateConfig() {
  if (!process.env.REDDIT_CLIENT_ID) {
    console.warn('Warning: REDDIT_CLIENT_ID environment variable is not set');
  }
  
  if (!process.env.REDDIT_CLIENT_SECRET) {
    console.error('Error: REDDIT_CLIENT_SECRET environment variable is not set');
    process.exit(1); // Exit if the secret is missing as it's critical
  }
}

validateConfig();
// Initialize the oauthState
let oauthState = null;

// Generate random state for OAuth security
function generateRandomState() {
  return crypto.randomBytes(16).toString('hex');
}

// Add OAuth routes
app.get('/login', (req, res) => {
  const state = generateRandomState();
  oauthState = state;
  
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.append('client_id', REDDIT_CONFIG.clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('redirect_uri', REDDIT_CONFIG.redirectUri);
  authUrl.searchParams.append('duration', 'permanent');
  // Update the scope to be more explicit about mysubreddits
  authUrl.searchParams.append('scope', 'identity subscribe read mysubreddits');
  
  res.redirect(authUrl.toString());
});

// OAuth callback handler
app.get('/authorize_callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Check for errors or state mismatch
  if (error) {
    console.error('Reddit OAuth error:', error);
    return res.redirect('/?error=oauth_denied');
  }
  
  if (!state || state !== oauthState) {
    console.error('Invalid state parameter');
    return res.redirect('/?error=invalid_state');
  }
  
  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${REDDIT_CONFIG.clientId}:${REDDIT_CONFIG.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDDIT_CONFIG.redirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenResponse.ok) {
      // Store tokens with expiration
      const tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      };
      
      // Save to persistent store
      authStore.setTokens(tokens);
      
      return res.redirect('/');
    } else {
      console.error('Token exchange failed:', tokenData);
      return res.redirect('/?error=token_exchange');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/?error=auth_error');
  }
});

// Logout endpoint
app.get('/logout', (req, res) => {
  // Clear tokens from persistent store
  authStore.clearTokens();
  
  // Redirect back to home page
  res.redirect('/');
});

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

// Refresh the access token
async function refreshAccessToken(tokens) {
  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${REDDIT_CONFIG.clientId}:${REDDIT_CONFIG.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Refresh token failed: ${data.error}`);
      return null;
    }
    
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

app.get('/api/auth-status', (req, res) => {
  const tokens = authStore.getTokens();
  
  // Try to refresh token if it's expired
  if (tokens && tokens.expiresAt - 300000 < Date.now()) {
    refreshAccessToken(tokens)
      .then(refreshedTokens => {
        if (refreshedTokens) {
          authStore.setTokens(refreshedTokens);
          res.json({ 
            isAuthenticated: true,
            username: null // You can fetch and store username if desired
          });
        } else {
          authStore.clearTokens();
          res.json({ isAuthenticated: false, username: null });
        }
      })
      .catch(() => {
        authStore.clearTokens();
        res.json({ isAuthenticated: false, username: null });
      });
  } else {
    res.json({ 
      isAuthenticated: !!tokens,
      username: null
    });
  }
});

// Serve fragment for the sidebar with HTMX
app.get('/fragments/subreddits', async (req, res) => {
  const tokens = authStore.getTokens();
  
  if (!tokens) {
    return res.send(`
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <h3>Subreddits</h3>
        </div>
        <div class="sidebar-content">
          <div class="no-results">
            <p>Not logged in</p>
          </div>
        </div>
      </div>
    `);
  }
  
  try {
    // Try to refresh token if needed
    if (tokens.expiresAt - 300000 < Date.now()) {
      const refreshedTokens = await refreshAccessToken(tokens);
      if (refreshedTokens) {
        authStore.setTokens(refreshedTokens);
      } else {
        // If refresh fails, clear tokens and show not logged in
        authStore.clearTokens();
        return res.send(`
          <div class="sidebar-inner">
            <div class="sidebar-header">
              <h3>Subreddits</h3>
            </div>
            <div class="sidebar-content">
              <div class="no-results">
                <p>Session expired. Please login again.</p>
              </div>
            </div>
          </div>
        `);
      }
    }
    
    // Use the current token (possibly refreshed)
    const currentTokens = authStore.getTokens();
    const subreddits = await getSubscribedSubreddits(currentTokens.accessToken);
    
    // Rest of your existing code for rendering subreddits...
    if (subreddits.length === 0) {
      return res.send(`
        <div class="sidebar-inner">
          <div class="sidebar-header">
            <h3>Your Subreddits</h3>
          </div>
          <div class="sidebar-content">
            <div class="no-results">
              <p>You haven't subscribed to any subreddits</p>
            </div>
          </div>
        </div>
      `);
    }
    
    res.send(`
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <h3>Your Subreddits</h3>
        </div>
        <div class="sidebar-content">
          <div class="subreddit-list">
            ${subreddits.map(sub => `
              <div class="subreddit-item" 
                   data-name="${sub.display_name}" 
                   onclick="selectSubreddit('${sub.display_name}')">
                <div class="subreddit-header">
                  <span class="subreddit-name">r/${sub.display_name}</span>
                  <span class="subscribers">${formatSubscribers(sub.subscribers)}</span>
                </div>
                ${sub.public_description ? 
                  `<div class="subreddit-desc">${truncateText(sub.public_description, 80)}</div>` : 
                  ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  } catch (error) {
    console.error('Error fetching subreddits:', error);
    
    // Check if it's an auth error and clear tokens if needed
    if (error.message && error.message.includes('401')) {
      authStore.clearTokens();
    }
    
    res.send(`
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <h3>Your Subreddits</h3>
        </div>
        <div class="sidebar-content">
          <div class="error-message">
            Failed to load subreddits. 
            <button hx-get="/fragments/subreddits" hx-target="#subreddit-sidebar">Retry</button>
          </div>
        </div>
      </div>
    `);
  }
});

// Get subscribed subreddits helper
async function getSubscribedSubreddits(accessToken) {
  try {
    const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber.json?limit=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_CONFIG.userAgent
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Subreddit fetch error:', response.status, errorData);
      throw new Error(`Failed to fetch subscribed subreddits: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data.children.map(child => child.data);
  } catch (error) {
    console.error('Error in getSubscribedSubreddits:', error);
    throw error;
  }
}

app.get('/fragments/login-button', (req, res) => {
  // Check if user is logged in from persistent storage
  const tokens = authStore.getTokens();
  const isLoggedIn = !!tokens;
  
  // If logged in but token is expired, try to refresh silently
  if (isLoggedIn && tokens.expiresAt - 300000 < Date.now()) {
    refreshAccessToken(tokens)
      .then(refreshedTokens => {
        if (refreshedTokens) {
          authStore.setTokens(refreshedTokens);
        } else {
          authStore.clearTokens();
        }
      })
      .catch(() => {
        authStore.clearTokens();
      });
  }
  
  // Send script to update app-content class based on login status
  const updateScript = `
    <script>
      document.getElementById('app-content').classList.toggle('not-logged-in', ${!isLoggedIn});
    </script>
  `;
  
  // Return the Snoo icon that changes color based on login status
  res.send(`
    <div class="header-snoo-container header-snoo-${isLoggedIn ? 'logged-in' : 'logged-out'}">
      <a href="${isLoggedIn ? '/logout' : '/login'}" title="${isLoggedIn ? 'Logout' : 'Login with Reddit'}">
        <svg class="header-snoo" xmlns="http://www.w3.org/2000/svg" viewBox="-269 361 72 72">
          <g>
            <path class="snoo-body" d="m-233 433c-19.9 0-36-16.1-36-36s16.1-36 36-36 36 16.1 36 36-16.1 36-36 36z" />
            <path d="m-224.8 404.5c-2.1 0-3.7-1.7-3.7-3.7 0-2.1 1.7-3.8 3.7-3.8s3.7 1.7 3.7 3.8c.1 2-1.6 3.7-3.7 3.7m.7 6.2c-2.6 2.6-7.5 2.8-8.9 2.8s-6.3-.2-8.9-2.8c-.4-.4-.4-1 0-1.4s1-.4 1.4 0c1.6 1.6 5.1 2.2 7.5 2.2 2.5 0 5.9-.6 7.5-2.2.4-.4 1-.4 1.4 0s.4 1 0 1.4m-20.9-9.9c0-2.1 1.7-3.8 3.8-3.8s3.7 1.7 3.7 3.8-1.7 3.7-3.7 3.7c-2.1 0-3.8-1.7-3.8-3.7m36-3.8c0-2.9-2.4-5.3-5.3-5.3-1.4 0-2.7.6-3.6 1.5-3.6-2.6-8.5-4.3-14-4.5l2.4-11.3 7.8 1.7c.1 2 1.7 3.6 3.7 3.6 2.1 0 3.7-1.7 3.7-3.7 0-2.1-1.7-3.7-3.7-3.7-1.5 0-2.7.9-3.3 2.1l-8.7-1.9c-.2-.1-.5 0-.7.1s-.4.3-.4.6l-2.6 12.3v.2c-5.6.1-10.6 1.8-14.3 4.4-.9-.9-2.2-1.5-3.6-1.5-2.9 0-5.3 2.4-5.3 5.3 0 2.1 1.3 4 3.1 4.8-.1.5-.1 1.1-.1 1.6 0 8.1 9.4 14.6 21 14.6s21-6.5 21-14.6c0-.5 0-1.1-.1-1.6 1.7-.7 3-2.6 3-4.7" fill="#fff"/>
          </g>
        </svg>
      </a>
    </div>
    ${updateScript}
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Determine if it's an API request
  const isApiRequest = req.path.startsWith('/api/');
  
  if (isApiRequest) {
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  } else {
    return res.status(500).send(`
      <div class="error-container">
        <h2>Something went wrong</h2>
        <p>Please try again later or return to the homepage.</p>
        <a href="/">Back to Home</a>
      </div>
    `);
  }
});


// Server startup
function startServer(callback) {
  findAvailablePort(3000, (port) => {
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${port}`);
      callback(port);
    });
  });
  
  return {
    close: () => {
      if (server) {
        server.close();
      }
    }
  };
}

module.exports = { startServer };