// NexusPOS — Receipt Builder
// Converts sale data into formatted printer lines
// Supports both thermal (ESC/POS) and digital receipts

import type { ISale, ISaleLine, IPayment, ITaxBreakdownItem } from '../../../shared/src/types';
import type { PrinterLine } from '../hardware/HardwareManager';
import { formatCents, formatRatePercentage } from '../../../shared/src/utils/vatEngine';

export interface ReceiptConfig {
  storeName: string;
  storeAddress?: string;
  storeCity?: string;
  storePostalCode?: string;
  storeTaxId?: string;
  storePhone?: string;
  storeEmail?: string;
  storeWebsite?: string;
  headerText?: string;
  footerText?: string;
  showLogo: boolean;
  showQrCode: boolean;
  showBarcode: boolean;
  paperWidth: 58 | 80;
  locale: string;
  currency: string;
  timezone: string;
}

export interface ReceiptData {
  sale: {
    id: string;
    saleNumber: string;
    createdAt: Date;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeAmount: number;
    lines: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxRate: number;
      lineTotal: number;
    }>;
    payments: Array<{
      paymentMethod: string;
      amount: number;
      tendered?: number;
      change?: number;
    }>;
    taxBreakdown: ITaxBreakdownItem[];
  };
  cashier: {
    firstName: string;
    lastName: string;
  };
  customer?: {
    firstName: string;
    lastName?: string;
  };
  receiptNumber: string;
  fiscalSignature?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Bargeld',
  CARD_CREDIT: 'Kreditkarte',
  CARD_DEBIT: 'EC-Karte',
  CONTACTLESS: 'Kontaktlos',
  VOUCHER: 'Gutschein',
  GIFT_CARD: 'Geschenkkarte',
  BANK_TRANSFER: 'Überweisung',
  ACCOUNT: 'Kundenkonto',
};

export class ReceiptBuilder {
  private readonly lineWidth: number;
  private readonly config: ReceiptConfig;
  private lines: PrinterLine[] = [];

  constructor(config: ReceiptConfig) {
    this.config = config;
    this.lineWidth = config.paperWidth === 58 ? 32 : 48;
  }

  // ============================================================
  // BUILD COMPLETE RECEIPT
  // ============================================================
  buildReceipt(data: ReceiptData): PrinterLine[] {
    this.lines = [];

    this.addHeader();
    this.addSeparator();
    this.addReceiptInfo(data);
    this.addSeparator();
    this.addLineItems(data.sale.lines);
    this.addSeparator();
    this.addTotals(data.sale);
    this.addSeparator();
    this.addPayments(data.sale.payments);
    this.addSeparator();
    this.addTaxBreakdown(data.sale.taxBreakdown);

    if (data.fiscalSignature) {
      this.addSeparator();
      this.addFiscalInfo(data.fiscalSignature, data.receiptNumber);
    }

    this.addSeparator();
    this.addFooter();
    this.addBlankLines(3);

    return [...this.lines];
  }

  // ============================================================
  // HEADER
  // ============================================================
  private addHeader(): void {
    this.addLine({ text: this.config.storeName, align: 'center', bold: true, fontSize: 'double_size' });
    this.addBlankLine();

    if (this.config.storeAddress) {
      this.addLine({ text: this.config.storeAddress, align: 'center' });
    }

    if (this.config.storePostalCode || this.config.storeCity) {
      this.addLine({
        text: `${this.config.storePostalCode ?? ''} ${this.config.storeCity ?? ''}`.trim(),
        align: 'center',
      });
    }

    if (this.config.storeTaxId) {
      this.addLine({ text: `St.-Nr.: ${this.config.storeTaxId}`, align: 'center' });
    }

    if (this.config.storePhone) {
      this.addLine({ text: `Tel: ${this.config.storePhone}`, align: 'center' });
    }

    if (this.config.headerText) {
      this.addBlankLine();
      this.addLine({ text: this.config.headerText, align: 'center' });
    }
  }

  // ============================================================
  // RECEIPT INFO
  // ============================================================
  private addReceiptInfo(data: ReceiptData): void {
    const date = new Date(data.sale.createdAt);
    const dateStr = date.toLocaleDateString(this.config.locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: this.config.timezone,
    });
    const timeStr = date.toLocaleTimeString(this.config.locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: this.config.timezone,
    });

    this.addLine({ text: 'KASSENBON', align: 'center', bold: true });
    this.addBlankLine();
    this.addTwoColumn('Datum:', dateStr);
    this.addTwoColumn('Uhrzeit:', timeStr);
    this.addTwoColumn('Bon-Nr.:', data.receiptNumber);
    this.addTwoColumn('Vorgang:', data.sale.saleNumber);
    this.addTwoColumn('Kassierer:', `${data.cashier.firstName} ${data.cashier.lastName}`);

    if (data.customer) {
      this.addTwoColumn('Kunde:', `${data.customer.firstName} ${data.customer.lastName ?? ''}`);
    }
  }

  // ============================================================
  // LINE ITEMS
  // ============================================================
  private addLineItems(lines: ReceiptData['sale']['lines']): void {
    this.addLine({ text: 'Artikel', bold: true });
    this.addBlankLine();

    for (const line of lines) {
      const qty = line.quantity / 1000;
      const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(3);
      const priceStr = this.formatMoney(line.unitPrice);
      const totalStr = this.formatMoney(line.lineTotal);

      // Product name (possibly truncated)
      const maxNameLen = this.lineWidth - 12;
      const name = line.productName.length > maxNameLen
        ? line.productName.substring(0, maxNameLen - 1) + '…'
        : line.productName;

      this.addLine({ text: name });

      // Quantity × price = total
      const qtyLine = `  ${qtyStr} × ${priceStr}`;
      const taxLabel = line.taxRate > 0 ? ` (${line.taxRate / 100}%)` : '';
      const rightPart = `${totalStr}${taxLabel}`;
      const spaces = Math.max(1, this.lineWidth - qtyLine.length - rightPart.length);
      this.addLine({ text: `${qtyLine}${' '.repeat(spaces)}${rightPart}` });

      // Show discount if applied
      if (line.discountAmount > 0) {
        const discountStr = `-${this.formatMoney(line.discountAmount)}`;
        this.addTwoColumn('  Rabatt:', discountStr);
      }
    }
  }

  // ============================================================
  // TOTALS
  // ============================================================
  private addTotals(sale: ReceiptData['sale']): void {
    if (sale.discountAmount > 0) {
      this.addTwoColumn('Zwischensumme:', this.formatMoney(sale.subtotal));
      this.addTwoColumn('Rabatt:', `-${this.formatMoney(sale.discountAmount)}`);
      this.addSeparator('·');
    }

    this.addTwoColumn(
      'GESAMT:',
      this.formatMoney(sale.totalAmount),
      true,
      'double_size'
    );
  }

  // ============================================================
  // PAYMENTS
  // ============================================================
  private addPayments(payments: ReceiptData['sale']['payments']): void {
    this.addLine({ text: 'Bezahlung', bold: true });
    this.addBlankLine();

    for (const payment of payments) {
      const methodLabel = PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod;
      this.addTwoColumn(methodLabel + ':', this.formatMoney(payment.amount));

      if (payment.paymentMethod === 'CASH' && payment.tendered) {
        this.addTwoColumn('  Gegeben:', this.formatMoney(payment.tendered));
        this.addTwoColumn('  Rückgeld:', this.formatMoney(payment.change ?? 0));
      }
    }
  }

  // ============================================================
  // VAT BREAKDOWN (Required for German receipts)
  // ============================================================
  private addTaxBreakdown(breakdown: ITaxBreakdownItem[]): void {
    this.addLine({ text: 'MwSt.-Ausweis', bold: true });
    this.addBlankLine();

    // Header row
    const header = this.padRight('MwSt-Satz', 12)
      + this.padLeft('Netto', 10)
      + this.padLeft('MwSt', 10)
      + this.padLeft('Brutto', 10);
    this.addLine({ text: header });
    this.addSeparator('·');

    for (const item of breakdown) {
      const rateStr = item.taxRate === 0 ? '0%' : `${(item.taxRate / 100).toFixed(0)}%`;
      const row = this.padRight(rateStr, 12)
        + this.padLeft(this.formatMoney(item.netAmount), 10)
        + this.padLeft(this.formatMoney(item.taxAmount), 10)
        + this.padLeft(this.formatMoney(item.grossAmount), 10);
      this.addLine({ text: row });
    }

    // Totals row
    const totals = breakdown.reduce(
      (acc, b) => ({
        net: acc.net + b.netAmount,
        tax: acc.tax + b.taxAmount,
        gross: acc.gross + b.grossAmount,
      }),
      { net: 0, tax: 0, gross: 0 }
    );

    this.addSeparator('·');
    const totalRow = this.padRight('Gesamt', 12)
      + this.padLeft(this.formatMoney(totals.net), 10)
      + this.padLeft(this.formatMoney(totals.tax), 10)
      + this.padLeft(this.formatMoney(totals.gross), 10);
    this.addLine({ text: totalRow, bold: true });
  }

  // ============================================================
  // FISCAL INFO (TSE / KassenSichV)
  // ============================================================
  private addFiscalInfo(signature: string, receiptNumber: string): void {
    this.addLine({ text: 'Fiskal-Information', align: 'center', bold: true });
    this.addBlankLine();
    this.addLine({ text: 'TSE-Signatur:', align: 'center' });

    // Wrap long signature across multiple lines
    const maxLen = this.lineWidth;
    for (let i = 0; i < signature.length; i += maxLen) {
      this.addLine({ text: signature.substring(i, i + maxLen), align: 'center', fontSize: 'normal' });
    }
  }

  // ============================================================
  // FOOTER
  // ============================================================
  private addFooter(): void {
    if (this.config.footerText) {
      this.addLine({ text: this.config.footerText, align: 'center' });
    } else {
      this.addLine({ text: 'Vielen Dank für Ihren Einkauf!', align: 'center', bold: true });
    }

    if (this.config.storeWebsite) {
      this.addBlankLine();
      this.addLine({ text: this.config.storeWebsite, align: 'center' });
    }

    this.addBlankLine();
    this.addLine({ text: 'Powered by NexusPOS', align: 'center' });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private addLine(line: PrinterLine): void {
    this.lines.push(line);
  }

  private addBlankLine(): void {
    this.lines.push({ text: '' });
  }

  private addBlankLines(count: number): void {
    for (let i = 0; i < count; i++) this.addBlankLine();
  }

  private addSeparator(char = '-'): void {
    this.lines.push({ text: char.repeat(this.lineWidth) });
  }

  private addTwoColumn(
    left: string,
    right: string,
    bold = false,
    fontSize: PrinterLine['fontSize'] = 'normal'
  ): void {
    const spaces = Math.max(1, this.lineWidth - left.length - right.length);
    this.lines.push({
      text: `${left}${' '.repeat(spaces)}${right}`,
      bold,
      fontSize,
    });
  }

  private formatMoney(cents: number): string {
    return formatCents(cents, this.config.locale, this.config.currency);
  }

  private padLeft(str: string, width: number): string {
    return str.padStart(width);
  }

  private padRight(str: string, width: number): string {
    return str.padEnd(width);
  }
}
