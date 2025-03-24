// Import other modules
import { appState, resetState } from './modules/state.js';
import { 
  handleSubredditScroll, 
  handlePostsScroll, 
  setupEventListeners 
} from './modules/ui-handlers.js';
import { checkAuthStatus } from './modules/api.js';
import { loadStoredSubreddit } from './modules/subreddits.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Set up all event listeners
  setupEventListeners();
  
  // Check auth status and update UI
  checkAuthStatus()
    .then(isAuthenticated => {
      document.getElementById('app-content').classList.toggle('not-logged-in', !isAuthenticated);
      
      // If authenticated, load the subreddits sidebar
      if (isAuthenticated) {
        const sidebarEl = document.getElementById('subreddit-sidebar');
        if (sidebarEl) {
          sidebarEl.setAttribute('hx-trigger', 'load');
          htmx.process(sidebarEl);
        }
      }
    })
    .catch(err => {
      console.error('Error checking auth status:', err);
    });
  
  // Load stored subreddit or show search view
  loadStoredSubreddit();
  
  // Add scroll event listeners for infinite scrolling
  const postsListContainer = document.querySelector('.posts-list');
  if (postsListContainer) {
    postsListContainer.addEventListener('scroll', handlePostsScroll);
  }
  
  const subredditResultsContainer = document.getElementById('subreddit-results');
  if (subredditResultsContainer) {
    subredditResultsContainer.addEventListener('scroll', handleSubredditScroll);
  }
});

// At the bottom of app.js, expose required functions to window
import { loadComments } from './modules/renderers.js';
import { selectSubreddit } from './modules/ui-handlers.js';

// Expose functions needed for inline HTML event handlers
window.loadComments = loadComments;
window.selectSubreddit = selectSubreddit;