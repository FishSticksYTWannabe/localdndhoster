const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const path = require('path');
const { WebSocketServer } = require('ws');

let mainWindow = null;
let wss = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }
}

function sendToWindow(channel, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

function broadcastToClients(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

ipcMain.handle('host:start', async (_, port = 3000) => {
  if (wss) {
    return { success: false, error: 'Server is already running.' };
  }

  try {
    wss = new WebSocketServer({ port });

    wss.on('connection', (ws) => {
      sendToWindow('host:client-count', wss.clients.size);
      sendToWindow('host:status', `Client connected (${wss.clients.size} total)`);

      ws.on('message', (message) => {
        sendToWindow('host:client-message', message.toString());
      });

      ws.on('close', () => {
        sendToWindow('host:client-count', wss.clients.size);
        sendToWindow('host:status', `Client disconnected (${wss.clients.size} total)`);
      });
    });

    wss.on('listening', () => {
      sendToWindow('host:status', `Listening on ws://localhost:${port}`);
    });

    wss.on('error', (error) => {
      sendToWindow('host:status', `Server error: ${error.message}`);
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('host:stop', async () => {
  if (!wss) {
    return { success: false, error: 'Server is not running.' };
  }

  return new Promise((resolve) => {
    wss.close((err) => {
      wss = null;
      sendToWindow('host:status', 'Server stopped.');
      sendToWindow('host:client-count', 0);
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('host:broadcast', async (_, message) => {
  if (!wss) {
    return { success: false, error: 'Server is not running.' };
  }

  broadcastToClients({ type: 'server', message });
  return { success: true };
});

// Books persistence
ipcMain.handle('books:load', async () => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'books.json');
    if (!fs.existsSync(dataPath)) {
      return { success: true, books: [] };
    }
    const raw = fs.readFileSync(dataPath, 'utf8');
    const books = JSON.parse(raw || '[]');
    return { success: true, books };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('books:save', async (_, books) => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'books.json');
    fs.writeFileSync(dataPath, JSON.stringify(books, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// AI generation: tries a configured local HTTP endpoint, falls back to a simple local generator
ipcMain.handle('ai:generate', async (_, { prompt, endpoint }) => {
  try {
    if (endpoint) {
      // call external local model endpoint
      const url = endpoint;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const body = await res.text();
        // attempt JSON parse, else return as text
        try {
          return { success: true, result: JSON.parse(body) };
        } catch {
          return { success: true, result: body };
        }
      } catch (err) {
        // fall through to local generator
      }
    }

    // Simple deterministic local generator (fallback)
    const now = new Date().toISOString();
    const name = `Ability: ${prompt.split('\n')[0].slice(0, 30)}`;
    const ability = {
      name,
      description: `Generated on ${now}. Based on: ${prompt}`,
      effect: 'Deal 1d8 + 2 damage (example)',
      cooldown: '1 turn',
      tags: ['homebrew', 'mock-ai'],
    };
    return { success: true, result: ability };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// VTT persistence
ipcMain.handle('vtt:save', async (_, payload) => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'vtt.json');
    fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vtt:load', async () => {
  try {
    const dataPath = path.join(app.getPath('userData'), 'vtt.json');
    if (!fs.existsSync(dataPath)) return { success: true, data: null };
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw || 'null');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

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
