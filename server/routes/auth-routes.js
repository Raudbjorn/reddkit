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
  
  // Login button fragment
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
}

module.exports = { setupAuthRoutes };