import { selectSubreddit } from './ui-handlers.js';

// Load stored subreddit from localStorage
export function loadStoredSubreddit() {
  const storedSubreddit = localStorage.getItem('selectedSubreddit');
  const urlParams = new URLSearchParams(window.location.search);
  const resetParam = urlParams.get('reset');
  
  // Only load the stored subreddit if there's no reset parameter
  if (storedSubreddit && resetParam !== 'true') {
    selectSubreddit(storedSubreddit);
  } else {
    // If reset is true or no stored subreddit, show the search view
    document.getElementById('posts-view').classList.remove('show');
    document.getElementById('subreddit-view').classList.add('show');
    document.getElementById('back-button').style.display = 'none';
    
    // Clear localStorage if reset is true
    if (resetParam === 'true') {
      localStorage.removeItem('selectedSubreddit');
    }
  }
}