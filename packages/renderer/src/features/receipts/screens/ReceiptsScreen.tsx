// NexusPOS — Receipts Screen
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../stores/settingsStore';
import { saleAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import { Receipt, RefreshCw, Search } from 'lucide-react';
import clsx from 'clsx';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Abgeschlossen', color: 'bg-green-100 text-green-700' },
  VOIDED: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Erstattet', color: 'bg-orange-100 text-orange-700' },
  PARTIALLY_REFUNDED: { label: 'Teil-Erstattung', color: 'bg-yellow-100 text-yellow-700' },
  PENDING: { label: 'Ausstehend', color: 'bg-gray-100 text-gray-600' },
};

export function ReceiptsScreen() {
  const { storeId } = useSettingsStore();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);

  const { data: sales = [], isLoading, refetch } = useQuery({
    queryKey: ['sales:list', storeId, date],
    queryFn: async () => {
      if (!storeId) return [];
      const r = await saleAPI.list({ storeId, startDate: date, endDate: date, pageSize: 100 });
      return (r.data as any[]) ?? [];
    },
    enabled: !!storeId,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Kassenbons</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Receipt size={48} className="mb-3 opacity-30" />
            <p>Keine Bons für dieses Datum</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bon-Nr.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zeit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kassier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Artikel</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Betrag</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((sale) => {
                const statusInfo = STATUS_LABELS[sale.status] ?? { label: sale.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-gray-700">{sale.saleNumber}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(sale.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {sale.cashier ? `${sale.cashier.firstName} ${sale.cashier.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName ?? ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{sale._count?.lines ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCents(sale.totalAmount, 'de-DE', 'EUR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 py-2 bg-white border-t border-gray-100 text-xs text-gray-400 flex justify-between">
        <span>{sales.length} Kassenbons</span>
        <span className="font-semibold text-gray-700">
          Gesamt: {formatCents(sales.reduce((s: number, r: any) => s + (r.totalAmount ?? 0), 0), 'de-DE', 'EUR')}
        </span>
      </div>
    </div>
  );
}

export default ReceiptsScreen;
