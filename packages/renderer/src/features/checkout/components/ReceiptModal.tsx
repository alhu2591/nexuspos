// NexusPOS — Receipt Modal
// Shown after a successful sale is completed

import React from 'react';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { formatCents } from '@nexuspos/shared';
import { useCheckoutStore } from '../../../stores/checkoutStore';

interface ReceiptModalProps {
  onClose?: () => void;
  onNewSale?: () => void;
}

export function ReceiptModal({ onClose, onNewSale }: ReceiptModalProps) {
  const { lastCompletedSaleId, totals, newSale } = useCheckoutStore();

  const handleNewSale = () => {
    if (onNewSale) {
      onNewSale();
    } else {
      newSale();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center p-8">
        {/* Success icon */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={52} className="text-green-600" />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Zahlung erfolgreich!</h2>
          <p className="text-gray-500 text-sm">
            Vorgang {lastCompletedSaleId ? `abgeschlossen` : ''}
          </p>
        </div>

        {/* New sale button */}
        <button
          onClick={handleNewSale}
          className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-colors shadow-sm"
          autoFocus
        >
          <ShoppingCart size={22} />
          Neuer Vorgang
        </button>
      </div>
    </div>
  );
}

export default ReceiptModal;
