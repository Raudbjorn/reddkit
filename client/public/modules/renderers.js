import { appState } from './state.js';
import { fetchPostDetails, fetchComments, vote, getSubscriptionStatus, toggleSubscribe } from './api.js';
import { formatNumber, formatTimeAgo, formatDate, formatSubscribers } from './utils.js';
import { showPopup } from './ui-handlers.js';

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
  const isGilded = post.gilded && post.gilded > 0;
  const isPinned = post.stickied === true;
  
  return `
    <div class="post-item ${isPinned ? 'pinned-post' : ''}" data-permalink="${post.permalink}" data-id="${post.name}">
      <div class="vote-container">
        <button class="vote-arrow upvote" data-vote="up" data-id="${post.name}" aria-label="Upvote">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 4.5L4 15h16L12 4.5z"/>
          </svg>
        </button>
        <div class="post-score" data-score="${post.score}">${formatNumber(post.score)}</div>
        <button class="vote-arrow downvote" data-vote="down" data-id="${post.name}" aria-label="Downvote">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 19.5L4 9h16L12 19.5z"/>
          </svg>
        </button>
      </div>
      <div class="post-content">
        ${isPinned ? `
          <div class="pinned-indicator">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
              <path d="M9.5 3h-3a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5H7v4H5.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1H9V7h.5a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"/>
            </svg>
            Pinned by moderators
          </div>
        ` : ''}
        <h3 class="post-title">${post.title}</h3>
        <div class="post-meta">
          Posted by u/${post.author} • ${formatTimeAgo(post.created)} • 
          ${post.numComments} comment${post.numComments !== 1 ? 's' : ''}
          ${isGilded ? `
            <div class="gilded-badge" title="This post received gold">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 8c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V9h1v1c0 .55.45 1 1 1h4c.55 0 1-.45 1-1V9h1v1z"/>
              </svg>
              <span>${post.gilded}x Gold</span>
            </div>
          ` : ''}
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
    const isGilded = comment.gilded && comment.gilded > 0;
    
    html += `
      <div class="comment${indentClass}" data-id="${comment.name}">
        <div class="comment-header">
          <span class="comment-author">u/${comment.author || '[deleted]'}</span>
          <span class="comment-meta">
            ${formatTimeAgo(comment.created)} • ${comment.score} points
            ${isGilded ? `
              <div class="gilded-badge" title="This comment received gold">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                  <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 8c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V9h1v1c0 .55.45 1 1 1h4c.55 0 1-.45 1-1V9h1v1z"/>
                </svg>
                <span>${comment.gilded}x Gold</span>
              </div>
            ` : ''}
          </span>
        </div>
        <div class="vote-container comment-votes">
          <button class="vote-arrow upvote" data-vote="up" data-id="${comment.name}" aria-label="Upvote">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 4.5L4 15h16L12 4.5z"/>
            </svg>
          </button>
          <div class="post-score" data-score="${comment.score}">${formatNumber(comment.score)}</div>
          <button class="vote-arrow downvote" data-vote="down" data-id="${comment.name}" aria-label="Downvote">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 19.5L4 9h16L12 19.5z"/>
            </svg>
          </button>
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

// Add subscribe button to the subreddit header
export async function addSubscribeButton(subreddit) {
  try {
    const { subscribed } = await getSubscriptionStatus(subreddit);
    
    const subscribeButton = document.createElement('button');
    subscribeButton.id = 'subscribe-button';
    subscribeButton.className = `subscribe-button ${subscribed ? 'subscribed' : ''}`;
    subscribeButton.dataset.subreddit = subreddit;
    subscribeButton.dataset.action = subscribed ? 'unsub' : 'sub';
    
    subscribeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        ${subscribed ? 
          '<path d="M19 13H5v-2h14v2z"/>' : 
          '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>'}
      </svg>
      ${subscribed ? 'Joined' : 'Join'}
    `;
    
    const header = document.querySelector('.subreddit-header-main');
    if (header) {
      header.appendChild(subscribeButton);
    }
    
    // Add event listener
    subscribeButton.addEventListener('click', handleSubscribeClick);
    
  } catch (error) {
    console.error('Error adding subscribe button:', error);
  }
}