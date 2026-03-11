// NexusPOS — Payment Modal
// Handles cash, card, split payment flows
// Numpad for cash entry, change calculation

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckoutStore } from '../store/checkoutStore';
import { formatCents } from '../../../../../shared/src/utils/vatEngine';
import type { ICartTotals } from '../../../../../shared/src/types';
import {
  ArrowLeft, Banknote, CreditCard, Smartphone, Ticket, Printer,
  CheckCircle2, AlertCircle, ChevronRight, Plus, Trash2
} from 'lucide-react';
import clsx from 'clsx';

interface PaymentModalProps {
  totals: ICartTotals;
  onBack: () => void;
  onComplete: () => void;
}

type PaymentMethod = 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'CONTACTLESS' | 'VOUCHER';

interface PaymentEntry {
  id: string;
  method: PaymentMethod;
  amount: number;
  tendered?: number;
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { method: 'CASH', label: 'Bargeld', icon: <Banknote size={22} />, color: 'bg-green-600 hover:bg-green-700' },
  { method: 'CARD_DEBIT', label: 'EC-Karte', icon: <CreditCard size={22} />, color: 'bg-blue-600 hover:bg-blue-700' },
  { method: 'CARD_CREDIT', label: 'Kreditkarte', icon: <CreditCard size={22} />, color: 'bg-indigo-600 hover:bg-indigo-700' },
  { method: 'CONTACTLESS', label: 'Kontaktlos', icon: <Smartphone size={22} />, color: 'bg-purple-600 hover:bg-purple-700' },
  { method: 'VOUCHER', label: 'Gutschein', icon: <Ticket size={22} />, color: 'bg-orange-500 hover:bg-orange-600' },
];

// Quick cash amounts (EUR)
const QUICK_CASH_CENTS = [500, 1000, 2000, 5000, 10000, 20000, 50000];

export function PaymentModal({ totals, onBack, onComplete }: PaymentModalProps) {
  const { t } = useTranslation();
  const { completeCheckout, isProcessing, step } = useCheckoutStore();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [numpadValue, setNumpadValue] = useState('');
  const [cashTendered, setCashTendered] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const totalDue = totals.totalAmount;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remainingDue = Math.max(0, totalDue - totalPaid);
  const change = cashTendered != null && selectedMethod === 'CASH'
    ? Math.max(0, cashTendered - remainingDue)
    : 0;

  const isFullyPaid = totalPaid >= totalDue;

  // ── NUMPAD INPUT ────────────────────────────────────────
  const handleNumpadKey = useCallback((key: string) => {
    if (key === 'C') { setNumpadValue(''); return; }
    if (key === '⌫') { setNumpadValue(v => v.slice(0, -1)); return; }
    if (key === '.' && numpadValue.includes('.')) return;
    if (numpadValue.length >= 8) return;
    setNumpadValue(v => v + key);
  }, [numpadValue]);

  const getEnteredAmount = useCallback((): number => {
    if (!numpadValue) return remainingDue;
    const val = parseFloat(numpadValue);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [numpadValue, remainingDue]);

  // ── ADD PAYMENT ─────────────────────────────────────────
  const handleAddPayment = useCallback(() => {
    const amount = getEnteredAmount();
    if (amount <= 0) return;

    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      method: selectedMethod,
      amount: Math.min(amount, remainingDue > 0 ? remainingDue : amount),
      tendered: selectedMethod === 'CASH' ? amount : undefined,
    };

    if (selectedMethod === 'CASH') {
      setCashTendered(amount);
    }

    setPayments(prev => [...prev, entry]);
    setNumpadValue('');
    setError(null);
  }, [getEnteredAmount, remainingDue, selectedMethod]);

  // ── QUICK CASH ──────────────────────────────────────────
  const handleQuickCash = useCallback((cents: number) => {
    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      method: 'CASH',
      amount: Math.min(cents, remainingDue),
      tendered: cents,
    };
    setPayments(prev => [...prev, entry]);
    setCashTendered(cents);
    setSelectedMethod('CASH');
    setError(null);
  }, [remainingDue]);

  // ── EXACT AMOUNT ────────────────────────────────────────
  const handleExactAmount = useCallback(() => {
    const entry: PaymentEntry = {
      id: crypto.randomUUID(),
      method: selectedMethod,
      amount: remainingDue,
      tendered: selectedMethod === 'CASH' ? remainingDue : undefined,
    };
    if (selectedMethod === 'CASH') setCashTendered(remainingDue);
    setPayments(prev => [...prev, entry]);
    setNumpadValue('');
    setError(null);
  }, [remainingDue, selectedMethod]);

  // ── REMOVE PAYMENT ──────────────────────────────────────
  const handleRemovePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    setCashTendered(null);
  }, []);

  // ── COMPLETE ─────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (!isFullyPaid) {
      setError('Zahlung nicht vollständig');
      return;
    }

    try {
      setError(null);
      await completeCheckout(
        payments.map(p => ({
          paymentMethod: p.method,
          amount: p.amount,
          tendered: p.tendered,
        }))
      );
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zahlung fehlgeschlagen');
    }
  }, [isFullyPaid, payments, completeCheckout]);

  // ── KEYBOARD SHORTCUT ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isFullyPaid && !isProcessing) {
        handleComplete();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullyPaid, isProcessing, handleComplete]);

  // ── SUCCESS SCREEN ───────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounce-once">
            <CheckCircle2 size={52} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Zahlung erfolgreich!</h2>
            {change > 0 && (
              <p className="text-xl text-green-600 font-semibold">
                Rückgeld: {formatCents(change, 'de-DE', 'EUR')}
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
              <Printer size={18} />
              Bon drucken
            </button>
          </div>
        </div>
      </div>
    );
  }

  const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','C','0','.', '⌫'];

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* LEFT: Payment methods + numpad */}
      <div className="flex-1 flex flex-col p-4 gap-4 min-w-0">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 w-fit"
        >
          <ArrowLeft size={16} />
          {t('common.back', 'Zurück')}
        </button>

        {/* Total display */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-gray-500 text-sm">{t('common.total')}</span>
            <span className="text-3xl font-bold text-gray-900">
              {formatCents(totalDue, 'de-DE', 'EUR')}
            </span>
          </div>
          {totalPaid > 0 && (
            <>
              <div className="flex justify-between items-baseline text-sm mt-2">
                <span className="text-gray-400">Bezahlt</span>
                <span className="text-green-600 font-semibold">{formatCents(totalPaid, 'de-DE', 'EUR')}</span>
              </div>
              <div className="flex justify-between items-baseline text-sm mt-1">
                <span className="text-gray-400">Ausstehend</span>
                <span className={clsx('font-bold', remainingDue > 0 ? 'text-red-600' : 'text-green-600')}>
                  {formatCents(remainingDue, 'de-DE', 'EUR')}
                </span>
              </div>
            </>
          )}
          {change > 0 && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg flex justify-between">
              <span className="text-green-700 font-medium">Rückgeld</span>
              <span className="text-green-700 font-bold text-lg">{formatCents(change, 'de-DE', 'EUR')}</span>
            </div>
          )}
        </div>

        {/* Payment method selector */}
        <div className="grid grid-cols-5 gap-2">
          {PAYMENT_METHODS.map(({ method, label, icon, color }) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={clsx(
                'flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all text-xs font-medium',
                selectedMethod === method
                  ? `${color} text-white shadow-md scale-105`
                  : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Quick cash buttons */}
        {selectedMethod === 'CASH' && (
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">Schnellbetrag</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CASH_CENTS.filter(c => c >= totalDue * 0.8).slice(0, 5).map(cents => (
                <button
                  key={cents}
                  onClick={() => handleQuickCash(cents)}
                  className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  {formatCents(cents, 'de-DE', 'EUR')}
                </button>
              ))}
              <button
                onClick={handleExactAmount}
                className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Exakt
              </button>
            </div>
          </div>
        )}

        {/* Numpad */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          {/* Display */}
          <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-right">
            <span className="text-2xl font-mono font-bold text-gray-900">
              {numpadValue ? `${numpadValue} €` : formatCents(remainingDue, 'de-DE', 'EUR')}
            </span>
          </div>

          {/* Keys */}
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleNumpadKey(key)}
                className={clsx(
                  'py-3.5 rounded-xl text-lg font-semibold transition-all active:scale-95',
                  key === 'C' ? 'bg-red-50 text-red-600 hover:bg-red-100' :
                  key === '⌫' ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' :
                  'bg-gray-100 text-gray-800 hover:bg-gray-200'
                )}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Add payment button */}
          <button
            onClick={handleAddPayment}
            disabled={remainingDue === 0}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={18} />
            Zahlung hinzufügen
          </button>
        </div>
      </div>

      {/* RIGHT: Payment summary + complete */}
      <div className="w-80 flex flex-col bg-white border-l border-gray-200 p-4 gap-4">
        <h3 className="font-bold text-gray-900 text-lg">Zahlungsübersicht</h3>

        {/* Added payments */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Noch keine Zahlung hinzugefügt</p>
          ) : (
            payments.map(payment => {
              const methodInfo = PAYMENT_METHODS.find(m => m.method === payment.method);
              return (
                <div key={payment.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={clsx('p-1.5 rounded-lg text-white', methodInfo?.color?.split(' ')[0] ?? 'bg-gray-500')}>
                    {methodInfo?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{methodInfo?.label}</p>
                    <p className="text-xs text-gray-400">{formatCents(payment.amount, 'de-DE', 'EUR')}</p>
                  </div>
                  <button
                    onClick={() => handleRemovePayment(payment.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gesamt fällig</span>
            <span className="font-bold">{formatCents(totalDue, 'de-DE', 'EUR')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bezahlt</span>
            <span className="font-semibold text-green-600">{formatCents(totalPaid, 'de-DE', 'EUR')}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rückgeld</span>
              <span className="font-bold text-green-600">{formatCents(change, 'de-DE', 'EUR')}</span>
            </div>
          )}
        </div>

        {/* Complete button */}
        <button
          onClick={handleComplete}
          disabled={!isFullyPaid || isProcessing}
          className={clsx(
            'w-full py-5 rounded-2xl font-bold text-xl transition-all',
            isFullyPaid
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl active:scale-98'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verarbeite...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 size={24} />
              Abschluss <span className="text-sm opacity-75">(Enter)</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
