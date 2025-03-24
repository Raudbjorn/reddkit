const dotenv = require('dotenv');
dotenv.config();

// Pass the app instance to the server module
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { startServer } = require('./server');

// Create a global reference to the app object for auth store
global.electronApp = app;

let mainWindow;
let serverInstance;

// Add this before creating the BrowserWindow

// Configure Electron for Linux environments
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
  app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  
  // Fix for X11 rendering issues
  app.disableHardwareAcceleration();
}

async function createWindow(port) {
  // Get stored window dimensions
  let windowConfig = {
    width: 1200,
    height: 800
  };
  
  try {
    const storedBounds = app.getPath('userData') ? 
      require('electron').safeStorage.isEncryptionAvailable() ?
      app.getStoredValue('windowBounds') :
      JSON.parse(app.getPath('userData') + '/window-config.json') || {} : {};
      
    if (storedBounds.width && storedBounds.height) {
      windowConfig = storedBounds;
    }
  } catch (err) {
    console.log('No stored window configuration found');
  }
  
  // Create the browser window with stored or default dimensions
  mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    x: windowConfig.x,
    y: windowConfig.y,
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

  // Load the app
  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Open DevTools during development (optional)
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }
  mainWindow.webContents.openDevTools();
  // Save window size and position when changed
  mainWindow.on('resize', saveWindowConfig);
  mainWindow.on('move', saveWindowConfig);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Ensure window is visible on screen
  ensureWindowVisible();
}

// Save window configuration
function saveWindowConfig() {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  
  try {
    if (require('electron').safeStorage.isEncryptionAvailable()) {
      app.setStoreValue('windowBounds', bounds);
    } else {
      const fs = require('fs');
      fs.writeFileSync(
        app.getPath('userData') + '/window-config.json',
        JSON.stringify(bounds)
      );
    }
  } catch (err) {
    console.error('Failed to save window configuration', err);
  }
}

// Ensure window is visible on screen
function ensureWindowVisible() {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  const displays = screen.getAllDisplays();
  let isVisible = false;
  
  for (const display of displays) {
    const { x, y, width, height } = display.bounds;
    if (
      bounds.x >= x && bounds.y >= y &&
      bounds.x + bounds.width <= x + width &&
      bounds.y + bounds.height <= y + height
    ) {
      isVisible = true;
      break;
    }
  }
  
  if (!isVisible) {
    // Reset to default size on primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    mainWindow.setBounds({
      x: primaryDisplay.bounds.x + 100,
      y: primaryDisplay.bounds.y + 100,
      width: 1200,
      height: 800
    });
  }
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
