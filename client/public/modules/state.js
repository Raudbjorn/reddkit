// Application State
export const appState = {
  // Subreddit state
  currentSubreddit: '',
  currentSubredditSearch: '',
  subredditAfterToken: null,
  isLoadingMoreSubreddits: false,
  noMoreSubreddits: false,
  
  // Posts state
  currentSort: 'hot',
  postsAfterToken: null,
  isLoadingMorePosts: false,
  noMorePosts: false
};

// Reset pagination for subreddits
export function resetSubredditPagination() {
  appState.subredditAfterToken = null;
  appState.isLoadingMoreSubreddits = false;
  appState.noMoreSubreddits = false;
}

// Reset pagination for posts
export function resetPostsPagination() {
  appState.postsAfterToken = null;
  appState.isLoadingMorePosts = false;
  appState.noMorePosts = false;
}

// Set current subreddit and save to localStorage
export function setCurrentSubreddit(name) {
  appState.currentSubreddit = name;
  localStorage.setItem('selectedSubreddit', name);
}

// Set current search query
export function setCurrentSearch(query) {
  appState.currentSubredditSearch = query;
  resetSubredditPagination();
}

// Set current sort method
export function setCurrentSort(sort) {
  appState.currentSort = sort;
  resetPostsPagination();
}

// Reset all state
export function resetState() {
  appState.currentSubreddit = '';
  appState.currentSubredditSearch = '';
  resetSubredditPagination();
  resetPostsPagination();
  localStorage.removeItem('selectedSubreddit');
}