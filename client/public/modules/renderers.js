import { appState } from './state.js';
import { fetchPostDetails, fetchComments } from './api.js';
import { formatNumber, formatTimeAgo, formatDate, formatSubscribers } from './utils.js';

// Render posts list
export function renderPosts(data) {
  const postsContainer = document.getElementById('posts-container');
  
  // Update pagination state
  appState.postsAfterToken = data.after;
  appState.noMorePosts = !data.after;
  
  if (!Array.isArray(data.posts) || data.posts.length === 0) {
    postsContainer.innerHTML = '<div class="no-results">No posts found</div>';
    return;
  }
  
  let html = '';
  data.posts.forEach(post => {
    html += createPostHTML(post);
  });
  
  postsContainer.innerHTML = html;
}

// Append additional posts
export function appendPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;
  
  const postsContainer = document.getElementById('posts-container');
  
  // Create temporary container
  const tempDiv = document.createElement('div');
  
  posts.forEach(post => {
    tempDiv.innerHTML = createPostHTML(post);
    while (tempDiv.firstChild) {
      postsContainer.appendChild(tempDiv.firstChild);
    }
  });
}

// Create HTML for a post item
function createPostHTML(post) {
  return `
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
}

// Render post detail
export function renderPostDetail(permalink) {
  if (!permalink) return;
  
  const postDetailContainer = document.getElementById('post-detail-container');
  postDetailContainer.innerHTML = '<div class="loading-message">Loading post details...</div>';
  
  fetchPostDetails(permalink)
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
          
          <button class="load-comments-btn" onclick="window.loadComments('${post.permalink}')">
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
export function loadComments(permalink) {
  console.log("Loading comments for:", permalink);
  const commentsContainer = document.createElement('div');
  commentsContainer.classList.add('comments-container');
  commentsContainer.innerHTML = '<div class="loading-message">Loading comments...</div>';
  
  const loadCommentsBtn = document.querySelector('.load-comments-btn');
  if (loadCommentsBtn) {
    loadCommentsBtn.replaceWith(commentsContainer);
  }
  
  // Fetch comments
  fetchComments(permalink)
    .then(data => {
      // Ensure we have a valid array of comments
      const comments = Array.isArray(data) ? data : [];
      
      if (comments.length === 0) {
        commentsContainer.innerHTML = '<div class="no-comments">No comments yet</div>';
        return;
      }
      
      let html = '<h3>Comments</h3>';
      html += renderComments(comments);
      
      // Clean the permalink
      let cleanPermalink = permalink;
      if (cleanPermalink.endsWith('/comments')) {
        cleanPermalink = cleanPermalink.substring(0, cleanPermalink.length - 9);
      }
      
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

// Recursively render comments
export function renderComments(comments) {
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

// Append subreddits to the results container
export function appendSubreddits(subreddits) {
  const resultsContainer = document.getElementById('subreddit-results');
  
  // Create a temporary div
  const tempDiv = document.createElement('div');
  
  subreddits.forEach(sr => {
    tempDiv.innerHTML = `
      <div class="subreddit-item" data-name="${sr.display_name}">
        <div class="subreddit-icon">
          ${sr.icon_img ? `<img src="${sr.icon_img}" alt="${sr.display_name}">` : 
            `<div class="default-icon">${sr.display_name.substring(0, 1).toUpperCase()}</div>`}
        </div>
        <div class="subreddit-info">
          <h3>${sr.display_name_prefixed}</h3>
          <p class="subscribers">${formatSubscribers(sr.subscribers)} subscribers</p>
          <p class="description">${sr.public_description || 'No description available'}</p>
        </div>
      </div>
    `;
    
    // Extract and append each subreddit individually
    while (tempDiv.firstChild) {
      resultsContainer.appendChild(tempDiv.firstChild);
    }
  });
}