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