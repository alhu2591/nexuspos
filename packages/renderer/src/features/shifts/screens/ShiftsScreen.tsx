// NexusPOS — Shifts Screen
// Shows shift history and allows closing the current shift

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useAuthStore } from '../../../stores/authStore';
import { shiftAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface ShiftSummary {
  id: string;
  shiftNumber: string;
  status: string;
  openedAt?: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  variance?: number;
}

export function ShiftsScreen() {
  const { currentShift, setCurrentShift, deviceId } = useSettingsStore();
  const { session } = useAuthStore();
  const [closingBalance, setClosingBalance] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCloseShift = async () => {
    if (!currentShift) return;
    const balance = Math.round(parseFloat(closingBalance) * 100);
    if (isNaN(balance)) { setError('Ungültiger Betrag'); return; }

    setIsClosing(true);
    setError('');
    try {
      const result = await shiftAPI.close({
        shiftId: currentShift.id,
        closingBalance: balance,
        notes: '',
      });
      if (result.success) {
        setCurrentShift(null);
        setSuccess('Schicht erfolgreich geschlossen');
        setClosingBalance('');
      } else {
        setError(result.error?.message ?? 'Fehler beim Schließen');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schichten</h1>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {currentShift ? (
        <div className="bg-white rounded-2xl border-2 border-green-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Aktuelle Schicht</h2>
              <p className="text-sm text-gray-500">{currentShift.shiftNumber}</p>
            </div>
            <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">OFFEN</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">Anfangsbestand</p>
              <p className="font-bold text-gray-900 text-lg">{formatCents(currentShift.openingBalance, 'de-DE', 'EUR')}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">Kassier</p>
              <p className="font-bold text-gray-900">{session?.user.firstName} {session?.user.lastName}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Schicht schließen</h3>
            {error && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Schlussbetrag (€)</label>
                <input
                  type="number"
                  value={closingBalance}
                  onChange={e => setClosingBalance(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                />
              </div>
              <button
                onClick={handleCloseShift}
                disabled={isClosing || !closingBalance}
                className="self-end px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {isClosing ? 'Schließe...' : 'Schicht schließen'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Keine offene Schicht. Öffnen Sie eine Schicht über das Dashboard.</p>
        </div>
      )}
    </div>
  );
}

export default ShiftsScreen;
