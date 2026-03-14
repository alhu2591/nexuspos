// NexusPOS — Customers Screen
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '../../../stores/settingsStore';
import { customerAPI } from '../../../services/ipcService';
import { Users, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Customer {
  id: string; firstName: string; lastName?: string;
  email?: string; phone?: string; customerNum: string; totalSpent: number;
}

export function CustomersScreen() {
  const { storeId } = useSettingsStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers:search', storeId, query],
    queryFn: async () => {
      if (!storeId || !query.trim()) return [];
      const r = await customerAPI.search(query, storeId);
      return (r.data as Customer[]) ?? [];
    },
    enabled: !!storeId && query.trim().length > 0,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Kunden</h1>
        <div className="relative w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, E-Mail, Telefon..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Users size={48} className="mb-3 opacity-30" />
            <p className="text-sm">Namen oder E-Mail eingeben zum Suchen</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Users size={48} className="mb-3 opacity-30" />
            <p>Kein Kunde gefunden</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kundennr.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">E-Mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                        {c.firstName[0]}{c.lastName?.[0] ?? ''}
                      </div>
                      <p className="font-medium text-gray-900">{c.firstName} {c.lastName ?? ''}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.customerNum}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default CustomersScreen;
