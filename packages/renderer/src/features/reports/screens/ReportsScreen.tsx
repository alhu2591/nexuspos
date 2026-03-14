// NexusPOS — Reports Screen

import React, { useState } from 'react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { reportAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Receipt, RefreshCw } from 'lucide-react';

export function ReportsScreen() {
  const { storeId } = useSettingsStore();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['report:daily', storeId, startDate, endDate],
    queryFn: async () => {
      if (!storeId) return null;
      const r = await reportAPI.daily({ storeId, startDate, endDate });
      return r.data as {
        totalSales: number; totalRefunds: number; netSales: number;
        totalTax: number; totalDiscounts: number; cashSales: number;
        cardSales: number; transactionCount: number; avgTransactionValue: number;
      } | null;
    },
    enabled: !!storeId,
  });

  const stats = [
    { label: 'Gesamtumsatz', value: report ? formatCents(report.totalSales, 'de-DE', 'EUR') : '—', color: 'text-blue-600' },
    { label: 'Nettoumsatz', value: report ? formatCents(report.netSales, 'de-DE', 'EUR') : '—', color: 'text-green-600' },
    { label: 'Transaktionen', value: report ? report.transactionCount.toString() : '—', color: 'text-purple-600' },
    { label: 'Ø Bon-Wert', value: report ? formatCents(report.avgTransactionValue, 'de-DE', 'EUR') : '—', color: 'text-orange-600' },
    { label: 'Bargeld', value: report ? formatCents(report.cashSales, 'de-DE', 'EUR') : '—', color: 'text-gray-700' },
    { label: 'Karte', value: report ? formatCents(report.cardSales, 'de-DE', 'EUR') : '—', color: 'text-gray-700' },
    { label: 'MwSt. gesamt', value: report ? formatCents(report.totalTax, 'de-DE', 'EUR') : '—', color: 'text-gray-700' },
    { label: 'Rabatte', value: report ? formatCents(report.totalDiscounts, 'de-DE', 'EUR') : '—', color: 'text-red-500' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Berichte</h1>
        <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <RefreshCw size={14} /> Aktualisieren
        </button>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mb-6 flex items-center gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Von</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bis</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsScreen;
