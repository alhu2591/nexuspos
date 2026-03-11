// NexusPOS — Auth Service

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'node:crypto';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { LoginSchema, LoginPinSchema } from '../../../../shared/src/schemas';
import { AppError } from '../../utils/AppError';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('AuthService');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'nexuspos-salt').digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// In-memory session store (for single-process simplicity)
const sessions = new Map<string, { userId: string; expiresAt: Date }>();

export class AuthService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async login(rawPayload: unknown) {
    const payload = LoginSchema.parse(rawPayload);

    const user = await this.db.user.findFirst({
      where: { username: payload.username, isActive: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', false);

    const hashed = hashPassword(payload.password);
    if (user.passwordHash !== hashed) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password', false);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    sessions.set(token, { userId: user.id, expiresAt });

    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    logger.info(`User logged in: ${user.username}`);

    return {
      userId: user.id,
      user: { ...user, passwordHash: undefined, pin: undefined },
      token,
      expiresAt,
      isPin: false,
      storeId: user.storeId,
      deviceId: payload.deviceId,
    };
  }

  async loginPin(rawPayload: unknown) {
    const payload = LoginPinSchema.parse(rawPayload);
    const hashedPin = hashPassword(payload.pin);

    const user = await this.db.user.findFirst({
      where: { pin: hashedPin, isActive: true },
      include: { role: { include: { permissions: true } } },
    });

    if (!user) throw new AppError('INVALID_PIN', 'Invalid PIN', false);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours for PIN sessions
    sessions.set(token, { userId: user.id, expiresAt });

    return {
      userId: user.id,
      user: { ...user, passwordHash: undefined, pin: undefined },
      token,
      expiresAt,
      isPin: true,
      storeId: user.storeId,
      deviceId: payload.deviceId,
    };
  }

  async logout(rawPayload: unknown) {
    const { token } = rawPayload as { token: string };
    sessions.delete(token);
    return { success: true };
  }

  async getSession(rawPayload: unknown) {
    const { token } = rawPayload as { token?: string };
    if (!token) return null;

    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      sessions.delete(token);
      return null;
    }

    const user = await this.db.user.findUnique({
      where: { id: session.userId },
      include: { role: { include: { permissions: true } } },
    });

    if (!user) return null;
    return { ...session, user: { ...user, passwordHash: undefined, pin: undefined } };
  }
}
