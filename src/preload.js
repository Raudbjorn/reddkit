const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Add methods that the renderer can call
  sendToMain: (channel, data) => {
    // Whitelist channels
    const validChannels = ['authenticate', 'load-data', 'toggle-theme'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['auth-response', 'data-response', 'theme-changed'];
    if (validChannels.includes(channel)) {
      // Remove the event listener to avoid memory leaks
      ipcRenderer.removeAllListeners(channel);
      // Add a new listener
      ipcRenderer.on(channel, (_, ...args) => func(...args));
    }
  }
});

// If needed, expose environment variables to the renderer
contextBridge.exposeInMainWorld('envVars', {
  isDev: process.env.NODE_ENV === 'development'
});