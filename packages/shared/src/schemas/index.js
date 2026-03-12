"use strict";
// NexusPOS — Zod Validation Schemas
// All IPC messages are validated against these schemas
// before processing in the main process
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTaxRuleSchema = exports.CreateDiscountSchema = exports.DateRangeSchema = exports.SetSettingSchema = exports.PrintInvoiceSchema = exports.PrintReceiptSchema = exports.AdjustInventorySchema = exports.CustomerSearchSchema = exports.CreateCustomerSchema = exports.CashMovementSchema = exports.CloseShiftSchema = exports.OpenShiftSchema = exports.RefundSchema = exports.ProcessPaymentSchema = exports.HoldSaleSchema = exports.VoidSaleSchema = exports.CreateSaleSchema = exports.CartLineSchema = exports.UpdateProductSchema = exports.CreateProductSchema = exports.ProductBarcodeSchema = exports.ProductSearchSchema = exports.LoginPinSchema = exports.LoginSchema = exports.NonEmptyString = exports.CuidSchema = exports.RateSchema = exports.CentsSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// COMMON PRIMITIVES
// ============================================================
exports.CentsSchema = zod_1.z.number().int().min(0);
exports.RateSchema = zod_1.z.number().int().min(0).max(10000); // max 100.00%
exports.CuidSchema = zod_1.z.string().cuid();
exports.NonEmptyString = zod_1.z.string().min(1).max(500);
// ============================================================
// AUTH SCHEMAS
// ============================================================
exports.LoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1).max(100),
    password: zod_1.z.string().min(1).max(200),
    deviceId: zod_1.z.string().min(1),
});
exports.LoginPinSchema = zod_1.z.object({
    pin: zod_1.z.string().length(4).regex(/^\d{4}$/),
    deviceId: zod_1.z.string().min(1),
});
// ============================================================
// PRODUCT SCHEMAS
// ============================================================
exports.ProductSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(200),
    categoryId: zod_1.z.string().optional(),
    storeId: zod_1.z.string().min(1),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
    offset: zod_1.z.number().int().min(0).default(0),
});
exports.ProductBarcodeSchema = zod_1.z.object({
    barcode: zod_1.z.string().min(1).max(100),
    storeId: zod_1.z.string().min(1),
});
exports.CreateProductSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().optional(),
    taxRuleId: zod_1.z.string().optional(),
    sku: zod_1.z.string().max(100).optional(),
    barcode: zod_1.z.string().max(100).optional(),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(2000).optional(),
    unitPrice: exports.CentsSchema,
    costPrice: exports.CentsSchema.optional(),
    taxInclusive: zod_1.z.boolean().default(true),
    unit: zod_1.z.enum(['PIECE', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'METER', 'HOUR', 'DAY']).default('PIECE'),
    isActive: zod_1.z.boolean().default(true),
    isSoldByWeight: zod_1.z.boolean().default(false),
    isService: zod_1.z.boolean().default(false),
    allowDiscount: zod_1.z.boolean().default(true),
    minStockLevel: zod_1.z.number().int().optional(),
    maxStockLevel: zod_1.z.number().int().optional(),
});
exports.UpdateProductSchema = exports.CreateProductSchema.partial().extend({
    id: exports.CuidSchema,
});
// ============================================================
// CART / CHECKOUT SCHEMAS
// ============================================================
exports.CartLineSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    variantId: zod_1.z.string().optional(),
    quantity: zod_1.z.number().int().min(1).max(99999),
    unitPrice: exports.CentsSchema,
    notes: zod_1.z.string().max(500).optional(),
    weight: zod_1.z.number().int().optional(),
});
exports.CreateSaleSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1),
    shiftId: zod_1.z.string().min(1),
    cashierId: zod_1.z.string().min(1),
    customerId: zod_1.z.string().optional(),
    storeId: zod_1.z.string().min(1),
    lines: zod_1.z.array(exports.CartLineSchema).min(1).max(500),
    discountRuleId: zod_1.z.string().optional(),
    couponCode: zod_1.z.string().max(50).optional(),
    payments: zod_1.z.array(zod_1.z.object({
        paymentMethod: zod_1.z.enum([
            'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
            'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
        ]),
        amount: exports.CentsSchema,
        tendered: exports.CentsSchema.optional(),
        reference: zod_1.z.string().max(200).optional(),
    })).min(1),
    notes: zod_1.z.string().max(1000).optional(),
    tableNumber: zod_1.z.string().max(20).optional(),
});
exports.VoidSaleSchema = zod_1.z.object({
    saleId: zod_1.z.string().min(1),
    reason: zod_1.z.string().min(1).max(500),
    userId: zod_1.z.string().min(1),
});
exports.HoldSaleSchema = zod_1.z.object({
    saleId: zod_1.z.string().optional(),
    cartData: zod_1.z.record(zod_1.z.unknown()),
    label: zod_1.z.string().max(100).optional(),
});
// ============================================================
// PAYMENT SCHEMAS
// ============================================================
exports.ProcessPaymentSchema = zod_1.z.object({
    saleId: zod_1.z.string().min(1),
    paymentMethod: zod_1.z.enum([
        'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
        'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
    ]),
    amount: exports.CentsSchema,
    tendered: exports.CentsSchema.optional(),
    reference: zod_1.z.string().max(200).optional(),
});
exports.RefundSchema = zod_1.z.object({
    saleId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    amount: exports.CentsSchema,
    reason: zod_1.z.string().min(1).max(500),
    refundMethod: zod_1.z.enum([
        'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
        'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
    ]),
    lines: zod_1.z.array(zod_1.z.object({
        saleLineId: zod_1.z.string(),
        quantity: zod_1.z.number().int().min(1),
    })).optional(),
});
// ============================================================
// SHIFT SCHEMAS
// ============================================================
exports.OpenShiftSchema = zod_1.z.object({
    deviceId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    storeId: zod_1.z.string().min(1),
    branchId: zod_1.z.string().optional(),
    openingBalance: exports.CentsSchema,
    notes: zod_1.z.string().max(500).optional(),
});
exports.CloseShiftSchema = zod_1.z.object({
    shiftId: zod_1.z.string().min(1),
    closingBalance: exports.CentsSchema,
    notes: zod_1.z.string().max(500).optional(),
});
exports.CashMovementSchema = zod_1.z.object({
    shiftId: zod_1.z.string().min(1),
    deviceId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    movementType: zod_1.z.enum(['CASH_IN', 'CASH_OUT']),
    amount: exports.CentsSchema.min(1),
    reason: zod_1.z.string().max(500).optional(),
});
// ============================================================
// CUSTOMER SCHEMAS
// ============================================================
exports.CreateCustomerSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    firstName: zod_1.z.string().min(1).max(100),
    lastName: zod_1.z.string().max(100).optional(),
    email: zod_1.z.string().email().max(200).optional(),
    phone: zod_1.z.string().max(50).optional(),
    company: zod_1.z.string().max(200).optional(),
    taxId: zod_1.z.string().max(50).optional(),
    address: zod_1.z.string().max(500).optional(),
    city: zod_1.z.string().max(100).optional(),
    postalCode: zod_1.z.string().max(20).optional(),
    country: zod_1.z.string().max(2).optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
exports.CustomerSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(200),
    storeId: zod_1.z.string().min(1),
    limit: zod_1.z.number().int().min(1).max(50).default(10),
});
// ============================================================
// INVENTORY SCHEMAS
// ============================================================
exports.AdjustInventorySchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int(), // Can be negative for manual deductions
    movementType: zod_1.z.enum(['ADJUSTMENT', 'PURCHASE', 'WASTE', 'TRANSFER', 'COUNT_CORRECTION', 'INITIAL']),
    reason: zod_1.z.string().max(500).optional(),
    userId: zod_1.z.string().min(1),
});
// ============================================================
// PRINT SCHEMAS
// ============================================================
exports.PrintReceiptSchema = zod_1.z.object({
    saleId: zod_1.z.string().min(1),
    printerId: zod_1.z.string().min(1),
    copies: zod_1.z.number().int().min(1).max(5).default(1),
});
exports.PrintInvoiceSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().min(1),
    printerId: zod_1.z.string().min(1),
    copies: zod_1.z.number().int().min(1).max(10).default(1),
    sendEmail: zod_1.z.boolean().default(false),
});
// ============================================================
// SETTINGS SCHEMAS
// ============================================================
exports.SetSettingSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    key: zod_1.z.string().min(1).max(100),
    value: zod_1.z.string().max(10000),
    dataType: zod_1.z.enum(['string', 'number', 'boolean', 'json']).default('string'),
});
// ============================================================
// REPORT SCHEMAS
// ============================================================
exports.DateRangeSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    deviceId: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional(),
});
// ============================================================
// DISCOUNT SCHEMAS
// ============================================================
exports.CreateDiscountSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(1000).optional(),
    discountType: zod_1.z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'BUNDLE']),
    value: zod_1.z.number().int().min(1),
    scope: zod_1.z.enum(['CART', 'LINE_ITEM', 'CATEGORY', 'PRODUCT']).default('CART'),
    categoryId: zod_1.z.string().optional(),
    productId: zod_1.z.string().optional(),
    minAmount: exports.CentsSchema.optional(),
    minQuantity: zod_1.z.number().int().optional(),
    couponCode: zod_1.z.string().max(50).optional(),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    requiresAuth: zod_1.z.boolean().default(false),
});
// ============================================================
// TAX RULE SCHEMAS
// ============================================================
exports.CreateTaxRuleSchema = zod_1.z.object({
    storeId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(100),
    rate: exports.RateSchema,
    taxClass: zod_1.z.enum(['standard', 'reduced', 'zero', 'exempt']),
    isDefault: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=index.js.map