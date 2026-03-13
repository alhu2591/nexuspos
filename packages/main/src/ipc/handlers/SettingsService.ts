// NexusPOS — Settings IPC Handler

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { SetSettingSchema } from '@nexuspos/shared';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('SettingsService');

export class SettingsService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async getSetting(rawPayload: unknown) {
    const { key, storeId } = rawPayload as { key: string; storeId: string };

    const setting = await this.db.storeSetting.findUnique({
      where: { storeId_key: { storeId, key } },
    });
    return setting?.value ?? null;
  }

  async setSetting(rawPayload: unknown) {
    const payload = SetSettingSchema.parse(rawPayload);

    const setting = await this.db.storeSetting.upsert({
      where: { storeId_key: { storeId: payload.storeId, key: payload.key } },
      update: { value: payload.value, dataType: payload.dataType },
      create: {
        id: createId(),
        storeId: payload.storeId,
        key: payload.key,
        value: payload.value,
        dataType: payload.dataType,
      },
    });

    logger.info(`Setting updated: ${payload.key}`);
    return setting;
  }

  async getAllSettings(rawPayload: unknown) {
    const { storeId } = rawPayload as { storeId: string };

    const settings = await this.db.storeSetting.findMany({
      where: { storeId },
    });
    return Object.fromEntries(settings.map(s => [s.key, s.value]));
  }

  async getDeviceConfig(rawPayload: unknown) {
    const { deviceId } = rawPayload as { deviceId: string };

    return this.db.deviceConfig.findUnique({ where: { deviceId } });
  }
}
