// NexusPOS — VAT Engine
// Domain Layer — Pure business logic, zero external dependencies
//
// Key design decisions:
// - ALL monetary values in integer cents to avoid floating-point errors
// - Rate stored as integer × 100 (e.g., 1900 = 19.00%)
// - Rounding uses banker's rounding (round half to even) for fiscal accuracy

import type {
  ICartLine,
  ICartTotals,
  ITaxRule,
  ITaxBreakdownItem,
  Cents,
  RatePercentage,
} from '../types';

// ============================================================
// MONETARY ARITHMETIC
// All calculations in integer cents
// ============================================================

/**
 * Banker's rounding (round half to even).
 * Required by German fiscal regulations for VAT calculations.
 */
export function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;

  if (decimal < 0.5) return floor;
  if (decimal > 0.5) return floor + 1;
  // Exactly 0.5 — round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Calculate VAT amount from gross (tax-inclusive) price.
 * Formula: VAT = gross - (gross / (1 + rate))
 * Where rate is e.g. 0.19 for 19%
 */
export function extractVatFromGross(grossCents: Cents, ratePercentage: RatePercentage): Cents {
  const rate = ratePercentage / 10000; // Convert from rate×100 to decimal
  const netCents = grossCents / (1 + rate);
  const vatCents = grossCents - netCents;
  return bankersRound(vatCents);
}

/**
 * Calculate VAT amount from net (tax-exclusive) price.
 * Formula: VAT = net × rate
 */
export function calculateVatFromNet(netCents: Cents, ratePercentage: RatePercentage): Cents {
  const rate = ratePercentage / 10000;
  return bankersRound(netCents * rate);
}

/**
 * Get net amount from gross (tax-inclusive) price.
 */
export function getNetFromGross(grossCents: Cents, ratePercentage: RatePercentage): Cents {
  const rate = ratePercentage / 10000;
  return bankersRound(grossCents / (1 + rate));
}

/**
 * Get gross amount from net (tax-exclusive) price.
 */
export function getGrossFromNet(netCents: Cents, ratePercentage: RatePercentage): Cents {
  const rate = ratePercentage / 10000;
  return bankersRound(netCents * (1 + rate));
}

// ============================================================
// LINE ITEM VAT CALCULATION
// ============================================================

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
export function calculateLineVAT(
  unitPrice: Cents,
  quantity: number, // × 1000
  taxRate: RatePercentage,
  taxClass: string,
  taxInclusive: boolean
): LineVATResult {
  const quantityDecimal = quantity / 1000;

  // Zero-rated or exempt items
  if (taxRate === 0 || taxClass === 'exempt') {
    const lineAmount = bankersRound(unitPrice * quantityDecimal);
    return {
      unitNetPrice: unitPrice,
      unitGrossPrice: unitPrice,
      unitVatAmount: 0,
      lineNetAmount: lineAmount,
      lineVatAmount: 0,
      lineGrossAmount: lineAmount,
      taxRate,
      taxClass,
      taxInclusive,
    };
  }

  if (taxInclusive) {
    // Price INCLUDES VAT
    const unitNetPrice = getNetFromGross(unitPrice, taxRate);
    const unitVatAmount = unitPrice - unitNetPrice;

    // Calculate on line totals (not per-unit × qty to minimize rounding errors)
    const lineGrossAmount = bankersRound(unitPrice * quantityDecimal);
    const lineNetAmount = getNetFromGross(lineGrossAmount, taxRate);
    const lineVatAmount = lineGrossAmount - lineNetAmount;

    return {
      unitNetPrice,
      unitGrossPrice: unitPrice,
      unitVatAmount,
      lineNetAmount,
      lineVatAmount,
      lineGrossAmount,
      taxRate,
      taxClass,
      taxInclusive,
    };
  } else {
    // Price EXCLUDES VAT
    const unitVatAmount = calculateVatFromNet(unitPrice, taxRate);
    const unitGrossPrice = unitPrice + unitVatAmount;

    const lineNetAmount = bankersRound(unitPrice * quantityDecimal);
    const lineVatAmount = calculateVatFromNet(lineNetAmount, taxRate);
    const lineGrossAmount = lineNetAmount + lineVatAmount;

    return {
      unitNetPrice: unitPrice,
      unitGrossPrice,
      unitVatAmount,
      lineNetAmount,
      lineVatAmount,
      lineGrossAmount,
      taxRate,
      taxClass,
      taxInclusive,
    };
  }
}

// ============================================================
// CART TOTALS CALCULATION
// ============================================================

export interface CartTotalsResult {
  subtotal: Cents;           // Sum of line gross amounts before discounts
  discountAmount: Cents;     // Total discounts applied
  taxableAmount: Cents;      // Net amount subject to tax after discounts
  taxAmount: Cents;          // Total VAT amount
  totalAmount: Cents;        // Final amount due
  taxBreakdown: ITaxBreakdownItem[];
}

/**
 * Calculate complete cart totals with VAT breakdown.
 * Applies discounts pro-rata across VAT classes for fiscal accuracy.
 */
export function calculateCartTotals(
  lines: Array<{
    quantity: number;
    unitPrice: Cents;
    discountAmount: Cents;
    taxRate: RatePercentage;
    taxClass: string;
    taxInclusive: boolean;
  }>
): CartTotalsResult {
  if (lines.length === 0) {
    return {
      subtotal: 0,
      discountAmount: 0,
      taxableAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      taxBreakdown: [],
    };
  }

  // Group lines by tax rate for breakdown
  const taxGroups = new Map<string, {
    taxRate: RatePercentage;
    taxClass: string;
    taxInclusive: boolean;
    netAmount: Cents;
    taxAmount: Cents;
    grossAmount: Cents;
  }>();

  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalGross = 0;

  for (const line of lines) {
    const quantityDecimal = line.quantity / 1000;
    const grossBeforeDiscount = bankersRound(line.unitPrice * quantityDecimal);
    const discountAmount = line.discountAmount;
    const grossAfterDiscount = Math.max(0, grossBeforeDiscount - discountAmount);

    totalSubtotal += grossBeforeDiscount;
    totalDiscount += discountAmount;

    // Calculate VAT on the discounted amount
    let netAmount: Cents;
    let taxAmount: Cents;
    let grossAmount: Cents;

    if (line.taxRate === 0 || line.taxClass === 'exempt') {
      netAmount = grossAfterDiscount;
      taxAmount = 0;
      grossAmount = grossAfterDiscount;
    } else if (line.taxInclusive) {
      netAmount = getNetFromGross(grossAfterDiscount, line.taxRate);
      taxAmount = grossAfterDiscount - netAmount;
      grossAmount = grossAfterDiscount;
    } else {
      netAmount = grossAfterDiscount;
      taxAmount = calculateVatFromNet(grossAfterDiscount, line.taxRate);
      grossAmount = grossAfterDiscount + taxAmount;
    }

    totalTax += taxAmount;
    totalGross += grossAmount;

    // Accumulate tax breakdown by rate
    const groupKey = `${line.taxRate}:${line.taxClass}`;
    const existing = taxGroups.get(groupKey);
    if (existing) {
      existing.netAmount += netAmount;
      existing.taxAmount += taxAmount;
      existing.grossAmount += grossAmount;
    } else {
      taxGroups.set(groupKey, {
        taxRate: line.taxRate,
        taxClass: line.taxClass,
        taxInclusive: line.taxInclusive,
        netAmount,
        taxAmount,
        grossAmount,
      });
    }
  }

  const taxBreakdown: ITaxBreakdownItem[] = Array.from(taxGroups.values()).map(g => ({
    taxClass: g.taxClass,
    taxRate: g.taxRate,
    netAmount: g.netAmount,
    taxAmount: g.taxAmount,
    grossAmount: g.grossAmount,
  }));

  // Sort breakdown by rate descending (19% first, then 7%, then 0%)
  taxBreakdown.sort((a, b) => b.taxRate - a.taxRate);

  return {
    subtotal: totalSubtotal,
    discountAmount: totalDiscount,
    taxableAmount: totalGross - totalTax,
    taxAmount: totalTax,
    totalAmount: totalGross,
    taxBreakdown,
  };
}

// ============================================================
// VAT ENGINE CLASS
// ============================================================

export class VATEngine {
  private readonly taxRules: Map<string, ITaxRule>;
  private readonly defaultRule: ITaxRule | undefined;

  constructor(taxRules: ITaxRule[]) {
    this.taxRules = new Map(taxRules.map(r => [r.id, r]));
    this.defaultRule = taxRules.find(r => r.isDefault && r.isActive);
  }

  getRule(taxRuleId: string): ITaxRule | undefined {
    return this.taxRules.get(taxRuleId);
  }

  getDefaultRule(): ITaxRule | undefined {
    return this.defaultRule;
  }

  getRuleForProduct(taxRuleId?: string): ITaxRule | undefined {
    if (taxRuleId) {
      return this.taxRules.get(taxRuleId) ?? this.defaultRule;
    }
    return this.defaultRule;
  }

  calculateLineVAT(
    unitPrice: Cents,
    quantity: number,
    taxRuleId?: string
  ): LineVATResult {
    const rule = this.getRuleForProduct(taxRuleId);
    const taxRate = rule?.rate ?? 0;
    const taxClass = rule?.taxClass ?? 'zero';
    const taxInclusive = true; // Default: price includes VAT (German standard)

    return calculateLineVAT(unitPrice, quantity, taxRate, taxClass, taxInclusive);
  }

  calculateCartTotals(lines: ICartLine[]): ICartTotals {
    const mappedLines = lines.map(line => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRate: line.taxRate,
      // Use the actual tax class from the product's tax rule, fall back to 'standard'
      taxClass: (line as any).taxClass ?? (line.taxRate === 0 ? 'zero' : 'standard'),
      taxInclusive: line.taxInclusive,
    }));

    const result = calculateCartTotals(mappedLines);

    return {
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      taxableAmount: result.taxableAmount,
      taxAmount: result.taxAmount,
      totalAmount: result.totalAmount,
      taxBreakdown: result.taxBreakdown,
    };
  }
}

// ============================================================
// GERMAN VAT PRESETS
// ============================================================

export const GERMAN_VAT_RULES: Array<Omit<ITaxRule, 'id' | 'storeId'>> = [
  {
    name: 'MwSt. 19%',
    rate: 1900,
    taxClass: 'standard',
    isDefault: true,
    isActive: true,
  },
  {
    name: 'MwSt. 7%',
    rate: 700,
    taxClass: 'reduced',
    isDefault: false,
    isActive: true,
  },
  {
    name: 'Steuerfrei 0%',
    rate: 0,
    taxClass: 'zero',
    isDefault: false,
    isActive: true,
  },
];

// ============================================================
// FORMATTING UTILITIES
// ============================================================

export function formatCents(cents: Cents, locale = 'de-DE', currency = 'EUR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatRatePercentage(rate: RatePercentage): string {
  return `${(rate / 100).toFixed(2)}%`;
}

export function centsFromDecimalString(decimalStr: string): Cents {
  // Parse "19.99" → 1999
  const parsed = parseFloat(decimalStr);
  if (isNaN(parsed)) throw new Error(`Invalid decimal string: ${decimalStr}`);
  return Math.round(parsed * 100);
}

export function centsToDecimalString(cents: Cents, decimals = 2): string {
  return (cents / 100).toFixed(decimals);
}
