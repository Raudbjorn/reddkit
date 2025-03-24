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
        selftext: snudown.markdown(child.data.selftext),
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
}

module.exports = { setupPostRoutes };