const axios = require('axios');
let snudown;
(async () => {
  snudown = await import('snudown-js');
})();

const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'ReddKit/1.0.0';

async function fetchFromReddit(url, params = {}, accessToken = null) {
  try {
    const headers = { 'User-Agent': REDDIT_USER_AGENT };
    
    // Add authorization if token is provided
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    return await axios.get(url, { params, headers });
  } catch (error) {
    console.error(`Error fetching from Reddit (${url}):`, error.message);
    throw error;
  }
}

async function getSubscribedSubreddits(accessToken) {
  if (!accessToken) {
    throw new Error('Access token required');
  }

  try {
    const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber?limit=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      }
    });
    
    // Handle non-OK response
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      throw new Error(`Failed to fetch subscribed subreddits: ${errorMessage}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    if (!data || !data.data || !Array.isArray(data.data.children)) {
      throw new Error('Invalid response format from Reddit API');
    }
    
    return data.data.children.map(child => child.data);
  } catch (error) {
    console.error('Error in getSubscribedSubreddits:', error);
    throw error;
  }
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

module.exports = {
  REDDIT_USER_AGENT,
  fetchFromReddit,
  getSubscribedSubreddits,
  parseComments,
  processCommentBody
};