// NexusPOS — Zod Validation Schemas
// All IPC messages are validated against these schemas
// before processing in the main process

import { z } from 'zod';

// ============================================================
// COMMON PRIMITIVES
// ============================================================

export const CentsSchema = z.number().int().min(0);
export const RateSchema = z.number().int().min(0).max(10000); // max 100.00%
export const CuidSchema = z.string().cuid();
export const NonEmptyString = z.string().min(1).max(500);

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  deviceId: z.string().min(1),
});

export const LoginPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
  deviceId: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type LoginPinInput = z.infer<typeof LoginPinSchema>;

// ============================================================
// PRODUCT SCHEMAS
// ============================================================

export const ProductSearchSchema = z.object({
  query: z.string().max(200).optional().default(''),
  categoryId: z.string().optional(),
  storeId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const ProductBarcodeSchema = z.object({
  barcode: z.string().min(1).max(100),
  storeId: z.string().min(1),
});

export const CreateProductSchema = z.object({
  storeId: z.string().min(1),
  categoryId: z.string().optional(),
  taxRuleId: z.string().optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  unitPrice: CentsSchema,
  costPrice: CentsSchema.optional(),
  taxInclusive: z.boolean().default(true),
  unit: z.enum(['PIECE', 'KG', 'GRAM', 'LITER', 'MILLILITER', 'METER', 'HOUR', 'DAY']).default('PIECE'),
  isActive: z.boolean().default(true),
  isSoldByWeight: z.boolean().default(false),
  isService: z.boolean().default(false),
  allowDiscount: z.boolean().default(true),
  minStockLevel: z.number().int().optional(),
  maxStockLevel: z.number().int().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  id: CuidSchema,
});

export type ProductSearchInput = z.infer<typeof ProductSearchSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// ============================================================
// CART / CHECKOUT SCHEMAS
// ============================================================

export const CartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).max(99999),
  unitPrice: CentsSchema,
  notes: z.string().max(500).optional(),
  weight: z.number().int().optional(),
});

export const CreateSaleSchema = z.object({
  deviceId: z.string().min(1),
  shiftId: z.string().min(1),
  cashierId: z.string().min(1),
  customerId: z.string().optional(),
  storeId: z.string().min(1),
  lines: z.array(CartLineSchema).min(1).max(500),
  discountRuleId: z.string().optional(),
  couponCode: z.string().max(50).optional(),
  payments: z.array(
    z.object({
      paymentMethod: z.enum([
        'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
        'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
      ]),
      amount: CentsSchema,
      tendered: CentsSchema.optional(),
      reference: z.string().max(200).optional(),
    })
  ).min(1),
  notes: z.string().max(1000).optional(),
  tableNumber: z.string().max(20).optional(),
});

export const VoidSaleSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().min(1).max(500),
  userId: z.string().min(1),
});

export const HoldSaleSchema = z.object({
  saleId: z.string().optional(),
  cartData: z.record(z.unknown()),
  label: z.string().max(100).optional(),
});

export type CartLineInput = z.infer<typeof CartLineSchema>;
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
export type VoidSaleInput = z.infer<typeof VoidSaleSchema>;

// ============================================================
// PAYMENT SCHEMAS
// ============================================================

export const ProcessPaymentSchema = z.object({
  saleId: z.string().min(1),
  paymentMethod: z.enum([
    'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
    'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
  ]),
  amount: CentsSchema,
  tendered: CentsSchema.optional(),
  reference: z.string().max(200).optional(),
});

export const RefundSchema = z.object({
  saleId: z.string().min(1),
  userId: z.string().min(1),
  amount: CentsSchema,
  reason: z.string().min(1).max(500),
  refundMethod: z.enum([
    'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CONTACTLESS',
    'VOUCHER', 'GIFT_CARD', 'BANK_TRANSFER', 'ACCOUNT'
  ]),
  lines: z.array(
    z.object({
      saleLineId: z.string(),
      quantity: z.number().int().min(1),
    })
  ).optional(),
});

export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type RefundInput = z.infer<typeof RefundSchema>;

// ============================================================
// SHIFT SCHEMAS
// ============================================================

export const OpenShiftSchema = z.object({
  deviceId: z.string().min(1),
  userId: z.string().min(1),
  storeId: z.string().min(1),
  branchId: z.string().optional(),
  openingBalance: CentsSchema,
  notes: z.string().max(500).optional(),
});

export const CloseShiftSchema = z.object({
  shiftId: z.string().min(1),
  closingBalance: CentsSchema,
  notes: z.string().max(500).optional(),
});

export const CashMovementSchema = z.object({
  shiftId: z.string().min(1),
  deviceId: z.string().min(1),
  userId: z.string().min(1),
  movementType: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: CentsSchema.min(1),
  reason: z.string().max(500).optional(),
});

export type OpenShiftInput = z.infer<typeof OpenShiftSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;
export type CashMovementInput = z.infer<typeof CashMovementSchema>;

// ============================================================
// CUSTOMER SCHEMAS
// ============================================================

export const CreateCustomerSchema = z.object({
  storeId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  notes: z.string().max(1000).optional(),
});

export const CustomerSearchSchema = z.object({
  query: z.string().min(1).max(200),
  storeId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof CustomerSearchSchema>;

// ============================================================
// INVENTORY SCHEMAS
// ============================================================

export const AdjustInventorySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int(), // Can be negative for manual deductions
  movementType: z.enum(['ADJUSTMENT', 'PURCHASE', 'WASTE', 'TRANSFER', 'COUNT_CORRECTION', 'INITIAL']),
  reason: z.string().max(500).optional(),
  userId: z.string().min(1),
});

export type AdjustInventoryInput = z.infer<typeof AdjustInventorySchema>;

// ============================================================
// PRINT SCHEMAS
// ============================================================

export const PrintReceiptSchema = z.object({
  saleId: z.string().min(1),
  printerId: z.string().min(1),
  copies: z.number().int().min(1).max(5).default(1),
});

export const PrintInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  printerId: z.string().min(1),
  copies: z.number().int().min(1).max(10).default(1),
  sendEmail: z.boolean().default(false),
});

export type PrintReceiptInput = z.infer<typeof PrintReceiptSchema>;
export type PrintInvoiceInput = z.infer<typeof PrintInvoiceSchema>;

// ============================================================
// SETTINGS SCHEMAS
// ============================================================

export const SetSettingSchema = z.object({
  storeId: z.string().min(1),
  key: z.string().min(1).max(100),
  value: z.string().max(10000),
  dataType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
});

export type SetSettingInput = z.infer<typeof SetSettingSchema>;

// ============================================================
// REPORT SCHEMAS
// ============================================================

export const DateRangeSchema = z.object({
  storeId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  deviceId: z.string().optional(),
  userId: z.string().optional(),
});

export type DateRangeInput = z.infer<typeof DateRangeSchema>;

// ============================================================
// DISCOUNT SCHEMAS
// ============================================================

export const CreateDiscountSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'BUNDLE']),
  value: z.number().int().min(1),
  scope: z.enum(['CART', 'LINE_ITEM', 'CATEGORY', 'PRODUCT']).default('CART'),
  categoryId: z.string().optional(),
  productId: z.string().optional(),
  minAmount: CentsSchema.optional(),
  minQuantity: z.number().int().optional(),
  couponCode: z.string().max(50).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  requiresAuth: z.boolean().default(false),
});

export type CreateDiscountInput = z.infer<typeof CreateDiscountSchema>;

// ============================================================
// TAX RULE SCHEMAS
// ============================================================

export const CreateTaxRuleSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1).max(100),
  rate: RateSchema,
  taxClass: z.enum(['standard', 'reduced', 'zero', 'exempt']),
  isDefault: z.boolean().default(false),
});

export type CreateTaxRuleInput = z.infer<typeof CreateTaxRuleSchema>;
