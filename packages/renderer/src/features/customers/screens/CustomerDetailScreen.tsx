// NexusPOS — Customer Detail Screen
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';
import { ArrowLeft, Mail, Phone, MapPin, Receipt } from 'lucide-react';

interface Customer {
  id: string; firstName: string; lastName?: string; email?: string;
  phone?: string; address?: string; city?: string; postalCode?: string;
  customerNum: string; totalSpent: number;
  sales: Array<{ id: string; saleNumber: string; totalAmount: number; status: string; createdAt: string }>;
}

export function CustomerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const r = await customerAPI.find(id!);
      return r.data as Customer | null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  }
  if (!customer) {
    return <div className="p-8 text-gray-500">Kunde nicht gefunden</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/customers')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={16} /> Zurück
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold">
          {customer.firstName[0]}{customer.lastName?.[0] ?? ''}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.firstName} {customer.lastName ?? ''}</h1>
          <p className="text-sm text-gray-500 font-mono">{customer.customerNum}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">Gesamtumsatz</p>
          <p className="text-2xl font-bold text-blue-600">{formatCents(customer.totalSpent, 'de-DE', 'EUR')}</p>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Kontaktdaten</h2>
        <div className="space-y-2 text-sm">
          {customer.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail size={15} className="text-gray-400" /> {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={15} className="text-gray-400" /> {customer.phone}
            </div>
          )}
          {(customer.address || customer.city) && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={15} className="text-gray-400" />
              {[customer.address, customer.postalCode, customer.city].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Recent sales */}
      {customer.sales?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Receipt size={16} /> Letzte Einkäufe
          </h2>
          <div className="space-y-2">
            {customer.sales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sale.saleNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(sale.createdAt).toLocaleDateString('de-DE')}</p>
                </div>
                <p className="font-semibold text-gray-900">{formatCents(sale.totalAmount, 'de-DE', 'EUR')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailScreen;
