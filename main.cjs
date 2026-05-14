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
       const serverModule = require(path.join(__dirname, 'dist', 'server.cjs'));
       
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

       if (serverModule && typeof serverModule.startServer === 'function') {
           // Pass 0 so the OS automatically assigns a free port. This prevents any EADDRINUSE errors.
           serverModule.startServer(0).then((assignedPort) => {
               console.log('Started local server on port ' + assignedPort);
               setTimeout(() => loadWithRetry(`http://localhost:${assignedPort}`), 200);
           }).catch((err) => {
               console.error("Failed to start server dynamically", err);
               // Even on failure, might have loaded on default port if some error occurred during fallback
               setTimeout(() => loadWithRetry('http://localhost:3000'), 500);
           });
       } else {
           console.log('Started local server from dist/server.cjs (legacy mode)');
           setTimeout(() => loadWithRetry('http://localhost:3000'), 500);
       }
    } catch (e) {
       console.error("Could not start server.cjs", e);
    }
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
