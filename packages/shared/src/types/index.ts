// NexusPOS Shared Types — Core Domain Interfaces
// Used by both main process and renderer (no Node.js dependencies)

// ============================================================
// MONETARY TYPES
// All monetary values are stored as integers (cents)
// to avoid floating-point arithmetic errors
// ============================================================

export type Cents = number;
export type RatePercentage = number; // Stored as rate × 100 (e.g., 1900 = 19.00%)

export interface Money {
  amount: Cents;
  currency: string;
}

// ============================================================
// STORE
// ============================================================

export interface IStore {
  id: string;
  name: string;
  legalName: string;
  taxId?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
}

export interface IBranch {
  id: string;
  storeId: string;
  name: string;
  address?: string;
  isActive: boolean;
}

export interface IDevice {
  id: string;
  storeId: string;
  branchId?: string;
  name: string;
  serialNumber?: string;
  deviceType: DeviceType;
  platformOS?: string;
  appVersion?: string;
  isActive: boolean;
  isPrimary: boolean;
  lastSeenAt?: Date;
}

export type DeviceType =
  | 'POS_TERMINAL'
  | 'CUSTOMER_DISPLAY'
  | 'KITCHEN_DISPLAY'
  | 'MANAGER_TERMINAL'
  | 'MOBILE_POS';

// ============================================================
// USER & AUTH
// ============================================================

export interface IUser {
  id: string;
  storeId: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  roleId: string;
  role?: IRole;
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: IPermission[];
}

export interface IPermission {
  id: string;
  roleId: string;
  resource: PermissionResource;
  action: PermissionAction;
}

export type PermissionResource =
  | 'checkout'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'customers'
  | 'receipts'
  | 'invoices'
  | 'payments'
  | 'discounts'
  | 'taxes'
  | 'shifts'
  | 'reports'
  | 'settings'
  | 'users'
  | 'devices'
  | 'fiscal'
  | 'audit';

export type PermissionAction = 'read' | 'write' | 'delete' | 'void' | 'admin';

export interface AuthSession {
  userId: string;
  user: IUser;
  token: string;
  expiresAt: Date;
  isPin: boolean;
  storeId?: string;
  deviceId?: string;
}

// ============================================================
// PRODUCTS
// ============================================================

export interface IProduct {
  id: string;
  storeId: string;
  categoryId?: string;
  category?: ICategory;
  taxRuleId?: string;
  taxRule?: ITaxRule;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  unitPrice: Cents;
  costPrice?: Cents;
  taxInclusive: boolean;
  unit: ProductUnit;
  isActive: boolean;
  isSoldByWeight: boolean;
  isService: boolean;
  allowDiscount: boolean;
  inventory?: IInventoryItem;
}

export type ProductUnit =
  | 'PIECE'
  | 'KG'
  | 'GRAM'
  | 'LITER'
  | 'MILLILITER'
  | 'METER'
  | 'HOUR'
  | 'DAY';

export interface IProductVariant {
  id: string;
  productId: string;
  sku?: string;
  barcode?: string;
  name: string;
  attributes: Record<string, string>;
  unitPrice: Cents;
  isActive: boolean;
}

export interface ICategory {
  id: string;
  storeId: string;
  parentId?: string;
  name: string;
  description?: string;
  colorHex?: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
  children?: ICategory[];
}

// ============================================================
// INVENTORY
// ============================================================

export interface IInventoryItem {
  id: string;
  productId: string;
  quantity: number;
  reservedQty: number;
  availableQty?: number; // computed client-side: quantity - reservedQty (not in DB)
  lastCountAt?: Date;
}

export interface IStockMovement {
  id: string;
  productId: string;
  movementType: StockMovementType;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason?: string;
  reference?: string;
  createdAt: Date;
}

export type StockMovementType =
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'PURCHASE'
  | 'WASTE'
  | 'TRANSFER'
  | 'INITIAL'
  | 'COUNT_CORRECTION';

// ============================================================
// CUSTOMERS
// ============================================================

export interface ICustomer {
  id: string;
  storeId: string;
  customerNum?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  loyaltyPoints: number;
  totalSpent: Cents;
  isActive: boolean;
}

// ============================================================
// CHECKOUT / CART (In-memory domain objects)
// ============================================================

export interface ICart {
  id: string;
  lines: ICartLine[];
  customerId?: string;
  customer?: ICustomer;
  discountRuleId?: string;
  couponCode?: string;
  notes?: string;
  totals: ICartTotals;
}

export interface ICartLine {
  id: string; // Local line ID (UUID)
  productId: string;
  variantId?: string;
  product: IProduct;
  quantity: number; // × 1000 for 3 decimal precision
  unitPrice: Cents;
  originalPrice: Cents;
  discountAmount: Cents;
  taxAmount: Cents;
  taxRate: RatePercentage;
  taxInclusive: boolean;
  lineTotal: Cents;
  notes?: string;
  weight?: number; // grams
}

export interface ICartTotals {
  subtotal: Cents;
  discountAmount: Cents;
  taxableAmount: Cents;
  taxAmount: Cents;
  totalAmount: Cents;
  taxBreakdown: ITaxBreakdownItem[];
}

export interface ITaxBreakdownItem {
  taxClass: string;
  taxRate: RatePercentage;
  netAmount: Cents;
  taxAmount: Cents;
  grossAmount: Cents;
}

// ============================================================
// SALES
// ============================================================

export interface ISale {
  id: string;
  storeId?: string;
  deviceId: string;
  shiftId: string;
  cashierId: string;
  customerId?: string;
  saleNumber: string;
  status: SaleStatus;
  subtotal: Cents;
  discountAmount: Cents;
  taxAmount: Cents;
  totalAmount: Cents;
  paidAmount: Cents;
  changeAmount: Cents;
  notes?: string;
  createdAt: Date;
  lines?: ISaleLine[];
  payments?: IPayment[];
}

export type SaleStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'VOIDED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'ON_HOLD';

export interface ISaleLine {
  id: string;
  saleId: string;
  productId: string;
  lineNumber: number;
  productName: string;
  quantity: number;
  unitPrice: Cents;
  discountAmount: Cents;
  taxAmount: Cents;
  taxRate: RatePercentage;
  taxInclusive: boolean;
  lineTotal: Cents;
}

// ============================================================
// PAYMENTS
// ============================================================

export interface IPayment {
  id: string;
  saleId: string;
  paymentMethod: PaymentMethod;
  amount: Cents;
  tendered?: Cents;
  change?: Cents;
  reference?: string;
  cardLast4?: string;
  cardBrand?: string;
  status: PaymentStatus;
  processedAt: Date;
}

export type PaymentMethod =
  | 'CASH'
  | 'CARD_CREDIT'
  | 'CARD_DEBIT'
  | 'CONTACTLESS'
  | 'VOUCHER'
  | 'GIFT_CARD'
  | 'BANK_TRANSFER'
  | 'ACCOUNT';

export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

// ============================================================
// TAXES
// ============================================================

export interface ITaxRule {
  id: string;
  storeId: string;
  name: string;
  rate: RatePercentage;
  taxClass: TaxClass;
  isDefault: boolean;
  isActive: boolean;
}

export type TaxClass = 'standard' | 'reduced' | 'zero' | 'exempt';

// ============================================================
// DISCOUNTS
// ============================================================

export interface IDiscountRule {
  id: string;
  storeId?: string;        // Optional for manual/in-session discounts
  name: string;
  discountType: DiscountType;
  value: number;
  scope: DiscountScope;
  categoryId?: string;
  productId?: string;
  minAmount?: Cents;
  minQuantity?: number;
  couponCode?: string;
  isActive: boolean;
  requiresAuth?: boolean;  // Optional for manual discounts
  startDate?: Date;
  endDate?: Date;
  maxUses?: number;
  usedCount?: number;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'BUNDLE';
export type DiscountScope = 'CART' | 'LINE_ITEM' | 'CATEGORY' | 'PRODUCT';

// ============================================================
// SHIFTS
// ============================================================

export interface IShift {
  id: string;
  storeId: string;
  deviceId: string;
  userId: string;
  shiftNumber: string;
  status: ShiftStatus;
  openingBalance: Cents;
  closingBalance?: Cents;
  expectedBalance?: Cents;
  variance?: Cents;
  openedAt: Date;
  closedAt?: Date;
}

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

export interface ICashMovement {
  id: string;
  shiftId: string;
  deviceId: string;
  movementType: CashMovementType;
  amount: Cents;
  reason?: string;
  createdAt: Date;
}

export type CashMovementType =
  | 'OPENING'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'SALE'
  | 'REFUND'
  | 'CLOSING';

// ============================================================
// HARDWARE
// ============================================================

export type HardwareStatus = 'connected' | 'disconnected' | 'error' | 'busy';

export interface IHardwareStatus {
  type: string;
  status: HardwareStatus;
  name: string;
  error?: string;
}

export interface IPrintJob {
  jobId: string;
  type: 'receipt' | 'invoice' | 'label';
  printerId: string;
  content: string; // ESC/POS or HTML
  copies: number;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
}

export interface IPrintResult {
  jobId: string;
  success: boolean;
  error?: string;
  printedAt?: Date;
}

// ============================================================
// IPC CHANNEL DEFINITIONS
// ============================================================

export type IPCChannel =
  // Auth
  | 'auth:login'
  | 'auth:login-pin'
  | 'auth:logout'
  | 'auth:session'
  // Checkout / Sales
  | 'sale:create'
  | 'sale:complete'
  | 'sale:void'
  | 'sale:hold'
  | 'sale:find'
  | 'sale:list'
  // Products
  | 'category:list'
  | 'product:find'
  | 'product:search'
  | 'product:barcode'
  | 'product:list'
  | 'product:create'
  | 'product:update'
  | 'product:delete'
  // Inventory
  | 'inventory:get'
  | 'inventory:adjust'
  | 'inventory:movements'
  // Customers
  | 'customer:find'
  | 'customer:search'
  | 'customer:create'
  | 'customer:update'
  // Payments
  | 'payment:process'
  | 'payment:refund'
  // Shifts
  | 'shift:open'
  | 'shift:close'
  | 'shift:current'
  | 'shift:cash-in'
  | 'shift:cash-out'
  // Reports
  | 'report:daily'
  | 'report:shift'
  | 'report:sales'
  | 'report:products'
  | 'report:customers'
  // Hardware
  | 'printer:print'
  | 'printer:status'
  | 'printer:test'
  | 'hardware:status'
  | 'drawer:open'
  // Settings
  | 'settings:get'
  | 'settings:set'
  | 'settings:getAll'
  | 'settings:device'
  // System
  | 'app:version'
  | 'app:device'
  | 'app:restart'
  | 'db:backup'
  | 'sync:status'
  | 'sync:trigger';

// ============================================================
// RESULT TYPE (Railway-oriented programming)
// ============================================================

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

// ============================================================
// SYNC
// ============================================================

export interface ISyncStatus {
  lastSyncAt?: Date;
  pendingCount: number;
  failedCount: number;
  peerCount: number;
  isOnline: boolean;
}

export interface ISyncEvent {
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID';
  payload: unknown;
  vectorClock: Record<string, number>;
  timestamp: Date;
}
