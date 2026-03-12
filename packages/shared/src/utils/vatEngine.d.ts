import type { ICartLine, ICartTotals, ITaxRule, ITaxBreakdownItem, Cents, RatePercentage } from '../types';
/**
 * Banker's rounding (round half to even).
 * Required by German fiscal regulations for VAT calculations.
 */
export declare function bankersRound(value: number): number;
/**
 * Calculate VAT amount from gross (tax-inclusive) price.
 * Formula: VAT = gross - (gross / (1 + rate))
 * Where rate is e.g. 0.19 for 19%
 */
export declare function extractVatFromGross(grossCents: Cents, ratePercentage: RatePercentage): Cents;
/**
 * Calculate VAT amount from net (tax-exclusive) price.
 * Formula: VAT = net × rate
 */
export declare function calculateVatFromNet(netCents: Cents, ratePercentage: RatePercentage): Cents;
/**
 * Get net amount from gross (tax-inclusive) price.
 */
export declare function getNetFromGross(grossCents: Cents, ratePercentage: RatePercentage): Cents;
/**
 * Get gross amount from net (tax-exclusive) price.
 */
export declare function getGrossFromNet(netCents: Cents, ratePercentage: RatePercentage): Cents;
export interface LineVATResult {
    unitNetPrice: Cents;
    unitGrossPrice: Cents;
    unitVatAmount: Cents;
    lineNetAmount: Cents;
    lineVatAmount: Cents;
    lineGrossAmount: Cents;
    taxRate: RatePercentage;
    taxClass: string;
    taxInclusive: boolean;
}
/**
 * Calculate VAT for a single cart line item.
 * Handles both tax-inclusive and tax-exclusive pricing.
 * Quantity is stored as integer × 1000 for 3 decimal precision.
 */
export declare function calculateLineVAT(unitPrice: Cents, quantity: number, // × 1000
taxRate: RatePercentage, taxClass: string, taxInclusive: boolean): LineVATResult;
export interface CartTotalsResult {
    subtotal: Cents;
    discountAmount: Cents;
    taxableAmount: Cents;
    taxAmount: Cents;
    totalAmount: Cents;
    taxBreakdown: ITaxBreakdownItem[];
}
/**
 * Calculate complete cart totals with VAT breakdown.
 * Applies discounts pro-rata across VAT classes for fiscal accuracy.
 */
export declare function calculateCartTotals(lines: Array<{
    quantity: number;
    unitPrice: Cents;
    discountAmount: Cents;
    taxRate: RatePercentage;
    taxClass: string;
    taxInclusive: boolean;
}>): CartTotalsResult;
export declare class VATEngine {
    private readonly taxRules;
    private readonly defaultRule;
    constructor(taxRules: ITaxRule[]);
    getRule(taxRuleId: string): ITaxRule | undefined;
    getDefaultRule(): ITaxRule | undefined;
    getRuleForProduct(taxRuleId?: string): ITaxRule | undefined;
    calculateLineVAT(unitPrice: Cents, quantity: number, taxRuleId?: string): LineVATResult;
    calculateCartTotals(lines: ICartLine[]): ICartTotals;
}
export declare const GERMAN_VAT_RULES: Array<Omit<ITaxRule, 'id' | 'storeId'>>;
export declare function formatCents(cents: Cents, locale?: string, currency?: string): string;
export declare function formatRatePercentage(rate: RatePercentage): string;
export declare function centsFromDecimalString(decimalStr: string): Cents;
export declare function centsToDecimalString(cents: Cents, decimals?: number): string;
