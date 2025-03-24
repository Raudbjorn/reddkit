const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const net = require('net');
const fs = require('fs');

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

// Set strict MIME types for JavaScript and CSS files
app.use((req, res, next) => {
  const url = req.url.toLowerCase();
  if (url.endsWith('.js')) {
    res.type('application/javascript');
  } else if (url.endsWith('.css')) {
    res.type('text/css');
  }
  next();
});

// Handle CORS
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Dedicated routes for critical files with explicit MIME types
app.get('/htmx.min.js', (req, res) => {
  const htmxPath = path.join(__dirname, '../client/public/htmx.min.js');
  
  // Check if file exists first
  if (fs.existsSync(htmxPath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(htmxPath);
  } else {
    console.error('htmx.min.js not found at:', htmxPath);
    res.status(404).send('File not found');
  }
});

// Regular static file serving
app.use(express.static(path.join(__dirname, '../client/public'), {
  setHeaders: function(res, path) {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

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
  // Add more detailed logging
  console.log('Starting server with Node version:', process.version);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // Check for critical files before starting
  const criticalFiles = [
    path.join(__dirname, '../client/public/htmx.min.js'),
    path.join(__dirname, '../client/public/index.html'),
    path.join(__dirname, '../client/public/styles.css'),
    path.join(__dirname, 'utils/formatting.js')  // Check if this file exists
  ];
  
  for (const file of criticalFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`WARNING: Critical file not found: ${file}`);
    } else {
      console.log(`Found file: ${file}`);
    }
  }

  findAvailablePort(3000, (port) => {
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${port}`);
      console.log(`Static files served from: ${path.join(__dirname, '../client/public')}`);
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