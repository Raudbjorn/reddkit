const { 
  PROXY_CONFIG, 
  authStore, 
  refreshAccessToken
} = require('../auth');

function setupAuthRoutes(app) {
  // Login route
  app.get('/login', (req, res) => {
    const redirectUri = encodeURIComponent(PROXY_CONFIG.redirectUri);
    const loginUrl = `${PROXY_CONFIG.baseUrl}/login?redirect_uri=${redirectUri}`;
    
    console.log(`Redirecting to auth proxy: ${loginUrl}`);
    res.redirect(loginUrl);
  });

  // Auth callback handler
  app.get('/auth_callback', async (req, res) => {
    const { token, error } = req.query;
    
    if (error) {
      console.error('Authentication error:', error);
      return res.redirect('/?error=auth_error');
    }
    
    if (!token) {
      console.error('Missing token parameter');
      return res.redirect('/?error=missing_token');
    }
    
    try {
      // Exchange the app token for Reddit tokens
      const response = await fetch(`${PROXY_CONFIG.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appToken: token })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.access_token || !data.refresh_token) {
        console.error('Failed to exchange token:', data.error || 'Missing token data');
        return res.redirect('/?error=token_exchange_failed');
      }
      
      // Store tokens with expiration
      const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (parseInt(data.expires_in) * 1000)
      };
      
      // Save to persistent store
      authStore.setTokens(tokens);
      
      // Redirect to home page
      res.redirect('/');
    } catch (error) {
      console.error('Error exchanging token:', error);
      res.redirect('/?error=token_exchange_error');
    }
  });
  
  // Logout endpoint
  app.get('/logout', (req, res) => {
    const wasLoggedIn = !!authStore.getTokens();
    authStore.clearTokens();
    
    console.log(`User logged out (was ${wasLoggedIn ? 'authenticated' : 'not authenticated'})`);
    res.redirect('/');
  });
  
  // Auth status endpoint
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
  
  // Modify the existing /fragments/login-button endpoint
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
        document.body.classList.toggle('user-not-logged-in', ${!isLoggedIn});
        
        // Handle sidebar visibility
        if (${!isLoggedIn}) {
          const sidebarElement = document.getElementById('subreddit-sidebar');
          if (sidebarElement) {
            sidebarElement.style.display = 'none';
          }
        } else {
          const sidebarElement = document.getElementById('subreddit-sidebar');
          if (sidebarElement) {
            sidebarElement.style.display = 'block';
          }
        }
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

  // Replace the existing /fragments/subreddits endpoint with this version
  app.get('/fragments/subreddits', async (req, res) => {
    const tokens = authStore.getTokens();
    
    if (!tokens) {
      // Return empty div with a class that can be targeted by CSS
      return res.send(`
        <div class="sidebar-empty" id="sidebar-content"></div>
        <script>
          // Add class to body or main container to indicate logged out state
          document.body.classList.add('user-not-logged-in');
          
          // Find the sidebar element
          const sidebarElement = document.getElementById('subreddit-sidebar');
          if (sidebarElement) {
            // Hide the sidebar
            sidebarElement.style.display = 'none';
          }
        </script>
      `);
    }
  
    try {
      // Try to refresh token if expired
      if (tokens.expiresAt < Date.now()) {
        const newTokens = await refreshAccessToken(tokens);
        if (newTokens) {
          authStore.setTokens(newTokens);
        } else {
          // If refresh fails, hide sidebar
          authStore.clearTokens();
          return res.send(`
            <div class="sidebar-empty" id="sidebar-content"></div>
            <script>
              document.body.classList.add('user-not-logged-in');
              const sidebarElement = document.getElementById('subreddit-sidebar');
              if (sidebarElement) {
                sidebarElement.style.display = 'none';
              }
            </script>
          `);
        }
      }
  
      // Fetch the user's subscribed subreddits using axios instead of fetch for better compatibility
      const axios = require('axios');
      const response = await axios({
        method: 'get',
        url: 'https://oauth.reddit.com/subreddits/mine/subscriber.json',
        params: { limit: 100 },
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'User-Agent': 'redDKit/1.0.6'
        }
      });

      // Extract and format subreddit data
      const subreddits = response.data.data.children.map(child => ({
        name: child.data.display_name,
        url: child.data.url,
        icon: child.data.community_icon || child.data.icon_img || '',
        subscribers: child.data.subscribers
      }));
  
      // Sort alphabetically
      subreddits.sort((a, b) => a.name.localeCompare(b.name));
  
      // Build HTML for the sidebar
      const subredditList = subreddits.map(sub => `
        <div class="sidebar-subreddit" data-subreddit="${sub.name}">
          <a href="javascript:void(0)" onclick="loadSubreddit('${sub.name}')" class="subreddit-link">
            <div class="subreddit-icon">
              ${sub.icon ? 
                '<img src="' + sub.icon.replace(/\?.*$/, '').replace('&amp;', '&') + '" alt="' + sub.name + '" onerror="this.onerror=null; this.src=\'/images/default-icon.png\'; this.classList.add(\'fallback-icon\');">' : 
                '<div class="default-icon">' + sub.name.charAt(0).toUpperCase() + '</div>'
              }
            </div>
            <div class="subreddit-name">r/${sub.name}</div>
          </a>
        </div>
      `).join('');
  
      // Return the complete sidebar HTML
      return res.send(`
        <div class="sidebar-inner">
          <div class="sidebar-header">
            <h3>My Subreddits</h3>
          </div>
          <div class="sidebar-content">
            <div class="subreddit-search">
              <input type="text" id="subreddit-search" placeholder="Search subreddits..." 
                    onkeyup="filterSubreddits(this.value)">
            </div>
            <div class="subreddit-list">
              ${subredditList}
            </div>
          </div>
          <script>
            function filterSubreddits(query) {
              query = query.toLowerCase();
              document.querySelectorAll('.sidebar-subreddit').forEach(item => {
                const subredditName = item.dataset.subreddit.toLowerCase();
                if (subredditName.includes(query)) {
                  item.style.display = 'block';
                } else {
                  item.style.display = 'none';
                }
              });
            }
            
            function loadSubreddit(name) {
              htmx.ajax('GET', '/r/' + name, {
                target: '#main-content',
                swap: 'innerHTML'
              });
              
              // Update active status
              document.querySelectorAll('.sidebar-subreddit').forEach(item => {
                item.classList.remove('active');
              });
              
              const activeElement = document.querySelector('.sidebar-subreddit[data-subreddit="' + name + '"]');
              
              if (activeElement) {
                activeElement.classList.add('active');
              }
              
              // Update URL without reloading page
              history.pushState(null, null, '/r/' + name);
            }
            
            // Remove loading state
            document.body.classList.remove('user-not-logged-in');
            document.getElementById('subreddit-sidebar').style.display = 'block';
          </script>
        </div>
      `);
    } catch (error) {
      console.error("Error loading subscribed subreddits:", error);
      return res.send(`
        <div class="sidebar-inner">
          <div class="sidebar-header">
            <h3>Error</h3>
          </div>
          <div class="sidebar-content">
            <div class="error-message">
              <p>Could not load subreddits: ${error.message}</p>
              <button onclick="htmx.ajax('GET', '/fragments/subreddits', {target: '#subreddit-sidebar', swap: 'innerHTML'})">
                Retry
              </button>
            </div>
          </div>
        </div>
      `);
    }
  });
}

module.exports = { setupAuthRoutes };