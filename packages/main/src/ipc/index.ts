// NexusPOS — IPC Handler Registration
// All renderer ↔ main communication flows through here
// Every handler validates input with Zod before processing

import { ipcMain, IpcMainInvokeEvent, app } from 'electron';
import type { DatabaseManager } from '../database/DatabaseManager';
import type { HardwareManager } from '../hardware/HardwareManager';
import type { PrintManager } from '../printing/PrintManager';
import type { SyncEngine } from '../sync/SyncEngine';
import type { FiscalEventBus } from '../fiscal/FiscalEventBus';
import { AuthService }      from './handlers/AuthService';
import { SaleService }      from './handlers/SaleService';
import { ProductService }   from './handlers/ProductService';
import { CustomerService }  from './handlers/CustomerService';
import { ShiftService }     from './handlers/ShiftService';
import { ReportService }    from './handlers/ReportService';
import { InventoryService } from './handlers/InventoryService';
import { SettingsService }  from './handlers/SettingsService';
import { AppLogger } from '../utils/AppLogger';
import { ErrorService } from '../utils/AppError';

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

      ErrorService.capture(channel, error, { ipcChannel: channel, duration });

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

  const authService      = new AuthService(dbManager);
  const saleService      = new SaleService(dbManager, fiscalBus, printManager, syncEngine);
  const productService   = new ProductService(dbManager);
  const customerService  = new CustomerService(dbManager);
  const shiftService     = new ShiftService(dbManager);
  const reportService    = new ReportService(dbManager);
  const inventoryService = new InventoryService(dbManager);
  const settingsService  = new SettingsService(dbManager);

  // ── AUTH ────────────────────────────────────────────────
  createHandler('auth:login',     (_, p) => authService.login(p));
  createHandler('auth:login-pin', (_, p) => authService.loginPin(p));
  createHandler('auth:logout',    (_, p) => authService.logout(p));
  createHandler('auth:session',   (_, p) => authService.getSession(p));

  // ── SALES ────────────────────────────────────────────────
  createHandler('sale:create',   (_, p) => saleService.createSale(p));
  createHandler('sale:complete', (_, p) => saleService.completeSale(p));
  createHandler('sale:void',     (_, p) => saleService.voidSale(p));
  createHandler('sale:hold',     (_, p) => saleService.holdSale(p));
  createHandler('sale:find',     (_, p) => saleService.findSale(p));
  createHandler('sale:list',     (_, p) => saleService.listSales(p));

  // ── PRODUCTS ─────────────────────────────────────────────
  createHandler('product:find',   (_, p) => productService.findProduct(p));
  createHandler('product:search', (_, p) => productService.searchProducts(p));
  createHandler('product:barcode',(_, p) => productService.findByBarcode(p));
  createHandler('product:list',   (_, p) => productService.listProducts(p));
  createHandler('product:create', (_, p) => productService.createProduct(p));
  createHandler('product:update', (_, p) => productService.updateProduct(p));
  createHandler('product:delete', (_, p) => productService.deleteProduct(p));

  // ── INVENTORY ────────────────────────────────────────────
  createHandler('inventory:get',       (_, p) => inventoryService.getInventory(p));
  createHandler('inventory:adjust',    (_, p) => inventoryService.adjustInventory(p));
  createHandler('inventory:movements', (_, p) => inventoryService.getMovements(p));

  // ── CUSTOMERS ────────────────────────────────────────────
  createHandler('customer:find',   (_, p) => customerService.findCustomer(p));
  createHandler('customer:search', (_, p) => customerService.searchCustomers(p));
  createHandler('customer:create', (_, p) => customerService.createCustomer(p));
  createHandler('customer:update', (_, p) => customerService.updateCustomer(p));

  // ── PAYMENTS ─────────────────────────────────────────────
  createHandler('payment:process', (_, p) => saleService.processPayment(p));
  createHandler('payment:refund',  (_, p) => saleService.processRefund(p));

  // ── SHIFTS ───────────────────────────────────────────────
  createHandler('shift:open',    (_, p) => shiftService.openShift(p));
  createHandler('shift:close',   (_, p) => shiftService.closeShift(p));
  createHandler('shift:current', (_, p) => shiftService.getCurrentShift(p));
  createHandler('shift:cash-in', (_, p) => shiftService.cashIn(p));
  createHandler('shift:cash-out',(_, p) => shiftService.cashOut(p));

  // ── REPORTS ──────────────────────────────────────────────
  createHandler('report:daily',     (_, p) => reportService.getDailyReport(p));
  createHandler('report:shift',     (_, p) => reportService.getShiftReport(p));
  createHandler('report:sales',     (_, p) => reportService.getSalesReport(p));
  createHandler('report:products',  (_, p) => reportService.getProductsReport(p));
  createHandler('report:customers', (_, p) => reportService.getCustomersReport(p));

  // ── HARDWARE ─────────────────────────────────────────────
  createHandler('printer:print',  (_, p) => printManager.printJob(p));
  createHandler('printer:status', async () => hardwareManager.getPrinterStatuses());
  createHandler('printer:test',   (_, p) => printManager.testPrint(p));
  createHandler('hardware:status',async () => hardwareManager.getAllStatuses());
  createHandler('drawer:open',    (_, p) => hardwareManager.openCashDrawer(p));

  // ── SETTINGS ─────────────────────────────────────────────
  createHandler('settings:get',    (_, p) => settingsService.getSetting(p));
  createHandler('settings:set',    (_, p) => settingsService.setSetting(p));
  createHandler('settings:device', (_, p) => settingsService.getDeviceConfig(p));

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
    setTimeout(() => { app.relaunch(); app.quit(); }, 500);
    return { restarting: true };
  });

  createHandler('db:backup',     async () => dbManager.createBackup());
  createHandler('sync:status',   async () => syncEngine.getStatus());
  createHandler('sync:trigger',  async () => syncEngine.triggerSync());

  logger.info('All IPC handlers registered');
}
