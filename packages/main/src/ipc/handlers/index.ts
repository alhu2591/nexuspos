// NexusPOS — Shift Service
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { OpenShiftSchema, CloseShiftSchema, CashMovementSchema } from '@nexuspos/shared';
import { AppError } from '../../utils/AppError';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('ShiftService');

export class ShiftService {
  private readonly db: PrismaClient;
  constructor(private readonly dbManager: DatabaseManager) { this.db = dbManager.client; }

  async openShift(rawPayload: unknown) {
    const payload = OpenShiftSchema.parse(rawPayload);

    const existing = await this.db.shift.findFirst({
      where: { deviceId: payload.deviceId, status: 'OPEN' },
    });
    if (existing) throw new AppError('SHIFT_ALREADY_OPEN', 'A shift is already open on this device', false);

    const count = await this.db.shift.count({ where: { storeId: payload.storeId } });
    const shiftNumber = `SHIFT-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(count+1).padStart(4,'0')}`;

    const shift = await this.db.shift.create({
      data: {
        id: createId(), storeId: payload.storeId, branchId: payload.branchId,
        deviceId: payload.deviceId, userId: payload.userId,
        shiftNumber, status: 'OPEN', openingBalance: payload.openingBalance,
      },
    });

    await this.db.cashMovement.create({
      data: {
        id: createId(), shiftId: shift.id, deviceId: payload.deviceId,
        userId: payload.userId, movementType: 'OPENING', amount: payload.openingBalance,
        reason: 'Kassenöffnung',
      },
    });

    logger.info(`Shift opened: ${shiftNumber}`);
    return shift;
  }

  async closeShift(rawPayload: unknown) {
    const payload = CloseShiftSchema.parse(rawPayload);

    const shift = await this.db.shift.findUnique({ where: { id: payload.shiftId } });
    if (!shift) throw new AppError('SHIFT_NOT_FOUND', 'Shift not found', false);
    if (shift.status !== 'OPEN') throw new AppError('SHIFT_NOT_OPEN', 'Shift is not open', false);

    // Calculate expected balance
    const cashMovements = await this.db.cashMovement.aggregate({
      where: { shiftId: payload.shiftId },
      _sum: { amount: true },
    });
    const expectedBalance = cashMovements._sum.amount ?? 0;
    const variance = payload.closingBalance - expectedBalance;

    const summary = await this.buildShiftSummary(payload.shiftId);

    const closed = await this.db.$transaction(async tx => {
      const updated = await tx.shift.update({
        where: { id: payload.shiftId },
        data: {
          status: 'CLOSED', closedAt: new Date(),
          closingBalance: payload.closingBalance,
          expectedBalance, variance, notes: payload.notes,
        },
      });

      await tx.shiftSummary.create({ data: { id: createId(), shiftId: payload.shiftId, ...summary } });

      await tx.cashMovement.create({
        data: {
          id: createId(), shiftId: payload.shiftId, deviceId: shift.deviceId,
          movementType: 'CLOSING', amount: payload.closingBalance, reason: 'Kassenschluss',
        },
      });

      return updated;
    });

    logger.info(`Shift closed: ${shift.shiftNumber}, variance: ${variance}`);
    return { shift: closed, summary };
  }

  async getCurrentShift(rawPayload: unknown) {
    const { deviceId } = rawPayload as { deviceId: string };
    return this.db.shift.findFirst({
      where: { deviceId, status: 'OPEN' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async cashIn(rawPayload: unknown) {
    const payload = CashMovementSchema.parse(rawPayload);
    return this.db.cashMovement.create({
      data: {
        id: createId(), shiftId: payload.shiftId, deviceId: payload.deviceId,
        userId: payload.userId, movementType: 'CASH_IN',
        amount: payload.amount, reason: payload.reason,
      },
    });
  }

  async cashOut(rawPayload: unknown) {
    const payload = CashMovementSchema.parse(rawPayload);
    return this.db.cashMovement.create({
      data: {
        id: createId(), shiftId: payload.shiftId, deviceId: payload.deviceId,
        userId: payload.userId, movementType: 'CASH_OUT',
        amount: payload.amount, reason: payload.reason,
      },
    });
  }

  private async buildShiftSummary(shiftId: string) {
    const sales = await this.db.sale.findMany({
      where: { shiftId, status: 'COMPLETED' },
      include: { payments: true, lines: true },
    });

    const totalSales = sales.reduce((s, sale) => s + sale.totalAmount, 0);
    const totalTax = sales.reduce((s, sale) => s + sale.taxAmount, 0);
    const totalDiscounts = sales.reduce((s, sale) => s + sale.discountAmount, 0);
    const cashSales = sales.reduce((s, sale) =>
      s + sale.payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + p.amount, 0), 0);
    const cardSales = totalSales - cashSales;
    const itemCount = sales.reduce((s, sale) => s + sale.lines.length, 0);

    const refunds = await this.db.refund.findMany({ where: { sale: { shiftId } } });
    const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);

    return {
      totalSales, totalRefunds, totalDiscounts, totalTax,
      cashSales, cardSales, otherSales: 0,
      transactionCount: sales.length, itemCount,
      avgTransaction: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
      newCustomers: 0, returningCustomers: 0,
    };
  }
}

// ── CUSTOMER SERVICE ────────────────────────────────────────

export class CustomerService {
  private readonly db: PrismaClient;
  constructor(private readonly dbManager: DatabaseManager) { this.db = dbManager.client; }

  async searchCustomers(rawPayload: unknown) {
    const { query, storeId, limit = 10 } = rawPayload as any;
    return this.db.customer.findMany({
      where: {
        storeId, isActive: true,
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { customerNum: { contains: query } },
        ],
      },
      take: limit,
      orderBy: { lastName: 'asc' },
    });
  }

  async findCustomer(rawPayload: unknown) {
    const { customerId } = rawPayload as { customerId: string };
    return this.db.customer.findUnique({ where: { id: customerId } });
  }

  async createCustomer(rawPayload: unknown) {
    const { CreateCustomerSchema } = await import('@nexuspos/shared');
    const payload = CreateCustomerSchema.parse(rawPayload);
    const count = await this.db.customer.count({ where: { storeId: payload.storeId } });
    return this.db.customer.create({
      data: {
        id: createId(),
        customerNum: `KD-${String(count + 1).padStart(6, '0')}`,
        ...payload,
      },
    });
  }

  async updateCustomer(rawPayload: unknown) {
    const { id, ...data } = rawPayload as any;
    return this.db.customer.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }
}

// ── INVENTORY SERVICE ────────────────────────────────────────

export class InventoryService {
  private readonly db: PrismaClient;
  constructor(private readonly dbManager: DatabaseManager) { this.db = dbManager.client; }

  async getInventory(rawPayload: unknown) {
    const { productId } = rawPayload as { productId: string };
    return this.db.inventoryItem.findUnique({ where: { productId } });
  }

  async adjustInventory(rawPayload: unknown) {
    const { AdjustInventorySchema } = await import('@nexuspos/shared');
    const payload = AdjustInventorySchema.parse(rawPayload);

    const current = await this.db.inventoryItem.findUnique({ where: { productId: payload.productId } });
    const prevQty = current?.quantity ?? 0;
    const newQty = prevQty + payload.quantity;

    const [updated] = await this.db.$transaction([
      this.db.inventoryItem.upsert({
        where: { productId: payload.productId },
        update: { quantity: newQty, updatedAt: new Date() },
        create: { id: createId(), productId: payload.productId, quantity: newQty, reservedQty: 0 },
      }),
      this.db.stockMovement.create({
        data: {
          id: createId(), productId: payload.productId,
          movementType: payload.movementType, quantity: payload.quantity,
          previousQty: prevQty, newQty, reason: payload.reason,
        },
      }),
    ]);

    return updated;
  }

  async getMovements(rawPayload: unknown) {
    const { productId, limit = 50 } = rawPayload as any;
    return this.db.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// ── REPORT SERVICE ────────────────────────────────────────────

export class ReportService {
  private readonly db: PrismaClient;
  constructor(private readonly dbManager: DatabaseManager) { this.db = dbManager.client; }

  async getDailyReport(rawPayload: unknown) {
    const { storeId, startDate, endDate } = rawPayload as any;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [sales, refunds] = await Promise.all([
      this.db.sale.findMany({
        where: { storeId, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
        include: { payments: true, taxBreakdown: true },
      }),
      this.db.refund.findMany({
        where: { sale: { storeId }, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
    ]);

    const totalSales = sales.reduce((s, r) => s + r.totalAmount, 0);
    const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);
    const totalTax = sales.reduce((s, r) => s + r.taxAmount, 0);
    const totalDiscounts = sales.reduce((s, r) => s + r.discountAmount, 0);
    const cashSales = sales.reduce((s, r) =>
      s + r.payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + p.amount, 0), 0);
    const cardSales = totalSales - cashSales;

    return {
      period: { start, end },
      totalSales, totalRefunds, netSales: totalSales - totalRefunds,
      totalTax, totalDiscounts, cashSales, cardSales,
      transactionCount: sales.length,
      avgTransactionValue: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
    };
  }

  async getShiftReport(rawPayload: unknown) {
    const { shiftId } = rawPayload as { shiftId: string };
    const shift = await this.db.shift.findUnique({
      where: { id: shiftId },
      include: { shiftSummary: true, user: { select: { firstName: true, lastName: true } } },
    });
    return shift;
  }

  async getSalesReport(rawPayload: unknown) {
    return this.getDailyReport(rawPayload);
  }

  async getProductsReport(rawPayload: unknown) {
    const { storeId, startDate, endDate, limit = 20 } = rawPayload as any;
    return this.db.saleLine.groupBy({
      by: ['productId', 'productName'],
      where: { sale: { storeId, createdAt: { gte: new Date(startDate), lte: new Date(endDate) }, status: 'COMPLETED' } },
      _sum: { quantity: true, lineTotal: true },
      _count: { id: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });
  }

  async getCustomersReport(rawPayload: unknown) {
    const { storeId, startDate, endDate } = rawPayload as any;
    return this.db.sale.groupBy({
      by: ['customerId'],
      where: { storeId, customerId: { not: null }, createdAt: { gte: new Date(startDate), lte: new Date(endDate) }, status: 'COMPLETED' },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 20,
    });
  }
}

// ── SETTINGS SERVICE ──────────────────────────────────────────

export class SettingsService {
  private readonly db: PrismaClient;
  constructor(private readonly dbManager: DatabaseManager) { this.db = dbManager.client; }

  async getSetting(rawPayload: unknown) {
    const { key, storeId } = rawPayload as { key: string; storeId: string };
    return this.db.storeSetting.findUnique({ where: { storeId_key: { storeId, key } } });
  }

  async setSetting(rawPayload: unknown) {
    const { SetSettingSchema } = await import('@nexuspos/shared');
    const payload = SetSettingSchema.parse(rawPayload);
    return this.db.storeSetting.upsert({
      where: { storeId_key: { storeId: payload.storeId, key: payload.key } },
      update: { value: payload.value, dataType: payload.dataType },
      create: { id: createId(), ...payload },
    });
  }

  async getDeviceConfig(rawPayload: unknown) {
    const { deviceId } = rawPayload as { deviceId: string };
    return this.db.deviceConfig.findUnique({ where: { deviceId } });
  }
}
