// NexusPOS — Fiscal Event Bus
// GoBD / KassenSichV compliant fiscal event logging
// Provider-agnostic TSE adapter interface

import { EventEmitter } from 'node:events';
import type { DatabaseManager } from '../database/DatabaseManager';
import { AppLogger } from '../utils/AppLogger';
import { createId } from '@paralleldrive/cuid2';

const logger = new AppLogger('FiscalBus');

// ============================================================
// TSE ADAPTER INTERFACE
// Provider-agnostic — implementations for Swissbit, CryptoVision, etc.
// ============================================================

export interface TSEAdapter {
  readonly provider: string;
  isAvailable(): Promise<boolean>;
  startTransaction(data: TSETransactionData): Promise<TSETransactionResult>;
  finishTransaction(transactionId: number, data: TSETransactionData): Promise<TSESignatureResult>;
  cancelTransaction(transactionId: number): Promise<void>;
  getSignatureCounter(): Promise<number>;
  exportData(from: Date, to: Date): Promise<Buffer>;
}

export interface TSETransactionData {
  processType: string;  // e.g., "Kassenbeleg-V1"
  processData: string;  // Encoded payload
  clientId: string;     // Device/terminal ID
}

export interface TSETransactionResult {
  transactionNumber: number;
  logTime: Date;
  serialNumber: string;
}

export interface TSESignatureResult {
  transactionNumber: number;
  signature: string;
  signatureCounter: number;
  logTime: Date;
  serialNumber: string;
}

// ============================================================
// MOCK TSE ADAPTER (Development / Testing)
// ============================================================

export class MockTSEAdapter implements TSEAdapter {
  readonly provider = 'mock';
  private transactionCounter = 0;
  private signatureCounter = 0;

  async isAvailable(): Promise<boolean> { return true; }

  async startTransaction(data: TSETransactionData): Promise<TSETransactionResult> {
    this.transactionCounter++;
    return {
      transactionNumber: this.transactionCounter,
      logTime: new Date(),
      serialNumber: 'MOCK-TSE-0000001',
    };
  }

  async finishTransaction(transactionId: number, data: TSETransactionData): Promise<TSESignatureResult> {
    this.signatureCounter++;
    // Simulate TSE signature (not a real signature)
    const fakeSignature = Buffer.from(
      `MOCK:${transactionId}:${Date.now()}:${data.processData.slice(0, 32)}`
    ).toString('base64');

    return {
      transactionNumber: transactionId,
      signature: fakeSignature,
      signatureCounter: this.signatureCounter,
      logTime: new Date(),
      serialNumber: 'MOCK-TSE-0000001',
    };
  }

  async cancelTransaction(transactionId: number): Promise<void> {}
  async getSignatureCounter(): Promise<number> { return this.signatureCounter; }
  async exportData(_from: Date, _to: Date): Promise<Buffer> { return Buffer.alloc(0); }
}

// ============================================================
// FISCAL EVENT PAYLOAD BUILDERS
// ============================================================

interface SalePayloadData {
  saleNumber: string;
  cashierId: string;
  totalAmount: number;
  taxBreakdown: Array<{ rate: number; net: number; tax: number }>;
  paymentMethods: Array<{ method: string; amount: number }>;
}

function buildKassenbelV1Payload(data: SalePayloadData): string {
  // Kassenbeleg-V1 format as per BSI TR-03153
  const payments = data.paymentMethods
    .map(p => `${p.method}:${(p.amount / 100).toFixed(2)}`)
    .join(';');

  const taxes = data.taxBreakdown
    .map(t => `${(t.rate / 100).toFixed(2)}%_${(t.net / 100).toFixed(2)}_${(t.tax / 100).toFixed(2)}`)
    .join(';');

  return [
    `Kassenbeleg-V1`,
    `Beleg^${(data.totalAmount / 100).toFixed(2)}^${taxes}`,
    payments,
    data.saleNumber,
  ].join('\n');
}

// ============================================================
// FISCAL EVENT BUS
// ============================================================

export class FiscalEventBus extends EventEmitter {
  private tseAdapter: TSEAdapter;
  private isConfigured = false;

  constructor(private readonly dbManager: DatabaseManager) {
    super();
    // Default to mock adapter
    this.tseAdapter = new MockTSEAdapter();
  }

  async initialize(): Promise<void> {
    // Check if TSE is configured in device settings
    const deviceConfig = await this.dbManager.getDeviceConfig();
    const tseProvider = deviceConfig?.paymentTerminalType;

    if (tseProvider === 'mock' || !tseProvider) {
      this.tseAdapter = new MockTSEAdapter();
      this.isConfigured = true;
      logger.info('Fiscal event bus initialized with Mock TSE');
    } else {
      // Real TSE providers would be loaded here
      logger.warn(`TSE provider "${tseProvider}" not yet implemented — using mock`);
      this.tseAdapter = new MockTSEAdapter();
      this.isConfigured = true;
    }
  }

  // ── SALE COMPLETED ─────────────────────────────────────
  async onSaleCompleted(sale: {
    id: string;
    saleNumber: string;
    cashierId: string;
    totalAmount: number;
    taxBreakdown?: Array<{ taxRate: number; netAmount: number; taxAmount: number }>;
    payments?: Array<{ paymentMethod: string; amount: number }>;
    deviceId: string;
  }): Promise<void> {
    if (!this.isConfigured) return;

    const processData = buildKassenbelV1Payload({
      saleNumber: sale.saleNumber,
      cashierId: sale.cashierId,
      totalAmount: sale.totalAmount,
      taxBreakdown: (sale.taxBreakdown ?? []).map(t => ({
        rate: t.taxRate,
        net: t.netAmount,
        tax: t.taxAmount,
      })),
      paymentMethods: (sale.payments ?? []).map(p => ({
        method: p.paymentMethod,
        amount: p.amount,
      })),
    });

    try {
      // Log start event
      await this.logFiscalEvent(sale.id, 'StartTransaction', processData, null);

      // TSE: Start transaction
      const startResult = await this.tseAdapter.startTransaction({
        processType: 'Kassenbeleg-V1',
        processData,
        clientId: sale.deviceId,
      });

      // TSE: Finish transaction
      const finishResult = await this.tseAdapter.finishTransaction(
        startResult.transactionNumber,
        { processType: 'Kassenbeleg-V1', processData, clientId: sale.deviceId }
      );

      // Log finish event with signature
      await this.logFiscalEvent(
        sale.id,
        'FinishTransaction',
        processData,
        finishResult,
        startResult.transactionNumber
      );

      // Update sale with fiscal receipt ID
      await this.dbManager.client.sale.update({
        where: { id: sale.id },
        data: {
          fiscalReceiptId: `${finishResult.serialNumber}:${finishResult.transactionNumber}:${finishResult.signatureCounter}`,
        },
      });

      logger.info(`Fiscal event logged for sale ${sale.saleNumber}`);
    } catch (err) {
      logger.error('Fiscal event failed — logging error', err);

      // Even on TSE failure, log the error for audit
      await this.dbManager.client.fiscalEvent.create({
        data: {
          id: createId(),
          saleId: sale.id,
          eventType: 'FinishTransaction',
          processType: 'Kassenbeleg-V1',
          payload: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          tseProvider: this.tseAdapter.provider,
          isVerified: false,
          errorCode: 'TSE_FAILURE',
          logTime: new Date(),
        },
      });

      // In production: must alert operator of TSE failure
      this.emit('tse-error', { saleId: sale.id, error: err });
    }
  }

  // ── SALE VOIDED ────────────────────────────────────────
  async onSaleVoided(saleId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const sale = await this.dbManager.client.sale.findUnique({
        where: { id: saleId },
      });
      if (!sale) return;

      await this.logFiscalEvent(saleId, 'CancelTransaction', `Storno:${sale.saleNumber}`, null);
      logger.info(`Fiscal void logged for sale ${sale.saleNumber}`);
    } catch (err) {
      logger.error('Fiscal void event failed', err);
    }
  }

  // ── REFUND CREATED ─────────────────────────────────────
  async onRefundCreated(refund: {
    id: string;
    saleId: string;
    amount: number;
    refundNumber: string;
  }): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const processData = `Storno-Kassenbeleg-V1\n${(refund.amount / 100).toFixed(2)}\n${refund.refundNumber}`;
      await this.logFiscalEvent(refund.saleId, 'FinishTransaction', processData, null);
      logger.info(`Fiscal refund logged: ${refund.refundNumber}`);
    } catch (err) {
      logger.error('Fiscal refund event failed', err);
    }
  }

  // ── INTERNAL ───────────────────────────────────────────
  private async logFiscalEvent(
    saleId: string,
    eventType: string,
    processData: string,
    signatureResult: TSESignatureResult | null,
    transactionNumber?: number
  ): Promise<void> {
    await this.dbManager.client.fiscalEvent.create({
      data: {
        id: createId(),
        saleId,
        eventType,
        processType: 'Kassenbeleg-V1',
        transactionNumber: signatureResult?.transactionNumber ?? transactionNumber,
        signature: signatureResult?.signature,
        signatureCounter: signatureResult?.signatureCounter,
        serialNumber: signatureResult?.serialNumber,
        logTime: signatureResult?.logTime ?? new Date(),
        payload: processData,
        tseProvider: this.tseAdapter.provider,
        isVerified: !!signatureResult,
      },
    });
  }
}
