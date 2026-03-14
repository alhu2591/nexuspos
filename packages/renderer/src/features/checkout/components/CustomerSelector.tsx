// NexusPOS — Customer Selector Modal
// Search and select a customer for the current sale

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useCheckoutStore } from '../../../stores/checkoutStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { customerAPI } from '../../../services/ipcService';
import { Search, X, User, Phone, Mail } from 'lucide-react';
import type { ICustomer } from '@nexuspos/shared';

interface CustomerSelectorProps {
  onSelect?: (customer: ICustomer) => void;
  onClose: () => void;
}

export function CustomerSelector({ onSelect, onClose }: CustomerSelectorProps) {
  const { t } = useTranslation();
  const { setCustomer } = useCheckoutStore();
  const { storeId } = useSettingsStore();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 200);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers:search', debouncedQuery, storeId],
    queryFn: async () => {
      if (!debouncedQuery.trim() || !storeId) return [];
      const result = await customerAPI.search(debouncedQuery, storeId);
      return (result.data as ICustomer[]) ?? [];
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  const handleSelect = useCallback((customer: ICustomer) => {
    setCustomer(customer);
    if (onSelect) onSelect(customer);
    onClose();
  }, [setCustomer, onSelect, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg">Kunde auswählen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name, E-Mail oder Telefon..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80">
          {/* No customer option */}
          <button
            onClick={() => { setCustomer(null); onClose(); }}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-gray-400" />
            </div>
            <span className="text-sm text-gray-500">Kein Kunde</span>
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : customers.length === 0 && debouncedQuery.trim().length >= 2 ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine Kunden gefunden</p>
          ) : (
            customers.map(customer => (
              <button
                key={customer.id}
                onClick={() => handleSelect(customer)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-600">
                    {customer.firstName[0]}{customer.lastName?.[0] ?? ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {customer.firstName} {customer.lastName ?? ''}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {customer.email && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Mail size={10} />{customer.email}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone size={10} />{customer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerSelector;
