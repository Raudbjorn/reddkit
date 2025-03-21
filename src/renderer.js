document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const sortFilter = document.getElementById('sort-filter');
  const nsfwFilter = document.getElementById('nsfw-filter');
  const resultsContainer = document.getElementById('results-container');
  
  let currentResults = [];
  
  // Search button click handler
  searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  });
  
  // Enter key press handler
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
      }
    }
  });
  
  // Filter change handlers
  sortFilter.addEventListener('change', filterAndDisplayResults);
  nsfwFilter.addEventListener('change', filterAndDisplayResults);
  
  // Perform search
  function performSearch(query) {
    resultsContainer.innerHTML = '<div class="loading">Searching subreddits...</div>';
    window.api.send('searchSubreddits', query);
  }
  
  // Receive search results
  window.api.receive('subredditResults', (data) => {
    if (data.error) {
      resultsContainer.innerHTML = `<div class="error">${data.error}</div>`;
      return;
    }
    
    currentResults = data;
    filterAndDisplayResults();
  });
  
  // Filter and display results
  function filterAndDisplayResults() {
    if (!currentResults || currentResults.length === 0) {
      return;
    }
    
    // Apply NSFW filter
    let filteredResults = currentResults;
    if (nsfwFilter.value === 'sfw') {
      filteredResults = currentResults.filter(sr => !sr.nsfw);
    }
    
    // Apply sorting
    const sortBy = sortFilter.value;
    filteredResults.sort((a, b) => {
      if (sortBy === 'subscribers') {
        return (b.subscribers || 0) - (a.subscribers || 0);
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default is relevance (as returned by API)
      return 0;
    });
    
    // Display results
    if (filteredResults.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No results match your filters</div>';
      return;
    }
    
    resultsContainer.innerHTML = filteredResults.map(sr => `
      <div class="subreddit-item" data-id="${sr.id}">
        <div class="subreddit-header">
          <div class="subreddit-name">
            r/${sr.name}
            ${sr.nsfw ? '<span class="nsfw-tag">NSFW</span>' : ''}
          </div>
          <div class="subreddit-stats">
            ${formatSubscribers(sr.subscribers)} subscribers
          </div>
        </div>
        <div class="subreddit-description">
          ${sr.description || 'No description available'}
        </div>
      </div>
    `).join('');
    
    // Add click handlers for subreddit selection
    document.querySelectorAll('.subreddit-item').forEach(item => {
      item.addEventListener('click', () => {
        const subredditId = item.getAttribute('data-id');
        const selectedSubreddit = filteredResults.find(sr => sr.id === subredditId);
        selectSubreddit(selectedSubreddit);
      });
    });
  }
  
  // Format subscriber numbers (e.g., 1.2k, 3.4M)
  function formatSubscribers(count) {
    if (!count) return '0';
    
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
  }
  
  // Handle subreddit selection
  function selectSubreddit(subreddit) {
    console.log('Selected subreddit:', subreddit);
    // Here you would implement the action to take when a subreddit is selected
    // For example, you could store it in local storage, or load posts from it
    window.api.send('toMain', { action: 'subredditSelected', subreddit });
    
    // Highlight the selected item
    document.querySelectorAll('.subreddit-item').forEach(item => {
      if (item.getAttribute('data-id') === subreddit.id) {
        item.style.backgroundColor = '#f0f7ff';
        item.style.borderLeft = '3px solid #0079d3';
      } else {
        item.style.backgroundColor = '';
        item.style.borderLeft = '';
      }
    });
  }
});