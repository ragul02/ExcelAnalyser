const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#eef2f7',
    icon: path.join(__dirname, 'src', 'assets', 'icon', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.removeMenu();

  // Open dev tools to see errors
  win.webContents.openDevTools();

  if (!app.isPackaged && process.argv.includes('--dev')) {
    win.loadURL('http://127.0.0.1:4200');
  } else {
    const htmlPath = path.join(__dirname, 'dist', 'DataAnalyzer', 'browser', 'index.html');
    console.log('Loading:', htmlPath);
    win.loadFile(htmlPath);
  }
  
  // Log errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Log console messages from renderer
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  // Handle external links - open in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed
  win.on('closed', () => {
    win = null;
  });
}

ipcMain.handle('project:choose-open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Data Visualization Project', extensions: ['dvis', 'json'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
