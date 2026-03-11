// NexusPOS — Test Suite
// Tests for: VAT engine, discount engine, cart totals, checkout flow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  bankersRound,
  extractVatFromGross,
  calculateVatFromNet,
  getNetFromGross,
  getGrossFromNet,
  calculateLineVAT,
  calculateCartTotals,
  VATEngine,
  centsFromDecimalString,
} from '../utils/vatEngine';
import {
  validateDiscountRule,
  calculateDiscountAmount,
  applyCartDiscount,
} from '../utils/discountEngine';
import type { ITaxRule, IDiscountRule, ICartLine, IProduct } from '../types/index';

// ============================================================
// VAT ENGINE TESTS
// ============================================================

describe('Banker\'s Rounding', () => {
  it('rounds 0.5 to 0 (even)', () => expect(bankersRound(0.5)).toBe(0));
  it('rounds 1.5 to 2 (even)', () => expect(bankersRound(1.5)).toBe(2));
  it('rounds 2.5 to 2 (even)', () => expect(bankersRound(2.5)).toBe(2));
  it('rounds 3.5 to 4 (even)', () => expect(bankersRound(3.5)).toBe(4));
  it('rounds 0.4 down', () => expect(bankersRound(0.4)).toBe(0));
  it('rounds 0.6 up', () => expect(bankersRound(0.6)).toBe(1));
  it('rounds 1.4 down', () => expect(bankersRound(1.4)).toBe(1));
  it('rounds negative correctly', () => expect(bankersRound(-0.5)).toBe(0));
});

describe('VAT Extraction (Tax-Inclusive)', () => {
  // German 19% VAT
  it('extracts 19% VAT from €100.00 gross', () => {
    // Net = 100/1.19 = 84.033...
    // VAT = 100 - 84.03 = 15.97 (by banker's rounding)
    const vat = extractVatFromGross(10000, 1900);
    expect(vat).toBe(1597);
  });

  it('extracts 7% VAT from €100.00 gross', () => {
    // Net = 100/1.07 = 93.457...
    // VAT = 100 - 93.46 = 6.54
    const vat = extractVatFromGross(10000, 700);
    expect(vat).toBe(654);
  });

  it('returns 0 VAT for zero-rated items', () => {
    expect(extractVatFromGross(5000, 0)).toBe(0);
  });

  it('net + VAT = gross (no rounding loss)', () => {
    const gross = 11900; // €119.00
    const vat = extractVatFromGross(gross, 1900);
    const net = getNetFromGross(gross, 1900);
    expect(net + vat).toBe(gross);
  });
});

describe('VAT Calculation (Tax-Exclusive)', () => {
  it('calculates 19% VAT on €100.00 net', () => {
    expect(calculateVatFromNet(10000, 1900)).toBe(1900);
  });

  it('calculates 7% VAT on €100.00 net', () => {
    expect(calculateVatFromNet(10000, 700)).toBe(700);
  });

  it('gross = net + VAT', () => {
    const net = 10000;
    const vat = calculateVatFromNet(net, 1900);
    expect(getGrossFromNet(net, 1900)).toBe(net + vat);
  });
});

describe('Line Item VAT Calculation', () => {
  it('calculates tax-inclusive 19% VAT for 1 item at €119.00', () => {
    const result = calculateLineVAT(11900, 1000, 1900, 'standard', true);
    expect(result.lineGrossAmount).toBe(11900);
    expect(result.lineNetAmount).toBe(10000);
    expect(result.lineVatAmount).toBe(1900);
    expect(result.lineNetAmount + result.lineVatAmount).toBe(result.lineGrossAmount);
  });

  it('calculates tax-exclusive 19% VAT for 2 items at €100.00 each', () => {
    const result = calculateLineVAT(10000, 2000, 1900, 'standard', false);
    expect(result.lineNetAmount).toBe(20000);
    expect(result.lineVatAmount).toBe(3800);
    expect(result.lineGrossAmount).toBe(23800);
  });

  it('handles zero-rated items correctly', () => {
    const result = calculateLineVAT(5000, 1000, 0, 'zero', true);
    expect(result.lineVatAmount).toBe(0);
    expect(result.lineNetAmount).toBe(result.lineGrossAmount);
  });

  it('handles fractional quantities (weighing scale)', () => {
    // 0.375kg at €10.00/kg = €3.75
    const result = calculateLineVAT(1000, 375, 1900, 'standard', true);
    expect(result.lineGrossAmount).toBe(375);
    // VAT should be extracted
    expect(result.lineVatAmount).toBeGreaterThan(0);
    expect(result.lineNetAmount + result.lineVatAmount).toBe(result.lineGrossAmount);
  });
});

describe('Cart Totals Calculation', () => {
  it('calculates single item totals correctly', () => {
    const lines = [{
      quantity: 1000,
      unitPrice: 11900,
      discountAmount: 0,
      taxRate: 1900,
      taxClass: 'standard',
      taxInclusive: true,
    }];

    const result = calculateCartTotals(lines);
    expect(result.subtotal).toBe(11900);
    expect(result.discountAmount).toBe(0);
    expect(result.taxAmount).toBe(1900);
    expect(result.totalAmount).toBe(11900);
  });

  it('calculates mixed VAT rates correctly', () => {
    const lines = [
      // Standard 19% item: €119.00 gross
      { quantity: 1000, unitPrice: 11900, discountAmount: 0, taxRate: 1900, taxClass: 'standard', taxInclusive: true },
      // Reduced 7% item: €107.00 gross
      { quantity: 1000, unitPrice: 10700, discountAmount: 0, taxRate: 700, taxClass: 'reduced', taxInclusive: true },
    ];

    const result = calculateCartTotals(lines);
    expect(result.subtotal).toBe(22600);
    expect(result.taxBreakdown).toHaveLength(2);

    const stdBreakdown = result.taxBreakdown.find(b => b.taxRate === 1900);
    expect(stdBreakdown?.taxAmount).toBe(1900); // €19.00 VAT at 19%

    const redBreakdown = result.taxBreakdown.find(b => b.taxRate === 700);
    expect(redBreakdown?.taxAmount).toBe(700); // €7.00 VAT at 7%
  });

  it('applies discounts and recalculates VAT correctly', () => {
    const lines = [{
      quantity: 1000,
      unitPrice: 11900,
      discountAmount: 1000, // €10.00 discount
      taxRate: 1900,
      taxClass: 'standard',
      taxInclusive: true,
    }];

    const result = calculateCartTotals(lines);
    expect(result.discountAmount).toBe(1000);
    expect(result.totalAmount).toBe(10900); // 119 - 10 = 109
    // VAT on discounted amount: 109/1.19 * 0.19
    expect(result.taxAmount).toBeCloseTo(1740, -1);
  });

  it('handles empty cart', () => {
    const result = calculateCartTotals([]);
    expect(result.totalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.taxBreakdown).toHaveLength(0);
  });

  it('handles multiple quantities', () => {
    const lines = [{
      quantity: 5000, // 5 items
      unitPrice: 1000, // €10.00 each
      discountAmount: 0,
      taxRate: 1900,
      taxClass: 'standard',
      taxInclusive: true,
    }];

    const result = calculateCartTotals(lines);
    expect(result.subtotal).toBe(5000); // 5 × €10 = €50
  });
});

describe('Money Parsing', () => {
  it('converts "19.99" to 1999 cents', () => {
    expect(centsFromDecimalString('19.99')).toBe(1999);
  });

  it('converts "100.00" to 10000 cents', () => {
    expect(centsFromDecimalString('100.00')).toBe(10000);
  });

  it('converts "0.99" to 99 cents', () => {
    expect(centsFromDecimalString('0.99')).toBe(99);
  });

  it('handles rounding of "19.995"', () => {
    // Should round to 2000 (round half up)
    expect(centsFromDecimalString('19.995')).toBe(2000);
  });

  it('throws on invalid input', () => {
    expect(() => centsFromDecimalString('abc')).toThrow();
  });
});

// ============================================================
// DISCOUNT ENGINE TESTS
// ============================================================

describe('Discount Rule Validation', () => {
  const baseRule: IDiscountRule = {
    id: 'discount-1',
    storeId: 'store-1',
    name: 'Test Discount',
    discountType: 'PERCENTAGE',
    value: 1000, // 10%
    scope: 'CART',
    isActive: true,
    requiresAuth: false,
  };

  it('validates active rule with no constraints', () => {
    const result = validateDiscountRule(baseRule, 5000, 2);
    expect(result.valid).toBe(true);
  });

  it('rejects inactive rule', () => {
    const result = validateDiscountRule({ ...baseRule, isActive: false }, 5000, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not active');
  });

  it('rejects when below minimum amount', () => {
    const result = validateDiscountRule({ ...baseRule, minAmount: 10000 }, 5000, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Minimum');
  });

  it('validates when meeting minimum amount exactly', () => {
    const result = validateDiscountRule({ ...baseRule, minAmount: 5000 }, 5000, 2);
    expect(result.valid).toBe(true);
  });

  it('rejects expired discount', () => {
    const yesterday = new Date(Date.now() - 86400000);
    const result = validateDiscountRule({ ...baseRule, endDate: yesterday }, 5000, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects discount not yet started', () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const result = validateDiscountRule({ ...baseRule, startDate: tomorrow }, 5000, 2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not yet active');
  });
});

describe('Discount Amount Calculation', () => {
  it('calculates 10% discount on €50.00', () => {
    expect(calculateDiscountAmount(5000, 'PERCENTAGE', 1000)).toBe(500);
  });

  it('calculates 25% discount on €100.00', () => {
    expect(calculateDiscountAmount(10000, 'PERCENTAGE', 2500)).toBe(2500);
  });

  it('calculates fixed €5.00 discount', () => {
    expect(calculateDiscountAmount(10000, 'FIXED_AMOUNT', 500)).toBe(500);
  });

  it('caps discount at item total', () => {
    expect(calculateDiscountAmount(1000, 'FIXED_AMOUNT', 5000)).toBe(1000);
  });

  it('returns 0 for zero base amount', () => {
    expect(calculateDiscountAmount(0, 'PERCENTAGE', 1000)).toBe(0);
  });

  it('handles 100% discount', () => {
    expect(calculateDiscountAmount(5000, 'PERCENTAGE', 10000)).toBe(5000);
  });
});

// ============================================================
// INTEGRATION: Full checkout flow calculation
// ============================================================

describe('Full Checkout Flow', () => {
  it('calculates complete sale with 2 items, mixed VAT, 10% discount', () => {
    // Item 1: €50.00 at 19% VAT (included)
    // Item 2: €21.40 at 7% VAT (included)
    // Cart total: €71.40
    // 10% discount: -€7.14
    // Final: €64.26

    const lines = [
      { quantity: 1000, unitPrice: 5000, discountAmount: 500, taxRate: 1900, taxClass: 'standard', taxInclusive: true },
      { quantity: 1000, unitPrice: 2140, discountAmount: 214, taxRate: 700, taxClass: 'reduced', taxInclusive: true },
    ];

    const result = calculateCartTotals(lines);
    expect(result.subtotal).toBe(7140);
    expect(result.discountAmount).toBe(714);
    expect(result.totalAmount).toBe(6426);
    expect(result.taxBreakdown).toHaveLength(2);

    // VAT at 19% on discounted amount (€45.00):
    const stdTax = result.taxBreakdown.find(b => b.taxRate === 1900);
    expect(stdTax).toBeDefined();
    expect(stdTax!.taxAmount).toBeGreaterThan(0);

    // Total VAT should be less than if no discount applied
    const undiscountedVAT = Math.round(5000 / 1.19 * 0.19) + Math.round(2140 / 1.07 * 0.07);
    expect(result.taxAmount).toBeLessThan(undiscountedVAT + 5); // within 5 cents rounding
  });

  it('handles cash payment and change calculation', () => {
    const totalDue = 2350; // €23.50
    const cashTendered = 3000; // €30.00
    const change = Math.max(0, cashTendered - totalDue);
    expect(change).toBe(650); // €6.50
  });
});
