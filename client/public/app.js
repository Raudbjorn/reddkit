// App state
let currentSubreddit = '';
let currentSort = 'hot';
let isLoadingMore = false;
let afterToken = null;
let noMorePosts = false;

// DOM Elements
const subredditView = document.getElementById('subreddit-view');
const postsView = document.getElementById('posts-view');
const backButton = document.getElementById('back-button');
const currentSubredditEl = document.getElementById('current-subreddit');
const postsContainer = document.getElementById('posts-container');
const postDetailContainer = document.getElementById('post-detail-container');
const postsLoader = document.getElementById('posts-loader');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Handle back button
  backButton.addEventListener('click', function() {
    postsView.classList.remove('show');
    subredditView.classList.add('show');
    backButton.style.display = 'none';
  });
  
  // Handle subreddit results click delegation
  document.getElementById('subreddit-results').addEventListener('click', function(e) {
    const subredditItem = e.target.closest('.subreddit-item');
    if (subredditItem) {
      const subredditName = subredditItem.getAttribute('data-name');
      if (subredditName) {
        selectSubreddit(subredditName);
      }
    }
  });

    // Handle subreddit side-bar click delegation
    document.getElementById('subreddit-sidebar').addEventListener('click', function(e) {
      const subredditItem = e.target.closest('.subreddit-item');
      if (subredditItem) {
        const subredditName = subredditItem.getAttribute('data-name');
        if (subredditName) {
          selectSubreddit(subredditName);
        }
      }
    });
  
  // Handle sort buttons
document.querySelectorAll('.sort-btn').forEach(button => {
    button.addEventListener('click', function() {
      if (!currentSubreddit) return;
      
      // Update active button
      document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      
      // Get sort type
      currentSort = this.getAttribute('data-sort');
      
      // Reset pagination
      afterToken = null;
      noMorePosts = false;
      
      console.log(`Loading posts for ${currentSubreddit} sorted by ${currentSort}`);
  
      // Show loader
      postsLoader.style.display = 'flex';
      
      // Load posts
      fetch(`http://127.0.0.1:3000/api/r/${currentSubreddit}/posts?sort=${currentSort}`)
        .then(response => {
          if (!response.ok) throw new Error(`Server responded with ${response.status}`);
          return response.json();
        })
        .then(data => {
          console.log("Received posts data:", data);
          renderPosts(data);
          postsLoader.style.display = 'none';
        })
        .catch(err => {
          console.error('Error loading posts:', err);
          postsContainer.innerHTML = `<div class="error">Failed to load posts: ${err.message}</div>`;
          postsLoader.style.display = 'none';
        });
    });
  });

  postsContainer.parentElement.addEventListener('scroll', handleScroll);

  // Handle post clicks delegation
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
        loadPostDetail(permalink);
      }
    }
  });
  
 // Check for stored subreddit
 const storedSubreddit = localStorage.getItem('selectedSubreddit');
 const urlParams = new URLSearchParams(window.location.search);
 const resetParam = urlParams.get('reset');
 
 // Only load the stored subreddit if there's no reset parameter
 if (storedSubreddit && resetParam !== 'true') {
   selectSubreddit(storedSubreddit);
 } else {
   // If reset is true or no stored subreddit, show the search view
   postsView.classList.remove('show');
   subredditView.classList.add('show');
   backButton.style.display = 'none';
   
   // Clear localStorage if reset is true
   if (resetParam === 'true') {
     localStorage.removeItem('selectedSubreddit');
   }
 }

 const postsListContainer = document.querySelector('.posts-list');
 postsListContainer.addEventListener('scroll', handleScroll);

  // Check auth status and update UI accordingly
  fetch('http://127.0.0.1:3000/api/auth-status')
    .then(response => response.json())
    .then(data => {
      document.getElementById('app-content').classList.toggle('not-logged-in', !data.isAuthenticated);
      
      // Refresh the login button to show the correct state
      if (data.isAuthenticated) {
        // If logged in, also refresh the subreddits sidebar
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

});

// Handle scroll event for infinite scrolling
function handleScroll(e) {
    if (!currentSubreddit || isLoadingMore || noMorePosts) return;
    
    const scrollElement = e.target;
    const scrollPosition = scrollElement.scrollTop + scrollElement.clientHeight;
    const totalHeight = scrollElement.scrollHeight;
    
    // If we're near the bottom (within 200px), load more posts
    if (scrollPosition >= totalHeight - 200) {
      loadMorePosts();
    }
  }




  // Load more posts for infinite scrolling
function loadMorePosts() {
    if (!afterToken || isLoadingMore || noMorePosts) return;
    
    isLoadingMore = true;
    
    // Create and show a loading indicator at the bottom of the posts
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-more';
    loadingIndicator.textContent = 'Loading more posts...';
    postsContainer.appendChild(loadingIndicator);
    
    fetch(`http://127.0.0.1:3000/api/r/${currentSubreddit}/posts?sort=${currentSort}&after=${afterToken}`)
      .then(response => {
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        return response.json();
      })
      .then(data => {
        // Remove the loading indicator
        loadingIndicator.remove();
        
        // Append new posts
        if (data.posts && data.posts.length > 0) {
          appendPosts(data.posts);
          afterToken = data.after;
        } else {
          noMorePosts = true;
          const endMessage = document.createElement('div');
          endMessage.className = 'end-message';
          endMessage.textContent = 'No more posts to load';
          postsContainer.appendChild(endMessage);
        }
        
        isLoadingMore = false;
      })
      .catch(err => {
        console.error('Error loading more posts:', err);
        loadingIndicator.textContent = 'Error loading more posts. Try again.';
        loadingIndicator.className = 'loading-error';
        isLoadingMore = false;
      });
  }
  
  // Append more posts to the existing list
  function appendPosts(posts) {
    if (!Array.isArray(posts) || posts.length === 0) return;
    
    let html = '';
    posts.forEach(post => {
      html += `
        <div class="post-item" data-permalink="${post.permalink}">
          <div class="post-score">${formatNumber(post.score)}</div>
          <div class="post-content">
            <h3 class="post-title">${post.title}</h3>
            <div class="post-meta">
              Posted by u/${post.author} • ${formatTimeAgo(post.created)} • 
              ${post.numComments} comment${post.numComments !== 1 ? 's' : ''}
            </div>
            ${post.thumbnail && post.thumbnail.startsWith('http') ? 
              `<div class="post-thumbnail"><img src="${post.thumbnail}" alt="Thumbnail"></div>` : ''}
          </div>
        </div>
      `;
    });
    
    // Append to existing content rather than replacing it
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Extract and append each post individually to maintain event handlers
    while (tempDiv.firstChild) {
      postsContainer.appendChild(tempDiv.firstChild);
    }
  }
  
 

  

// Select a subreddit
function selectSubreddit(name) {
    console.log(`Selecting subreddit: ${name}`);
    currentSubreddit = name;
    currentSubredditEl.textContent = `r/${name}`;
  
  // Switch views
  subredditView.classList.remove('show');
  postsView.classList.add('show');
  backButton.style.display = 'block';
  
  // Load the default "hot" posts
  document.querySelector('.sort-btn[data-sort="hot"]').click();
  
  // Store selection
  localStorage.setItem('selectedSubreddit', name);
}

function renderPosts(data) {
  // Reset pagination state
  afterToken = data.after;
  noMorePosts = !data.after;
  
  if (!Array.isArray(data.posts) || data.posts.length === 0) {
    postsContainer.innerHTML = '<div class="no-results">No posts found</div>';
    return;
  }
  
  let html = '';
  data.posts.forEach(post => {
    html += `
      <div class="post-item" data-permalink="${post.permalink}">
        <div class="post-score">${formatNumber(post.score)}</div>
        <div class="post-content">
          <h3 class="post-title">${post.title}</h3>
          <div class="post-meta">
            Posted by u/${post.author} • ${formatTimeAgo(post.created)} • 
            ${post.numComments} comment${post.numComments !== 1 ? 's' : ''}
          </div>
          ${post.thumbnail && post.thumbnail.startsWith('http') ? 
            `<div class="post-thumbnail"><img src="${post.thumbnail}" alt="Thumbnail"></div>` : ''}
        </div>
      </div>
    `;
  });
  
  postsContainer.innerHTML = html;
}

// Load post details
function loadPostDetail(permalink) {
  if (!permalink) return;
  
  postDetailContainer.innerHTML = '<div class="loading-message">Loading post details...</div>';
  
  fetch(`http://127.0.0.1:3000/api/post${permalink}`)
    .then(response => {
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      return response.json();
    })
    .then(post => {
      let html = `
        <div class="post-detail-view">
          <h2 class="post-title">${post.title}</h2>
          
          <div class="post-stats">
            <div class="stat"><span>Score:</span> ${post.score} ${post.upvoteRatio ? `(${Math.round(post.upvoteRatio * 100)}% upvoted)` : ''}</div>
            <div class="stat"><span>Posted by:</span> u/${post.author}</div>
            <div class="stat"><span>Posted:</span> ${formatDate(post.created)}</div>
            <div class="stat"><span>Comments:</span> ${post.numComments}</div>
          </div>
          
          <div class="post-body">
            ${post.selftext ? `<div class="post-text">${post.selftext}</div>` : ''}
            ${post.url ? `<div class="post-link"><a href="${post.url}" target="_blank">${post.domain || 'Link'} ↗</a></div>` : ''}
          </div>
          
          <button class="load-comments-btn" onclick="loadComments('${post.permalink}')">
            Load Comments
          </button>
        </div>
      `;
      
      postDetailContainer.innerHTML = html;
    })
    .catch(err => {
      console.error(`Error loading post details:`, err);
      postDetailContainer.innerHTML = `<div class="error">Failed to load post details: ${err.message}</div>`;
    });
}

// Load comments for a post
function loadComments(permalink) {
  console.log("Loading comments for:", permalink);
  const commentsContainer = document.createElement('div');
  commentsContainer.classList.add('comments-container');
  commentsContainer.innerHTML = '<div class="loading-message">Loading comments...</div>';
  
  const loadCommentsBtn = document.querySelector('.load-comments-btn');
  if (loadCommentsBtn) {
    loadCommentsBtn.replaceWith(commentsContainer);
  }
  
  // Clean the permalink
  let cleanPermalink = permalink;
  if (cleanPermalink.endsWith('/comments')) {
    cleanPermalink = cleanPermalink.substring(0, cleanPermalink.length - 9);
  }
  
  fetch(`http://127.0.0.1:3000/api/post${cleanPermalink}/comments`)
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

// Recursively render comments and their replies
function renderComments(comments) {
  if (!Array.isArray(comments) || comments.length === 0) {
    return '';
  }
  
  let html = '';
  
  comments.forEach(comment => {
    if (!comment || typeof comment !== 'object') {
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

// Format utilities
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
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

// // Function to load a subreddit when clicked
// function loadSubreddit(subredditName) {
//   // Update the current subreddit display
//   document.getElementById('current-subreddit').textContent = `r/${subredditName}`;
  
//   // Hide subreddit search view and show posts view
//   document.getElementById('subreddit-view').classList.remove('show');
//   document.getElementById('posts-view').classList.add('show');
  
//   // Show back button
//   document.getElementById('back-button').style.display = 'block';
  
//   // Clear existing posts
//   const postsContainer = document.getElementById('posts-container');
//   postsContainer.innerHTML = '<div class="loading-message">Loading posts...</div>';
  
//   // Get the currently active sort button
//   const activeSortBtn = document.querySelector('.sort-btn.active');
//   const sortType = activeSortBtn ? activeSortBtn.dataset.sort : 'hot';
  
//   // Fetch posts for the subreddit with the active sort
//   fetchSubredditPosts(subredditName, sortType);

//   // Update URL if using history API (optional)
//   if (history && history.pushState) {
//     history.pushState({ subreddit: subredditName }, '', `#/r/${subredditName}`);
//   }
// }

// // This assumes you have a function like this to fetch posts
// function fetchSubredditPosts(subreddit, sort) {
//   const postsContainer = document.getElementById('posts-container');
  
//   // Show loader
//   document.getElementById('posts-loader').style.display = 'block';
  
//   // Use fetch or HTMX to load posts
//   fetch(`http://127.0.0.1:3000/api/posts/${subreddit}?sort=${sort}`)
//     .then(response => response.json())
//     .then(data => {
//       // Process and display posts
//       displayPosts(data, postsContainer);
//     })
//     .catch(error => {
//       console.error('Error fetching posts:', error);
//       postsContainer.innerHTML = '<div class="error">Failed to load posts. Please try again.</div>';
//     })
//     .finally(() => {
//       document.getElementById('posts-loader').style.display = 'none';
//     });
// }

// // Handle back button click
// document.getElementById('back-button').addEventListener('click', function() {
//   // Hide posts view and show subreddit search view
//   document.getElementById('posts-view').classList.remove('show');
//   document.getElementById('subreddit-view').classList.add('show');
  
//   // Hide back button
//   this.style.display = 'none';
  
//   // Update URL if using history API (optional)
//   if (history && history.pushState) {
//     history.pushState({}, '', '/');
//   }
// });