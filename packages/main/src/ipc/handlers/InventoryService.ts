// NexusPOS — Inventory IPC Handler

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { AdjustInventorySchema } from '@nexuspos/shared';
import { AppError } from '../../utils/AppError';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('InventoryService');

export class InventoryService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async getInventory(rawPayload: unknown) {
    const { productId, lowStockOnly } = rawPayload as {
      productId?: string;
      lowStockOnly?: boolean;
    };

    // InventoryItem has no branchId — query by productId or get all
    const items = await this.db.inventoryItem.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: {
          include: { category: true, taxRule: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    // Low stock: quantity <= product.minStockLevel (if set)
    if (lowStockOnly) {
      return items.filter(i =>
        i.product.minStockLevel !== null &&
        i.product.minStockLevel !== undefined &&
        i.quantity <= i.product.minStockLevel
      );
    }

    return items;
  }

  async adjustInventory(rawPayload: unknown) {
    const payload = AdjustInventorySchema.parse(rawPayload);

    // Load current inventory item
    const current = await this.db.inventoryItem.findUnique({
      where: { productId: payload.productId }, // productId is @unique in schema
    });

    const previousQty = current?.quantity ?? 0;
    const newQty = previousQty + payload.quantity;

    // Transaction: update item + record movement
    const [updated] = await this.db.$transaction([
      // Upsert inventory item
      this.db.inventoryItem.upsert({
        where: { productId: payload.productId },
        update: { quantity: newQty, updatedAt: new Date() },
        create: {
          id: createId(),
          productId: payload.productId,
          quantity: newQty,
          reservedQty: 0,
        },
      }),
      // Create stock movement record
      // Schema fields: productId (not inventoryItemId), movementType (not type)
      this.db.stockMovement.create({
        data: {
          id: createId(),
          productId: payload.productId,      // ← correct field name
          movementType: payload.movementType, // ← correct field name
          quantity: payload.quantity,
          previousQty,                        // ← required by schema
          newQty,                             // ← required by schema
          reason: payload.reason,
          userId: payload.userId,
        },
      }),
    ]);

    logger.info(`Inventory adjusted: product=${payload.productId} delta=${payload.quantity} new=${newQty}`);
    return updated;
  }

  async getMovements(rawPayload: unknown) {
    const { productId, limit = 50 } = rawPayload as {
      productId: string;
      limit?: number;
    };

    if (!productId) throw new AppError('MISSING_PRODUCT_ID', 'Product ID is required', false);

    return this.db.stockMovement.findMany({
      where: { productId }, // schema uses productId (not inventoryItemId)
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
