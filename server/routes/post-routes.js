const { fetchFromReddit, parseComments } = require('../reddit');
let snudown;
(async () => {
  snudown = await import('snudown-js');
})();

function setupPostRoutes(app) {
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
      
      // Make sure we're importing REDDIT_USER_AGENT at the top of this file
      const response = await fetchFromReddit(`https://www.reddit.com/r/${subredditName}/${sort}.json`, params);
      
      // Add error handling for empty response
      if (!response || !response.data || !response.data.data) {
        console.error('Invalid response structure from Reddit API');
        return res.status(500).json({ error: 'Invalid response from Reddit API' });
      }
      
      // Map the posts data - check for missing properties
      const posts = response.data.data.children.map(child => {
        if (!child || !child.data) {
          return null;
        }
        
        const data = child.data;
        return {
          id: data.id || '',
          name: data.name || '', // Add name for voting
          title: data.title || 'No Title',
          author: data.author || '[deleted]',
          score: data.score || 0,
          numComments: data.num_comments || 0,
          created: data.created_utc || 0,
          permalink: data.permalink || '',
          url: data.url || '',
          domain: data.domain || '',
          selftext: data.selftext ? (snudown ? snudown.markdown(data.selftext) : data.selftext) : '',
          thumbnail: data.thumbnail || '',
          stickied: !!data.stickied,  // Add stickied property
          gilded: data.gilded || 0    // Add gilded property
        };
      }).filter(post => post !== null);
      
      console.log(`Returning ${posts.length} posts with after: ${response.data.data.after}`);
      
      // Return in the pagination format
      return res.json({
        posts: posts,
        after: response.data.data.after,
        before: response.data.data.before
      });
    } catch (error) {
      console.error(`Error fetching posts for r/${subredditName}:`, error);
      return res.status(500).json({ error: 'Failed to fetch posts: ' + error.message });
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
          selftext: snudown.markdown(postData.selftext),
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

  // Handle voting
  app.post('/api/vote', async (req, res) => {
    const { id, dir } = req.body;
    const tokens = authStore.getTokens();
    
    if (!tokens) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const response = await fetch('https://oauth.reddit.com/api/vote', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT
        },
        body: new URLSearchParams({
          id,
          dir,
          api_type: 'json'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }
      
      const data = await response.json();
      return res.json({ success: true });
    } catch (error) {
      console.error('Error voting:', error);
      return res.status(500).json({ error: 'Failed to vote' });
    }
  });

  // Subscribe to subreddit
  app.post('/api/subreddit/subscribe', async (req, res) => {
    const { subreddit, action } = req.body;
    const tokens = authStore.getTokens();
    
    if (!tokens) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const response = await fetch('https://oauth.reddit.com/api/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT
        },
        body: new URLSearchParams({
          sr_name: subreddit,
          action: action, // 'sub' or 'unsub'
          api_type: 'json'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }
      
      const data = await response.json();
      return res.json({ success: true });
    } catch (error) {
      console.error('Error subscribing:', error);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  // Get subscription status
  app.get('/api/subreddit/:name/subscription', async (req, res) => {
    const name = req.params.name;
    const tokens = authStore.getTokens();
    
    if (!tokens) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Get subscription status by checking if the subreddit is in the user's subscribed list
      const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'User-Agent': REDDIT_USER_AGENT
        }
      });
      
      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }
      
      const data = await response.json();
      const isSubscribed = data.data.children.some(
        child => child.data.display_name.toLowerCase() === name.toLowerCase()
      );
      
      return res.json({ subscribed: isSubscribed });
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json({ error: 'Failed to check subscription status' });
    }
  });
}

module.exports = { setupPostRoutes };