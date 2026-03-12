// NexusPOS — Settings IPC Handler

import type { DatabaseManager } from '../../database/DatabaseManager';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('SettingsService');

export class SettingsService {
  constructor(private db: DatabaseManager) {}

  async getSetting(payload: { storeId: string; key: string }) {
    const setting = await this.db.client.storeSetting.findUnique({
      where: { storeId_key: { storeId: payload.storeId, key: payload.key } },
    });
    return setting?.value ?? null;
  }

  async setSetting(payload: { storeId: string; key: string; value: string }) {
    const setting = await this.db.client.storeSetting.upsert({
      where: { storeId_key: { storeId: payload.storeId, key: payload.key } },
      update: { value: payload.value },
      create: { storeId: payload.storeId, key: payload.key, value: payload.value },
    });
    logger.info('Setting updated', { key: payload.key });
    return setting;
  }

  async getAllSettings(payload: { storeId: string }) {
    const settings = await this.db.client.storeSetting.findMany({
      where: { storeId: payload.storeId },
    });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async getDeviceConfig(payload: { deviceId: string }) {
    const config = await this.db.client.deviceConfig.findUnique({
      where: { deviceId: payload.deviceId },
    });
    return config;
  }
}
