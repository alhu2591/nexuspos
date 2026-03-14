// NexusPOS — Products Screen
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../stores/settingsStore';
import { productAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import type { IProduct } from '@nexuspos/shared';
import { Package, Search, Plus, Edit2, X } from 'lucide-react';
import clsx from 'clsx';

export function ProductsScreen() {
  const { storeId } = useSettingsStore();
  const [query, setQuery] = useState('');

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['products:list', storeId, query],
    queryFn: async () => {
      if (!storeId) return [];
      const r = await productAPI.search(query, storeId, undefined, 100);
      return (r.data as IProduct[]) ?? [];
    },
    enabled: !!storeId,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Produkte</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Produkt suchen..."
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package size={48} className="mb-3 opacity-30" />
            <p>{query ? 'Keine Produkte gefunden' : 'Noch keine Produkte'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produkt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategorie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Preis</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lager</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: p.category?.colorHex ?? '#6366f1' }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCents(p.unitPrice, 'de-DE', 'EUR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.isService ? (
                      <span className="text-gray-400 text-xs">Dienstl.</span>
                    ) : (
                      <span className={clsx(
                        'font-semibold',
                        (p.inventory?.quantity ?? 0) <= 0 ? 'text-red-500'
                          : (p.inventory?.quantity ?? 0) <= 5 ? 'text-orange-500'
                          : 'text-gray-700'
                      )}>
                        {p.inventory?.quantity ?? 0}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {p.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      <div className="px-6 py-2 bg-white border-t border-gray-100 text-xs text-gray-400">
        {products.length} Produkte
      </div>
    </div>
  );
}

export default ProductsScreen;
