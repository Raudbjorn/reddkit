import { appState } from './state.js';

const API_BASE_URL = 'http://127.0.0.1:3000';

// Check auth status
export async function checkAuthStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth-status`);
    const data = await response.json();
    return data.isAuthenticated;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return false;
  }
}

// Fetch subreddits with search
export async function fetchSubreddits(query, after = null) {
  let url = `${API_BASE_URL}/api/subreddits/search?q=${encodeURIComponent(query)}`;
  if (after) {
    url += `&after=${after}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  
  return response.json();
}

// Fetch posts for a subreddit
export async function fetchPosts(subreddit, sort = 'hot', after = null) {
  let url = `${API_BASE_URL}/api/r/${subreddit}/posts?sort=${sort}`;
  if (after) {
    url += `&after=${after}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  
  return response.json();
}

// Fetch post details
export async function fetchPostDetails(permalink) {
  const response = await fetch(`${API_BASE_URL}/api/post${permalink}`);
  
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  
  return response.json();
}

// Fetch post comments
export async function fetchComments(permalink) {
  // Clean the permalink
  let cleanPermalink = permalink;
  if (cleanPermalink.endsWith('/comments')) {
    cleanPermalink = cleanPermalink.substring(0, cleanPermalink.length - 9);
  }
  
  const response = await fetch(`${API_BASE_URL}/api/post${cleanPermalink}/comments`);
  
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  
  return response.json();
}

// Fetch comprehensive subreddit statistics
export async function fetchSubredditStats(subreddit) {
    const response = await fetch(`${API_BASE_URL}/api/subreddit/${subreddit}/stats`);
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    return response.json();
  }

// Vote on a post or comment
export async function vote(id, direction) {
  const dir = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
  
  const response = await fetch(`${API_BASE_URL}/api/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, dir })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Vote failed with status: ${response.status}`);
  }
  
  return response.json();
}

// Subscribe or unsubscribe from a subreddit
export async function toggleSubscribe(subredditName, action) {
  const response = await fetch(`${API_BASE_URL}/api/subreddit/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      subreddit: subredditName, 
      action: action // 'sub' or 'unsub'
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Subscription action failed with status: ${response.status}`);
  }
  
  return response.json();
}

// Get subscription status for a subreddit
export async function getSubscriptionStatus(subredditName) {
  const response = await fetch(`${API_BASE_URL}/api/subreddit/${subredditName}/subscription`);
  
  if (!response.ok) {
    throw new Error(`Failed to get subscription status: ${response.status}`);
  }
  
  return response.json();
}