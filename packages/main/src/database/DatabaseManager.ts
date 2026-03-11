// NexusPOS — Database Manager
// Prisma client initialization with WAL mode, backup, and migration support

import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { AppLogger } from '../utils/AppLogger';

const logger = new AppLogger('DatabaseManager');

export class DatabaseManager {
  private _client: PrismaClient | null = null;
  private dbPath: string = '';

  get client(): PrismaClient {
    if (!this._client) throw new Error('Database not initialized');
    return this._client;
  }

  async initialize(): Promise<void> {
    // Determine DB path
    const userDataPath = app?.getPath('userData') ?? process.env.APP_DATA ?? '.';
    const dataDir = path.join(userDataPath, 'nexuspos-data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'nexuspos.db');
    const dbUrl = `file:${this.dbPath}`;

    logger.info(`Database path: ${this.dbPath}`);

    // Initialize Prisma client
    this._client = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    });

    // Enable WAL mode for concurrent access
    await this._client.$executeRawUnsafe(`PRAGMA journal_mode=WAL;`);
    await this._client.$executeRawUnsafe(`PRAGMA synchronous=NORMAL;`);
    await this._client.$executeRawUnsafe(`PRAGMA cache_size=-64000;`); // 64MB cache
    await this._client.$executeRawUnsafe(`PRAGMA temp_store=MEMORY;`);
    await this._client.$executeRawUnsafe(`PRAGMA mmap_size=268435456;`); // 256MB mmap
    await this._client.$executeRawUnsafe(`PRAGMA foreign_keys=ON;`);

    // Run pending migrations
    await this.runMigrations();

    logger.info('Database initialized with WAL mode');
  }

  private async runMigrations(): Promise<void> {
    try {
      // Prisma migrate deploy runs migrations programmatically
      const { execSync } = await import('node:child_process');
      execSync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: `file:${this.dbPath}`,
        },
        stdio: 'pipe',
      });
      logger.info('Database migrations applied');
    } catch (err) {
      logger.warn('Migration via CLI failed — database may already be up to date', err);
    }
  }

  async getCurrentDevice() {
    try {
      return await this._client!.device.findFirst({
        where: { isActive: true },
        include: { store: true },
      });
    } catch {
      return null;
    }
  }

  async getDeviceConfig() {
    try {
      const device = await this.getCurrentDevice();
      if (!device) return null;
      return await this._client!.deviceConfig.findUnique({
        where: { deviceId: device.id },
      });
    } catch {
      return null;
    }
  }

  async createBackup(): Promise<{ path: string; size: number }> {
    const userDataPath = app?.getPath('userData') ?? '.';
    const backupDir = path.join(userDataPath, 'nexuspos-data', 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `nexuspos-backup-${timestamp}.db`);

    // SQLite online backup using VACUUM INTO
    await this._client!.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const stat = fs.statSync(backupPath);

    // Keep only last 10 backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('nexuspos-backup-') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > 10) {
      for (const old of backups.slice(10)) {
        fs.unlinkSync(path.join(backupDir, old.name));
      }
    }

    logger.info(`Backup created: ${backupPath} (${stat.size} bytes)`);
    return { path: backupPath, size: stat.size };
  }

  async shutdown(): Promise<void> {
    if (this._client) {
      await this._client.$disconnect();
      this._client = null;
      logger.info('Database disconnected');
    }
  }
}
