const dotenv = require('dotenv');
dotenv.config();

// Pass the app instance to the server module
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer } = require('./server');

// Create a global reference to the app object for auth store
global.electronApp = app;

let mainWindow;
let serverInstance;

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "redDKit",
    icon: path.join(__dirname, 'client/public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'src/preload.js')
    }
  });

  //Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
          "connect-src 'self' http://127.0.0.1:3000 https://www.reddit.com https://oauth.reddit.com https://api.reddit.com; " +
          "img-src 'self' https: data:; " +
          "style-src 'self' 'unsafe-inline';"
        ]
      }
    });
  });
  // Load the Express app URL with the dynamically assigned port
  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Open DevTools during development (optional)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }


  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start the server first, then create the window
  serverInstance = startServer((port) => {
    createWindow(port);
  });
});

app.on('window-all-closed', () => {
  // Close the server when the app is closed
  if (serverInstance) {
    serverInstance.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // If we're activating again, restart the server to get a new port
    serverInstance = startServer((port) => {
      createWindow(port);
    });
  }
});
