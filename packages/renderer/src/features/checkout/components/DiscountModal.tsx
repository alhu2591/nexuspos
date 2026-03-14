// NexusPOS — Discount Modal
// Apply a percentage or fixed discount to the entire cart

import React, { useState, useCallback } from 'react';
import { X, Tag } from 'lucide-react';
import { useCheckoutStore } from '../../../stores/checkoutStore';
import { formatCents } from '@nexuspos/shared';
import type { IDiscountRule } from '@nexuspos/shared';
import clsx from 'clsx';

interface DiscountModalProps {
  onApply?: (discount: IDiscountRule) => void;
  onClose: () => void;
}

export function DiscountModal({ onApply, onClose }: DiscountModalProps) {
  const { totals, applyDiscount, removeDiscount } = useCheckoutStore();
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const parsedValue = parseFloat(value) || 0;

  // Preview discount amount
  const previewAmount = (() => {
    if (!parsedValue) return 0;
    if (discountType === 'PERCENTAGE') {
      const rate = Math.min(parsedValue, 100);
      return Math.round(totals.totalAmount * (rate / 100));
    } else {
      return Math.min(Math.round(parsedValue * 100), totals.totalAmount);
    }
  })();

  const handleApply = useCallback(() => {
    if (!parsedValue || parsedValue <= 0) {
      setError('Bitte einen Betrag eingeben');
      return;
    }
    if (discountType === 'PERCENTAGE' && parsedValue > 100) {
      setError('Prozentsatz kann nicht über 100% sein');
      return;
    }
    if (discountType === 'FIXED_AMOUNT' && Math.round(parsedValue * 100) > totals.totalAmount) {
      setError('Rabattbetrag übersteigt den Gesamtbetrag');
      return;
    }

    const rule: IDiscountRule = {
      id: `manual-${Date.now()}`,
      name: discountType === 'PERCENTAGE' ? `${parsedValue}% Rabatt` : `${value}€ Rabatt`,
      discountType,
      value: discountType === 'PERCENTAGE'
        ? Math.round(parsedValue * 100)   // store as rate×100 (e.g. 10% = 1000)
        : Math.round(parsedValue * 100),  // store as cents
      scope: 'CART',
      isActive: true,
    };

    applyDiscount(rule);
    if (onApply) onApply(rule);
    onClose();
  }, [parsedValue, discountType, value, totals, applyDiscount, onApply, onClose]);

  const handleRemove = useCallback(() => {
    removeDiscount();
    onClose();
  }, [removeDiscount, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900">Rabatt anwenden</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cart total info */}
          <div className="flex justify-between text-sm text-gray-500">
            <span>Warenkorbwert</span>
            <span className="font-semibold text-gray-900">{formatCents(totals.totalAmount, 'de-DE', 'EUR')}</span>
          </div>

          {/* Discount type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setDiscountType('PERCENTAGE')}
              className={clsx('flex-1 py-2 text-sm font-medium transition-colors',
                discountType === 'PERCENTAGE' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Prozent (%)
            </button>
            <button
              onClick={() => setDiscountType('FIXED_AMOUNT')}
              className={clsx('flex-1 py-2 text-sm font-medium transition-colors',
                discountType === 'FIXED_AMOUNT' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Betrag (€)
            </button>
          </div>

          {/* Quick % buttons */}
          {discountType === 'PERCENTAGE' && (
            <div className="flex gap-2">
              {[5, 10, 15, 20].map(pct => (
                <button
                  key={pct}
                  onClick={() => setValue(String(pct))}
                  className={clsx(
                    'flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                    value === String(pct)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}

          {/* Value input */}
          <div>
            <div className="relative">
              <input
                type="number"
                value={value}
                onChange={e => { setValue(e.target.value); setError(''); }}
                placeholder={discountType === 'PERCENTAGE' ? 'z.B. 10' : 'z.B. 5.00'}
                min="0"
                max={discountType === 'PERCENTAGE' ? '100' : undefined}
                step={discountType === 'PERCENTAGE' ? '1' : '0.01'}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                {discountType === 'PERCENTAGE' ? '%' : '€'}
              </span>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Preview */}
          {previewAmount > 0 && (
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-200">
              <span className="text-sm text-green-700">Rabattbetrag</span>
              <span className="text-lg font-bold text-green-700">-{formatCents(previewAmount, 'de-DE', 'EUR')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            onClick={handleApply}
            disabled={!parsedValue}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            Rabatt anwenden
          </button>
          <button
            onClick={handleRemove}
            className="w-full py-2.5 text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Rabatt entfernen
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiscountModal;
