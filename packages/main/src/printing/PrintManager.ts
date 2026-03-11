// NexusPOS — Print Manager

import type { HardwareManager } from '../hardware/HardwareManager';
import { ReceiptBuilder } from './ReceiptBuilder';
import { AppLogger } from '../utils/AppLogger';
import { createId } from '@paralleldrive/cuid2';

const logger = new AppLogger('PrintManager');

export class PrintManager {
  constructor(private readonly hw: HardwareManager) {}

  async initialize(): Promise<void> {
    logger.info('Print manager initialized');
  }

  async shutdown(): Promise<void> {}

  async printJob(payload: unknown): Promise<unknown> {
    const { saleId, printerId, type } = payload as { saleId: string; printerId: string; type: string };
    logger.info(`Print job: ${type} for sale ${saleId}`);
    const printer = this.hw.getReceiptPrinter();
    if (!printer) return { success: false, error: 'No printer available' };

    const builder = new ReceiptBuilder({
      storeName: 'NexusPOS Store',
      locale: 'de-DE',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      showLogo: false,
      showQrCode: false,
      showBarcode: false,
      paperWidth: 80,
    });

    // In real impl: load sale data and build full receipt
    const lines = builder.buildReceipt({
      sale: {
        id: saleId, saleNumber: 'TEST', createdAt: new Date(),
        subtotal: 1000, discountAmount: 0, taxAmount: 159, totalAmount: 1000,
        paidAmount: 1000, changeAmount: 0, lines: [], payments: [], taxBreakdown: [],
      },
      cashier: { firstName: 'Max', lastName: 'Mustermann' },
      receiptNumber: 'RCP-00000001',
    });

    return printer.printReceipt({
      jobId: createId(),
      lines,
      cutAfter: true,
      openDrawer: false,
    });
  }

  async testPrint(payload: unknown): Promise<unknown> {
    const printer = this.hw.getReceiptPrinter();
    if (!printer) return { success: false, error: 'No printer' };
    await printer.printTestPage();
    return { success: true };
  }
}
