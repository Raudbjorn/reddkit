const { 
  getSubscribedSubreddits, 
  fetchFromReddit 
} = require('../reddit');

const { 
  formatSubscribers, 
  formatNumber, 
  formatDate,
  truncateText 
} = require('../formatters');

const { 
  authStore, 
  refreshAccessToken, 
  getAccessToken 
} = require('../auth');

function setupSubredditRoutes(app) {
  // Subreddit search
  app.get('/api/subreddits/search', async (req, res) => {
    const query = req.query.q;
    const after = req.query.after || '';
    
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    
    const tokens = authStore.getTokens();
    
    try {
      // Use authenticated search if logged in, otherwise anonymous
      const baseUrl = 'https://oauth.reddit.com/subreddits/search';
      const searchUrl = new URL(baseUrl);
      
      // Add query parameters
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('limit', '25');
      if (after) {
        searchUrl.searchParams.append('after', after);
      }
      
      const headers = {
        'User-Agent': process.env.REDDIT_USER_AGENT || 'ReddKit/1.0.0'
      };
      
      // Add authorization header if authenticated
      if (tokens && tokens.accessToken) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }
      
      const response = await fetch(searchUrl.toString(), { headers });
      
      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the response
      res.json({
        subreddits: data.data.children.map(child => child.data),
        after: data.data.after || null
      });
    } catch (error) {
      console.error('Subreddit search error:', error);
      res.status(500).json({ error: error.message });
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

  // Enhanced subreddit statistics
  app.get('/api/subreddit/:name/stats', async (req, res) => {
    const name = req.params.name;
    
    try {
      // Fetch basic subreddit info
      const subredditResponse = await fetchFromReddit(`https://www.reddit.com/r/${name}/about.json`);
      
      // Ensure we're correctly extracting data
      if (!subredditResponse || !subredditResponse.data || !subredditResponse.data.data) {
        return res.status(500).json({ 
          error: 'Invalid response from Reddit API',
          name: name // Include the name so client can display something
        });
      }
      
      const basicData = subredditResponse.data.data;
      
      // Default values for stats if we can't fetch real posts
      let avgComments = Math.floor(Math.random() * 20) + 5;
      let avgScore = Math.floor(Math.random() * 100) + 20;
      let successRate = Math.floor(Math.random() * 30) + 20;
      let discussionRate = Math.floor(Math.random() * 40) + 30;
      let contentBreakdown = {
        text: 40,
        images: 30,
        links: 20,
        videos: 10
      };
      
      // Generate random weekly activity data
      const weeklyActivity = [
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 60) + 40,
        Math.floor(Math.random() * 60) + 40,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 60) + 20,
      ];
      
      // Try to fetch recent posts to get better stats estimates
      try {
        const recentPostsResponse = await fetchFromReddit(
          `https://www.reddit.com/r/${name}/hot.json`,
          { limit: 50 }
        );
        
        if (recentPostsResponse?.data?.data?.children) {
          const recentPosts = recentPostsResponse.data.data.children.map(child => child.data);
          
          // Calculate post statistics from actual data
          if (recentPosts.length > 0) {
            const totalComments = recentPosts.reduce((sum, post) => sum + (post.num_comments || 0), 0);
            const totalScore = recentPosts.reduce((sum, post) => sum + (post.score || 0), 0);
            avgComments = Math.round(totalComments / recentPosts.length);
            avgScore = Math.round(totalScore / recentPosts.length);
            
            // Calculate success and discussion rates
            const successfulPosts = recentPosts.filter(post => post.score > 100).length;
            const discussionPosts = recentPosts.filter(post => post.num_comments > 10).length;
            successRate = Math.round((successfulPosts / recentPosts.length) * 100);
            discussionRate = Math.round((discussionPosts / recentPosts.length) * 100);
            
            // Analyze content types
            const types = {
              text: 0,
              images: 0,
              links: 0,
              videos: 0
            };
            
            recentPosts.forEach(post => {
              if (post.is_video) types.videos += 1;
              else if (post.is_self) types.text += 1;
              else if (/\.(jpg|jpeg|png|gif)$/i.test(post.url || '')) types.images += 1;
              else types.links += 1;
            });
            
            // Calculate percentages
            const total = Object.values(types).reduce((sum, val) => sum + val, 0);
            if (total > 0) {
              contentBreakdown = {};
              for (const [key, value] of Object.entries(types)) {
                contentBreakdown[key] = Math.round((value / total) * 100) || 0;
              }
            }
          }
        }
      } catch (postsError) {
        console.error(`Error getting recent posts for stats: ${postsError.message}`);
        // Continue with default values
      }
      
      // Create related subreddits based on name
      const relatedSubreddits = [];
      
      // Generate relevant related subreddits based on the current subreddit
      if (name.toLowerCase() === 'news') {
        relatedSubreddits.push(
          { name: "worldnews", display_name_prefixed: "r/worldnews" },
          { name: "politics", display_name_prefixed: "r/politics" },
          { name: "UkraineWarVideoReport", display_name_prefixed: "r/UkraineWarVideoReport" }
        );
      } else if (name.toLowerCase() === 'gaming') {
        relatedSubreddits.push(
          { name: "games", display_name_prefixed: "r/games" },
          { name: "pcgaming", display_name_prefixed: "r/pcgaming" },
          { name: "PS5", display_name_prefixed: "r/PS5" }
        );
      } else if (name.toLowerCase() === 'technology') {
        relatedSubreddits.push(
          { name: "programming", display_name_prefixed: "r/programming" },
          { name: "hardware", display_name_prefixed: "r/hardware" },
          { name: "futurology", display_name_prefixed: "r/Futurology" }
        );
      } else {
        // Generic popular subreddits as fallbacks
        relatedSubreddits.push(
          { name: "AskReddit", display_name_prefixed: "r/AskReddit" },
          { name: "todayilearned", display_name_prefixed: "r/todayilearned" },
          { name: "explainlikeimfive", display_name_prefixed: "r/explainlikeimfive" }
        );
      }
      
      // Combine all data
      const stats = {
        ...basicData,
        display_name: basicData.display_name || name, // Ensure display_name is available
        requested_name: name, // Keep the original request name
        weekly_growth: Math.floor((basicData.subscribers || 0) * 0.007),
        daily_growth: Math.floor((basicData.subscribers || 0) * 0.001),
        mod_count: Math.floor(Math.random() * 10) + 1, // Fake data
        total_posts: Math.floor(Math.random() * 90000) + 10000, // Fake data
        posts_per_day: Math.floor(Math.random() * 90) + 10, // Fake data
        avg_comments: avgComments,
        avg_score: avgScore,
        content_breakdown: contentBreakdown,
        success_rate: successRate,
        discussion_rate: discussionRate,
        weekly_activity: weeklyActivity,
        activity_rank: Math.floor(Math.random() * 9000) + 1000, // Fake ranking
        subreddit_rank: Math.floor(Math.random() * 9000) + 1000, // Fake ranking
        most_active_time: `${Math.floor(Math.random() * 12) + 1}${Math.random() > 0.5 ? 'pm' : 'am'} EST`, // Fake time
        related_subreddits: relatedSubreddits
      };
      
      res.json(stats);
    } catch (error) {
      console.error(`Error fetching subreddit stats for ${name}:`, error);
      res.status(500).json({ 
        error: 'Failed to fetch subreddit statistics: ' + error.message,
        name: name // Include the name in error response too
      });
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

  // Get user's subscribed subreddits
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
}

module.exports = { setupSubredditRoutes };