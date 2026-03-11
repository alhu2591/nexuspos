// NexusPOS — Hardware Integration Layer
// Adapter pattern for all POS peripherals
// Pure interface definitions + concrete implementations

import { EventEmitter } from 'node:events';
import type { IHardwareStatus, IPrintJob, IPrintResult } from '../../../shared/src/types';
import { AppLogger } from '../utils/AppLogger';

const logger = new AppLogger('Hardware');

// ============================================================
// BASE HARDWARE ADAPTER INTERFACE
// ============================================================

export interface HardwareAdapter {
  readonly name: string;
  readonly type: HardwareAdapterType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): IHardwareStatus;
  test(): Promise<boolean>;
}

export type HardwareAdapterType =
  | 'receipt_printer'
  | 'invoice_printer'
  | 'label_printer'
  | 'barcode_scanner'
  | 'cash_drawer'
  | 'customer_display'
  | 'weighing_scale'
  | 'payment_terminal';

// ============================================================
// RECEIPT PRINTER INTERFACE
// ============================================================

export interface PrinterLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  fontSize?: 'normal' | 'double_width' | 'double_height' | 'double_size';
  invert?: boolean;
}

export interface ReceiptPrinterAdapter extends HardwareAdapter {
  printReceipt(job: PrintJob): Promise<PrintResult>;
  cutPaper(partial?: boolean): Promise<void>;
  openCashDrawer(pin?: 0 | 1): Promise<void>;
  printTestPage(): Promise<void>;
  getLineWidth(): number; // Characters per line (usually 32 or 48)
}

export interface PrintJob {
  jobId: string;
  lines: PrinterLine[];
  cutAfter: boolean;
  openDrawer: boolean;
}

export interface PrintResult {
  jobId: string;
  success: boolean;
  error?: string;
}

// ============================================================
// ESC/POS COMMAND BUILDER
// Low-level ESC/POS protocol implementation
// ============================================================

export class EscPosBuilder {
  private buffer: number[] = [];

  // Control characters
  static readonly ESC = 0x1b;
  static readonly GS = 0x1d;
  static readonly FS = 0x1c;
  static readonly FF = 0x0c;
  static readonly LF = 0x0a;
  static readonly CR = 0x0d;
  static readonly HT = 0x09;
  static readonly NUL = 0x00;

  // ── Initialize printer
  init(): this {
    this.buffer.push(EscPosBuilder.ESC, 0x40);
    return this;
  }

  // ── Text alignment
  alignLeft(): this {
    this.buffer.push(EscPosBuilder.ESC, 0x61, 0x00);
    return this;
  }

  alignCenter(): this {
    this.buffer.push(EscPosBuilder.ESC, 0x61, 0x01);
    return this;
  }

  alignRight(): this {
    this.buffer.push(EscPosBuilder.ESC, 0x61, 0x02);
    return this;
  }

  // ── Text formatting
  bold(enable: boolean): this {
    this.buffer.push(EscPosBuilder.ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  underline(enable: boolean): this {
    this.buffer.push(EscPosBuilder.ESC, 0x2d, enable ? 0x01 : 0x00);
    return this;
  }

  invert(enable: boolean): this {
    this.buffer.push(EscPosBuilder.GS, 0x42, enable ? 0x01 : 0x00);
    return this;
  }

  doubleWidth(enable: boolean): this {
    this.buffer.push(EscPosBuilder.ESC, 0x0e, enable ? 0x01 : 0x00);
    return this;
  }

  fontSize(size: 'normal' | 'double_width' | 'double_height' | 'double_size'): this {
    const codes: Record<string, number> = {
      normal: 0x00,
      double_width: 0x10,
      double_height: 0x01,
      double_size: 0x11,
    };
    this.buffer.push(EscPosBuilder.GS, 0x21, codes[size] ?? 0x00);
    return this;
  }

  // ── Text output
  text(str: string): this {
    const encoded = Buffer.from(str, 'utf-8');
    for (const byte of encoded) {
      this.buffer.push(byte);
    }
    return this;
  }

  textLine(str = ''): this {
    return this.text(str).newline();
  }

  newline(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(EscPosBuilder.LF);
    }
    return this;
  }

  // ── Separator line
  separator(char = '-', width = 48): this {
    return this.textLine(char.repeat(width));
  }

  // ── Two-column row (left text, right text)
  twoColumn(left: string, right: string, width = 48): this {
    const spaces = width - left.length - right.length;
    const row = spaces > 0
      ? left + ' '.repeat(spaces) + right
      : left.substring(0, width - right.length - 1) + ' ' + right;
    return this.textLine(row);
  }

  // ── Cut paper
  cutFull(): this {
    this.buffer.push(EscPosBuilder.GS, 0x56, 0x00);
    return this;
  }

  cutPartial(): this {
    this.buffer.push(EscPosBuilder.GS, 0x56, 0x01);
    return this;
  }

  // ── Cash drawer
  openDrawer(pin: 0 | 1 = 0): this {
    // Pin 0 = drawer connector pin 2
    // Pin 1 = drawer connector pin 5
    const pinCode = pin === 0 ? 0x00 : 0x01;
    this.buffer.push(EscPosBuilder.ESC, 0x70, pinCode, 0x19, 0xfa);
    return this;
  }

  // ── QR Code
  qrCode(data: string, size = 5): this {
    const encoded = Buffer.from(data, 'utf-8');
    const length = encoded.length + 3;

    // QR Model (Model 2)
    this.buffer.push(EscPosBuilder.GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // QR Size
    this.buffer.push(EscPosBuilder.GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // QR Error correction (M = 4)
    this.buffer.push(EscPosBuilder.GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // QR Data
    this.buffer.push(
      EscPosBuilder.GS, 0x28, 0x6b,
      length & 0xff, (length >> 8) & 0xff,
      0x31, 0x50, 0x30,
      ...Array.from(encoded)
    );
    // Print QR
    this.buffer.push(EscPosBuilder.GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  // ── Barcode (Code128)
  barcode(data: string): this {
    const encoded = Buffer.from(data, 'ascii');
    // Set barcode height
    this.buffer.push(EscPosBuilder.GS, 0x68, 0x50);
    // Set HRI position (below barcode)
    this.buffer.push(EscPosBuilder.GS, 0x48, 0x02);
    // Print Code128
    this.buffer.push(EscPosBuilder.GS, 0x6b, 0x49, encoded.length + 2, 0x7b, 0x42);
    this.buffer.push(...Array.from(encoded));
    return this;
  }

  // ── Feed and cut
  feedAndCut(lines = 4): this {
    this.newline(lines);
    return this.cutPartial();
  }

  build(): Buffer {
    return Buffer.from(this.buffer);
  }

  reset(): this {
    this.buffer = [];
    return this;
  }
}

// ============================================================
// USB/SERIAL ESC/POS PRINTER ADAPTER
// ============================================================

export class EscPosPrinterAdapter implements ReceiptPrinterAdapter {
  readonly name: string;
  readonly type: HardwareAdapterType = 'receipt_printer';

  private connected = false;
  private port: any = null; // SerialPort or USB handle
  private readonly lineWidth: number;

  constructor(
    name: string,
    private readonly config: {
      connectionType: 'usb' | 'serial' | 'network';
      address: string;
      baudRate?: number;
      paperWidth?: 58 | 80; // mm
    }
  ) {
    this.name = name;
    this.lineWidth = config.paperWidth === 58 ? 32 : 48;
  }

  async connect(): Promise<void> {
    try {
      if (this.config.connectionType === 'serial') {
        const { SerialPort } = await import('serialport');
        this.port = new SerialPort({
          path: this.config.address,
          baudRate: this.config.baudRate ?? 9600,
          autoOpen: false,
        });
        await new Promise<void>((resolve, reject) => {
          this.port.open((err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else if (this.config.connectionType === 'network') {
        const net = await import('net');
        const [host, portStr] = this.config.address.split(':');
        this.port = new net.Socket();
        await new Promise<void>((resolve, reject) => {
          this.port.connect(parseInt(portStr ?? '9100'), host, resolve);
          this.port.once('error', reject);
        });
      }
      this.connected = true;
      logger.info(`Printer connected: ${this.name}`);
    } catch (err) {
      this.connected = false;
      logger.error(`Printer connection failed: ${this.name}`, err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.port) {
      await new Promise<void>((resolve) => {
        this.port.close(() => resolve());
      });
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): IHardwareStatus {
    return {
      type: this.type,
      status: this.connected ? 'connected' : 'disconnected',
      name: this.name,
    };
  }

  async test(): Promise<boolean> {
    try {
      await this.printTestPage();
      return true;
    } catch {
      return false;
    }
  }

  getLineWidth(): number {
    return this.lineWidth;
  }

  async printReceipt(job: PrintJob): Promise<PrintResult> {
    if (!this.connected) {
      return { jobId: job.jobId, success: false, error: 'Printer not connected' };
    }

    try {
      const builder = new EscPosBuilder().init();

      for (const line of job.lines) {
        // Apply alignment
        switch (line.align) {
          case 'center': builder.alignCenter(); break;
          case 'right': builder.alignRight(); break;
          default: builder.alignLeft(); break;
        }

        // Apply formatting
        if (line.bold) builder.bold(true);
        if (line.underline) builder.underline(true);
        if (line.invert) builder.invert(true);
        if (line.fontSize && line.fontSize !== 'normal') {
          builder.fontSize(line.fontSize);
        }

        builder.textLine(line.text);

        // Reset formatting
        if (line.bold) builder.bold(false);
        if (line.underline) builder.underline(false);
        if (line.invert) builder.invert(false);
        if (line.fontSize && line.fontSize !== 'normal') {
          builder.fontSize('normal');
        }
        builder.alignLeft();
      }

      if (job.openDrawer) {
        builder.openDrawer();
      }

      if (job.cutAfter) {
        builder.feedAndCut(4);
      }

      const data = builder.build();
      await this.writeToPort(data);

      logger.debug(`Printed job: ${job.jobId}`);
      return { jobId: job.jobId, success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Print failed';
      logger.error(`Print failed for job ${job.jobId}`, err);
      return { jobId: job.jobId, success: false, error };
    }
  }

  async cutPaper(partial = true): Promise<void> {
    const cmd = new EscPosBuilder().init();
    partial ? cmd.cutPartial() : cmd.cutFull();
    await this.writeToPort(cmd.build());
  }

  async openCashDrawer(pin: 0 | 1 = 0): Promise<void> {
    if (!this.connected) throw new Error('Printer not connected');
    const cmd = new EscPosBuilder().init().openDrawer(pin);
    await this.writeToPort(cmd.build());
    logger.info('Cash drawer opened');
  }

  async printTestPage(): Promise<void> {
    const builder = new EscPosBuilder()
      .init()
      .alignCenter()
      .bold(true)
      .fontSize('double_size')
      .textLine('NexusPOS')
      .fontSize('normal')
      .bold(false)
      .textLine('TEST PRINT')
      .separator()
      .alignLeft()
      .twoColumn('Date:', new Date().toLocaleDateString(), this.lineWidth)
      .twoColumn('Time:', new Date().toLocaleTimeString(), this.lineWidth)
      .twoColumn('Printer:', this.name, this.lineWidth)
      .twoColumn('Width:', `${this.lineWidth} chars`, this.lineWidth)
      .separator()
      .alignCenter()
      .textLine('If you can read this,')
      .textLine('the printer is working correctly!')
      .feedAndCut(6);

    await this.writeToPort(builder.build());
  }

  private writeToPort(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port) {
        reject(new Error('No port available'));
        return;
      }

      const writeFn = this.port.write ?? this.port.send;
      if (typeof writeFn === 'function') {
        writeFn.call(this.port, data, (err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        reject(new Error('Port has no write method'));
      }
    });
  }
}

// ============================================================
// MOCK PRINTER ADAPTER (Testing / Demo Mode)
// ============================================================

export class MockPrinterAdapter implements ReceiptPrinterAdapter {
  readonly name = 'Mock Printer';
  readonly type: HardwareAdapterType = 'receipt_printer';
  private connected = false;
  private readonly jobs: PrintJob[] = [];
  private readonly emitter = new EventEmitter();

  async connect(): Promise<void> {
    this.connected = true;
    logger.info('Mock printer connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): IHardwareStatus {
    return { type: this.type, status: 'connected', name: this.name };
  }

  async test(): Promise<boolean> { return true; }
  getLineWidth(): number { return 48; }

  async printReceipt(job: PrintJob): Promise<PrintResult> {
    this.jobs.push(job);
    logger.info(`Mock print job: ${job.jobId} (${job.lines.length} lines)`);
    return { jobId: job.jobId, success: true };
  }

  async cutPaper(): Promise<void> {}
  async openCashDrawer(): Promise<void> {
    logger.info('Mock cash drawer opened');
  }
  async printTestPage(): Promise<void> {
    logger.info('Mock test page printed');
  }

  getJobs(): PrintJob[] { return [...this.jobs]; }
  clearJobs(): void { this.jobs.length = 0; }
}

// ============================================================
// HID BARCODE SCANNER ADAPTER
// ============================================================

export interface BarcodeScannerAdapter extends HardwareAdapter {
  onScan(callback: (barcode: string) => void): () => void;
  simulateScan(barcode: string): void;
}

export class HidBarcodeScannerAdapter implements BarcodeScannerAdapter {
  readonly name: string;
  readonly type: HardwareAdapterType = 'barcode_scanner';
  private connected = false;
  private readonly emitter = new EventEmitter();
  private buffer = '';
  private bufferTimer: NodeJS.Timeout | null = null;
  private readonly threshold = 100; // ms — HID scanners complete input quickly

  constructor(name = 'HID Barcode Scanner') {
    this.name = name;
  }

  async connect(): Promise<void> {
    // HID scanners work as keyboard input — listen to global keyboard events
    // In Electron, this would use a global shortcut or uIOhook
    // For now, set up buffer-based detection
    this.connected = true;
    logger.info('HID barcode scanner adapter active');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.buffer = '';
  }

  isConnected(): boolean { return this.connected; }

  getStatus(): IHardwareStatus {
    return { type: this.type, status: this.connected ? 'connected' : 'disconnected', name: this.name };
  }

  async test(): Promise<boolean> { return this.connected; }

  onScan(callback: (barcode: string) => void): () => void {
    this.emitter.on('scan', callback);
    return () => this.emitter.off('scan', callback);
  }

  // Called from renderer via IPC when barcode input is detected
  processInput(char: string): void {
    if (char === '\n' || char === '\r') {
      if (this.buffer.length > 0) {
        const barcode = this.buffer.trim();
        this.buffer = '';
        if (this.bufferTimer) {
          clearTimeout(this.bufferTimer);
          this.bufferTimer = null;
        }
        if (barcode.length >= 4) {
          this.emitter.emit('scan', barcode);
          logger.debug(`Barcode scanned: ${barcode}`);
        }
      }
    } else {
      this.buffer += char;
      // Reset timer on each character — scanner sends characters rapidly
      if (this.bufferTimer) clearTimeout(this.bufferTimer);
      this.bufferTimer = setTimeout(() => {
        this.buffer = ''; // Clear stale buffer
      }, this.threshold);
    }
  }

  simulateScan(barcode: string): void {
    this.emitter.emit('scan', barcode);
    logger.debug(`Simulated scan: ${barcode}`);
  }
}

// ============================================================
// HARDWARE MANAGER
// Central registry for all hardware adapters
// ============================================================

export class HardwareManager {
  private adapters = new Map<HardwareAdapterType, HardwareAdapter>();
  private readonly emitter = new EventEmitter();

  async initialize(): Promise<void> {
    // Default to mock adapters — real adapters configured from DeviceConfig
    this.adapters.set('receipt_printer', new MockPrinterAdapter());
    this.adapters.set('barcode_scanner', new HidBarcodeScannerAdapter());

    // Connect all adapters
    for (const [type, adapter] of this.adapters.entries()) {
      try {
        await adapter.connect();
        logger.info(`Adapter connected: ${type}`);
      } catch (err) {
        logger.warn(`Adapter failed to connect: ${type}`, err);
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const [type, adapter] of this.adapters.entries()) {
      try {
        await adapter.disconnect();
      } catch (err) {
        logger.warn(`Adapter disconnect error: ${type}`, err);
      }
    }
    this.adapters.clear();
  }

  getAdapter<T extends HardwareAdapter>(type: HardwareAdapterType): T | undefined {
    return this.adapters.get(type) as T | undefined;
  }

  getReceiptPrinter(): ReceiptPrinterAdapter | undefined {
    return this.adapters.get('receipt_printer') as ReceiptPrinterAdapter | undefined;
  }

  getBarcodeScanner(): BarcodeScannerAdapter | undefined {
    return this.adapters.get('barcode_scanner') as BarcodeScannerAdapter | undefined;
  }

  getAllStatuses(): IHardwareStatus[] {
    return Array.from(this.adapters.values()).map(a => a.getStatus());
  }

  getPrinterStatuses(): IHardwareStatus[] {
    return Array.from(this.adapters.entries())
      .filter(([type]) => type.includes('printer'))
      .map(([, adapter]) => adapter.getStatus());
  }

  async openCashDrawer(payload?: { pin?: 0 | 1 }): Promise<void> {
    const printer = this.getReceiptPrinter();
    if (!printer) throw new Error('No receipt printer configured');
    await printer.openCashDrawer(payload?.pin ?? 0);
  }

  registerAdapter(type: HardwareAdapterType, adapter: HardwareAdapter): void {
    const existing = this.adapters.get(type);
    if (existing?.isConnected()) {
      existing.disconnect().catch(() => {});
    }
    this.adapters.set(type, adapter);
    this.emitter.emit('adapter-registered', { type, name: adapter.name });
  }
}
