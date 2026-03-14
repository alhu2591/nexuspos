// NexusPOS — Customer Display Screen
// Secondary display for customer-facing information during checkout
import React, { useEffect, useState } from 'react';
import { ipcService } from '../../../services/ipcService';
import { formatCents } from '@nexuspos/shared';

interface DisplayState {
  storeName: string;
  lines: Array<{ name: string; qty: number; total: number }>;
  total: number;
  step: 'idle' | 'cart' | 'payment' | 'complete';
  change?: number;
}

export function CustomerDisplayScreen() {
  const [display, setDisplay] = useState<DisplayState>({
    storeName: 'NexusPOS',
    lines: [],
    total: 0,
    step: 'idle',
  });

  useEffect(() => {
    const unsub = ipcService.on('customer-display:update', (data: unknown) => {
      if (data && typeof data === 'object') {
        setDisplay(prev => ({ ...prev, ...(data as Partial<DisplayState>) }));
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      {display.step === 'idle' ? (
        <div className="text-center">
          <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl font-bold">N</div>
          <h1 className="text-4xl font-bold mb-2">{display.storeName}</h1>
          <p className="text-gray-400 text-xl">Willkommen!</p>
        </div>
      ) : display.step === 'complete' ? (
        <div className="text-center">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-3xl font-bold text-green-400 mb-2">Vielen Dank!</h2>
          {display.change != null && display.change > 0 && (
            <p className="text-2xl text-gray-300">Rückgeld: <strong className="text-white">{formatCents(display.change, 'de-DE', 'EUR')}</strong></p>
          )}
        </div>
      ) : (
        <div className="w-full max-w-lg">
          <div className="space-y-3 mb-8">
            {display.lines.map((line, i) => (
              <div key={i} className="flex justify-between items-center text-lg">
                <span className="text-gray-300">{line.qty}× {line.name}</span>
                <span className="font-semibold">{formatCents(line.total, 'de-DE', 'EUR')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-700 pt-4 flex justify-between items-baseline">
            <span className="text-2xl text-gray-400">Gesamt</span>
            <span className="text-4xl font-bold text-blue-400">{formatCents(display.total, 'de-DE', 'EUR')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDisplayScreen;
