// NexusPOS — Report IPC Handler

import { PrismaClient } from '@prisma/client';
import type { DatabaseManager } from '../../database/DatabaseManager';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('ReportService');

export class ReportService {
  private readonly db: PrismaClient;

  constructor(private readonly dbManager: DatabaseManager) {
    this.db = dbManager.client;
  }

  async getDailyReport(rawPayload: unknown) {
    const { storeId, startDate, endDate } = rawPayload as {
      storeId: string;
      startDate: string;
      endDate: string;
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [sales, refunds] = await Promise.all([
      this.db.sale.findMany({
        where: { storeId, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
        include: { payments: true, taxBreakdown: true },
      }),
      this.db.refund.findMany({
        where: { sale: { storeId }, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      }),
    ]);

    // Correct Sale model fields: totalAmount, taxAmount, discountAmount (not totalGross/totalNet/totalDiscount)
    const totalSales      = sales.reduce((s, r) => s + r.totalAmount, 0);
    const totalRefunds    = refunds.reduce((s, r) => s + r.amount, 0);
    const totalTax        = sales.reduce((s, r) => s + r.taxAmount, 0);
    const totalDiscounts  = sales.reduce((s, r) => s + r.discountAmount, 0);

    const cashSales = sales.reduce(
      (s, r) => s + r.payments.filter(p => p.paymentMethod === 'CASH').reduce((a, p) => a + p.amount, 0),
      0
    );
    const cardSales = totalSales - cashSales;

    return {
      period: { start, end },
      totalSales,
      totalRefunds,
      netSales: totalSales - totalRefunds,
      totalTax,
      totalDiscounts,
      cashSales,
      cardSales,
      transactionCount: sales.length,
      avgTransactionValue: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
    };
  }

  async getSalesReport(rawPayload: unknown) {
    const { storeId, startDate, endDate } = rawPayload as {
      storeId: string;
      startDate: string;
      endDate: string;
    };

    const start = new Date(startDate);
    const end   = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.db.sale.findMany({
      where: {
        storeId,
        createdAt: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      include: {
        lines: { include: { product: true } },
        payments: true,
        cashier: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShiftReport(rawPayload: unknown) {
    const { shiftId } = rawPayload as { shiftId: string };

    const shift = await this.db.shift.findUnique({
      where: { id: shiftId },
      include: {
        shiftSummary: true,
        cashMovements: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!shift) throw new Error('Shift not found');
    return shift;
  }

  async getProductsReport(rawPayload: unknown) {
    const { storeId, startDate, endDate, limit = 20 } = rawPayload as {
      storeId: string;
      startDate: string;
      endDate: string;
      limit?: number;
    };

    return this.db.saleLine.groupBy({
      by: ['productId', 'productName'],
      where: {
        sale: {
          storeId,
          createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
          status: 'COMPLETED',
        },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: { id: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });
  }

  async getCustomersReport(rawPayload: unknown) {
    const { storeId, startDate, endDate } = rawPayload as {
      storeId: string;
      startDate: string;
      endDate: string;
    };

    return this.db.sale.groupBy({
      by: ['customerId'],
      where: {
        storeId,
        customerId: { not: null },
        createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
        status: 'COMPLETED',
      },
      _sum: { totalAmount: true }, // correct field: totalAmount
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 20,
    });
  }
}
