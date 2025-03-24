import { appState, setCurrentSubreddit, setCurrentSort, setCurrentSearch } from './state.js';
import { fetchSubreddits, fetchPosts, vote, toggleSubscribe } from './api.js';
import { renderPosts, appendPosts, renderPostDetail, loadComments, appendSubreddits, addSubscribeButton } from './renderers.js';
import { setupStatsPanel } from './subreddit-stats.js';
import { formatNumber } from './utils.js';

// Set up all event listeners
export function setupEventListeners() {
  // Handle back button
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.addEventListener('click', function() {
      const postsView = document.getElementById('posts-view');
      const subredditView = document.getElementById('subreddit-view');
      
      postsView.classList.remove('show');
      subredditView.classList.add('show');
      backButton.style.display = 'none';
    });
  }
  
  // Handle subreddit results click delegation
  const subredditResults = document.getElementById('subreddit-results');
  if (subredditResults) {
    subredditResults.addEventListener('click', function(e) {
      const subredditItem = e.target.closest('.subreddit-item');
      if (subredditItem) {
        const subredditName = subredditItem.getAttribute('data-name');
        if (subredditName) {
          selectSubreddit(subredditName);
        }
      }
    });
  }

  // Handle subreddit sidebar click delegation
  const subredditSidebar = document.getElementById('subreddit-sidebar');
  if (subredditSidebar) {
    subredditSidebar.addEventListener('click', function(e) {
      const subredditItem = e.target.closest('.subreddit-item');
      if (subredditItem) {
        const subredditName = subredditItem.getAttribute('data-name');
        if (subredditName) {
          selectSubreddit(subredditName);
        }
      }
    });
  }
  
  // Handle sort buttons
  const sortButtons = document.querySelectorAll('.sort-btn');
  if (sortButtons.length) {
    sortButtons.forEach(button => {
      button.addEventListener('click', function() {
        if (!appState.currentSubreddit) return;
        
        // Update active button
        document.querySelectorAll('.sort-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Get sort type and update state
        const sortType = this.getAttribute('data-sort');
        setCurrentSort(sortType);
        
        // Show loader
        const postsLoader = document.getElementById('posts-loader');
        postsLoader.style.display = 'flex';
        
        // Load posts
        fetchPosts(appState.currentSubreddit, appState.currentSort)
          .then(data => {
            renderPosts(data);
            postsLoader.style.display = 'none';
          })
          .catch(err => {
            console.error('Error loading posts:', err);
            const postsContainer = document.getElementById('posts-container');
            postsContainer.innerHTML = `<div class="error">Failed to load posts: ${err.message}</div>`;
            postsLoader.style.display = 'none';
          });
      });
    });
  }

  // Handle post clicks
  const postsContainer = document.getElementById('posts-container');
  if (postsContainer) {
    postsContainer.addEventListener('click', function(e) {
      const postItem = e.target.closest('.post-item');
      if (postItem) {
        // Remove selected class from all posts
        document.querySelectorAll('.post-item').forEach(post => {
          post.classList.remove('selected');
        });
        
        // Add selected class to clicked post
        postItem.classList.add('selected');
        
        // Get permalink and load post details
        const permalink = postItem.getAttribute('data-permalink');
        if (permalink) {
          renderPostDetail(permalink);
        }
      }
    });
  }
  
  // Override the subreddit search form submission
  const searchForm = document.querySelector('.search-container form');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const searchInput = this.querySelector('input[name="q"]');
      if (!searchInput.value.trim()) return;
      
      // Set current search and reset pagination
      setCurrentSearch(searchInput.value.trim());
      
      // Show loader and clear previous results
      const resultsContainer = document.getElementById('subreddit-results');
      const loader = document.querySelector('.search-container .loader');
      
      loader.style.display = 'block';
      resultsContainer.innerHTML = '';
      
      // Fetch initial results
      handleSubredditSearch();
    });
  }

  // Add event delegation for voting buttons
  document.addEventListener('click', function(e) {
    if (e.target.closest('.vote-arrow')) {
      handleVoteClick(e);
    }
  });

  // Set up stats panel toggle
  setupStatsPanel();
  
  // Update selectSubreddit function to add subscribe button
  const originalSelectSubreddit = window.selectSubreddit;
  window.selectSubreddit = function(name) {
    originalSelectSubreddit(name);
    
    // Add the subscribe button after loading the subreddit
    setTimeout(() => {
      addSubscribeButton(name);
    }, 500);
  };
}

// Handle scroll event for posts infinite scrolling
export function handlePostsScroll(e) {
  if (!appState.currentSubreddit || appState.isLoadingMorePosts || appState.noMorePosts) return;
  
  const scrollElement = e.target;
  const scrollPosition = scrollElement.scrollTop + scrollElement.clientHeight;
  const totalHeight = scrollElement.scrollHeight;
  
  // If we're near the bottom (within 200px), load more posts
  if (scrollPosition >= totalHeight - 200) {
    loadMorePosts();
  }
}

// Handle scroll event for subreddit infinite scrolling
export function handleSubredditScroll(e) {
  if (!appState.currentSubredditSearch || appState.isLoadingMoreSubreddits || appState.noMoreSubreddits) return;
  
  const scrollElement = e.target;
  const scrollPosition = scrollElement.scrollTop + scrollElement.clientHeight;
  const totalHeight = scrollElement.scrollHeight;
  
  // If we're near the bottom (within 200px), load more subreddits
  if (scrollPosition >= totalHeight - 200) {
    loadMoreSubreddits();
  }
}

// Select a subreddit
export function selectSubreddit(name) {
  setCurrentSubreddit(name);
  
  // Update UI
  document.getElementById('current-subreddit').textContent = `r/${name}`;
  
  // Switch views
  document.getElementById('subreddit-view').classList.remove('show');
  document.getElementById('posts-view').classList.add('show');
  document.getElementById('back-button').style.display = 'block';
  
  // Load subreddit stats
  loadSubredditStats(name);
  
  // Load the default "hot" posts
  document.querySelector('.sort-btn[data-sort="hot"]').click();
}

// Handle subreddit search
export function handleSubredditSearch() {
  appState.isLoadingMoreSubreddits = true;
  
  fetchSubreddits(appState.currentSubredditSearch)
    .then(data => {
      const resultsContainer = document.getElementById('subreddit-results');
      const loader = document.querySelector('.search-container .loader');
      
      // Clear previous results
      resultsContainer.innerHTML = '';
      
      if (data.subreddits && data.subreddits.length > 0) {
        appendSubreddits(data.subreddits);
        appState.subredditAfterToken = data.after;
      } else {
        resultsContainer.innerHTML = '<div class="no-results">No subreddits found</div>';
        appState.noMoreSubreddits = true;
      }
      
      loader.style.display = 'none';
      appState.isLoadingMoreSubreddits = false;
    })
    .catch(err => {
      console.error('Error searching subreddits:', err);
      const resultsContainer = document.getElementById('subreddit-results');
      const loader = document.querySelector('.search-container .loader');
      
      resultsContainer.innerHTML = `<div class="error">Search failed: ${err.message}</div>`;
      
      loader.style.display = 'none';
      appState.isLoadingMoreSubreddits = false;
    });
}

// Load more posts for infinite scrolling
export function loadMorePosts() {
  if (!appState.postsAfterToken || appState.isLoadingMorePosts || appState.noMorePosts) return;
  
  appState.isLoadingMorePosts = true;
  
  // Create loading indicator
  const postsContainer = document.getElementById('posts-container');
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-more';
  loadingIndicator.textContent = 'Loading more posts...';
  postsContainer.appendChild(loadingIndicator);
  
  // Fetch more posts
  fetchPosts(appState.currentSubreddit, appState.currentSort, appState.postsAfterToken)
    .then(data => {
      // Remove loading indicator
      loadingIndicator.remove();
      
      if (data.posts && data.posts.length > 0) {
        appendPosts(data.posts);
        appState.postsAfterToken = data.after;
      } else {
        appState.noMorePosts = true;
        const endMessage = document.createElement('div');
        endMessage.className = 'end-message';
        endMessage.textContent = 'No more posts to load';
        postsContainer.appendChild(endMessage);
      }
      
      appState.isLoadingMorePosts = false;
    })
    .catch(err => {
      console.error('Error loading more posts:', err);
      loadingIndicator.textContent = 'Error loading more posts. Try again.';
      loadingIndicator.className = 'loading-error';
      appState.isLoadingMorePosts = false;
    });
}

// Load more subreddits
export function loadMoreSubreddits() {
  if (!appState.subredditAfterToken || appState.isLoadingMoreSubreddits || appState.noMoreSubreddits) return;
  
  appState.isLoadingMoreSubreddits = true;
  
  // Create loading indicator
  const resultsContainer = document.getElementById('subreddit-results');
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-more';
  loadingIndicator.textContent = 'Loading more subreddits...';
  resultsContainer.appendChild(loadingIndicator);
  
  // Fetch more subreddits
  fetchSubreddits(appState.currentSubredditSearch, appState.subredditAfterToken)
    .then(data => {
      // Remove loading indicator after delay
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.remove();
        }
      }, 500);
      
      if (data.subreddits && data.subreddits.length > 0) {
        appendSubreddits(data.subreddits);
        appState.subredditAfterToken = data.after;
      } else {
        appState.noMoreSubreddits = true;
        const endMessage = document.createElement('div');
        endMessage.className = 'end-message';
        endMessage.textContent = 'No more subreddits to load';
        resultsContainer.appendChild(endMessage);
      }
      
      appState.isLoadingMoreSubreddits = false;
    })
    .catch(err => {
      console.error('Error loading more subreddits:', err);
      loadingIndicator.textContent = 'Error loading more subreddits. Try again.';
      loadingIndicator.className = 'loading-error';
      appState.isLoadingMoreSubreddits = false;
    });
}

// Handle voting
export async function handleVoteClick(e) {
  const voteButton = e.target.closest('.vote-arrow');
  if (!voteButton) return;
  
  const postId = voteButton.dataset.id;
  const direction = voteButton.dataset.vote; // 'up' or 'down'
  const scoreElement = voteButton.parentElement.querySelector('.post-score');
  
  // Remove active class from both buttons
  const upvoteButton = voteButton.parentElement.querySelector('.upvote');
  const downvoteButton = voteButton.parentElement.querySelector('.downvote');
  
  // Check if this button is already active (clicking again to undo)
  const isActive = voteButton.classList.contains('active');
  
  // Remove active classes and score modifications
  upvoteButton.classList.remove('active');
  downvoteButton.classList.remove('active');
  scoreElement.classList.remove('upvoted', 'downvoted');
  
  let dir = 0; // 0 = remove vote
  
  // If not already active, set the new vote
  if (!isActive) {
    voteButton.classList.add('active');
    scoreElement.classList.add(direction === 'up' ? 'upvoted' : 'downvoted');
    dir = direction === 'up' ? 1 : -1;
  }
  
  // Get current score
  const currentScore = parseInt(scoreElement.dataset.score || 0);
  
  // Update UI immediately for responsiveness
  let newScore = currentScore;
  if (dir === 1) newScore++;
  if (dir === -1) newScore--;
  
  scoreElement.textContent = formatNumber(newScore);
  
  try {
    // Send vote to server
    await vote(postId, dir);
    
    // Show success message
    showPopup(`${dir === 0 ? 'Vote removed' : dir === 1 ? 'Upvoted' : 'Downvoted'}`);
    
    // Update the score attribute to match new value
    scoreElement.dataset.score = newScore;
  } catch (error) {
    console.error('Error voting:', error);
    
    // Revert UI if there was an error
    upvoteButton.classList.remove('active');
    downvoteButton.classList.remove('active');
    scoreElement.classList.remove('upvoted', 'downvoted');
    scoreElement.textContent = formatNumber(currentScore);
    
    showPopup('Error: Vote failed', true);
  }
}

// Handle subscribe button click
export async function handleSubscribeClick(e) {
  const button = e.currentTarget;
  const subreddit = button.dataset.subreddit;
  const action = button.dataset.action; // 'sub' or 'unsub'
  
  try {
    // Send subscription update to server
    await toggleSubscribe(subreddit, action);
    
    // Update button state
    if (action === 'sub') {
      button.dataset.action = 'unsub';
      button.classList.add('subscribed');
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
        Joined
      `;
      showPopup(`Joined r/${subreddit}`);
    } else {
      button.dataset.action = 'sub';
      button.classList.remove('subscribed');
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Join
      `;
      showPopup(`Left r/${subreddit}`);
    }
  } catch (error) {
    console.error('Error updating subscription:', error);
    showPopup('Error updating subscription', true);
  }
}

// Show a popup notification
export function showPopup(message, isError = false) {
  // Remove any existing popups
  const existingPopup = document.querySelector('.action-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create new popup
  const popup = document.createElement('div');
  popup.className = `action-popup ${isError ? 'error' : ''}`;
  popup.textContent = message;
  
  // Add to document
  document.body.appendChild(popup);
  
  // Trigger animation
  setTimeout(() => popup.classList.add('show'), 10);
  
  // Remove after a delay
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 300); // Wait for fade-out animation
  }, 2000);
}