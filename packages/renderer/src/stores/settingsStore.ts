// NexusPOS — Settings Store

import { create } from 'zustand';
import type { IShift, ISyncStatus } from '@nexuspos/shared';
import { shiftAPI, settingsAPI, systemAPI } from '../services/ipcService';

export interface DeviceInfo {
  id: string;
  name: string;
  storeId: string;
  branchId: string | null;
  deviceType: string;
  isPrimary: boolean;
  store: {
    id: string;
    name: string;
    legalName: string;
    currency: string;
    locale: string;
    timezone: string;
  } | null;
}

interface SettingsState {
  currentShift: IShift | null;
  syncStatus: ISyncStatus | null;
  device: DeviceInfo | null;
  storeId: string | null;
  deviceId: string | null;
  locale: string;
  currency: string;
  timezone: string;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  setCurrentShift: (shift: IShift | null) => void;
  refreshSyncStatus: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()((set, get) => ({
  currentShift: null,
  syncStatus: null,
  device: null,
  storeId: null,
  deviceId: null,
  locale: 'de-DE',
  currency: 'EUR',
  timezone: 'Europe/Berlin',

  loadSettings: async () => {
    try {
      // Load device info from main process (gives us real DB device ID)
      const deviceResult = await systemAPI.device();
      if (deviceResult.success && deviceResult.data) {
        const device = deviceResult.data as DeviceInfo;
        set({
          device,
          storeId: device.storeId,
          deviceId: device.id,
          locale: device.store?.locale ?? 'de-DE',
          currency: device.store?.currency ?? 'EUR',
          timezone: device.store?.timezone ?? 'Europe/Berlin',
        });
      }

      // Load sync status
      const syncResult = await systemAPI.syncStatus();
      if (syncResult.success) {
        set({ syncStatus: syncResult.data as ISyncStatus });
      }
    } catch (err) {
      console.warn('[SettingsStore] Failed to load settings:', err);
    }
  },

  setCurrentShift: (shift) => set({ currentShift: shift }),

  refreshSyncStatus: async () => {
    const result = await systemAPI.syncStatus();
    if (result.success) {
      set({ syncStatus: result.data as ISyncStatus });
    }
  },
}));
