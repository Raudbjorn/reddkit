const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const net = require('net');

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
const REDDIT_USER_AGENT = 'electron-reddit-app/1.0.0';

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

// Process comment body text
function processCommentBody(body) {
  return body
    // Convert HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Handle linebreaks
    .replace(/\n/g, '<br>');
}

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