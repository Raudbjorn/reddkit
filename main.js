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
