// NexusPOS — Inventory Screen
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useAuthStore } from '../../../stores/authStore';
import { inventoryAPI } from '../../../services/ipcService';
import { Warehouse, AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface InventoryItem {
  id: string;
  quantity: number;
  reservedQty: number;
  product: {
    id: string;
    name: string;
    sku?: string;
    minStockLevel?: number;
    category?: { name: string };
  };
}

export function InventoryScreen() {
  const { storeId } = useSettingsStore();
  const [showLowOnly, setShowLowOnly] = useState(false);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['inventory', storeId, showLowOnly],
    queryFn: async () => {
      const r = await inventoryAPI.get(undefined, showLowOnly);
      return (r.data as InventoryItem[]) ?? [];
    },
  });

  const lowStockCount = items.filter(i =>
    i.product.minStockLevel != null && i.quantity <= i.product.minStockLevel
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Lagerbestand</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
              <AlertTriangle size={11} /> {lowStockCount} Niedrig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowOnly}
              onChange={e => setShowLowOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Nur Niedrigbestand
          </label>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Warehouse size={48} className="mb-3 opacity-30" />
            <p>{showLowOnly ? 'Kein Niedrigbestand' : 'Keine Lagerdaten'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produkt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategorie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bestand</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reserviert</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Verfügbar</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const available = item.quantity - item.reservedQty;
                const isLow = item.product.minStockLevel != null && item.quantity <= item.product.minStockLevel;
                const isOut = item.quantity <= 0;
                return (
                  <tr key={item.id} className={clsx('hover:bg-gray-50', isOut && 'bg-red-50')}>
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      {item.product.sku && <p className="text-xs text-gray-400">SKU: {item.product.sku}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.product.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-bold', isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-900')}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.reservedQty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{available}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        isOut ? 'bg-red-100 text-red-700'
                          : isLow ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      )}>
                        {isOut ? 'Ausverkauft' : isLow ? 'Niedrig' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 py-2 bg-white border-t border-gray-100 text-xs text-gray-400">
        {items.length} Artikel
      </div>
    </div>
  );
}

export default InventoryScreen;
