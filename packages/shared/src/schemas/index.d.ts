import { z } from 'zod';
export declare const CentsSchema: z.ZodNumber;
export declare const RateSchema: z.ZodNumber;
export declare const CuidSchema: z.ZodString;
export declare const NonEmptyString: z.ZodString;
export declare const LoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
    username?: string;
    password?: string;
}, {
    deviceId?: string;
    username?: string;
    password?: string;
}>;
export declare const LoginPinSchema: z.ZodObject<{
    pin: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
    pin?: string;
}, {
    deviceId?: string;
    pin?: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type LoginPinInput = z.infer<typeof LoginPinSchema>;
export declare const ProductSearchSchema: z.ZodObject<{
    query: z.ZodString;
    categoryId: z.ZodOptional<z.ZodString>;
    storeId: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    storeId?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
}, {
    query?: string;
    storeId?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
}>;
export declare const ProductBarcodeSchema: z.ZodObject<{
    barcode: z.ZodString;
    storeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    barcode?: string;
    storeId?: string;
}, {
    barcode?: string;
    storeId?: string;
}>;
export declare const CreateProductSchema: z.ZodObject<{
    storeId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodString>;
    taxRuleId: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    unitPrice: z.ZodNumber;
    costPrice: z.ZodOptional<z.ZodNumber>;
    taxInclusive: z.ZodDefault<z.ZodBoolean>;
    unit: z.ZodDefault<z.ZodEnum<["PIECE", "KG", "GRAM", "LITER", "MILLILITER", "METER", "HOUR", "DAY"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    isSoldByWeight: z.ZodDefault<z.ZodBoolean>;
    isService: z.ZodDefault<z.ZodBoolean>;
    allowDiscount: z.ZodDefault<z.ZodBoolean>;
    minStockLevel: z.ZodOptional<z.ZodNumber>;
    maxStockLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    barcode?: string;
    unitPrice?: number;
    taxInclusive?: boolean;
    description?: string;
    sku?: string;
    storeId?: string;
    categoryId?: string;
    taxRuleId?: string;
    costPrice?: number;
    unit?: "PIECE" | "KG" | "GRAM" | "LITER" | "MILLILITER" | "METER" | "HOUR" | "DAY";
    isActive?: boolean;
    isSoldByWeight?: boolean;
    isService?: boolean;
    allowDiscount?: boolean;
    minStockLevel?: number;
    maxStockLevel?: number;
}, {
    name?: string;
    barcode?: string;
    unitPrice?: number;
    taxInclusive?: boolean;
    description?: string;
    sku?: string;
    storeId?: string;
    categoryId?: string;
    taxRuleId?: string;
    costPrice?: number;
    unit?: "PIECE" | "KG" | "GRAM" | "LITER" | "MILLILITER" | "METER" | "HOUR" | "DAY";
    isActive?: boolean;
    isSoldByWeight?: boolean;
    isService?: boolean;
    allowDiscount?: boolean;
    minStockLevel?: number;
    maxStockLevel?: number;
}>;
export declare const UpdateProductSchema: z.ZodObject<{
    storeId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taxRuleId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sku: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    unitPrice: z.ZodOptional<z.ZodNumber>;
    costPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    taxInclusive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    unit: z.ZodOptional<z.ZodDefault<z.ZodEnum<["PIECE", "KG", "GRAM", "LITER", "MILLILITER", "METER", "HOUR", "DAY"]>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    isSoldByWeight: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    isService: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    allowDiscount: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    minStockLevel: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    maxStockLevel: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name?: string;
    id?: string;
    barcode?: string;
    unitPrice?: number;
    taxInclusive?: boolean;
    description?: string;
    sku?: string;
    storeId?: string;
    categoryId?: string;
    taxRuleId?: string;
    costPrice?: number;
    unit?: "PIECE" | "KG" | "GRAM" | "LITER" | "MILLILITER" | "METER" | "HOUR" | "DAY";
    isActive?: boolean;
    isSoldByWeight?: boolean;
    isService?: boolean;
    allowDiscount?: boolean;
    minStockLevel?: number;
    maxStockLevel?: number;
}, {
    name?: string;
    id?: string;
    barcode?: string;
    unitPrice?: number;
    taxInclusive?: boolean;
    description?: string;
    sku?: string;
    storeId?: string;
    categoryId?: string;
    taxRuleId?: string;
    costPrice?: number;
    unit?: "PIECE" | "KG" | "GRAM" | "LITER" | "MILLILITER" | "METER" | "HOUR" | "DAY";
    isActive?: boolean;
    isSoldByWeight?: boolean;
    isService?: boolean;
    allowDiscount?: boolean;
    minStockLevel?: number;
    maxStockLevel?: number;
}>;
export type ProductSearchInput = z.infer<typeof ProductSearchSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export declare const CartLineSchema: z.ZodObject<{
    productId: z.ZodString;
    variantId: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    weight: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId?: string;
    quantity?: number;
    unitPrice?: number;
    notes?: string;
    weight?: number;
    variantId?: string;
}, {
    productId?: string;
    quantity?: number;
    unitPrice?: number;
    notes?: string;
    weight?: number;
    variantId?: string;
}>;
export declare const CreateSaleSchema: z.ZodObject<{
    deviceId: z.ZodString;
    shiftId: z.ZodString;
    cashierId: z.ZodString;
    customerId: z.ZodOptional<z.ZodString>;
    storeId: z.ZodString;
    lines: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        variantId: z.ZodOptional<z.ZodString>;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
        weight: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        productId?: string;
        quantity?: number;
        unitPrice?: number;
        notes?: string;
        weight?: number;
        variantId?: string;
    }, {
        productId?: string;
        quantity?: number;
        unitPrice?: number;
        notes?: string;
        weight?: number;
        variantId?: string;
    }>, "many">;
    discountRuleId: z.ZodOptional<z.ZodString>;
    couponCode: z.ZodOptional<z.ZodString>;
    payments: z.ZodArray<z.ZodObject<{
        paymentMethod: z.ZodEnum<["CASH", "CARD_CREDIT", "CARD_DEBIT", "CONTACTLESS", "VOUCHER", "GIFT_CARD", "BANK_TRANSFER", "ACCOUNT"]>;
        amount: z.ZodNumber;
        tendered: z.ZodOptional<z.ZodNumber>;
        reference: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
        amount?: number;
        tendered?: number;
        reference?: string;
    }, {
        paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
        amount?: number;
        tendered?: number;
        reference?: string;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
    tableNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lines?: {
        productId?: string;
        quantity?: number;
        unitPrice?: number;
        notes?: string;
        weight?: number;
        variantId?: string;
    }[];
    payments?: {
        paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
        amount?: number;
        tendered?: number;
        reference?: string;
    }[];
    deviceId?: string;
    notes?: string;
    storeId?: string;
    shiftId?: string;
    cashierId?: string;
    customerId?: string;
    discountRuleId?: string;
    couponCode?: string;
    tableNumber?: string;
}, {
    lines?: {
        productId?: string;
        quantity?: number;
        unitPrice?: number;
        notes?: string;
        weight?: number;
        variantId?: string;
    }[];
    payments?: {
        paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
        amount?: number;
        tendered?: number;
        reference?: string;
    }[];
    deviceId?: string;
    notes?: string;
    storeId?: string;
    shiftId?: string;
    cashierId?: string;
    customerId?: string;
    discountRuleId?: string;
    couponCode?: string;
    tableNumber?: string;
}>;
export declare const VoidSaleSchema: z.ZodObject<{
    saleId: z.ZodString;
    reason: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    saleId?: string;
    reason?: string;
    userId?: string;
}, {
    saleId?: string;
    reason?: string;
    userId?: string;
}>;
export declare const HoldSaleSchema: z.ZodObject<{
    saleId: z.ZodOptional<z.ZodString>;
    cartData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    label: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    saleId?: string;
    cartData?: Record<string, unknown>;
    label?: string;
}, {
    saleId?: string;
    cartData?: Record<string, unknown>;
    label?: string;
}>;
export type CartLineInput = z.infer<typeof CartLineSchema>;
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
export type VoidSaleInput = z.infer<typeof VoidSaleSchema>;
export declare const ProcessPaymentSchema: z.ZodObject<{
    saleId: z.ZodString;
    paymentMethod: z.ZodEnum<["CASH", "CARD_CREDIT", "CARD_DEBIT", "CONTACTLESS", "VOUCHER", "GIFT_CARD", "BANK_TRANSFER", "ACCOUNT"]>;
    amount: z.ZodNumber;
    tendered: z.ZodOptional<z.ZodNumber>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    saleId?: string;
    paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
    amount?: number;
    tendered?: number;
    reference?: string;
}, {
    saleId?: string;
    paymentMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
    amount?: number;
    tendered?: number;
    reference?: string;
}>;
export declare const RefundSchema: z.ZodObject<{
    saleId: z.ZodString;
    userId: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodString;
    refundMethod: z.ZodEnum<["CASH", "CARD_CREDIT", "CARD_DEBIT", "CONTACTLESS", "VOUCHER", "GIFT_CARD", "BANK_TRANSFER", "ACCOUNT"]>;
    lines: z.ZodOptional<z.ZodArray<z.ZodObject<{
        saleLineId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity?: number;
        saleLineId?: string;
    }, {
        quantity?: number;
        saleLineId?: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    lines?: {
        quantity?: number;
        saleLineId?: string;
    }[];
    saleId?: string;
    amount?: number;
    reason?: string;
    userId?: string;
    refundMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
}, {
    lines?: {
        quantity?: number;
        saleLineId?: string;
    }[];
    saleId?: string;
    amount?: number;
    reason?: string;
    userId?: string;
    refundMethod?: "CASH" | "CARD_CREDIT" | "CARD_DEBIT" | "CONTACTLESS" | "VOUCHER" | "GIFT_CARD" | "BANK_TRANSFER" | "ACCOUNT";
}>;
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type RefundInput = z.infer<typeof RefundSchema>;
export declare const OpenShiftSchema: z.ZodObject<{
    deviceId: z.ZodString;
    userId: z.ZodString;
    storeId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    openingBalance: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
    notes?: string;
    storeId?: string;
    userId?: string;
    branchId?: string;
    openingBalance?: number;
}, {
    deviceId?: string;
    notes?: string;
    storeId?: string;
    userId?: string;
    branchId?: string;
    openingBalance?: number;
}>;
export declare const CloseShiftSchema: z.ZodObject<{
    shiftId: z.ZodString;
    closingBalance: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string;
    shiftId?: string;
    closingBalance?: number;
}, {
    notes?: string;
    shiftId?: string;
    closingBalance?: number;
}>;
export declare const CashMovementSchema: z.ZodObject<{
    shiftId: z.ZodString;
    deviceId: z.ZodString;
    userId: z.ZodString;
    movementType: z.ZodEnum<["CASH_IN", "CASH_OUT"]>;
    amount: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
    amount?: number;
    shiftId?: string;
    reason?: string;
    userId?: string;
    movementType?: "CASH_IN" | "CASH_OUT";
}, {
    deviceId?: string;
    amount?: number;
    shiftId?: string;
    reason?: string;
    userId?: string;
    movementType?: "CASH_IN" | "CASH_OUT";
}>;
export type OpenShiftInput = z.infer<typeof OpenShiftSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;
export type CashMovementInput = z.infer<typeof CashMovementSchema>;
export declare const CreateCustomerSchema: z.ZodObject<{
    storeId: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
    taxId: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string;
    storeId?: string;
    phone?: string;
    email?: string;
    lastName?: string;
    firstName?: string;
    company?: string;
    taxId?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
}, {
    notes?: string;
    storeId?: string;
    phone?: string;
    email?: string;
    lastName?: string;
    firstName?: string;
    company?: string;
    taxId?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
}>;
export declare const CustomerSearchSchema: z.ZodObject<{
    query: z.ZodString;
    storeId: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    storeId?: string;
    limit?: number;
}, {
    query?: string;
    storeId?: string;
    limit?: number;
}>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CustomerSearchInput = z.infer<typeof CustomerSearchSchema>;
export declare const AdjustInventorySchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    movementType: z.ZodEnum<["ADJUSTMENT", "PURCHASE", "WASTE", "TRANSFER", "COUNT_CORRECTION", "INITIAL"]>;
    reason: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    productId?: string;
    quantity?: number;
    reason?: string;
    userId?: string;
    movementType?: "ADJUSTMENT" | "PURCHASE" | "WASTE" | "TRANSFER" | "COUNT_CORRECTION" | "INITIAL";
}, {
    productId?: string;
    quantity?: number;
    reason?: string;
    userId?: string;
    movementType?: "ADJUSTMENT" | "PURCHASE" | "WASTE" | "TRANSFER" | "COUNT_CORRECTION" | "INITIAL";
}>;
export type AdjustInventoryInput = z.infer<typeof AdjustInventorySchema>;
export declare const PrintReceiptSchema: z.ZodObject<{
    saleId: z.ZodString;
    printerId: z.ZodString;
    copies: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    saleId?: string;
    printerId?: string;
    copies?: number;
}, {
    saleId?: string;
    printerId?: string;
    copies?: number;
}>;
export declare const PrintInvoiceSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    printerId: z.ZodString;
    copies: z.ZodDefault<z.ZodNumber>;
    sendEmail: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    printerId?: string;
    copies?: number;
    invoiceId?: string;
    sendEmail?: boolean;
}, {
    printerId?: string;
    copies?: number;
    invoiceId?: string;
    sendEmail?: boolean;
}>;
export type PrintReceiptInput = z.infer<typeof PrintReceiptSchema>;
export type PrintInvoiceInput = z.infer<typeof PrintInvoiceSchema>;
export declare const SetSettingSchema: z.ZodObject<{
    storeId: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    dataType: z.ZodDefault<z.ZodEnum<["string", "number", "boolean", "json"]>>;
}, "strip", z.ZodTypeAny, {
    storeId?: string;
    value?: string;
    key?: string;
    dataType?: "string" | "number" | "boolean" | "json";
}, {
    storeId?: string;
    value?: string;
    key?: string;
    dataType?: "string" | "number" | "boolean" | "json";
}>;
export type SetSettingInput = z.infer<typeof SetSettingSchema>;
export declare const DateRangeSchema: z.ZodObject<{
    storeId: z.ZodString;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    deviceId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId?: string;
    storeId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
}, {
    deviceId?: string;
    storeId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
}>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
export declare const CreateDiscountSchema: z.ZodObject<{
    storeId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    discountType: z.ZodEnum<["PERCENTAGE", "FIXED_AMOUNT", "BUY_X_GET_Y", "BUNDLE"]>;
    value: z.ZodNumber;
    scope: z.ZodDefault<z.ZodEnum<["CART", "LINE_ITEM", "CATEGORY", "PRODUCT"]>>;
    categoryId: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodString>;
    minAmount: z.ZodOptional<z.ZodNumber>;
    minQuantity: z.ZodOptional<z.ZodNumber>;
    couponCode: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    requiresAuth: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    productId?: string;
    description?: string;
    storeId?: string;
    categoryId?: string;
    value?: number;
    couponCode?: string;
    startDate?: Date;
    endDate?: Date;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | "BUY_X_GET_Y" | "BUNDLE";
    scope?: "CART" | "LINE_ITEM" | "CATEGORY" | "PRODUCT";
    minAmount?: number;
    minQuantity?: number;
    requiresAuth?: boolean;
}, {
    name?: string;
    productId?: string;
    description?: string;
    storeId?: string;
    categoryId?: string;
    value?: number;
    couponCode?: string;
    startDate?: Date;
    endDate?: Date;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | "BUY_X_GET_Y" | "BUNDLE";
    scope?: "CART" | "LINE_ITEM" | "CATEGORY" | "PRODUCT";
    minAmount?: number;
    minQuantity?: number;
    requiresAuth?: boolean;
}>;
export type CreateDiscountInput = z.infer<typeof CreateDiscountSchema>;
export declare const CreateTaxRuleSchema: z.ZodObject<{
    storeId: z.ZodString;
    name: z.ZodString;
    rate: z.ZodNumber;
    taxClass: z.ZodEnum<["standard", "reduced", "zero", "exempt"]>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    taxClass?: "zero" | "exempt" | "standard" | "reduced";
    rate?: number;
    storeId?: string;
    isDefault?: boolean;
}, {
    name?: string;
    taxClass?: "zero" | "exempt" | "standard" | "reduced";
    rate?: number;
    storeId?: string;
    isDefault?: boolean;
}>;
export type CreateTaxRuleInput = z.infer<typeof CreateTaxRuleSchema>;
