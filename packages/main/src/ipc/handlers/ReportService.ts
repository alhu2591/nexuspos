// NexusPOS — Report IPC Handler

import type { DatabaseManager } from '../../database/DatabaseManager';
import { AppLogger } from '../../utils/AppLogger';

const logger = new AppLogger('ReportService');

export class ReportService {
  constructor(private db: DatabaseManager) {}

  async getDailyReport(payload: { date: string; storeId: string }) {
    const start = new Date(payload.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(payload.date);
    end.setHours(23, 59, 59, 999);

    const sales = await this.db.client.sale.findMany({
      where: { storeId: payload.storeId, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      include: { lines: true, payments: true },
    });

    const totalGross = sales.reduce((s, sale) => s + sale.totalGross, 0);
    const totalTax = sales.reduce((s, sale) => s + sale.totalTax, 0);
    const totalNet = sales.reduce((s, sale) => s + sale.totalNet, 0);
    const totalDiscount = sales.reduce((s, sale) => s + sale.totalDiscount, 0);
    const saleCount = sales.length;

    return { date: payload.date, saleCount, totalGross, totalTax, totalNet, totalDiscount };
  }

  async getSalesReport(payload: { startDate: string; endDate: string; storeId: string }) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await this.db.client.sale.findMany({
      where: {
        storeId: payload.storeId,
        createdAt: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      include: { lines: { include: { product: true } }, payments: true },
      orderBy: { createdAt: 'desc' },
    });

    return sales;
  }

  async getShiftReport(payload: { shiftId: string }) {
    const shift = await this.db.client.shift.findUnique({
      where: { id: payload.shiftId },
      include: {
        summary: true,
        cashMovements: true,
        sales: { include: { payments: true } },
      },
    });
    if (!shift) throw new Error('Shift not found');
    return shift;
  }

  async getProductsReport(payload: { startDate: string; endDate: string; storeId: string; limit?: number }) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    end.setHours(23, 59, 59, 999);

    const lines = await this.db.client.saleLine.findMany({
      where: {
        sale: { storeId: payload.storeId, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      },
      include: { product: true },
    });

    const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const line of lines) {
      const key = line.productId;
      const existing = byProduct.get(key) ?? { name: line.product.name, quantity: 0, revenue: 0 };
      byProduct.set(key, {
        name: existing.name,
        quantity: existing.quantity + line.quantity,
        revenue: existing.revenue + line.lineTotal,
      });
    }

    return Array.from(byProduct.entries())
      .map(([id, data]) => ({ productId: id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, payload.limit ?? 50);
  }

  async getCustomersReport(payload: { startDate: string; endDate: string; storeId: string }) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    end.setHours(23, 59, 59, 999);

    const customers = await this.db.client.customer.findMany({
      where: { storeId: payload.storeId, isActive: true },
      include: {
        sales: {
          where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
        },
      },
      orderBy: { totalSpend: 'desc' },
      take: 50,
    });

    return customers.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName ?? ''}`.trim(),
      saleCount: c.sales.length,
      totalSpend: c.totalSpend,
    }));
  }
}
