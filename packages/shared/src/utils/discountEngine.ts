// NexusPOS — Discount Engine
// Domain Layer — Pure business logic
// Handles all discount calculation and validation

import type { ICartLine, IDiscountRule, Cents } from '../types';
import { bankersRound } from './vatEngine';

// ============================================================
// DISCOUNT RESULT TYPES
// ============================================================

export interface DiscountApplicationResult {
  appliedDiscounts: AppliedDiscountResult[];
  totalDiscountAmount: Cents;
  lineDiscounts: Map<string, Cents>; // lineId → discount amount
}

export interface AppliedDiscountResult {
  ruleId?: string;
  name: string;
  discountType: string;
  value: number;
  amount: Cents;
  scope: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
}

// ============================================================
// DISCOUNT VALIDATION
// ============================================================

export function validateDiscountRule(
  rule: IDiscountRule,
  cartTotal: Cents,
  cartQuantity: number,
  now = new Date()
): DiscountValidationResult {
  if (!rule.isActive) {
    return { valid: false, reason: 'Discount is not active' };
  }

  if (rule.minAmount !== undefined && cartTotal < rule.minAmount) {
    return {
      valid: false,
      reason: `Minimum cart total of ${rule.minAmount / 100} required`,
    };
  }

  if (rule.minQuantity !== undefined && cartQuantity < rule.minQuantity) {
    return {
      valid: false,
      reason: `Minimum quantity of ${rule.minQuantity} required`,
    };
  }

  if (rule.maxUses !== undefined && rule.usedCount !== undefined) {
    if (rule.usedCount >= rule.maxUses) {
      return { valid: false, reason: 'Discount usage limit reached' };
    }
  }

  if (rule.startDate && now < new Date(rule.startDate)) {
    return { valid: false, reason: 'Discount not yet active' };
  }

  if (rule.endDate && now > new Date(rule.endDate)) {
    return { valid: false, reason: 'Discount has expired' };
  }

  return { valid: true };
}

// ============================================================
// DISCOUNT CALCULATION
// ============================================================

/**
 * Calculate discount amount for a given value.
 * PERCENTAGE: value is percentage × 100 (e.g., 1000 = 10.00%)
 * FIXED_AMOUNT: value is cents (e.g., 500 = €5.00)
 */
export function calculateDiscountAmount(
  baseAmount: Cents,
  discountType: string,
  discountValue: number
): Cents {
  if (baseAmount <= 0) return 0;

  switch (discountType) {
    case 'PERCENTAGE': {
      const rate = discountValue / 10000; // e.g., 1000 → 0.10 = 10%
      const discount = bankersRound(baseAmount * rate);
      return Math.min(discount, baseAmount);
    }

    case 'FIXED_AMOUNT': {
      return Math.min(discountValue, baseAmount);
    }

    default:
      return 0;
  }
}

/**
 * Apply cart-level discount (distributed pro-rata across lines).
 * Pro-rata distribution ensures correct VAT calculation per tax class.
 */
export function applyCartDiscount(
  lines: ICartLine[],
  discountRule: IDiscountRule,
  cartTotal: Cents
): Map<string, Cents> {
  const lineDiscounts = new Map<string, Cents>();

  if (discountRule.scope !== 'CART') {
    return lineDiscounts;
  }

  const totalDiscount = calculateDiscountAmount(cartTotal, discountRule.discountType, discountRule.value);

  if (totalDiscount === 0 || lines.length === 0) {
    return lineDiscounts;
  }

  // Distribute pro-rata based on line contribution to total
  // This preserves correct VAT class breakdown
  let distributed = 0;

  lines.forEach((line, index) => {
    const lineGross = line.lineTotal;
    let lineDiscount: Cents;

    if (index === lines.length - 1) {
      // Last line gets remainder to avoid rounding errors
      lineDiscount = totalDiscount - distributed;
    } else {
      const proportion = lineGross / cartTotal;
      lineDiscount = bankersRound(totalDiscount * proportion);
    }

    lineDiscount = Math.min(lineDiscount, lineGross);
    lineDiscounts.set(line.id, lineDiscount);
    distributed += lineDiscount;
  });

  return lineDiscounts;
}

/**
 * Apply line-item or product-level discount.
 */
export function applyLineDiscount(
  line: ICartLine,
  discountRule: IDiscountRule
): Cents {
  if (discountRule.scope === 'CART') return 0;

  // Check if discount applies to this line
  if (discountRule.scope === 'PRODUCT' && discountRule.productId !== line.productId) {
    return 0;
  }

  if (discountRule.scope === 'CATEGORY' && discountRule.categoryId !== line.product?.categoryId) {
    return 0;
  }

  return calculateDiscountAmount(line.lineTotal, discountRule.discountType, discountRule.value);
}

/**
 * Apply all active discount rules to a cart.
 * Rules are applied in order: line items first, then cart-level.
 * Multiple discounts are not stacked by default (highest wins per line).
 */
export function applyDiscounts(
  lines: ICartLine[],
  rules: IDiscountRule[],
  cartTotal: Cents,
  cartQuantity: number
): DiscountApplicationResult {
  const appliedDiscounts: AppliedDiscountResult[] = [];
  const lineDiscountMap = new Map<string, Cents>();

  // Initialize all line discounts to 0
  lines.forEach(line => lineDiscountMap.set(line.id, 0));

  // Sort rules: line-level rules first, then cart-level
  const sortedRules = [...rules].sort((a, b) => {
    if (a.scope === 'CART' && b.scope !== 'CART') return 1;
    if (a.scope !== 'CART' && b.scope === 'CART') return -1;
    return 0;
  });

  for (const rule of sortedRules) {
    const validation = validateDiscountRule(rule, cartTotal, cartQuantity);
    if (!validation.valid) continue;

    if (rule.scope === 'CART') {
      // Cart-level discount
      const discountAmount = calculateDiscountAmount(cartTotal, rule.discountType, rule.value);
      if (discountAmount > 0) {
        const distribution = applyCartDiscount(lines, rule, cartTotal);
        distribution.forEach((amount, lineId) => {
          const current = lineDiscountMap.get(lineId) ?? 0;
          lineDiscountMap.set(lineId, current + amount);
        });

        appliedDiscounts.push({
          ruleId: rule.id,
          name: rule.name,
          discountType: rule.discountType,
          value: rule.value,
          amount: discountAmount,
          scope: rule.scope,
        });
      }
    } else {
      // Line-level discount
      let totalLineDiscount = 0;
      for (const line of lines) {
        const lineDiscount = applyLineDiscount(line, rule);
        if (lineDiscount > 0) {
          const current = lineDiscountMap.get(line.id) ?? 0;
          lineDiscountMap.set(line.id, Math.min(current + lineDiscount, line.lineTotal));
          totalLineDiscount += lineDiscount;
        }
      }

      if (totalLineDiscount > 0) {
        appliedDiscounts.push({
          ruleId: rule.id,
          name: rule.name,
          discountType: rule.discountType,
          value: rule.value,
          amount: totalLineDiscount,
          scope: rule.scope,
        });
      }
    }
  }

  const totalDiscountAmount = Array.from(lineDiscountMap.values()).reduce((sum, d) => sum + d, 0);

  return {
    appliedDiscounts,
    totalDiscountAmount,
    lineDiscounts: lineDiscountMap,
  };
}

// ============================================================
// MANUAL DISCOUNT (Cashier-applied)
// ============================================================

export interface ManualDiscount {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  reason?: string;
  authorizedBy?: string;
}

export function applyManualDiscount(
  lineTotal: Cents,
  discount: ManualDiscount
): Cents {
  const amount = calculateDiscountAmount(lineTotal, discount.type, discount.value);
  return Math.min(amount, lineTotal);
}
