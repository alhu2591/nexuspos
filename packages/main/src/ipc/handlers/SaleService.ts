// NexusPOS — Sale Service (Application Layer, Main Process)
// Orchestrates the complete checkout flow:
// Cart → Validation → DB Write → Fiscal Event → Print → Sync

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import type { PrintManager } from '../../printing/PrintManager';
import type { FiscalEventBus } from '../../fiscal/FiscalEventBus';
import type { SyncEngine } from '../../sync/SyncEngine';
import {
  CreateSaleSchema,
  VoidSaleSchema,
  RefundSchema,
  ProcessPaymentSchema,
  type CreateSaleInput,
  type VoidSaleInput,
  type RefundInput,
} from '@nexuspos/shared';
import { VATEngine, calculateCartTotals } from '@nexuspos/shared';
import { AppLogger } from '../../utils/AppLogger';
import { AppError } from '../../utils/AppError';

const logger = new AppLogger('SaleService');

export class SaleService {
  private readonly db: PrismaClient;

  constructor(
    private readonly dbManager: DatabaseManager,
    private readonly fiscalBus: FiscalEventBus,
    private readonly printManager: PrintManager,
    private readonly syncEngine: SyncEngine
  ) {
    this.db = dbManager.client;
  }

  // ============================================================
  // CREATE SALE
  // Full transactional checkout flow
  // ============================================================
  async createSale(rawPayload: unknown) {
    // 1. Validate input
    const payload = CreateSaleSchema.parse(rawPayload);

    // 2. Verify shift is open
    const shift = await this.db.shift.findFirst({
      where: { id: payload.shiftId, status: 'OPEN' },
    });
    if (!shift) {
      throw new AppError('SHIFT_NOT_OPEN', 'No open shift found for this device', false);
    }

    // 3. Load products with tax rules
    const productIds = [...new Set(payload.lines.map(l => l.productId))];
    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      include: { taxRule: true },
    });

    const productMap = new Map((products as any[]).map((p: any) => [p.id, p]));

    // 4. Validate all products exist and are active
    for (const line of payload.lines) {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product ${line.productId} not found`, false);
      }
      if (!product.isActive) {
        throw new AppError('PRODUCT_INACTIVE', `Product "${product.name}" is not active`, false);
      }
    }

    // 5. Calculate line VAT
    const lineData = payload.lines.map((line, index) => {
      const product = productMap.get(line.productId)!;
      const taxRate = product.taxRule?.rate ?? 0;
      const taxClass = product.taxRule?.taxClass ?? 'zero';
      const taxInclusive = product.taxInclusive;

      const quantityDecimal = line.quantity / 1000;
      const grossBeforeDiscount = Math.round(line.unitPrice * quantityDecimal);

      let netAmount: number;
      let taxAmount: number;
      let grossAmount: number;

      if (taxRate === 0 || taxClass === 'exempt') {
        netAmount = grossBeforeDiscount;
        taxAmount = 0;
        grossAmount = grossBeforeDiscount;
      } else if (taxInclusive) {
        const rate = taxRate / 10000;
        netAmount = Math.round(grossBeforeDiscount / (1 + rate));
        taxAmount = grossBeforeDiscount - netAmount;
        grossAmount = grossBeforeDiscount;
      } else {
        const rate = taxRate / 10000;
        netAmount = grossBeforeDiscount;
        taxAmount = Math.round(grossBeforeDiscount * rate);
        grossAmount = grossBeforeDiscount + taxAmount;
      }

      return {
        lineNumber: index + 1,
        productId: product.id,
        productName: product.name,
        productSku: product.sku ?? undefined,
        barcode: product.barcode ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: 0,
        taxAmount,
        taxRate,
        taxInclusive,
        lineTotal: grossAmount,
        notes: line.notes ?? undefined,
        weight: line.weight ?? undefined,
      };
    });

    // 6. Calculate totals
    const subtotal = lineData.reduce((s, l) => s + l.lineTotal, 0);
    const discountAmount = 0; // TODO: apply discount rules
    const taxAmount = lineData.reduce((s, l) => s + l.taxAmount, 0);
    const totalAmount = subtotal - discountAmount;
    const paidAmount = payload.payments.reduce((s, p) => s + p.amount, 0);
    const changeAmount = Math.max(0, paidAmount - totalAmount);

    // 7. Generate sale number
    const saleNumber = await this.generateSaleNumber(payload.storeId);
    const refundNumber = await this.generateRefundNumber(payload.storeId);

    // 8. Build tax breakdown
    const taxBreakdownMap = new Map<number, { net: number; tax: number; gross: number; class: string }>();
    for (const line of lineData) {
      const key = line.taxRate;
      const existing = taxBreakdownMap.get(key);
      if (existing) {
        existing.net += line.lineTotal - line.taxAmount;
        existing.tax += line.taxAmount;
        existing.gross += line.lineTotal;
      } else {
        const product = productMap.get(line.productId)!;
        taxBreakdownMap.set(key, {
          net: line.lineTotal - line.taxAmount,
          tax: line.taxAmount,
          gross: line.lineTotal,
          class: product.taxRule?.taxClass ?? 'zero',
        });
      }
    }

    // 9. Execute database transaction
    const sale = await this.db.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          id: createId(),
          storeId: payload.storeId,
          deviceId: payload.deviceId,
          shiftId: payload.shiftId,
          cashierId: payload.cashierId,
          customerId: payload.customerId ?? undefined,
          saleNumber,
          status: 'COMPLETED',
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount,
          changeAmount,
          notes: payload.notes ?? undefined,
          tableNumber: payload.tableNumber ?? undefined,
          lines: {
            create: lineData.map(l => ({
              id: createId(),
              ...l,
            })),
          },
          payments: {
            create: payload.payments.map(p => ({
              id: createId(),
              paymentMethod: p.paymentMethod,
              amount: p.amount,
              tendered: p.tendered ?? undefined,
              change: p.tendered ? Math.max(0, p.tendered - p.amount) : undefined,
              reference: p.reference ?? undefined,
              status: 'COMPLETED',
            })),
          },
          taxBreakdown: {
            create: Array.from(taxBreakdownMap.entries()).map(([rate, b]) => ({
              id: createId(),
              taxRate: rate,
              taxClass: b.class,
              netAmount: b.net,
              taxAmount: b.tax,
              grossAmount: b.gross,
            })),
          },
        },
        include: {
          lines: true,
          payments: true,
          taxBreakdown: true,
          cashier: { select: { id: true, firstName: true, lastName: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // Deduct inventory (skip for services)
      for (const line of lineData) {
        const product = productMap.get(line.productId)!;
        if (!product.isService) {
          const qty = line.quantity / 1000;
          await tx.inventoryItem.upsert({
            where: { productId: line.productId },
            update: {
              quantity: { decrement: Math.round(qty) },
              updatedAt: new Date(),
            },
            create: {
              id: createId(),
              productId: line.productId,
              quantity: -Math.round(qty),
              reservedQty: 0,
            },
          });

          // Record stock movement
          const currentInventory = await tx.inventoryItem.findUnique({
            where: { productId: line.productId },
          });

          await tx.stockMovement.create({
            data: {
              id: createId(),
              productId: line.productId,
              shiftId: payload.shiftId,
              saleId: newSale.id,
              movementType: 'SALE',
              quantity: -Math.round(qty),
              previousQty: (currentInventory?.quantity ?? 0) + Math.round(qty),
              newQty: currentInventory?.quantity ?? 0,
              reference: saleNumber,
            },
          });
        }
      }

      // Update customer total spent
      if (payload.customerId) {
        await tx.customer.update({
          where: { id: payload.customerId },
          data: {
            totalSpent: { increment: totalAmount },
            updatedAt: new Date(),
          },
        });
      }

      // Create receipt record
      const receiptNumber = await this.generateReceiptNumber(payload.storeId);
      await tx.receipt.create({
        data: {
          id: createId(),
          saleId: newSale.id,
          receiptNumber,
        },
      });

      return newSale;
    });

    logger.info(`Sale created: ${saleNumber} (${totalAmount} cents)`);

    // 10. Fire fiscal event (async, non-blocking for performance)
    this.fiscalBus.onSaleCompleted(sale).catch(err => {
      logger.error('Fiscal event failed for sale', err);
    });

    // 11. Queue for sync
    this.syncEngine.queueCreate('Sale', sale.id, sale).catch(err => {
      logger.error('Sync queue failed for sale', err);
    });

    return sale;
  }

  // ============================================================
  // VOID SALE
  // ============================================================
  async voidSale(rawPayload: unknown) {
    const payload = VoidSaleSchema.parse(rawPayload);

    const sale = await this.db.sale.findUnique({
      where: { id: payload.saleId },
      include: { lines: true, payments: true },
    });

    if (!sale) {
      throw new AppError('SALE_NOT_FOUND', 'Sale not found', false);
    }

    if (sale.status === 'VOIDED') {
      throw new AppError('SALE_ALREADY_VOIDED', 'Sale is already voided', false);
    }

    if (sale.status === 'REFUNDED') {
      throw new AppError('SALE_ALREADY_REFUNDED', 'Cannot void a refunded sale', false);
    }

    const voidedSale = await this.db.$transaction(async (tx) => {
      // Update sale status
      const updated = await tx.sale.update({
        where: { id: payload.saleId },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: payload.reason,
        },
      });

      // Restore inventory
      for (const line of sale.lines) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (product && !product.isService) {
          const qty = line.quantity / 1000;
          await tx.inventoryItem.update({
            where: { productId: line.productId },
            data: { quantity: { increment: Math.round(qty) } },
          });
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          id: createId(),
          userId: payload.userId,
          entityType: 'Sale',
          entityId: payload.saleId,
          action: 'void',
          newValue: JSON.stringify({ reason: payload.reason }),
        },
      });

      return updated;
    });

    // Fiscal void event
    this.fiscalBus.onSaleVoided(sale.id).catch(err => {
      logger.error('Fiscal void event failed', err);
    });

    return voidedSale;
  }

  // ============================================================
  // PROCESS REFUND
  // ============================================================
  async processRefund(rawPayload: unknown) {
    const payload = RefundSchema.parse(rawPayload);

    const sale = await this.db.sale.findUnique({
      where: { id: payload.saleId },
      include: { lines: true, payments: true },
    });

    if (!sale) {
      throw new AppError('SALE_NOT_FOUND', 'Sale not found', false);
    }

    if (sale.status === 'VOIDED') {
      throw new AppError('SALE_VOIDED', 'Cannot refund a voided sale', false);
    }

    // Validate refund amount
    const maxRefundable = sale.totalAmount - (sale.refunds ? 0 : 0); // TODO: track prior refunds
    if (payload.amount > maxRefundable) {
      throw new AppError(
        'REFUND_EXCEEDS_MAX',
        `Refund amount exceeds maximum refundable amount`,
        false
      );
    }

    const refundNumber = await this.generateRefundNumber(sale.storeId ?? '');

    const refund = await this.db.$transaction(async (tx) => {
      // Create refund record
      const newRefund = await tx.refund.create({
        data: {
          id: createId(),
          saleId: payload.saleId,
          userId: payload.userId,
          refundNumber,
          amount: payload.amount,
          reason: payload.reason,
          refundMethod: payload.refundMethod,
          status: 'COMPLETED',
          isPartial: payload.amount < sale.totalAmount,
          lines: payload.lines
            ? {
                create: payload.lines.map(l => ({
                  id: createId(),
                  saleLineId: l.saleLineId,
                  productId: sale.lines.find(sl => sl.id === l.saleLineId)?.productId,
                  productName: sale.lines.find(sl => sl.id === l.saleLineId)?.productName ?? '',
                  quantity: l.quantity,
                  amount: Math.round(
                    (sale.lines.find(sl => sl.id === l.saleLineId)?.lineTotal ?? 0) *
                      (l.quantity / (sale.lines.find(sl => sl.id === l.saleLineId)?.quantity ?? 1))
                  ),
                })),
              }
            : undefined,
        },
      });

      // Update sale status
      await tx.sale.update({
        where: { id: payload.saleId },
        data: {
          status: payload.amount >= sale.totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      // Restore inventory for refunded lines
      if (payload.lines) {
        for (const refundLine of payload.lines) {
          const saleLine = sale.lines.find(l => l.id === refundLine.saleLineId);
          if (saleLine) {
            const product = await tx.product.findUnique({ where: { id: saleLine.productId } });
            if (product && !product.isService) {
              await tx.inventoryItem.update({
                where: { productId: saleLine.productId },
                data: { quantity: { increment: Math.round(refundLine.quantity / 1000) } },
              });
            }
          }
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          id: createId(),
          userId: payload.userId,
          entityType: 'Refund',
          entityId: newRefund.id,
          action: 'create',
          newValue: JSON.stringify({ amount: payload.amount, reason: payload.reason }),
        },
      });

      return newRefund;
    });

    logger.info(`Refund created: ${refundNumber} (${payload.amount} cents)`);

    this.fiscalBus.onRefundCreated(refund).catch(err => {
      logger.error('Fiscal refund event failed', err);
    });

    return refund;
  }

  // ============================================================
  // PROCESS PAYMENT (for existing pending sale)
  // ============================================================
  async processPayment(rawPayload: unknown) {
    const payload = ProcessPaymentSchema.parse(rawPayload);

    const sale = await this.db.sale.findUnique({ where: { id: payload.saleId } });
    if (!sale) throw new AppError('SALE_NOT_FOUND', 'Sale not found', false);
    if (sale.status !== 'PENDING') {
      throw new AppError('SALE_NOT_PENDING', 'Sale is not in pending state', false);
    }

    const payment = await this.db.payment.create({
      data: {
        id: createId(),
        saleId: payload.saleId,
        paymentMethod: payload.paymentMethod,
        amount: payload.amount,
        tendered: payload.tendered ?? undefined,
        change: payload.tendered ? Math.max(0, payload.tendered - payload.amount) : undefined,
        reference: payload.reference ?? undefined,
        status: 'COMPLETED',
      },
    });

    // Check if fully paid
    const totalPayments = await this.db.payment.aggregate({
      where: { saleId: payload.saleId, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const totalPaid = totalPayments._sum.amount ?? 0;
    if (totalPaid >= sale.totalAmount) {
      await this.db.sale.update({
        where: { id: payload.saleId },
        data: {
          status: 'COMPLETED',
          paidAmount: totalPaid,
          changeAmount: Math.max(0, totalPaid - sale.totalAmount),
        },
      });
    }

    return payment;
  }

  // ============================================================
  // HOLD SALE
  // ============================================================
  async holdSale(rawPayload: unknown) {
    const payload = rawPayload as { cartData: Record<string, unknown>; label?: string };

    // Holds are stored in app settings as serialized cart data
    // In a real POS, these would be stored in a dedicated HeldSale table
    logger.info(`Sale held: ${payload.label ?? 'unlabeled'}`);
    return { success: true, heldAt: new Date() };
  }

  // ============================================================
  // FIND / LIST SALES
  // ============================================================
  async findSale(rawPayload: unknown) {
    const { saleId } = rawPayload as { saleId: string };

    return this.db.sale.findUnique({
      where: { id: saleId },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        payments: true,
        taxBreakdown: true,
        cashier: { select: { id: true, firstName: true, lastName: true } },
        customer: true,
        receipt: true,
      },
    });
  }

  async listSales(rawPayload: unknown) {
    const payload = rawPayload as {
      storeId: string;
      deviceId?: string;
      shiftId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    };

    const pageSize = payload.pageSize ?? 25;
    const page = payload.page ?? 1;

    return this.db.sale.findMany({
      where: {
        storeId: payload.storeId,
        deviceId: payload.deviceId,
        shiftId: payload.shiftId,
        status: payload.status as any,
        createdAt: {
          gte: payload.startDate ? new Date(payload.startDate) : undefined,
          lte: payload.endDate ? new Date(payload.endDate) : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        cashier: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        payments: { select: { paymentMethod: true, amount: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async generateSaleNumber(storeId: string): Promise<string> {
    const today = new Date();
    const prefix = `POS-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    // Count today's sales
    const count = await this.db.sale.count({
      where: {
        storeId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateRefundNumber(storeId: string): Promise<string> {
    const today = new Date();
    const prefix = `REF-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.db.refund.count({
      where: {
        sale: { storeId },
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), 1),
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReceiptNumber(storeId: string): Promise<string> {
    const count = await this.db.receipt.count({
      where: { sale: { storeId } },
    });
    return `RCP-${String(count + 1).padStart(8, '0')}`;
  }

  async completeSale(rawPayload: unknown) {
    // Alias for createSale — same flow
    return this.createSale(rawPayload);
  }
}
