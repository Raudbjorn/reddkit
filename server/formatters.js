// Format subscriber counts
function formatSubscribers(count) {
  if (!count) return '0';
  
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
}

// Format numbers with commas
function formatNumber(num) {
  return num ? num.toLocaleString() : '0';
}

// Format dates
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

// Format dates with time
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Format post scores
function formatPostScore(score) {
  if (score >= 10000) {
    return (score / 1000).toFixed(1) + 'k';
  }
  return score.toString();
}

// Format relative time
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

// Truncate text to a specified length
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

module.exports = {
  formatSubscribers,
  formatNumber,
  formatDate,
  formatDateTime,
  formatPostScore,
  formatTimeAgo,
  truncateText
};