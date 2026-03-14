// NexusPOS — Held Carts Panel
// Shows all paused carts with ability to retrieve or delete

import React from 'react';
import { X, ShoppingCart, Clock, Trash2, RotateCcw } from 'lucide-react';
import { useCheckoutStore } from '../../../stores/checkoutStore';
import { formatCents } from '@nexuspos/shared';

interface HeldCartsPanelProps {
  onClose: () => void;
}

export function HeldCartsPanel({ onClose }: HeldCartsPanelProps) {
  const { heldCarts, retrieveHeldCart, deleteHeldCart } = useCheckoutStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-900">Pausierte Vorgänge</h2>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
              {heldCarts.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Held cart list */}
        <div className="overflow-y-auto max-h-96">
          {heldCarts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingCart size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Keine pausierten Vorgänge</p>
            </div>
          ) : (
            heldCarts.map(held => {
              const itemCount = held.lines.length;
              const total = held.lines.reduce((s, l) => s + l.lineTotal - l.discountAmount, 0);
              const heldAt = new Date(held.heldAt);

              return (
                <div key={held.id} className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 last:border-0">
                  {/* Cart info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{held.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {itemCount} Artikel · {formatCents(total, 'de-DE', 'EUR')}
                      </span>
                      {held.customer && (
                        <span className="text-xs text-blue-500">
                          {held.customer.firstName} {held.customer.lastName ?? ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {heldAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => deleteHeldCart(held.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Löschen"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => { retrieveHeldCart(held.id); onClose(); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <RotateCcw size={13} />
                      Fortsetzen
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
