// NexusPOS — Inventory IPC Handler

import type { DatabaseManager } from '../../database/DatabaseManager';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('InventoryService');

export class InventoryService {
  constructor(private db: DatabaseManager) {}

  async getInventory(payload: { branchId?: string; lowStockOnly?: boolean }) {
    const where: Record<string, unknown> = {};
    if (payload.branchId) where.branchId = payload.branchId;
    if (payload.lowStockOnly) {
      // will filter in memory since Prisma doesn't support column comparison directly
    }
    const items = await this.db.client.inventoryItem.findMany({
      where,
      include: { product: true, variant: true },
      orderBy: { product: { name: 'asc' } },
    });
    if (payload.lowStockOnly) {
      return items.filter((i) => i.quantity <= i.lowStockThreshold * 1000);
    }
    return items;
  }

  async adjustInventory(payload: {
    productId: string;
    variantId?: string;
    branchId: string;
    delta: number; // in integer × 1000
    reason: string;
    userId: string;
  }) {
    const item = await this.db.client.inventoryItem.findFirst({
      where: { productId: payload.productId, branchId: payload.branchId },
    });
    if (!item) throw new Error('Inventory item not found');

    const [updated] = await this.db.client.$transaction([
      this.db.client.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: { increment: payload.delta } },
      }),
      this.db.client.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: payload.delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(payload.delta),
          reason: payload.reason,
          userId: payload.userId,
        },
      }),
    ]);
    logger.info('Inventory adjusted', { productId: payload.productId, delta: payload.delta });
    return updated;
  }

  async getMovements(payload: { productId: string; branchId?: string; limit?: number }) {
    const item = await this.db.client.inventoryItem.findFirst({
      where: { productId: payload.productId },
    });
    if (!item) return [];
    return this.db.client.stockMovement.findMany({
      where: { inventoryItemId: item.id },
      take: payload.limit ?? 50,
      orderBy: { createdAt: 'desc' },
    });
  }
}
