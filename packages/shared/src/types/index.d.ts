export type Cents = number;
export type RatePercentage = number;
export interface Money {
    amount: Cents;
    currency: string;
}
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
export type DeviceType = 'POS_TERMINAL' | 'CUSTOMER_DISPLAY' | 'KITCHEN_DISPLAY' | 'MANAGER_TERMINAL' | 'MOBILE_POS';
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
export type PermissionResource = 'checkout' | 'products' | 'categories' | 'inventory' | 'customers' | 'receipts' | 'invoices' | 'payments' | 'discounts' | 'taxes' | 'shifts' | 'reports' | 'settings' | 'users' | 'devices' | 'fiscal' | 'audit';
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
export type ProductUnit = 'PIECE' | 'KG' | 'GRAM' | 'LITER' | 'MILLILITER' | 'METER' | 'HOUR' | 'DAY';
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
export interface IInventoryItem {
    id: string;
    productId: string;
    quantity: number;
    reservedQty: number;
    availableQty: number;
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
export type StockMovementType = 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'PURCHASE' | 'WASTE' | 'TRANSFER' | 'INITIAL' | 'COUNT_CORRECTION';
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
    id: string;
    productId: string;
    variantId?: string;
    product: IProduct;
    quantity: number;
    unitPrice: Cents;
    originalPrice: Cents;
    discountAmount: Cents;
    taxAmount: Cents;
    taxRate: RatePercentage;
    taxInclusive: boolean;
    lineTotal: Cents;
    notes?: string;
    weight?: number;
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
export type SaleStatus = 'PENDING' | 'COMPLETED' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'ON_HOLD';
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
export type PaymentMethod = 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'CONTACTLESS' | 'VOUCHER' | 'GIFT_CARD' | 'BANK_TRANSFER' | 'ACCOUNT';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
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
export interface IDiscountRule {
    id: string;
    storeId: string;
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
    requiresAuth: boolean;
    startDate?: Date;
    endDate?: Date;
    maxUses?: number;
    usedCount?: number;
}
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'BUNDLE';
export type DiscountScope = 'CART' | 'LINE_ITEM' | 'CATEGORY' | 'PRODUCT';
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
export type CashMovementType = 'OPENING' | 'CASH_IN' | 'CASH_OUT' | 'SALE' | 'REFUND' | 'CLOSING';
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
    content: string;
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
export type IPCChannel = 'auth:login' | 'auth:login-pin' | 'auth:logout' | 'auth:session' | 'sale:create' | 'sale:complete' | 'sale:void' | 'sale:hold' | 'sale:find' | 'sale:list' | 'product:find' | 'product:search' | 'product:barcode' | 'product:list' | 'product:create' | 'product:update' | 'product:delete' | 'inventory:get' | 'inventory:adjust' | 'inventory:movements' | 'customer:find' | 'customer:search' | 'customer:create' | 'customer:update' | 'payment:process' | 'payment:refund' | 'shift:open' | 'shift:close' | 'shift:current' | 'shift:cash-in' | 'shift:cash-out' | 'report:daily' | 'report:shift' | 'report:sales' | 'report:products' | 'report:customers' | 'printer:print' | 'printer:status' | 'printer:test' | 'hardware:status' | 'drawer:open' | 'settings:get' | 'settings:set' | 'settings:device' | 'app:version' | 'app:restart' | 'db:backup' | 'sync:status' | 'sync:trigger';
export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
export interface AppError {
    code: string;
    message: string;
    details?: unknown;
    recoverable: boolean;
}
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
