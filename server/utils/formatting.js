/**
 * Utility functions for formatting data
 */

// Format subscriber count with abbreviations
function formatSubscribers(count) {
  if (!count) return '0';
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
}

// Format number with abbreviations
function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString();
}

// Format date to readable string
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

module.exports = {
  formatSubscribers,
  formatNumber,
  formatDate,
  truncateText
};