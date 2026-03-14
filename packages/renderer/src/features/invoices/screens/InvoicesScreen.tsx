// NexusPOS — Invoices Screen (placeholder)
import React from 'react';
import { FileText } from 'lucide-react';

export function InvoicesScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <FileText size={56} className="mb-4 opacity-30" />
      <h1 className="text-xl font-bold text-gray-700 mb-1">Rechnungen</h1>
      <p className="text-sm">Diese Funktion ist in Entwicklung.</p>
    </div>
  );
}

export default InvoicesScreen;
