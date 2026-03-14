// NexusPOS — Checkout Store (Zustand)
// Central cart state management
// Handles: cart operations, tax calculation, discount application, checkout flow

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createId } from '@paralleldrive/cuid2';
import type { IProduct, ICartLine, ICartTotals, ICustomer, IDiscountRule } from '@nexuspos/shared';
import { calculateCartTotals, applyDiscounts } from '@nexuspos/shared';
import { ipcService } from '../services/ipcService';
import { useSettingsStore } from './settingsStore';
import { useAuthStore } from './authStore';

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
  addProduct: (product: IProduct, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateLineDiscount: (lineId: string, discountAmount: number) => void;
  addLineNote: (lineId: string, note: string) => void;

  setCustomer: (customer: ICustomer | null) => void;

  applyDiscount: (rule: IDiscountRule) => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeDiscount: () => void;

  clearCart: () => void;
  setNotes: (notes: string) => void;

  holdCart: (label?: string) => void;
  retrieveHeldCart: (heldId: string) => void;
  deleteHeldCart: (heldId: string) => void;

  goToPayment: () => void;
  goToCart: () => void;
  completeCheckout: (payments: PaymentInput[]) => Promise<{ saleId: string }>;
  newSale: () => void;

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
        const existingLineIndex = state.lines.findIndex(
          (l) => l.productId === product.id && !l.variantId && !l.notes
        );

        if (existingLineIndex >= 0) {
          const line = state.lines[existingLineIndex];
          const prevTotal = line.lineTotal;
          line.quantity += quantity * 1000;
          const newTotal = Math.round((line.unitPrice * line.quantity) / 1000);
          // Preserve proportional discount when merging
          const discountRate = prevTotal > 0 ? line.discountAmount / prevTotal : 0;
          line.lineTotal = newTotal;
          line.discountAmount = Math.round(newTotal * discountRate);
          // Recalculate tax
          if (line.taxRate > 0) {
            const discountedTotal = newTotal - line.discountAmount;
            if (line.taxInclusive) {
              const rate = line.taxRate / 10000;
              line.taxAmount = discountedTotal - Math.round(discountedTotal / (1 + rate));
            } else {
              line.taxAmount = Math.round(discountedTotal * (line.taxRate / 10000));
            }
          }
        } else {
          const taxRate = product.taxRule?.rate ?? 0;
          const taxInclusive = product.taxInclusive;
          const unitPrice = product.unitPrice;
          const qty = quantity * 1000;
          const lineTotal = Math.round((unitPrice * qty) / 1000);

          let taxAmount = 0;
          if (taxRate > 0) {
            if (taxInclusive) {
              const rate = taxRate / 10000;
              taxAmount = lineTotal - Math.round(lineTotal / (1 + rate));
            } else {
              taxAmount = Math.round(lineTotal * (taxRate / 10000));
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

        let taxAmount = 0;
        if (line.taxRate > 0) {
          if (line.taxInclusive) {
            const rate = line.taxRate / 10000;
            taxAmount = lineTotal - Math.round(lineTotal / (1 + rate));
          } else {
            taxAmount = Math.round(lineTotal * (line.taxRate / 10000));
          }
        }

        // Preserve proportional discount on quantity change
        const discountRate = line.lineTotal > 0 ? line.discountAmount / line.lineTotal : 0;
        line.lineTotal = lineTotal;
        line.taxAmount = taxAmount;
        line.discountAmount = Math.round(lineTotal * discountRate);
      });

      get().recalculateTotals();
    },

    // ── LINE DISCOUNT ──────────────────────────────────────
    updateLineDiscount: (lineId: string, discountAmount: number) => {
      set((state) => {
        const line = state.lines.find((l) => l.id === lineId);
        if (!line) return;
        line.discountAmount = Math.min(Math.max(0, discountAmount), line.lineTotal);
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
      // Look up coupon code from settings
      const { storeId } = useSettingsStore.getState();
      if (!storeId) return false;
      const result = await ipcService.invoke('settings:get', { key: `coupon:${code}`, storeId });
      if (result.success && result.data) {
        set((state) => { state.couponCode = code; });
        return true;
      }
      return false;
    },

    removeDiscount: () => {
      set((state) => {
        state.appliedDiscount = null;
        state.couponCode = null;
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
      const { lines: currentLines, customer: currentCustomer } = get();

      set((state) => {
        const held = state.heldCarts.find((h) => h.id === heldId);
        if (!held) return;

        if (currentLines.length > 0) {
          state.heldCarts.push({
            id: createId(),
            label: 'Auto-hold',
            lines: [...currentLines],
            customer: currentCustomer,
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
        // Get real device/store IDs from settingsStore (loaded on app startup)
        const settings = useSettingsStore.getState();
        const deviceId = settings.deviceId;
        const storeId = settings.storeId;

        if (!deviceId || !storeId) {
          throw new Error('Device not initialized. Please restart the application.');
        }

        // Get cashier ID from the already-loaded auth session (avoids IPC round-trip)
        const authSession = useAuthStore.getState().session;
        const cashierId = authSession?.userId;

        if (!cashierId) {
          throw new Error('No active session. Please log in again.');
        }

        // Get current shift
        const shiftResult = await ipcService.invoke<{ id: string }>('shift:current', { deviceId });
        const shift = shiftResult.data as { id: string } | null;

        if (!shift) {
          throw new Error('No open shift found. Please open a shift before checkout.');
        }

        const saleData = {
          deviceId,
          shiftId: shift.id,
          cashierId,
          storeId,
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

        const result = await ipcService.invoke<{ id: string }>('sale:create', saleData);

        if (!result.success) {
          throw new Error(result.error?.message ?? 'Checkout failed');
        }

        const saleId = result.data!.id;

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

      const cartTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const cartQty = lines.reduce((sum, l) => sum + l.quantity / 1000, 0);

      if (appliedDiscount) {
        const { lineDiscounts } = applyDiscounts(lines, [appliedDiscount], cartTotal, cartQty);

        set((state) => {
          state.lines.forEach((line) => {
            const discount = lineDiscounts.get(line.id) ?? 0;
            line.discountAmount = discount;

            // Recalculate tax on discounted amount
            const discountedTotal = line.lineTotal - discount;
            if (line.taxRate > 0) {
              if (line.taxInclusive) {
                const rate = line.taxRate / 10000;
                line.taxAmount = discountedTotal - Math.round(discountedTotal / (1 + rate));
              } else {
                line.taxAmount = Math.round(discountedTotal * (line.taxRate / 10000));
              }
            }
          });
        });
      }

      const updatedLines = get().lines;
      const totalsInput = updatedLines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        taxRate: l.taxRate,
        taxClass: l.product?.taxRule?.taxClass ?? 'standard',
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
