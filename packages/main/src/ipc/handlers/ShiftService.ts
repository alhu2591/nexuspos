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

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async openShift(rawPayload: unknown) {
    const payload = OpenShiftSchema.parse(rawPayload);

    const existing = await this.db.shift.findFirst({
      where: { deviceId: payload.deviceId, status: 'OPEN' },
    });
    if (existing) {
      throw new AppError('SHIFT_ALREADY_OPEN', 'A shift is already open on this device', false);
    }

    const count = await this.db.shift.count({ where: { storeId: payload.storeId } });
    const today = new Date();
    const shiftNumber = `SHIFT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

    const shift = await this.db.shift.create({
      data: {
        id: createId(),
        storeId: payload.storeId,
        branchId: payload.branchId,
        deviceId: payload.deviceId,
        userId: payload.userId,
        shiftNumber,
        status: 'OPEN',
        openingBalance: payload.openingBalance,
      },
    });

    await this.db.cashMovement.create({
      data: {
        id: createId(),
        shiftId: shift.id,
        deviceId: payload.deviceId,
        userId: payload.userId,
        movementType: 'OPENING',
        amount: payload.openingBalance,
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

    // Calculate expected balance from all cash movements
    const cashAgg = await this.db.cashMovement.aggregate({
      where: { shiftId: payload.shiftId },
      _sum: { amount: true },
    });
    const expectedBalance = cashAgg._sum.amount ?? 0;
    const variance = payload.closingBalance - expectedBalance;

    const summary = await this.buildShiftSummary(payload.shiftId);

    const closed = await this.db.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: payload.shiftId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingBalance: payload.closingBalance,
          expectedBalance,
          variance,
          notes: payload.notes,
        },
      });

      await tx.shiftSummary.create({
        data: {
          id: createId(),
          shiftId: payload.shiftId,
          ...summary,
        },
      });

      await tx.cashMovement.create({
        data: {
          id: createId(),
          shiftId: payload.shiftId,
          deviceId: shift.deviceId,
          movementType: 'CLOSING',
          amount: payload.closingBalance,
          reason: 'Kassenschluss',
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
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async cashIn(rawPayload: unknown) {
    const payload = CashMovementSchema.parse(rawPayload);

    return this.db.cashMovement.create({
      data: {
        id: createId(),
        shiftId: payload.shiftId,
        deviceId: payload.deviceId,
        userId: payload.userId,
        movementType: 'CASH_IN',
        amount: payload.amount,
        reason: payload.reason,
      },
    });
  }

  async cashOut(rawPayload: unknown) {
    const payload = CashMovementSchema.parse(rawPayload);

    return this.db.cashMovement.create({
      data: {
        id: createId(),
        shiftId: payload.shiftId,
        deviceId: payload.deviceId,
        userId: payload.userId,
        movementType: 'CASH_OUT',
        amount: payload.amount,
        reason: payload.reason,
      },
    });
  }

  private async buildShiftSummary(shiftId: string) {
    const sales = await this.db.sale.findMany({
      where: { shiftId, status: 'COMPLETED' },
      include: { payments: true, lines: true },
    });

    // Correct Sale model fields: totalAmount, taxAmount, discountAmount
    const totalSales     = sales.reduce((s, sale) => s + sale.totalAmount, 0);
    const totalTax       = sales.reduce((s, sale) => s + sale.taxAmount, 0);
    const totalDiscounts = sales.reduce((s, sale) => s + sale.discountAmount, 0);

    const cashSales = sales.reduce(
      (s, sale) => s + sale.payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + p.amount, 0),
      0
    );
    const cardSales  = totalSales - cashSales;
    const itemCount  = sales.reduce((s, sale) => s + sale.lines.length, 0);

    const refunds = await this.db.refund.findMany({ where: { sale: { shiftId } } });
    const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);

    return {
      totalSales,
      totalRefunds,
      totalDiscounts,
      totalTax,
      cashSales,
      cardSales,
      otherSales: 0,
      transactionCount: sales.length,
      itemCount,
      avgTransaction: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
      newCustomers: 0,
      returningCustomers: 0,
    };
  }
}
