// NexusPOS — Electron Main Process
// Entry point with full security hardening

import { app, BrowserWindow, session, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import { setupIpcHandlers } from './ipc';
import { DatabaseManager } from './database/DatabaseManager';
import { HardwareManager } from './hardware/HardwareManager';
import { PrintManager } from './printing/PrintManager';
import { SyncEngine } from './sync/SyncEngine';
import { FiscalEventBus } from './fiscal/FiscalEventBus';
import { AppLogger } from './utils/AppLogger';
import { ErrorService } from './utils/AppError';

// In CommonJS, __dirname is already available globally
const isDev = process.env.NODE_ENV === 'development';
const isKioskMode = process.env.KIOSK_MODE === '1' || process.argv.includes('--kiosk');

// Use module-level variable instead of extending app type
let isQuitting = false;

const logger = new AppLogger('Main');

// ============================================================
// SINGLETON LOCK
// ============================================================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logger.error('Another instance is already running. Exiting.');
  app.quit();
}

// ============================================================
// SERVICES (initialized after app ready)
// ============================================================
let dbManager: DatabaseManager;
let hardwareManager: HardwareManager;
let printManager: PrintManager;
let syncEngine: SyncEngine;
let fiscalBus: FiscalEventBus;
let mainWindow: BrowserWindow | null = null;

// ============================================================
// WINDOW CREATION
// ============================================================
async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: isKioskMode ? undefined : 1280,
    height: isKioskMode ? undefined : 800,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: isKioskMode,
    kiosk: isKioskMode,
    frame: !isKioskMode,
    titleBarStyle: isKioskMode ? 'hidden' : 'default',
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:;",
        ],
      },
    });
  });

  // Load app
  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
    if (isKioskMode) win.setFullScreen(true);
    logger.info('Main window ready');
  });

  win.on('close', (e) => {
    if (!isQuitting && isKioskMode) {
      e.preventDefault();
      logger.warn('Close blocked in kiosk mode');
    }
  });

  return win;
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
  logger.info('App starting...', { isDev, isKioskMode });

  try {
    // 1. Database
    dbManager = new DatabaseManager();
    await dbManager.initialize();
    logger.info('Database ready');

    // 2. Fiscal
    fiscalBus = new FiscalEventBus(dbManager);
    await fiscalBus.initialize();          // ← required: sets isConfigured = true
    logger.info('Fiscal bus ready');

    // 3. Hardware
    hardwareManager = new HardwareManager();
    await hardwareManager.initialize();
    logger.info('Hardware ready');

    // 4. Printing
    printManager = new PrintManager(hardwareManager);
    await printManager.initialize();
    logger.info('Print manager ready');

    // 5. Sync
    syncEngine = new SyncEngine(dbManager);
    await syncEngine.initialize();
    logger.info('Sync engine ready');

    // 6. IPC Handlers
    setupIpcHandlers({
      db: dbManager,
      hardware: hardwareManager,
      print: printManager,
      sync: syncEngine,
      fiscal: fiscalBus,
    });
    logger.info('IPC handlers registered');

    // 7. Window
    mainWindow = await createMainWindow();
    logger.info('App ready ✓');

  } catch (err) {
    ErrorService.fatal('STARTUP_FAILED', err);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  logger.info('Shutting down...');
  syncEngine?.shutdown();
  hardwareManager?.shutdown();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Dark mode IPC
ipcMain.handle('system:theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('system:theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});
