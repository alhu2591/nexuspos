// NexusPOS — Product Form Screen (placeholder)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';

export function ProductFormScreen() {
  const navigate = useNavigate();
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate('/products')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Zurück
      </button>
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <Package size={40} className="mb-3 opacity-30" />
        <p className="text-sm">Produkt bearbeiten — In Entwicklung</p>
      </div>
    </div>
  );
}

export default ProductFormScreen;
