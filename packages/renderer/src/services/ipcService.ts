// NexusPOS — IPC Service (Renderer)
// Typed wrapper around window.nexuspos.invoke
// All IPC calls go through this service

import type { IPCChannel } from '@nexuspos/shared';

// ============================================================
// IPC RESPONSE TYPE
// Main process always returns { success, data } | { success, error }
// ============================================================

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================
// IPC SERVICE
// ============================================================

class IPCService {
  /**
   * Invoke an IPC channel and return typed response.
   * Throws if the main process returns an error.
   */
  async invoke<T>(channel: IPCChannel, payload?: unknown): Promise<IPCResponse<T>> {
    if (!window.nexuspos) {
      // In browser dev mode without Electron, use mock
      return this.mockInvoke<T>(channel, payload);
    }

    const response = await window.nexuspos.invoke(channel, payload) as IPCResponse<T>;
    return response;
  }

  /**
   * Subscribe to events from main process.
   */
  on(event: string, handler: (...args: unknown[]) => void): () => void {
    if (!window.nexuspos) return () => {};
    return window.nexuspos.on(event, handler);
  }

  /**
   * Check if running in Electron
   */
  isElectron(): boolean {
    return !!window.nexuspos;
  }

  /**
   * Mock implementation for browser development
   */
  private async mockInvoke<T>(channel: IPCChannel, _payload: unknown): Promise<IPCResponse<T>> {
    console.debug(`[IPC Mock] ${channel}`, _payload);
    return { success: true, data: undefined as unknown as T };
  }
}

export const ipcService = new IPCService();

// ============================================================
// TYPED DOMAIN SERVICE WRAPPERS
// ============================================================

export const authAPI = {
  login: (username: string, password: string, deviceId: string) =>
    ipcService.invoke('auth:login', { username, password, deviceId }),

  loginPin: (pin: string, deviceId: string) =>
    ipcService.invoke('auth:login-pin', { pin, deviceId }),

  logout: (token: string) =>
    ipcService.invoke('auth:logout', { token }),

  getSession: () =>
    ipcService.invoke('auth:session', {}),
};

export const productAPI = {
  search: (query: string, storeId: string, categoryId?: string, limit = 20) =>
    ipcService.invoke('product:search', { query, storeId, categoryId, limit }),

  findByBarcode: (barcode: string, storeId: string) =>
    ipcService.invoke('product:barcode', { barcode, storeId }),

  find: (productId: string) =>
    ipcService.invoke('product:find', { productId }),

  list: (storeId: string, categoryId?: string, page = 1, pageSize = 50) =>
    ipcService.invoke('product:list', { storeId, categoryId, page, pageSize }),

  create: (data: unknown) =>
    ipcService.invoke('product:create', data),

  update: (data: unknown) =>
    ipcService.invoke('product:update', data),

  delete: (productId: string) =>
    ipcService.invoke('product:delete', { productId }),
};

export const saleAPI = {
  create: (data: unknown) =>
    ipcService.invoke('sale:create', data),

  void: (saleId: string, reason: string, userId: string) =>
    ipcService.invoke('sale:void', { saleId, reason, userId }),

  find: (saleId: string) =>
    ipcService.invoke('sale:find', { saleId }),

  list: (params: unknown) =>
    ipcService.invoke('sale:list', params),
};

export const customerAPI = {
  search: (query: string, storeId: string) =>
    ipcService.invoke('customer:search', { query, storeId }),

  find: (customerId: string) =>
    ipcService.invoke('customer:find', { customerId }),

  create: (data: unknown) =>
    ipcService.invoke('customer:create', data),

  update: (data: unknown) =>
    ipcService.invoke('customer:update', data),
};

export const shiftAPI = {
  open: (data: unknown) =>
    ipcService.invoke('shift:open', data),

  close: (data: unknown) =>
    ipcService.invoke('shift:close', data),

  getCurrent: (deviceId: string) =>
    ipcService.invoke('shift:current', { deviceId }),

  cashIn: (data: unknown) =>
    ipcService.invoke('shift:cash-in', data),

  cashOut: (data: unknown) =>
    ipcService.invoke('shift:cash-out', data),
};

export const reportAPI = {
  daily: (params: unknown) =>
    ipcService.invoke('report:daily', params),

  shift: (shiftId: string) =>
    ipcService.invoke('report:shift', { shiftId }),

  sales: (params: unknown) =>
    ipcService.invoke('report:sales', params),

  products: (params: unknown) =>
    ipcService.invoke('report:products', params),
};

export const hardwareAPI = {
  getStatus: () =>
    ipcService.invoke('hardware:status', {}),

  openDrawer: () =>
    ipcService.invoke('drawer:open', {}),

  printReceipt: (saleId: string, printerId: string) =>
    ipcService.invoke('printer:print', { saleId, printerId, type: 'receipt' }),

  testPrint: (printerId: string) =>
    ipcService.invoke('printer:test', { printerId }),
};

export const settingsAPI = {
  get: (key: string, storeId: string) =>
    ipcService.invoke('settings:get', { key, storeId }),

  set: (key: string, value: string, storeId: string, dataType = 'string') =>
    ipcService.invoke('settings:set', { key, value, storeId, dataType }),

  getAll: (storeId: string) =>
    ipcService.invoke('settings:getAll', { storeId }),

  getDevice: (deviceId: string) =>
    ipcService.invoke('settings:device', { deviceId }),
};

export const inventoryAPI = {
  get: (productId?: string, lowStockOnly = false) =>
    ipcService.invoke('inventory:get', { productId, lowStockOnly }),

  adjust: (data: unknown) =>
    ipcService.invoke('inventory:adjust', data),

  movements: (productId: string, limit = 50) =>
    ipcService.invoke('inventory:movements', { productId, limit }),
};

export const paymentAPI = {
  refund: (data: unknown) =>
    ipcService.invoke('payment:refund', data),
};

export const systemAPI = {
  version: () =>
    ipcService.invoke('app:version', {}),

  device: () =>
    ipcService.invoke('app:device', {}),

  restart: () =>
    ipcService.invoke('app:restart', {}),

  backup: () =>
    ipcService.invoke('db:backup', {}),

  syncStatus: () =>
    ipcService.invoke('sync:status', {}),

  triggerSync: () =>
    ipcService.invoke('sync:trigger', {}),
};
