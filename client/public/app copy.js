// DOM Elements
const backButton = document.getElementById('back-button');
const subredditView = document.getElementById('subreddit-view');
const postsView = document.getElementById('posts-view');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const subredditResults = document.getElementById('subreddit-results');
const subredditNameElement = document.getElementById('subreddit-name');
const postsContainer = document.getElementById('posts-container');
const postDetailContainer = document.getElementById('post-detail-container');

// Current state
let currentSubreddit = null;
let currentSort = 'hot';

// Initialize the app
function init() {
  // Set up event listeners
  backButton.addEventListener('click', showSubredditView);
  searchButton.addEventListener('click', searchSubreddits);
  searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchSubreddits();
  });
  
  // Set up sort button listeners
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      currentSort = e.target.getAttribute('data-sort');
      loadPosts(currentSubreddit, currentSort);
    });
  });
  
  // Listen for clicks on subreddit results (using event delegation)
  subredditResults.addEventListener('click', e => {
    const item = e.target.closest('.subreddit-item');
    if (item) {
      const name = item.getAttribute('data-name');
      selectSubreddit(name);
    }
  });
  
  // Listen for clicks on posts (using event delegation)
  postsContainer.addEventListener('click', e => {
    const post = e.target.closest('.post-item');
    if (post) {
      const permalink = post.getAttribute('data-permalink');
      loadPostDetail(permalink);
      
      // Highlight selected post
      document.querySelectorAll('.post-item').forEach(p => {
        p.classList.remove('selected');
      });
      post.classList.add('selected');
    }
  });
}

// Search for subreddits
function searchSubreddits() {
  const query = searchInput.value.trim();
  if (!query) return;
  
  // Show loading indicator
  subredditResults.innerHTML = '<div class="loading-message">Searching...</div>';
  
  // Fetch results
  fetch(`/api/subreddits/search?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      if (data.length === 0) {
        subredditResults.innerHTML = '<div class="no-results">No subreddits found</div>';
        return;
      }
      
      let html = '';
      data.forEach(sr => {
        html += `
          <div class="subreddit-item" data-name="${sr.name}">
            <div class="subreddit-header">
              <div class="subreddit-name">r/${sr.name}</div>
              <div class="subscribers">${formatNumber(sr.subscribers)} subscribers</div>
            </div>
            <div class="subreddit-desc">${sr.description || 'No description available'}</div>
          </div>
        `;
      });
      
      subredditResults.innerHTML = html;
    })
    .catch(err => {
      console.error('Error searching subreddits:', err);
      subredditResults.innerHTML = '<div class="error">Failed to search subreddits. Please try again.</div>';
    });
}

// Select a subreddit and show its posts
function selectSubreddit(name) {
  currentSubreddit = name;
  subredditNameElement.textContent = `r/${name}`;
  
  // Show posts view
  subredditView.style.display = 'none';
  postsView.style.display = 'block';
  backButton.style.display = 'block';
  
  // Load posts with default sort
  loadPosts(name, currentSort);
}

// Load posts for a subreddit
function loadPosts(subreddit, sort) {
  postsContainer.innerHTML = '<div class="loading-message">Loading posts...</div>';
  
  fetch(`/api/r/${subreddit}/posts?sort=${sort}`)
    .then(response => response.json())
    .then(posts => {
      if (posts.length === 0) {
        postsContainer.innerHTML = '<div class="no-results">No posts found</div>';
        return;
      }
      
      let html = '';
      posts.forEach(post => {
        html += `
          <div class="post-item" data-permalink="${post.permalink}">
            <div class="post-score">${formatScore(post.score)}</div>
            <div class="post-content">
              <h3 class="post-title">${post.title}</h3>
              <div class="post-meta">
                Posted by u/${post.author} • ${formatTimeAgo(post.created)}
              </div>
            </div>
          </div>
        `;
      });
      
      postsContainer.innerHTML = html;
    })
    .catch(err => {
      console.error(`Error loading posts for r/${subreddit}:`, err);
      postsContainer.innerHTML = '<div class="error">Failed to load posts. Please try again.</div>';
    });
}

// Load post detail
function loadPostDetail(permalink) {
  postDetailContainer.innerHTML = '<div class="loading-message">Loading post details...</div>';
  
  fetch(`/api/post${permalink}`)
    .then(response => response.json())
    .then(post => {
      let html = `
        <div class="post-detail-view">
          <h2 class="post-title">${post.title}</h2>
          
          <div class="post-stats">
            <div class="stat"><span>Score:</span> ${post.score} (${Math.round(post.upvoteRatio * 100)}% upvoted)</div>
            <div class="stat"><span>Posted by:</span> u/${post.author}</div>
            <div class="stat"><span>Posted:</span> ${formatDate(post.created)}</div>
            <div class="stat"><span>Comments:</span> ${post.numComments}</div>
          </div>
          
          <div class="post-body">
            ${post.selftext ? `<div class="post-text">${post.selftext}</div>` : ''}
            ${post.url ? `<div class="post-link"><a href="${post.url}" target="_blank">${post.domain || 'Link'} ↗</a></div>` : ''}
          </div>
          
          <button class="load-comments-btn" onclick="loadComments('${permalink}')">
            Load Comments
          </button>
        </div>
      `;
      
      postDetailContainer.innerHTML = html;
    })
    .catch(err => {
      console.error(`Error loading post details:`, err);
      postDetailContainer.innerHTML = '<div class="error">Failed to load post details. Please try again.</div>';
    });
}

// Load comments for a post
// Load comments for a post
function loadComments(permalink) {
    console.log("Loading comments for:", permalink);
    const commentsContainer = document.createElement('div');
    commentsContainer.classList.add('comments-container');
    commentsContainer.innerHTML = '<div class="loading-message">Loading comments...</div>';
    
    const loadCommentsBtn = document.querySelector('.load-comments-btn');
    loadCommentsBtn.replaceWith(commentsContainer);
    
    // Remove 'comments' from the permalink if it's already there
    let cleanPermalink = permalink;
    if (cleanPermalink.endsWith('/comments')) {
      cleanPermalink = cleanPermalink.substring(0, cleanPermalink.length - 9);
    }
    
    // Make the request to the correct comments endpoint
    fetch(`/api/post${cleanPermalink}/comments`)
      .then(response => {
        console.log("Comments response status:", response.status);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Received comments data:", data);
        
        // Ensure we have a valid array of comments
        const comments = Array.isArray(data) ? data : [];
        
        if (comments.length === 0) {
          commentsContainer.innerHTML = '<div class="no-comments">No comments yet</div>';
          return;
        }
        
        let html = '<h3>Comments</h3>';
        html += renderComments(comments);
        
        html += `
          <div class="view-more">
            <a href="https://www.reddit.com${cleanPermalink}" target="_blank">
              View all comments on Reddit ↗
            </a>
          </div>
        `;
        
        commentsContainer.innerHTML = html;
      })
      .catch(err => {
        console.error(`Error loading comments:`, err);
        commentsContainer.innerHTML = `<div class="error">Failed to load comments: ${err.message}</div>`;
      });
  }
  

// function loadComments(permalink) {
//     const commentsContainer = document.createElement('div');
//     commentsContainer.classList.add('comments-container');
//     commentsContainer.innerHTML = '<div class="loading-message">Loading comments...</div>';
    
//     const loadCommentsBtn = document.querySelector('.load-comments-btn');
//     loadCommentsBtn.replaceWith(commentsContainer);
    
//     fetch(`/api/post${permalink}/comments`)
//       .then(response => response.json())
//       .then(comments => {
//         if (comments.length === 0) {
//           commentsContainer.innerHTML = '<div class="no-comments">No comments yet</div>';
//           return;
//         }
        
//         let html = '<h3>Comments</h3>';
//         html += renderComments(comments);
        
//         html += `
//           <div class="view-more">
//             <a href="https://www.reddit.com${permalink}" target="_blank">
//               View all comments on Reddit ↗
//             </a>
//           </div>
//         `;
        
//         commentsContainer.innerHTML = html;
//       })
//       .catch(err => {
//         console.error(`Error loading comments:`, err);
//         commentsContainer.innerHTML = '<div class="error">Failed to load comments. Please try again.</div>';
//       });
//   }
  
  // Recursively render comments and their replies
// Recursively render comments and their replies
function renderComments(comments) {
  // Check if comments is an array
  if (!Array.isArray(comments) || comments.length === 0) {
    console.log("Invalid comments data:", comments);
    return '';
  }
  
  let html = '';
  
  comments.forEach(comment => {
    // Make sure comment is a valid object
    if (!comment || typeof comment !== 'object') {
      console.log("Invalid comment object:", comment);
      return;
    }
    
    // Increase indent based on depth
    const depth = comment.depth || 0;
    const indentClass = depth > 0 ? ` indent-${Math.min(depth, 5)}` : '';
    
    html += `
      <div class="comment${indentClass}">
        <div class="comment-header">
          <span class="comment-author">u/${comment.author || '[deleted]'}</span>
          <span class="comment-meta">${formatTimeAgo(comment.created)} • ${comment.score} points</span>
        </div>
        <div class="comment-body">${comment.body || ''}</div>
        
        ${comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0 ? 
          renderComments(comment.replies) : 
          ''}
      </div>
    `;
  });
  
  return html;
}
// Show subreddit search view
function showSubredditView() {
  postsView.style.display = 'none';
  subredditView.style.display = 'block';
  backButton.style.display = 'none';
}

// Utility functions
function formatNumber(num) {
  if (!num) return '0';
  return num >= 1000000 
    ? (num / 1000000).toFixed(1) + 'M'
    : num >= 1000 
      ? (num / 1000).toFixed(1) + 'k' 
      : num.toString();
}

function formatScore(score) {
  if (score >= 10000) return (score / 1000).toFixed(1) + 'k';
  return score.toString();
}

function formatTimeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - timestamp;
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + ' days ago';
  if (seconds < 31536000) return Math.floor(seconds / 2592000) + ' months ago';
  return Math.floor(seconds / 31536000) + ' years ago';
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', init);