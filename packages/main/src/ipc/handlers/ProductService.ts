// NexusPOS — Product Service

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { CreateProductSchema, UpdateProductSchema, ProductSearchSchema, ProductBarcodeSchema } from '../../../../shared/src/schemas';
import { AppError } from '../../utils/AppError';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('ProductService');

export class ProductService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async searchProducts(rawPayload: unknown) {
    const payload = ProductSearchSchema.parse(rawPayload);

    return this.db.product.findMany({
      where: {
        storeId: payload.storeId,
        isActive: true,
        ...(payload.categoryId && { categoryId: payload.categoryId }),
        ...(payload.query && {
          OR: [
            { name: { contains: payload.query } },
            { sku: { contains: payload.query } },
            { barcode: { contains: payload.query } },
            { description: { contains: payload.query } },
          ],
        }),
      },
      include: {
        category: true,
        taxRule: true,
        inventory: true,
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: payload.limit,
      skip: payload.offset,
    });
  }

  async findByBarcode(rawPayload: unknown) {
    const payload = ProductBarcodeSchema.parse(rawPayload);

    const product = await this.db.product.findFirst({
      where: { barcode: payload.barcode, storeId: payload.storeId, isActive: true },
      include: { category: true, taxRule: true, inventory: true },
    });

    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', `No product with barcode: ${payload.barcode}`, false);
    }

    return product;
  }

  async findProduct(rawPayload: unknown) {
    const { productId } = rawPayload as { productId: string };
    return this.db.product.findUnique({
      where: { id: productId },
      include: { category: true, taxRule: true, inventory: true, productVariants: true },
    });
  }

  async listProducts(rawPayload: unknown) {
    const { storeId, categoryId, page = 1, pageSize = 50 } = rawPayload as any;
    return this.db.product.findMany({
      where: { storeId, isActive: true, ...(categoryId && { categoryId }) },
      include: { category: true, taxRule: true, inventory: true },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async createProduct(rawPayload: unknown) {
    const payload = CreateProductSchema.parse(rawPayload);

    if (payload.sku) {
      const exists = await this.db.product.findFirst({ where: { storeId: payload.storeId, sku: payload.sku } });
      if (exists) throw new AppError('SKU_EXISTS', 'A product with this SKU already exists', false);
    }

    if (payload.barcode) {
      const exists = await this.db.product.findFirst({ where: { storeId: payload.storeId, barcode: payload.barcode } });
      if (exists) throw new AppError('BARCODE_EXISTS', 'A product with this barcode already exists', false);
    }

    const product = await this.db.product.create({
      data: { id: createId(), ...payload },
      include: { category: true, taxRule: true },
    });

    if (!payload.isService) {
      await this.db.inventoryItem.create({
        data: { id: createId(), productId: product.id, quantity: 0, reservedQty: 0 },
      });
    }

    logger.info(`Product created: ${product.name}`);
    return product;
  }

  async updateProduct(rawPayload: unknown) {
    const payload = UpdateProductSchema.parse(rawPayload);
    const { id, ...data } = payload;

    return this.db.product.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: { category: true, taxRule: true },
    });
  }

  async deleteProduct(rawPayload: unknown) {
    const { productId } = rawPayload as { productId: string };
    // Soft delete
    return this.db.product.update({
      where: { id: productId },
      data: { isActive: false, updatedAt: new Date() },
    });
  }
}
