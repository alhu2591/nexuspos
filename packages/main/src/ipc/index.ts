// NexusPOS — IPC Handler Registration
// All renderer ↔ main communication flows through here
// Every handler validates input with Zod before processing

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import type { DatabaseManager } from '../database/DatabaseManager';
import type { HardwareManager } from '../hardware/HardwareManager';
import type { PrintManager } from '../printing/PrintManager';
import type { SyncEngine } from '../sync/SyncEngine';
import type { FiscalEventBus } from '../fiscal/FiscalEventBus';
import { SaleService } from './handlers/SaleService';
import { ProductService } from './handlers/ProductService';
import { CustomerService } from './handlers/CustomerService';
import { ShiftService } from './handlers/ShiftService';
import { ReportService } from './handlers/ReportService';
import { InventoryService } from './handlers/InventoryService';
import { AuthService } from './handlers/AuthService';
import { SettingsService } from './handlers/SettingsService';
import { AppLogger } from '../utils/AppLogger';
import { ErrorService } from '../utils/AppError';
import { app } from 'electron';

const logger = new AppLogger('IPC');

export interface ServiceDependencies {
  db: DatabaseManager;
  hardware: HardwareManager;
  print: PrintManager;
  sync: SyncEngine;
  fiscal: FiscalEventBus;
}

// ============================================================
// HANDLER WRAPPER
// Validates, logs, and handles errors for all IPC calls
// ============================================================
function createHandler(
  channel: string,
  handler: (event: IpcMainInvokeEvent, payload: any) => Promise<unknown>
) {
  return ipcMain.handle(channel, async (event: IpcMainInvokeEvent, payload: any) => {
    const start = Date.now();
    try {
      logger.debug(`IPC ${channel} called`);
      const result = await handler(event, payload);
      const duration = Date.now() - start;
      logger.debug(`IPC ${channel} completed in ${duration}ms`);
      return { success: true, data: result };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`IPC ${channel} failed after ${duration}ms`, error);

      // Log to error service
      ErrorService.capture(channel, error, {
        ipcChannel: channel,
        duration,
      });

      // Return structured error (never throw raw errors to renderer)
      const appError = ErrorService.normalize(error);
      return {
        success: false,
        error: {
          code: appError.code,
          message: appError.message,
          recoverable: appError.recoverable,
        },
      };
    }
  });
}

// ============================================================
// REGISTER ALL IPC HANDLERS
// ============================================================
export function setupIpcHandlers(deps: ServiceDependencies): void {
  const {
    db: dbManager,
    hardware: hardwareManager,
    print: printManager,
    sync: syncEngine,
    fiscal: fiscalBus,
  } = deps;

  // Initialize services
  const authService = new AuthService(dbManager as any);
  const saleService = new SaleService(dbManager, fiscalBus, printManager, syncEngine);
  const productService = new ProductService(dbManager);
  const customerService = new CustomerService(dbManager);
  const shiftService = new ShiftService(dbManager);
  const reportService = new ReportService(dbManager);
  const inventoryService = new InventoryService(dbManager);
  const settingsService = new SettingsService(dbManager);

  // ── AUTH ────────────────────────────────────────────────
  createHandler('auth:login', (_, payload) => authService.login(payload));
  createHandler('auth:login-pin', (_, payload) => authService.loginPin(payload));
  createHandler('auth:logout', (_, payload) => authService.logout(payload));
  createHandler('auth:session', (_, payload) => authService.getSession(payload));

  // ── SALES ────────────────────────────────────────────────
  createHandler('sale:create', (_, payload) => saleService.createSale(payload));
  createHandler('sale:complete', (_, payload) => saleService.completeSale(payload));
  createHandler('sale:void', (_, payload) => saleService.voidSale(payload));
  createHandler('sale:hold', (_, payload) => saleService.holdSale(payload));
  createHandler('sale:find', (_, payload) => saleService.findSale(payload));
  createHandler('sale:list', (_, payload) => saleService.listSales(payload));

  // ── PRODUCTS ─────────────────────────────────────────────
  createHandler('product:find', (_, payload) => productService.findProduct(payload));
  createHandler('product:search', (_, payload) => productService.searchProducts(payload));
  createHandler('product:barcode', (_, payload) => productService.findByBarcode(payload));
  createHandler('product:list', (_, payload) => productService.listProducts(payload));
  createHandler('product:create', (_, payload) => productService.createProduct(payload));
  createHandler('product:update', (_, payload) => productService.updateProduct(payload));
  createHandler('product:delete', (_, payload) => productService.deleteProduct(payload));

  // ── INVENTORY ────────────────────────────────────────────
  createHandler('inventory:get', (_, payload) => inventoryService.getInventory(payload));
  createHandler('inventory:adjust', (_, payload) => inventoryService.adjustInventory(payload));
  createHandler('inventory:movements', (_, payload) => inventoryService.getMovements(payload));

  // ── CUSTOMERS ────────────────────────────────────────────
  createHandler('customer:find', (_, payload) => customerService.findCustomer(payload));
  createHandler('customer:search', (_, payload) => customerService.searchCustomers(payload));
  createHandler('customer:create', (_, payload) => customerService.createCustomer(payload));
  createHandler('customer:update', (_, payload) => customerService.updateCustomer(payload));

  // ── PAYMENTS ─────────────────────────────────────────────
  createHandler('payment:process', (_, payload) => saleService.processPayment(payload));
  createHandler('payment:refund', (_, payload) => saleService.processRefund(payload));

  // ── SHIFTS ───────────────────────────────────────────────
  createHandler('shift:open', (_, payload) => shiftService.openShift(payload));
  createHandler('shift:close', (_, payload) => shiftService.closeShift(payload));
  createHandler('shift:current', (_, payload) => shiftService.getCurrentShift(payload));
  createHandler('shift:cash-in', (_, payload) => shiftService.cashIn(payload));
  createHandler('shift:cash-out', (_, payload) => shiftService.cashOut(payload));

  // ── REPORTS ──────────────────────────────────────────────
  createHandler('report:daily', (_, payload) => reportService.getDailyReport(payload));
  createHandler('report:shift', (_, payload) => reportService.getShiftReport(payload));
  createHandler('report:sales', (_, payload) => reportService.getSalesReport(payload));
  createHandler('report:products', (_, payload) => reportService.getProductsReport(payload));
  createHandler('report:customers', (_, payload) => reportService.getCustomersReport(payload));

  // ── HARDWARE ─────────────────────────────────────────────
  createHandler('printer:print', (_, payload) => printManager.printJob(payload));
  createHandler('printer:status', async (_, _p) => hardwareManager.getPrinterStatuses());
  createHandler('printer:test', (_, payload) => printManager.testPrint(payload));
  createHandler('hardware:status', async (_, _p) => hardwareManager.getAllStatuses());
  createHandler('drawer:open', (_, payload) => hardwareManager.openCashDrawer(payload));

  // ── SETTINGS ─────────────────────────────────────────────
  createHandler('settings:get', (_, payload) => settingsService.getSetting(payload));
  createHandler('settings:set', (_, payload) => settingsService.setSetting(payload));
  createHandler('settings:device', (_, payload) => settingsService.getDeviceConfig(payload));

  // ── SYSTEM ───────────────────────────────────────────────
  createHandler('app:version', async () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }));

  createHandler('app:restart', async () => {
    logger.info('Application restart requested via IPC');
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 500);
    return { restarting: true };
  });

  createHandler('db:backup', async () => dbManager.createBackup());

  createHandler('sync:status', async () => syncEngine.getStatus());
  createHandler('sync:trigger', async () => syncEngine.triggerSync());

  logger.info('All IPC handlers registered');
}
