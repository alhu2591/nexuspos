// NexusPOS — Checkout Store (Zustand)
// Central cart state management
// Handles: cart operations, tax calculation, discount application, checkout flow

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createId } from '@paralleldrive/cuid2';
import type { IProduct, ICartLine, ICartTotals, ICustomer, IDiscountRule } from '../../../shared/src/types';
import { calculateCartTotals } from '../../../shared/src/utils/vatEngine';
import { applyDiscounts } from '../../../shared/src/utils/discountEngine';
import { ipcService } from '../services/ipcService';

// ============================================================
// STATE TYPES
// ============================================================

export type CheckoutStep = 'cart' | 'payment' | 'receipt';

export interface CartState {
  lines: ICartLine[];
  customer: ICustomer | null;
  appliedDiscount: IDiscountRule | null;
  couponCode: string | null;
  notes: string;
  totals: ICartTotals;
  step: CheckoutStep;
  isProcessing: boolean;
  lastCompletedSaleId: string | null;
  heldCarts: HeldCart[];
}

export interface HeldCart {
  id: string;
  label: string;
  lines: ICartLine[];
  customer: ICustomer | null;
  heldAt: Date;
}

// ============================================================
// ACTIONS
// ============================================================

export interface CartActions {
  // Cart line operations
  addProduct: (product: IProduct, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateLineDiscount: (lineId: string, discountAmount: number) => void;
  addLineNote: (lineId: string, note: string) => void;

  // Customer
  setCustomer: (customer: ICustomer | null) => void;

  // Discounts
  applyDiscount: (rule: IDiscountRule) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeDiscount: () => void;

  // Cart management
  clearCart: () => void;
  setNotes: (notes: string) => void;

  // Hold / Retrieve
  holdCart: (label?: string) => void;
  retrieveHeldCart: (heldId: string) => void;
  deleteHeldCart: (heldId: string) => void;

  // Checkout flow
  goToPayment: () => void;
  goToCart: () => void;
  completeCheckout: (payments: PaymentInput[]) => Promise<{ saleId: string }>;
  newSale: () => void;

  // Internal
  recalculateTotals: () => void;
}

export interface PaymentInput {
  paymentMethod: string;
  amount: number;
  tendered?: number;
  reference?: string;
}

// ============================================================
// EMPTY TOTALS
// ============================================================

const EMPTY_TOTALS: ICartTotals = {
  subtotal: 0,
  discountAmount: 0,
  taxableAmount: 0,
  taxAmount: 0,
  totalAmount: 0,
  taxBreakdown: [],
};

// ============================================================
// INITIAL STATE
// ============================================================

const initialState: CartState = {
  lines: [],
  customer: null,
  appliedDiscount: null,
  couponCode: null,
  notes: '',
  totals: EMPTY_TOTALS,
  step: 'cart',
  isProcessing: false,
  lastCompletedSaleId: null,
  heldCarts: [],
};

// ============================================================
// STORE
// ============================================================

export const useCheckoutStore = create<CartState & CartActions>()(
  immer((set, get) => ({
    ...initialState,

    // ── ADD PRODUCT ────────────────────────────────────────
    addProduct: (product: IProduct, quantity = 1) => {
      set((state) => {
        // Check if same product already in cart (merge lines)
        const existingLineIndex = state.lines.findIndex(
          (l) => l.productId === product.id && !l.variantId && !l.notes
        );

        if (existingLineIndex >= 0) {
          // Increment quantity
          const line = state.lines[existingLineIndex];
          line.quantity += quantity * 1000;
          // Recalculate line total
          const newTotal = Math.round((line.unitPrice * line.quantity) / 1000);
          const discountFraction = line.discountAmount / line.lineTotal;
          line.lineTotal = newTotal;
          line.discountAmount = Math.round(newTotal * discountFraction);
        } else {
          // Add new line
          const taxRate = product.taxRule?.rate ?? 0;
          const taxInclusive = product.taxInclusive;
          const unitPrice = product.unitPrice;
          const qty = quantity * 1000;
          const lineTotal = Math.round((unitPrice * qty) / 1000);

          // Calculate tax on line total
          let taxAmount = 0;
          if (taxRate > 0) {
            if (taxInclusive) {
              const rate = taxRate / 10000;
              const net = Math.round(lineTotal / (1 + rate));
              taxAmount = lineTotal - net;
            } else {
              const rate = taxRate / 10000;
              taxAmount = Math.round(lineTotal * rate);
            }
          }

          const newLine: ICartLine = {
            id: createId(),
            productId: product.id,
            product,
            quantity: qty,
            unitPrice,
            originalPrice: unitPrice,
            discountAmount: 0,
            taxAmount,
            taxRate,
            taxInclusive,
            lineTotal,
          };

          state.lines.push(newLine);
        }
      });

      get().recalculateTotals();
    },

    // ── REMOVE ITEM ────────────────────────────────────────
    removeItem: (lineId: string) => {
      set((state) => {
        state.lines = state.lines.filter((l) => l.id !== lineId);
      });
      get().recalculateTotals();
    },

    // ── UPDATE QUANTITY ────────────────────────────────────
    updateQuantity: (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        get().removeItem(lineId);
        return;
      }

      set((state) => {
        const line = state.lines.find((l) => l.id === lineId);
        if (!line) return;

        const qty = Math.round(quantity * 1000);
        line.quantity = qty;
        const lineTotal = Math.round((line.unitPrice * qty) / 1000);

        // Recalculate tax
        let taxAmount = 0;
        if (line.taxRate > 0) {
          if (line.taxInclusive) {
            const rate = line.taxRate / 10000;
            const net = Math.round(lineTotal / (1 + rate));
            taxAmount = lineTotal - net;
          } else {
            const rate = line.taxRate / 10000;
            taxAmount = Math.round(lineTotal * rate);
          }
        }

        line.lineTotal = lineTotal;
        line.taxAmount = taxAmount;
        // Proportional discount adjustment
        const discountRate = line.discountAmount / (line.lineTotal || 1);
        line.discountAmount = Math.round(lineTotal * discountRate);
      });

      get().recalculateTotals();
    },

    // ── LINE DISCOUNT ──────────────────────────────────────
    updateLineDiscount: (lineId: string, discountAmount: number) => {
      set((state) => {
        const line = state.lines.find((l) => l.id === lineId);
        if (!line) return;
        line.discountAmount = Math.min(discountAmount, line.lineTotal);
      });
      get().recalculateTotals();
    },

    // ── LINE NOTE ─────────────────────────────────────────
    addLineNote: (lineId: string, note: string) => {
      set((state) => {
        const line = state.lines.find((l) => l.id === lineId);
        if (line) line.notes = note;
      });
    },

    // ── CUSTOMER ──────────────────────────────────────────
    setCustomer: (customer) => {
      set((state) => { state.customer = customer; });
    },

    // ── DISCOUNTS ─────────────────────────────────────────
    applyDiscount: (rule: IDiscountRule) => {
      set((state) => { state.appliedDiscount = rule; });
      get().recalculateTotals();
    },

    applyCoupon: async (code: string) => {
      const result = await ipcService.invoke('settings:get', { key: `coupon:${code}` });
      if (result.success && result.data) {
        // TODO: validate and apply coupon rule
        set((state) => { state.couponCode = code; });
        return true;
      }
      return false;
    },

    removeDiscount: () => {
      set((state) => {
        state.appliedDiscount = null;
        state.couponCode = null;
        // Reset line discounts from rules (keep manual discounts)
        state.lines.forEach((l) => { l.discountAmount = 0; });
      });
      get().recalculateTotals();
    },

    // ── CART MANAGEMENT ───────────────────────────────────
    clearCart: () => {
      set((state) => {
        state.lines = [];
        state.customer = null;
        state.appliedDiscount = null;
        state.couponCode = null;
        state.notes = '';
        state.totals = EMPTY_TOTALS;
        state.step = 'cart';
        state.isProcessing = false;
      });
    },

    setNotes: (notes) => {
      set((state) => { state.notes = notes; });
    },

    // ── HOLD / RETRIEVE ───────────────────────────────────
    holdCart: (label) => {
      const { lines, customer } = get();
      if (lines.length === 0) return;

      set((state) => {
        state.heldCarts.push({
          id: createId(),
          label: label ?? `Hold ${state.heldCarts.length + 1}`,
          lines: [...lines],
          customer,
          heldAt: new Date(),
        });
        state.lines = [];
        state.customer = null;
        state.appliedDiscount = null;
        state.couponCode = null;
        state.totals = EMPTY_TOTALS;
      });
    },

    retrieveHeldCart: (heldId) => {
      const { lines: currentLines } = get();

      set((state) => {
        const held = state.heldCarts.find((h) => h.id === heldId);
        if (!held) return;

        // If current cart has items, push to held
        if (currentLines.length > 0) {
          state.heldCarts.push({
            id: createId(),
            label: 'Auto-hold',
            lines: [...currentLines],
            customer: state.customer,
            heldAt: new Date(),
          });
        }

        state.lines = held.lines;
        state.customer = held.customer;
        state.heldCarts = state.heldCarts.filter((h) => h.id !== heldId);
      });

      get().recalculateTotals();
    },

    deleteHeldCart: (heldId) => {
      set((state) => {
        state.heldCarts = state.heldCarts.filter((h) => h.id !== heldId);
      });
    },

    // ── CHECKOUT FLOW ──────────────────────────────────────
    goToPayment: () => {
      set((state) => { state.step = 'payment'; });
    },

    goToCart: () => {
      set((state) => { state.step = 'cart'; });
    },

    completeCheckout: async (payments: PaymentInput[]) => {
      const state = get();
      set((s) => { s.isProcessing = true; });

      try {
        const sessionResult = await ipcService.invoke('auth:session', {});
        const session = sessionResult.data;

        const shiftResult = await ipcService.invoke('shift:current', {
          deviceId: session.deviceId,
        });
        const shift = shiftResult.data;

        if (!shift) {
          throw new Error('No open shift found. Please open a shift before checkout.');
        }

        const saleData = {
          deviceId: session.deviceId,
          shiftId: shift.id,
          cashierId: session.userId,
          storeId: session.storeId,
          customerId: state.customer?.id,
          lines: state.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            notes: l.notes,
          })),
          payments,
          notes: state.notes || undefined,
        };

        const result = await ipcService.invoke('sale:create', saleData);

        if (!result.success) {
          throw new Error(result.error?.message ?? 'Checkout failed');
        }

        const saleId = result.data.id;

        set((s) => {
          s.lastCompletedSaleId = saleId;
          s.step = 'receipt';
          s.isProcessing = false;
        });

        return { saleId };
      } catch (error) {
        set((s) => { s.isProcessing = false; });
        throw error;
      }
    },

    newSale: () => {
      get().clearCart();
    },

    // ── RECALCULATE TOTALS ─────────────────────────────────
    recalculateTotals: () => {
      const { lines, appliedDiscount } = get();

      if (lines.length === 0) {
        set((state) => { state.totals = EMPTY_TOTALS; });
        return;
      }

      // Apply discount rules
      const cartTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const cartQty = lines.reduce((sum, l) => sum + l.quantity / 1000, 0);

      if (appliedDiscount) {
        const { lineDiscounts } = applyDiscounts(
          lines,
          [appliedDiscount],
          cartTotal,
          cartQty
        );

        set((state) => {
          state.lines.forEach((line) => {
            const discount = lineDiscounts.get(line.id) ?? 0;
            line.discountAmount = discount;

            // Recalculate tax on discounted amount
            const discountedTotal = line.lineTotal - discount;
            if (line.taxRate > 0 && line.taxInclusive) {
              const rate = line.taxRate / 10000;
              line.taxAmount = discountedTotal - Math.round(discountedTotal / (1 + rate));
            }
          });
        });
      }

      // Calculate final totals
      const updatedLines = get().lines;
      const totalsInput = updatedLines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        taxRate: l.taxRate,
        taxClass: 'standard',
        taxInclusive: l.taxInclusive,
      }));

      const result = calculateCartTotals(totalsInput);

      set((state) => {
        state.totals = {
          subtotal: result.subtotal,
          discountAmount: result.discountAmount,
          taxableAmount: result.taxableAmount,
          taxAmount: result.taxAmount,
          totalAmount: result.totalAmount,
          taxBreakdown: result.taxBreakdown,
        };
      });
    },
  }))
);
