// NexusPOS — Auth Store (Zustand)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession } from '@nexuspos/shared';
import { authAPI } from '../services/ipcService';
import { useSettingsStore } from './settingsStore';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  loginPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      error: null,

      initialize: async () => {
        set({ isLoading: true });
        try {
          const result = await authAPI.getSession();
          if (result.success && result.data) {
            set({ session: result.data as AuthSession, isLoading: false });
          } else {
            set({ session: null, isLoading: false });
          }
        } catch {
          set({ session: null, isLoading: false });
        }
      },

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          // Use the real database device ID (not the OS platform string)
          const { deviceId } = useSettingsStore.getState();
          const effectiveDeviceId = deviceId ?? window.platform?.os ?? 'dev';

          const result = await authAPI.login(username, password, effectiveDeviceId);
          if (result.success && result.data) {
            set({ session: result.data as AuthSession, isLoading: false });
          } else {
            set({ error: result.error?.message ?? 'Login fehlgeschlagen', isLoading: false });
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Verbindungsfehler', isLoading: false });
        }
      },

      loginPin: async (pin) => {
        set({ isLoading: true, error: null });
        try {
          const { deviceId } = useSettingsStore.getState();
          const effectiveDeviceId = deviceId ?? window.platform?.os ?? 'dev';

          const result = await authAPI.loginPin(pin, effectiveDeviceId);
          if (result.success && result.data) {
            set({ session: result.data as AuthSession, isLoading: false });
          } else {
            set({ error: 'Ungültige PIN', isLoading: false });
          }
        } catch {
          set({ error: 'Verbindungsfehler', isLoading: false });
        }
      },

      logout: async () => {
        const { session } = get();
        if (session?.token) {
          await authAPI.logout(session.token).catch(() => {});
        }
        set({ session: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'nexuspos-auth',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
