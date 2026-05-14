const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Necessary for unrestricted fetch to AI APIs
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (!isDev) {
    process.env.NODE_ENV = 'production';
  }

  if (isDev) {
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools();
  } else {
    // Start the express server from dist/server.cjs
    try {
       require(path.join(__dirname, 'dist', 'server.cjs'));
       console.log('Started local server from dist/server.cjs');
    } catch (e) {
       console.error("Could not start server.cjs", e);
    }
    
    // Check if index.html exists but load from local server to allow API routes to work
    // Add retry logic because the server may take a few ms to start listening 
    const loadWithRetry = (url, retries = 5) => {
       win.loadURL(url).catch((err) => {
          if (retries > 0) {
             console.log(`Failed to load ${url}, retrying in 500ms...`);
             setTimeout(() => loadWithRetry(url, retries - 1), 500);
          } else {
             console.error("Failed to load local server:", err);
          }
       });
    };
    
    setTimeout(() => loadWithRetry('http://localhost:3000'), 500);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
