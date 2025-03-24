const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const net = require('net');

// Import modules
const { setupAuthRoutes } = require('./routes/auth-routes');
const { setupSubredditRoutes } = require('./routes/subreddit-routes');
const { setupPostRoutes } = require('./routes/post-routes');

const app = express();
let server = null;

// Function to find an available port
function findAvailablePort(startPort, callback) {
  const server = net.createServer();
  server.listen(startPort, '127.0.0.1', () => {
    const port = server.address().port;
    server.close(() => {
      callback(port);
    });
  });
  
  server.on('error', () => {
    findAvailablePort(startPort + 1, callback);
  });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// Setup routes
setupAuthRoutes(app);
setupSubredditRoutes(app);
setupPostRoutes(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Determine if it's an API request
  const isApiRequest = req.path.startsWith('/api/');
  
  if (isApiRequest) {
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  } else {
    return res.status(500).send(`
      <div class="error-container">
        <h2>Something went wrong</h2>
        <p>Please try again later or return to the homepage.</p>
        <a href="/">Back to Home</a>
      </div>
    `);
  }
});

// Server startup
function startServer(callback) {
  findAvailablePort(3000, (port) => {
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${port}`);
      callback(port);
    });
  });
  
  return {
    close: () => {
      if (server) {
        server.close();
      }
    }
  };
}

module.exports = { startServer };