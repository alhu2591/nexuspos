// NexusPOS — Checkout Screen
// The primary POS interface: product search, cart, payment

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckoutStore } from '../store/checkoutStore';
import { useAuthStore } from '../../../stores/authStore';
import { ProductSearch } from '../components/ProductSearch';
import { CartPanel } from '../components/CartPanel';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { CustomerSelector } from '../components/CustomerSelector';
import { DiscountModal } from '../components/DiscountModal';
import { HeldCartsPanel } from '../components/HeldCartsPanel';
import { NumPad } from '../../../components/ui/NumPad';
import { useHardwareEvents } from '../../../hooks/useHardwareEvents';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { formatCents } from '../../../../../shared/src/utils/vatEngine';
import {
  ShoppingCart,
  Search,
  User,
  Tag,
  PauseCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const {
    lines,
    customer,
    totals,
    step,
    isProcessing,
    heldCarts,
    goToPayment,
    goToCart,
    holdCart,
    newSale,
    removeItem,
    updateQuantity,
    addProduct,
  } = useCheckoutStore();

  const { session } = useAuthStore();
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [numPadTarget, setNumPadTarget] = useState<'qty' | 'price' | 'discount' | null>(null);

  // Barcode scanner integration
  useBarcodeScanner((barcode) => {
    if (step === 'cart') {
      // Product lookup handled by ProductSearch
    }
  });

  // Hardware events (drawer, etc.)
  useHardwareEvents();

  const cartEmpty = lines.length === 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 = go to payment
      if (e.key === 'F2' && !cartEmpty && step === 'cart') {
        e.preventDefault();
        goToPayment();
      }
      // Escape = go back to cart
      if (e.key === 'Escape' && step === 'payment') {
        e.preventDefault();
        goToCart();
      }
      // F3 = hold cart
      if (e.key === 'F3' && !cartEmpty) {
        e.preventDefault();
        holdCart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartEmpty, step, goToPayment, goToCart, holdCart]);

  // ── RENDER PAYMENT STEP ─────────────────────────────────
  if (step === 'payment') {
    return (
      <PaymentModal
        totals={totals}
        onBack={goToCart}
        onComplete={() => {}}
      />
    );
  }

  // ── RENDER RECEIPT STEP ─────────────────────────────────
  if (step === 'receipt') {
    return (
      <ReceiptModal
        onNewSale={newSale}
      />
    );
  }

  // ── RENDER CART STEP ────────────────────────────────────
  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* LEFT: Product Search Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          {/* Customer selector button */}
          <button
            onClick={() => setShowCustomerSelector(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
          >
            <User size={16} className={customer ? 'text-blue-600' : 'text-gray-400'} />
            <span className={customer ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              {customer
                ? `${customer.firstName} ${customer.lastName ?? ''}`
                : t('checkout.selectCustomer')}
            </span>
          </button>

          {/* Held carts button */}
          {heldCarts.length > 0 && (
            <button
              onClick={() => setShowHeldCarts(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-sm"
            >
              <Clock size={16} className="text-orange-600" />
              <span className="text-orange-700 font-medium">{heldCarts.length} {t('checkout.held')}</span>
            </button>
          )}

          <div className="flex-1" />

          {/* Shift info */}
          <div className="text-xs text-gray-400">
            {session?.user.firstName} {session?.user.lastName}
          </div>
        </div>

        {/* Product search */}
        <div className="flex-1 overflow-hidden">
          <ProductSearch onProductSelect={(product) => addProduct(product)} />
        </div>
      </div>

      {/* RIGHT: Cart Panel */}
      <div className="w-[420px] flex flex-col bg-white border-l border-gray-200 shadow-lg">
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600" />
            <span className="font-semibold text-gray-900">
              {t('checkout.cart')}
            </span>
            {lines.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {lines.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Discount button */}
            <button
              onClick={() => setShowDiscountModal(true)}
              disabled={cartEmpty}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t('checkout.applyDiscount')}
            >
              <Tag size={16} className="text-gray-600" />
            </button>

            {/* Hold cart button */}
            <button
              onClick={() => holdCart()}
              disabled={cartEmpty}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={`${t('checkout.holdCart')} (F3)`}
            >
              <PauseCircle size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cartEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={48} className="mb-3 opacity-30" />
              <p className="text-sm">{t('checkout.emptyCart')}</p>
              <p className="text-xs mt-1">{t('checkout.scanOrSearch')}</p>
            </div>
          ) : (
            <CartPanel
              lines={lines}
              selectedLineId={selectedLineId}
              onSelectLine={setSelectedLineId}
              onRemoveLine={removeItem}
              onUpdateQuantity={updateQuantity}
            />
          )}
        </div>

        {/* Cart totals */}
        {!cartEmpty && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>{t('common.subtotal')}</span>
                <span>{formatCents(totals.subtotal, 'de-DE', 'EUR')}</span>
              </div>
            )}
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600 mb-1">
                <span>{t('common.discount')}</span>
                <span>-{formatCents(totals.discountAmount, 'de-DE', 'EUR')}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{t('common.taxIncluded')}</span>
              <span>{formatCents(totals.taxAmount, 'de-DE', 'EUR')}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold text-gray-900 mb-3">
              <span>{t('common.total')}</span>
              <span className="text-blue-600">{formatCents(totals.totalAmount, 'de-DE', 'EUR')}</span>
            </div>

            {/* Checkout button */}
            <button
              onClick={goToPayment}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-lg rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <CreditCard size={22} />
              <span>{t('checkout.proceedToPayment')}</span>
              <span className="text-sm opacity-75 ml-1">(F2)</span>
            </button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showCustomerSelector && (
        <CustomerSelector
          onClose={() => setShowCustomerSelector(false)}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          onClose={() => setShowDiscountModal(false)}
        />
      )}

      {showHeldCarts && (
        <HeldCartsPanel
          onClose={() => setShowHeldCarts(false)}
        />
      )}
    </div>
  );
}
