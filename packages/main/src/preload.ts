// NexusPOS — Preload Script
// SECURITY: This runs in isolated context with Node.js access
// It exposes ONLY validated, typed API to the renderer
// No direct Node.js access is exposed to renderer

import { contextBridge, ipcRenderer } from 'electron';
import type { IPCChannel } from '../../shared/src/types';

// ============================================================
// SECURITY: Whitelist of allowed IPC channels
// Any channel NOT in this list will be blocked
// ============================================================
const ALLOWED_CHANNELS: Set<IPCChannel> = new Set([
  // Auth
  'auth:login',
  'auth:login-pin',
  'auth:logout',
  'auth:session',
  // Sales
  'sale:create',
  'sale:complete',
  'sale:void',
  'sale:hold',
  'sale:find',
  'sale:list',
  // Products
  'product:find',
  'product:search',
  'product:barcode',
  'product:list',
  'product:create',
  'product:update',
  'product:delete',
  // Inventory
  'inventory:get',
  'inventory:adjust',
  'inventory:movements',
  // Customers
  'customer:find',
  'customer:search',
  'customer:create',
  'customer:update',
  // Payments
  'payment:process',
  'payment:refund',
  // Shifts
  'shift:open',
  'shift:close',
  'shift:current',
  'shift:cash-in',
  'shift:cash-out',
  // Reports
  'report:daily',
  'report:shift',
  'report:sales',
  'report:products',
  'report:customers',
  // Hardware
  'printer:print',
  'printer:status',
  'printer:test',
  'hardware:status',
  'drawer:open',
  // Settings
  'settings:get',
  'settings:set',
  'settings:device',
  // System
  'app:version',
  'app:restart',
  'db:backup',
  'sync:status',
  'sync:trigger',
]);

// ============================================================
// ALLOWED EVENT CHANNELS (renderer listens to these from main)
// ============================================================
const ALLOWED_EVENTS = new Set([
  'hardware:status-changed',
  'sync:progress',
  'sync:completed',
  'sync:error',
  'barcode:scanned',
  'scale:weight-updated',
  'payment:terminal-status',
  'app:update-available',
  'shift:force-close',
  'display:cart-updated',
]);

// ============================================================
// SANITIZE: Remove functions/symbols that shouldn't cross IPC
// ============================================================
function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }
  if (typeof payload === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      // Skip functions, symbols, and prototype pollution attempts
      if (typeof value === 'function' || typeof value === 'symbol') continue;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = sanitizePayload(value);
    }
    return sanitized;
  }
  return undefined; // Drop unknown types
}

// ============================================================
// API BRIDGE
// ============================================================
const api = {
  /**
   * Send an IPC message and await response.
   * Channel is validated against whitelist.
   */
  invoke: async (channel: IPCChannel, payload?: unknown): Promise<unknown> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    const sanitized = sanitizePayload(payload);
    return ipcRenderer.invoke(channel, sanitized);
  },

  /**
   * Subscribe to events from main process.
   * Returns cleanup function.
   */
  on: (event: string, handler: (...args: unknown[]) => void): (() => void) => {
    if (!ALLOWED_EVENTS.has(event)) {
      console.warn(`[Preload] Event channel not in whitelist: ${event}`);
      return () => {};
    }

    const wrappedHandler = (_: Electron.IpcRendererEvent, ...args: unknown[]) => {
      handler(...args);
    };

    ipcRenderer.on(event, wrappedHandler);

    return () => {
      ipcRenderer.removeListener(event, wrappedHandler);
    };
  },

  /**
   * Send one-way message to main process.
   */
  send: (channel: IPCChannel, payload?: unknown): void => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`[Preload] Blocked send on channel: ${channel}`);
      return;
    }
    ipcRenderer.send(channel, sanitizePayload(payload));
  },
};

// ============================================================
// SYSTEM INFO (Read-only, safe to expose)
// ============================================================
const platform = {
  os: process.platform,
  version: process.versions.electron,
  arch: process.arch,
};

// ============================================================
// CONTEXT BRIDGE EXPOSURE
// Only these exact properties are accessible in renderer
// ============================================================
contextBridge.exposeInMainWorld('nexuspos', api);
contextBridge.exposeInMainWorld('platform', platform);

// ============================================================
// TYPE AUGMENTATION for renderer
// (this block has no runtime effect — just for TypeScript)
// ============================================================
declare global {
  interface Window {
    nexuspos: typeof api;
    platform: typeof platform;
  }
}
