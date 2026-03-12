// NexusPOS — Multi-Terminal Sync Engine
// Event-sourced local network synchronization
// Uses UDP for peer discovery + TCP for data transfer
// Vector clock conflict resolution

import { EventEmitter } from 'node:events';
import * as dgram from 'node:dgram';
import * as net from 'node:net';
import * as os from 'node:os';
import type { DatabaseManager } from '../database/DatabaseManager';
import type { ISyncEvent, ISyncStatus } from '@nexuspos/shared';
import { AppLogger } from '../utils/AppLogger';
import { createHash } from 'node:crypto';

const logger = new AppLogger('SyncEngine');

const DISCOVERY_PORT = 45678;
const SYNC_PORT = 45679;
const DISCOVERY_INTERVAL_MS = 5_000;
const SYNC_RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];
const MAX_BATCH_SIZE = 50;

interface SyncPeer {
  deviceId: string;
  address: string;
  port: number;
  lastSeenAt: Date;
  appVersion?: string;
}

interface DiscoveryMessage {
  type: 'ANNOUNCE' | 'BYE';
  deviceId: string;
  syncPort: number;
  appVersion: string;
  storeId: string;
}

interface SyncMessage {
  type: 'REQUEST_EVENTS' | 'EVENTS' | 'ACK' | 'CONFLICT';
  deviceId: string;
  events?: ISyncEvent[];
  fromSequence?: number;
  ackIds?: string[];
}

export class SyncEngine extends EventEmitter {
  private peers = new Map<string, SyncPeer>();
  private discoverySocket: dgram.Socket | null = null;
  private syncServer: net.Server | null = null;
  private discoveryTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private deviceId: string = '';
  private storeId: string = '';
  private vectorClock: Record<string, number> = {};

  constructor(private readonly dbManager: DatabaseManager) {
    super();
  }

  // ── INITIALIZATION ─────────────────────────────────────
  async initialize(): Promise<void> {
    try {
      const device = await this.dbManager.getCurrentDevice();
      if (!device) {
        logger.warn('No device configured — sync engine in standby');
        return;
      }

      this.deviceId = device.id;
      this.storeId = device.storeId;
      this.vectorClock = { [this.deviceId]: 0 };

      await this.startDiscovery();
      await this.startSyncServer();
      this.startSyncLoop();
      this.isRunning = true;

      logger.info(`Sync engine started for device: ${this.deviceId}`);
    } catch (err) {
      logger.error('Sync engine initialization failed', err);
      // Non-fatal — POS works without sync
    }
  }

  // ── UDP PEER DISCOVERY ─────────────────────────────────
  private async startDiscovery(): Promise<void> {
    this.discoverySocket = dgram.createSocket('udp4');

    this.discoverySocket.on('message', (msg, rinfo) => {
      try {
        const data: DiscoveryMessage = JSON.parse(msg.toString());
        if (data.deviceId === this.deviceId) return; // Ignore self
        if (data.storeId !== this.storeId) return; // Different store

        if (data.type === 'ANNOUNCE') {
          this.peers.set(data.deviceId, {
            deviceId: data.deviceId,
            address: rinfo.address,
            port: data.syncPort,
            lastSeenAt: new Date(),
            appVersion: data.appVersion,
          });
          logger.debug(`Peer discovered: ${data.deviceId} @ ${rinfo.address}`);
          this.emit('peer-discovered', { deviceId: data.deviceId });
        } else if (data.type === 'BYE') {
          this.peers.delete(data.deviceId);
          this.emit('peer-lost', { deviceId: data.deviceId });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    this.discoverySocket.on('error', (err) => {
      logger.error('Discovery socket error', err);
    });

    await new Promise<void>((resolve, reject) => {
      this.discoverySocket!.bind(DISCOVERY_PORT, () => resolve());
      this.discoverySocket!.once('error', reject);
    });

    this.discoverySocket.setBroadcast(true);

    // Announce presence periodically
    this.discoveryTimer = setInterval(() => {
      this.broadcastPresence();
    }, DISCOVERY_INTERVAL_MS);

    // Initial announcement
    this.broadcastPresence();

    // Expire stale peers
    setInterval(() => {
      const staleThreshold = Date.now() - 30_000;
      for (const [id, peer] of this.peers.entries()) {
        if (peer.lastSeenAt.getTime() < staleThreshold) {
          this.peers.delete(id);
          logger.debug(`Peer expired: ${id}`);
        }
      }
    }, 15_000);
  }

  private broadcastPresence(): void {
    if (!this.discoverySocket || !this.isRunning) return;

    const msg = JSON.stringify({
      type: 'ANNOUNCE',
      deviceId: this.deviceId,
      syncPort: SYNC_PORT,
      appVersion: '1.0.0',
      storeId: this.storeId,
    } satisfies DiscoveryMessage);

    const buf = Buffer.from(msg);

    // Broadcast to all network interfaces
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const parts = addr.address.split('.');
          parts[3] = '255';
          const broadcast = parts.join('.');
          this.discoverySocket.send(buf, 0, buf.length, DISCOVERY_PORT, broadcast);
        }
      }
    }
  }

  // ── TCP SYNC SERVER ────────────────────────────────────
  private async startSyncServer(): Promise<void> {
    this.syncServer = net.createServer((socket) => {
      let buffer = '';

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg: SyncMessage = JSON.parse(line);
            this.handleSyncMessage(msg, socket);
          } catch {
            logger.warn('Malformed sync message received');
          }
        }
      });

      socket.on('error', () => {}); // Suppress individual connection errors
    });

    await new Promise<void>((resolve, reject) => {
      this.syncServer!.listen(SYNC_PORT, '0.0.0.0', () => resolve());
      this.syncServer!.once('error', reject);
    });

    logger.info(`Sync server listening on port ${SYNC_PORT}`);
  }

  // ── HANDLE INCOMING SYNC MESSAGES ─────────────────────
  private async handleSyncMessage(msg: SyncMessage, socket: net.Socket): Promise<void> {
    switch (msg.type) {
      case 'REQUEST_EVENTS': {
        const events = await this.getPendingEvents(msg.fromSequence ?? 0);
        this.sendMessage(socket, {
          type: 'EVENTS',
          deviceId: this.deviceId,
          events,
        });
        break;
      }

      case 'EVENTS': {
        if (msg.events && msg.events.length > 0) {
          const ackIds = await this.applyRemoteEvents(msg.events);
          this.sendMessage(socket, {
            type: 'ACK',
            deviceId: this.deviceId,
            ackIds,
          });
        }
        break;
      }

      case 'ACK': {
        if (msg.ackIds?.length) {
          await this.markEventsAcked(msg.ackIds);
        }
        break;
      }
    }
  }

  private sendMessage(socket: net.Socket, msg: SyncMessage): void {
    try {
      socket.write(JSON.stringify(msg) + '\n');
    } catch (err) {
      logger.warn('Failed to send sync message', err);
    }
  }

  // ── SYNC LOOP ──────────────────────────────────────────
  private startSyncLoop(): void {
    this.syncTimer = setInterval(async () => {
      await this.syncWithPeers();
    }, 3000);
  }

  async triggerSync(): Promise<void> {
    await this.syncWithPeers();
  }

  private async syncWithPeers(): Promise<void> {
    for (const peer of this.peers.values()) {
      try {
        await this.syncWithPeer(peer);
      } catch (err) {
        logger.warn(`Sync failed with peer ${peer.deviceId}`, err);
      }
    }
  }

  private async syncWithPeer(peer: SyncPeer): Promise<void> {
    const pendingCount = await this.dbManager.client.syncQueue.count({
      where: { deviceId: this.deviceId, status: 'PENDING' },
    });

    if (pendingCount === 0) return;

    const socket = await this.connectToPeer(peer);
    if (!socket) return;

    try {
      // Request peer's pending events first
      this.sendMessage(socket, {
        type: 'REQUEST_EVENTS',
        deviceId: this.deviceId,
        fromSequence: 0,
      });

      // Wait for response with timeout
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        socket.once('close', () => { clearTimeout(timer); resolve(); });
      });
    } finally {
      socket.destroy();
    }
  }

  private connectToPeer(peer: SyncPeer): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, 3000);

      socket.connect(peer.port, peer.address, () => {
        clearTimeout(timeout);
        resolve(socket);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  // ── APPLY REMOTE EVENTS ────────────────────────────────
  private async applyRemoteEvents(events: ISyncEvent[]): Promise<string[]> {
    const ackIds: string[] = [];

    for (const event of events) {
      try {
        await this.applyEvent(event);
        ackIds.push(`${event.deviceId}:${event.entityId}`);
      } catch (err) {
        logger.error('Failed to apply remote event', err);
      }
    }

    return ackIds;
  }

  private async applyEvent(event: ISyncEvent): Promise<void> {
    // Check if we've already applied this event (idempotency)
    const existing = await this.dbManager.client.syncQueue.findFirst({
      where: {
        deviceId: event.deviceId,
        entityId: event.entityId,
        operation: event.operation,
        status: 'SYNCED',
      },
    });
    if (existing) return;

    // Conflict detection using vector clocks
    const localClock = this.vectorClock[event.deviceId] ?? 0;
    const eventClock = (event.vectorClock as Record<string, number>)[event.deviceId] ?? 0;

    if (eventClock <= localClock) {
      // Already applied or stale
      return;
    }

    // Apply the change based on entity type
    try {
      switch (event.entityType) {
        case 'Sale':
          await this.applySaleEvent(event);
          break;
        case 'Product':
          await this.applyProductEvent(event);
          break;
        case 'InventoryItem':
          await this.applyInventoryEvent(event);
          break;
        case 'Customer':
          await this.applyCustomerEvent(event);
          break;
        default:
          logger.debug(`Unknown entity type in sync: ${event.entityType}`);
      }

      // Update vector clock
      this.vectorClock[event.deviceId] = eventClock;

      // Mark as synced
      await this.dbManager.client.syncQueue.create({
        data: {
          deviceId: event.deviceId,
          entityType: event.entityType,
          entityId: event.entityId,
          operation: event.operation,
          payload: JSON.stringify(event.payload),
          vectorClock: JSON.stringify(event.vectorClock),
          status: 'SYNCED',
          processedAt: new Date(),
        },
      });
    } catch (err) {
      logger.error(`Failed to apply ${event.entityType} event`, err);
      throw err;
    }
  }

  private async applySaleEvent(event: ISyncEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    if (event.operation === 'CREATE') {
      const exists = await this.dbManager.client.sale.findUnique({
        where: { id: event.entityId },
      });
      if (!exists) {
        // Insert the sale from remote device
        logger.info(`Sync: received remote sale ${event.entityId}`);
      }
    } else if (event.operation === 'VOID') {
      await this.dbManager.client.sale.updateMany({
        where: { id: event.entityId },
        data: { status: 'VOIDED', voidedAt: new Date() },
      });
    }
  }

  private async applyProductEvent(event: ISyncEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    if (event.operation === 'UPDATE') {
      await this.dbManager.client.product.updateMany({
        where: { id: event.entityId },
        data: payload as any,
      });
    }
  }

  private async applyInventoryEvent(event: ISyncEvent): Promise<void> {
    const payload = event.payload as { quantity: number };
    if (event.operation === 'UPDATE') {
      await this.dbManager.client.inventoryItem.updateMany({
        where: { productId: event.entityId },
        data: { quantity: payload.quantity },
      });
    }
  }

  private async applyCustomerEvent(event: ISyncEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    if (event.operation === 'CREATE') {
      logger.debug(`Sync: customer event for ${event.entityId}`);
    } else if (event.operation === 'UPDATE') {
      await this.dbManager.client.customer.updateMany({
        where: { id: event.entityId },
        data: payload as any,
      });
    }
  }

  // ── QUEUE OPERATIONS ───────────────────────────────────
  async queueCreate(entityType: string, entityId: string, payload: unknown): Promise<void> {
    this.vectorClock[this.deviceId] = (this.vectorClock[this.deviceId] ?? 0) + 1;

    await this.dbManager.client.syncQueue.create({
      data: {
        deviceId: this.deviceId,
        entityType,
        entityId,
        operation: 'CREATE',
        payload: JSON.stringify(payload),
        vectorClock: JSON.stringify({ ...this.vectorClock }),
        checksum: this.computeChecksum(payload),
        status: 'PENDING',
      },
    });
  }

  async queueUpdate(entityType: string, entityId: string, payload: unknown): Promise<void> {
    this.vectorClock[this.deviceId] = (this.vectorClock[this.deviceId] ?? 0) + 1;

    await this.dbManager.client.syncQueue.create({
      data: {
        deviceId: this.deviceId,
        entityType,
        entityId,
        operation: 'UPDATE',
        payload: JSON.stringify(payload),
        vectorClock: JSON.stringify({ ...this.vectorClock }),
        status: 'PENDING',
      },
    });
  }

  private async getPendingEvents(fromSequence: number): Promise<ISyncEvent[]> {
    const items = await this.dbManager.client.syncQueue.findMany({
      where: { deviceId: this.deviceId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: MAX_BATCH_SIZE,
    });

    return items.map(item => ({
      deviceId: item.deviceId,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation as ISyncEvent['operation'],
      payload: JSON.parse(item.payload),
      vectorClock: JSON.parse(item.vectorClock),
      timestamp: item.createdAt,
    }));
  }

  private async markEventsAcked(ackIds: string[]): Promise<void> {
    for (const ackId of ackIds) {
      const [deviceId, entityId] = ackId.split(':');
      await this.dbManager.client.syncQueue.updateMany({
        where: { deviceId, entityId, status: 'PENDING' },
        data: { status: 'SYNCED', processedAt: new Date() },
      });
    }
  }

  private computeChecksum(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
  }

  // ── STATUS ─────────────────────────────────────────────
  async getStatus(): Promise<ISyncStatus> {
    const pending = await this.dbManager.client.syncQueue.count({
      where: { deviceId: this.deviceId, status: 'PENDING' },
    });
    const failed = await this.dbManager.client.syncQueue.count({
      where: { deviceId: this.deviceId, status: 'FAILED' },
    });
    const lastSynced = await this.dbManager.client.syncQueue.findFirst({
      where: { status: 'SYNCED' },
      orderBy: { processedAt: 'desc' },
    });

    return {
      lastSyncAt: lastSynced?.processedAt ?? undefined,
      pendingCount: pending,
      failedCount: failed,
      peerCount: this.peers.size,
      isOnline: this.peers.size > 0,
    };
  }

  // ── SHUTDOWN ───────────────────────────────────────────
  async shutdown(): Promise<void> {
    this.isRunning = false;

    // Announce goodbye
    if (this.discoverySocket) {
      const byeMsg = JSON.stringify({
        type: 'BYE',
        deviceId: this.deviceId,
        syncPort: SYNC_PORT,
        appVersion: '1.0.0',
        storeId: this.storeId,
      } satisfies DiscoveryMessage);
      try { this.broadcastPresence(); } catch {}
    }

    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);

    await new Promise<void>((resolve) => {
      this.discoverySocket?.close(() => resolve());
      if (!this.discoverySocket) resolve();
    });

    await new Promise<void>((resolve) => {
      this.syncServer?.close(() => resolve());
      if (!this.syncServer) resolve();
    });

    logger.info('Sync engine shut down');
  }
}
