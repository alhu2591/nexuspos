// NexusPOS — Settings Store

import { create } from 'zustand';
import type { IShift, ISyncStatus } from '../../../shared/src/types';
import { shiftAPI, settingsAPI, systemAPI } from '../services/ipcService';

interface SettingsState {
  currentShift: IShift | null;
  syncStatus: ISyncStatus | null;
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
  storeId: null,
  deviceId: null,
  locale: 'de-DE',
  currency: 'EUR',
  timezone: 'Europe/Berlin',

  loadSettings: async () => {
    try {
      const syncResult = await systemAPI.syncStatus();
      if (syncResult.success) {
        set({ syncStatus: syncResult.data as ISyncStatus });
      }
    } catch {}
  },

  setCurrentShift: (shift) => set({ currentShift: shift }),

  refreshSyncStatus: async () => {
    const result = await systemAPI.syncStatus();
    if (result.success) {
      set({ syncStatus: result.data as ISyncStatus });
    }
  },
}));
