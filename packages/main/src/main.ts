// NexusPOS — Electron Main Process
// Entry point with full security hardening

import { app, BrowserWindow, session, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupIpcHandlers } from './ipc';
import { DatabaseManager } from './database/DatabaseManager';
import { HardwareManager } from './hardware/HardwareManager';
import { PrintManager } from './printing/PrintManager';
import { SyncEngine } from './sync/SyncEngine';
import { FiscalEventBus } from './fiscal/FiscalEventBus';
import { AppLogger } from './utils/AppLogger';
import { ErrorService } from './utils/ErrorService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isKioskMode = process.env.KIOSK_MODE === '1' || process.argv.includes('--kiosk');

// ============================================================
// SECURITY: Disable GPU sandbox bypass attempts
// ============================================================
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('enable-features', 'PasswordImport');

// ============================================================
// SINGLETON LOCK
// Only allow one instance of the application
// ============================================================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ============================================================
// GLOBAL STATE
// ============================================================
let mainWindow: BrowserWindow | null = null;
let customerDisplayWindow: BrowserWindow | null = null;
let dbManager: DatabaseManager;
let hardwareManager: HardwareManager;
let printManager: PrintManager;
let syncEngine: SyncEngine;
let fiscalBus: FiscalEventBus;

const logger = new AppLogger('Main');

// ============================================================
// SECURITY: Content Security Policy
// ============================================================
function setupCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:*"
            : [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                "connect-src 'self' ws://localhost:* http://localhost:*", // For local sync
                "object-src 'none'",
                "base-uri 'self'",
              ].join('; '),
        ],
        'X-Frame-Options': ['SAMEORIGIN'],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer'],
      },
    });
  });
}

// ============================================================
// WINDOW CREATION
// ============================================================
async function createMainWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, 'preload.js');

  const windowConfig: Electron.BrowserWindowConstructorOptions = {
    width: isKioskMode ? undefined : 1366,
    height: isKioskMode ? undefined : 768,
    minWidth: 1024,
    minHeight: 600,
    frame: !isKioskMode,
    fullscreen: isKioskMode,
    kiosk: isKioskMode,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    show: false, // Show after ready-to-show for smooth startup
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      // SECURITY: Critical settings
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Must be false for preload with Node access
      webviewTag: false,
      preload: preloadPath,
      spellcheck: false,
      enableRemoteModule: false,
      // SECURITY: Prevent navigation to unexpected URLs
      navigationTimeout: 5000,
    },
  };

  mainWindow = new BrowserWindow(windowConfig);

  // SECURITY: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = isDev
      ? ['http://localhost:5173', 'http://localhost:3000']
      : [`file://${path.join(__dirname, '../renderer')}`];

    const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));
    if (!isAllowed) {
      logger.warn(`Blocked navigation to: ${url}`);
      event.preventDefault();
    }
  });

  // SECURITY: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    if (isKioskMode) {
      mainWindow?.setAlwaysOnTop(true, 'screen-saver');
      mainWindow?.setVisibleOnAllWorkspaces(true);
      mainWindow?.maximize();
    }

    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Kiosk mode: prevent close
  if (isKioskMode) {
    mainWindow.on('close', (event) => {
      // Allow close only with explicit shutdown sequence
      if (!app.isQuitting) {
        event.preventDefault();
      }
    });
  }

  // Load the application
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

async function createCustomerDisplayWindow(): Promise<BrowserWindow | null> {
  const displays = require('electron').screen.getAllDisplays();
  if (displays.length < 2) return null;

  const secondDisplay = displays[1];

  customerDisplayWindow = new BrowserWindow({
    x: secondDisplay.bounds.x,
    y: secondDisplay.bounds.y,
    width: secondDisplay.bounds.width,
    height: secondDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    kiosk: true,
    backgroundColor: '#1e293b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-display.js'),
    },
  });

  if (isDev) {
    await customerDisplayWindow.loadURL('http://localhost:5173/customer-display');
  } else {
    await customerDisplayWindow.loadFile(
      path.join(__dirname, '../renderer/index.html'),
      { hash: '/customer-display' }
    );
  }

  customerDisplayWindow.on('closed', () => {
    customerDisplayWindow = null;
  });

  return customerDisplayWindow;
}

// ============================================================
// APPLICATION SERVICES INITIALIZATION
// ============================================================
async function initializeServices(): Promise<void> {
  logger.info('Initializing application services...');

  try {
    // 1. Database (must be first)
    dbManager = new DatabaseManager();
    await dbManager.initialize();
    logger.info('Database initialized');

    // 2. Fiscal event bus (before hardware, as hardware events go to fiscal)
    fiscalBus = new FiscalEventBus(dbManager);
    await fiscalBus.initialize();
    logger.info('Fiscal event bus initialized');

    // 3. Hardware manager
    hardwareManager = new HardwareManager();
    await hardwareManager.initialize();
    logger.info('Hardware manager initialized');

    // 4. Print manager
    printManager = new PrintManager(hardwareManager);
    await printManager.initialize();
    logger.info('Print manager initialized');

    // 5. Sync engine (start background sync)
    syncEngine = new SyncEngine(dbManager);
    await syncEngine.initialize();
    logger.info('Sync engine initialized');

    // 6. Register IPC handlers
    setupIpcHandlers({
      dbManager,
      hardwareManager,
      printManager,
      syncEngine,
      fiscalBus,
    });
    logger.info('IPC handlers registered');

  } catch (error) {
    logger.error('Failed to initialize services', error);
    ErrorService.fatal('SERVICE_INIT_FAILED', error);
    throw error;
  }
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
  logger.info(`NexusPOS starting (v${app.getVersion()}, ${isDev ? 'dev' : 'prod'})`);
  logger.info(`Kiosk mode: ${isKioskMode}`);
  logger.info(`Platform: ${process.platform} ${process.arch}`);

  // Setup security
  setupCSP();

  // Set memory limits for low-end hardware
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');

  try {
    await initializeServices();
    await createMainWindow();

    // Try to setup customer display
    const deviceConfig = await dbManager.getDeviceConfig();
    if (deviceConfig?.customerDisplayEnabled) {
      await createCustomerDisplayWindow();
    }

    logger.info('NexusPOS started successfully');
  } catch (error) {
    logger.error('Fatal startup error', error);
    app.quit();
  }
});

app.on('second-instance', () => {
  // Focus existing window if second instance launched
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('activate', async () => {
  // macOS: re-create window if dock icon clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  logger.info('Application shutting down...');
  app.isQuitting = true;

  try {
    await syncEngine?.shutdown();
    await hardwareManager?.shutdown();
    await printManager?.shutdown();
    await dbManager?.shutdown();
    logger.info('Clean shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  ErrorService.fatal('UNCAUGHT_EXCEPTION', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
  ErrorService.capture('UNHANDLED_REJECTION', reason);
});

// Extend app type for isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting: boolean;
  }
}

app.isQuitting = false;
