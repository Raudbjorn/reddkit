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