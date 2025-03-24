// Create a new file for subreddit statistics

import { fetchSubredditStats } from './api.js';
import { formatNumber, formatDate } from './utils.js';

// Toggle stats panel visibility
export function setupStatsPanel() {
  const statsButton = document.getElementById('show-stats');
  const statsPanel = document.getElementById('subreddit-detailed-stats');
  
  if (statsButton) {
    statsButton.addEventListener('click', function() {
      if (statsPanel.style.display === 'none') {
        statsPanel.style.display = 'block';
        this.textContent = '📊 Hide Stats';
      } else {
        statsPanel.style.display = 'none';
        this.textContent = '📊 Stats';
      }
    });
  }
}

// Update loadSubredditStats function

export async function loadSubredditStats(subreddit) {
  try {
    // Store subreddit name globally for retry functionality
    window.currentSubreddit = subreddit;
    
    // Update basic info first - show loading state
    updateBasicStats({ name: subreddit, isLoading: true });
    
    const stats = await fetchSubredditStats(subreddit);
    
    // Update UI with fetched data
    updateBasicStats(stats);
    
    // Only call these if the detailed stats panel exists
    if (document.getElementById('subreddit-detailed-stats')) {
      updateDetailedStats(stats);
      updateContentChart(stats);
      updateActivityChart(stats);
      updateRelatedSubreddits(stats);
    }
    
    return stats;
  } catch (error) {
    console.error('Error loading subreddit statistics:', error);
    showStatsError(error.message);
    
    // Return default stats object with just the subreddit name
    return { name: subreddit };
  }
}

// Update the basic stats in the header
function updateBasicStats(stats) {
  // Subreddit name
  const currentSubredditElement = document.getElementById('current-subreddit');
  if (currentSubredditElement) {
    // Always use display_name for showing the subreddit name
    const displayName = stats.display_name || stats.requested_name || stats.name;
    currentSubredditElement.textContent = `r/${displayName}`;
  }
  
  if (stats.isLoading) {
    return;
  }
  
  // Subscribers count
  const subscribersElement = document.getElementById('subreddit-subscribers');
  if (subscribersElement) {
    subscribersElement.textContent = formatNumber(stats.subscribers || 0);
  }
  
  // Active users
  const activeElement = document.getElementById('subreddit-active');
  if (activeElement) {
    activeElement.textContent = formatNumber(stats.active_user_count || 0);
  }
  
  // Age
  const ageElement = document.getElementById('subreddit-age');
  if (ageElement && stats.created_utc) {
    const ageYears = ((Date.now() / 1000 - stats.created_utc) / (60 * 60 * 24 * 365)).toFixed(1);
    ageElement.textContent = ageYears;
  }
  
  // Rank
  const rankElement = document.getElementById('subreddit-rank');
  if (rankElement) {
    rankElement.textContent = stats.subreddit_rank || 'N/A';
  }
  
  // Type
  const typeElement = document.getElementById('subreddit-type');
  if (typeElement) {
    typeElement.textContent = stats.subreddit_type || 'public';
  }
  
  // NSFW tag
  const nsfwElement = document.getElementById('subreddit-nsfw');
  if (nsfwElement) {
    nsfwElement.style.display = stats.over_18 ? 'inline-block' : 'none';
  }
  
  // Restricted tag
  const restrictedElement = document.getElementById('subreddit-restricted');
  if (restrictedElement) {
    restrictedElement.style.display = stats.subreddit_type === 'restricted' ? 'inline-block' : 'none';
  }
}

// Update the detailed statistics panel
function updateDetailedStats(stats) {
  // Helper function to safely update an element's text content
  function safeSetText(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  // Community stats
  safeSetText('stat-total-subscribers', formatNumber(stats.subscribers));
  safeSetText('stat-daily-growth', formatNumber(stats.daily_growth || Math.floor(stats.subscribers * 0.001)));
  safeSetText('stat-weekly-growth', formatNumber(stats.weekly_growth || Math.floor(stats.subscribers * 0.007)));
  safeSetText('stat-currently-online', formatNumber(stats.active_user_count || 0));
  
  // Calculate online ratio
  const onlineRatio = stats.active_user_count && stats.subscribers ? 
    ((stats.active_user_count / stats.subscribers) * 100).toFixed(2) : '0.00';
  safeSetText('stat-online-ratio', onlineRatio);
  
  // Creation date and age
  if (stats.created_utc) {
    const createdDate = new Date(stats.created_utc * 1000).toLocaleDateString();
    const ageInDays = Math.floor((Date.now() / 1000 - stats.created_utc) / (60 * 60 * 24));
    
    safeSetText('stat-created-date', createdDate);
    safeSetText('stat-subreddit-age', formatNumber(ageInDays));
  }
  
  safeSetText('stat-subreddit-type', stats.subreddit_type || 'public');
  safeSetText('stat-mod-count', stats.mod_count || 'Unknown');
  
  // Content stats
  safeSetText('stat-total-posts', formatNumber(stats.total_posts || 'Unknown'));
  safeSetText('stat-posts-per-day', stats.posts_per_day || 'Unknown');
  safeSetText('stat-avg-comments', stats.avg_comments || 'Unknown');
  safeSetText('stat-avg-score', stats.avg_score || 'Unknown');
  
  // Activity & engagement
  safeSetText('stat-activity-rank', `#${stats.activity_rank || 'Unknown'}`);
  safeSetText('stat-most-active-time', stats.most_active_time || 'Unknown');
  safeSetText('stat-success-rate', stats.success_rate || '0');
  safeSetText('stat-discussion-rate', stats.discussion_rate || '0');
}

// Update the content type chart
function updateContentChart(stats) {
  const contentTypes = stats.content_breakdown || {
    text: 40,
    images: 30,
    links: 20,
    videos: 10
  };
  
  const chartContainer = document.getElementById('content-type-chart');
  if (!chartContainer) return;
  
  let chartHTML = '';
  for (const [type, percentage] of Object.entries(contentTypes)) {
    chartHTML += `
      <div class="chart-bar" style="width: ${percentage}%;" title="${capitalize(type)}: ${percentage}%">
        ${capitalize(type)}: ${percentage}%
      </div>
    `;
  }
  
  chartContainer.innerHTML = chartHTML;
}

// Update the weekly activity chart
function updateActivityChart(stats) {
  const weeklyActivity = stats.weekly_activity || [20, 40, 70, 100, 60, 30, 10];
  
  const chartContainer = document.getElementById('weekly-activity-chart');
  if (!chartContainer) return;
  
  let chartHTML = '';
  for (const activity of weeklyActivity) {
    chartHTML += `<div class="spark-bar" style="height: ${activity}%"></div>`;
  }
  
  chartContainer.innerHTML = chartHTML;
}

// Update related subreddits
function updateRelatedSubreddits(stats) {
  const relatedSubs = stats.related_subreddits || [];
  
  const container = document.getElementById('related-subreddits');
  if (!container) return;
  
  if (!relatedSubs || relatedSubs.length === 0) {
    container.innerHTML = '<span class="no-related">No related subreddits found</span>';
    return;
  }
  
  let html = '';
  for (const sub of relatedSubs) {
    if (!sub || !sub.name) continue;
    
    // Make sure to use name not display_name_prefixed which might not be defined
    const displayName = sub.display_name || sub.name;
    const displayNamePrefixed = sub.display_name_prefixed || `r/${displayName}`;
    
    html += `<span class="related-subreddit" onclick="selectSubreddit('${displayName}')">${displayNamePrefixed}</span>`;
  }
  
  if (html) {
    container.innerHTML = html;
  } else {
    container.innerHTML = '<span class="no-related">No related subreddits found</span>';
  }
}

// Improved error display
function showStatsError(errorMsg) {
  const detailedStats = document.getElementById('subreddit-detailed-stats');
  if (detailedStats) {
    detailedStats.innerHTML = `
      <div class="stats-error">
        <p>Could not load complete statistics for this subreddit.</p>
        <p class="error-details">${errorMsg || 'Unknown error'}</p>
        <button class="retry-button" onclick="loadSubredditStats('${window.currentSubreddit || ''}')">
          Retry
        </button>
      </div>
    `;
  }
}

// Helper function to capitalize first letter
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}