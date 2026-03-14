// NexusPOS — Dashboard Screen
import React, { useState } from 'react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useAuthStore } from '../../../stores/authStore';
import { shiftAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function DashboardScreen() {
  const { currentShift, setCurrentShift, deviceId, storeId } = useSettingsStore();
  const { session } = useAuthStore();
  const [isOpening, setIsOpening] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [error, setError] = useState('');

  const handleOpenShift = async () => {
    if (!deviceId || !storeId || !session?.userId) {
      setError('Gerät oder Sitzung nicht initialisiert');
      return;
    }
    setIsOpening(true);
    try {
      const result = await shiftAPI.open({
        deviceId,
        storeId,
        userId: session.userId,
        openingBalance: Math.round(parseFloat(openingBalance) * 100) || 0,
      });
      if (result.success && result.data) {
        setCurrentShift(result.data as any);
        setError('');
      } else {
        setError(result.error?.message ?? 'Fehler beim Öffnen der Schicht');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Shift status card */}
      <div className={`rounded-2xl border-2 p-6 ${currentShift ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
        <div className="flex items-center gap-3 mb-4">
          {currentShift
            ? <CheckCircle2 size={24} className="text-green-600" />
            : <AlertTriangle size={24} className="text-orange-500" />
          }
          <h2 className="text-lg font-bold text-gray-900">
            {currentShift ? `Schicht: ${currentShift.shiftNumber}` : 'Keine offene Schicht'}
          </h2>
        </div>

        {currentShift ? (
          <div className="space-y-1 text-sm text-gray-600">
            <p>Öffnungsbetrag: <strong>{formatCents(currentShift.openingBalance, 'de-DE', 'EUR')}</strong></p>
            <p>Kassier: <strong>{session?.user.firstName} {session?.user.lastName}</strong></p>
            <p className="text-green-700 font-medium mt-3">✓ Kasse ist bereit – Sie können zur Kasse navigieren</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Öffnen Sie eine Schicht, um mit dem Kassieren zu beginnen.</p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anfangsbestand (€)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
              />
            </div>

            <button
              onClick={handleOpenShift}
              disabled={isOpening}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              <Clock size={18} />
              {isOpening ? 'Öffne...' : 'Schicht öffnen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardScreen;
