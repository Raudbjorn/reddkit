// Dark mode functionality
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
  
    // Check for saved theme preference or respect OS preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Apply theme based on saved preference or OS preference
    if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeToggle.textContent = '☾'; // Moon glyph (Nerd Font)
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggle.textContent = '☀'; // Sun glyph (Nerd Font)
    }
    
    // Toggle theme when button is clicked
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      
      if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '☀'; // Sun glyph (Nerd Font)
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☾'; // Moon glyph (Nerd Font)
      }
    });
    
    // Watch for OS theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // Only apply OS changes if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        if (e.matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
          themeToggle.textContent = '☾'; // Moon glyph (Nerd Font)
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          themeToggle.textContent = '☀'; // Sun glyph (Nerd Font)
        }
      }
    });

 // Function to improve visibility of usernames in the UI
 function enhanceUsernames() {
    // Find all username links and elements
    const usernameElements = document.querySelectorAll('[class*="user"], [class*="author"], [href*="/u/"]');
    
    // Process each user element
    usernameElements.forEach(el => {
      el.classList.add('enhanced-username');
    });
    
    // Look for text containing "Posted by" pattern
    document.querySelectorAll('*').forEach(el => {
      if (!el.children.length && el.textContent.includes('Posted by')) {
        // Create a wrapper for the "Posted by" text
        const text = el.textContent;
        const regex = /(Posted by )([uU]\/\w+)/;
        
        if (regex.test(text)) {
          const match = text.match(regex);
          if (match && match.length >= 3) {
            el.innerHTML = match[1] + '<span class="enhanced-username">' + match[2] + '</span>';
          }
        }
      }
    });
    
    // Add a style element if needed
    if (!document.getElementById('username-enhancement-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'username-enhancement-styles';
      styleEl.textContent = `
        [data-theme="dark"] .enhanced-username {
          color: #80ccff !important;
          font-weight: 600 !important;
          text-shadow: 0 0 1px rgba(0, 0, 0, 0.5) !important;
        }
        [data-theme="dark"] .enhanced-score {
      color: #ffcc66 !important;
      font-weight: bold !important;
      text-shadow: 0px 0px 1px rgba(0, 0, 0, 0.5) !important;
    }
          [data-theme="dark"] .enhanced-subreddit {
      color: #5ea9ff !important;
      font-weight: 600 !important;
      text-shadow: 0px 0px 1px rgba(0, 0, 0, 0.5) !important;
      background-color: rgba(94, 169, 255, 0.1) !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
      display: inline-block !important;
    }
          [data-theme="dark"] .enhanced-subreddit-name {
      color: #5ea9ff !important;
      font-weight: 600 !important;
      text-shadow: 0px 0px 1px rgba(0, 0, 0, 0.5) !important;
    }
      `;
      document.head.appendChild(styleEl);
    }
  }

    // Function to improve visibility of post numbers and scores
    function enhancePostNumbers() {
        // Look for typical score elements
        const scoreElements = document.querySelectorAll(
          '.score, .karma, .vote-count, .points, [class*="score"], [class*="vote"]'
        );
        
        scoreElements.forEach(el => {
          el.classList.add('enhanced-score');
        });
        
        // Look for standalone numbers at the beginning of posts (like in your screenshot)
        document.querySelectorAll('.post-item, .post').forEach(post => {
          const firstEl = post.firstElementChild;
          if (firstEl && firstEl.textContent && /^\s*\d+\s*$/.test(firstEl.textContent.trim())) {
            firstEl.classList.add('enhanced-score');
          }
        });
        
        // Look for any numeric content that might be post ranks
        document.querySelectorAll('div, span').forEach(el => {
          if (!el.children.length && /^\s*\d+\s*$/.test(el.textContent.trim())) {
            const parent = el.parentElement;
            const children = Array.from(parent.children);
            if (children.indexOf(el) === 0 || children.indexOf(el) === 1) {
              el.classList.add('enhanced-score');
            }
          }
        });
      }

       // Function to improve visibility of subreddit names
 // Function to improve visibility of subreddit names only
 function enhanceSubredditNames() {
    // Find all subreddit links - use a more precise approach
    const subredditPattern = /^r\/\w+$/;
    
    // Only enhance exact subreddit name matches
    const subredditLinks = document.querySelectorAll('a[href^="/r/"], a[href^="r/"]');
    subredditLinks.forEach(link => {
      const linkText = link.textContent.trim();
      // Only enhance if it's just the subreddit name, not description text
      if (subredditPattern.test(linkText)) {
        link.classList.add('enhanced-subreddit-name');
      }
    });
    
    // Handle the search results specifically
    document.querySelectorAll('.search-result, .subreddit-item').forEach(item => {
      // Find the name part only, not the description
      const nameElement = item.querySelector('h3, h4, .title, .name');
      if (nameElement && /^r\/\w+/.test(nameElement.textContent.trim())) {
        nameElement.classList.add('enhanced-subreddit-name');
      }
    });
  }

  // Initial enhancement
  enhanceUsernames();
  enhancePostNumbers();
  enhanceSubredditNames();

  // Set up a mutation observer to handle dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    let shouldEnhance = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        shouldEnhance = true;
      }
    });
    
    if (shouldEnhance) {
      enhanceUsernames();
      enhancePostNumbers();
      enhanceSubredditNames();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });



  });