// NexusPOS — Cart Panel Component
// Displays cart lines with inline quantity editing

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ICartLine } from '@nexuspos/shared';
import { formatCents } from '@nexuspos/shared';
import { Trash2, Plus, Minus, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

interface CartPanelProps {
  lines: ICartLine[];
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onRemoveLine: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
}

export function CartPanel({
  lines,
  selectedLineId,
  onSelectLine,
  onRemoveLine,
  onUpdateQuantity,
}: CartPanelProps) {
  const { t } = useTranslation();

  const handleIncrement = useCallback((line: ICartLine, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateQuantity(line.id, line.quantity / 1000 + 1);
  }, [onUpdateQuantity]);

  const handleDecrement = useCallback((line: ICartLine, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = line.quantity / 1000;
    if (current <= 1) {
      onRemoveLine(line.id);
    } else {
      onUpdateQuantity(line.id, current - 1);
    }
  }, [onUpdateQuantity, onRemoveLine]);

  return (
    <div className="divide-y divide-gray-100">
      {lines.map((line, index) => {
        const qty = line.quantity / 1000;
        const isSelected = line.id === selectedLineId;

        return (
          <div
            key={line.id}
            onClick={() => onSelectLine(isSelected ? null : line.id)}
            className={clsx(
              'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
              isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
            )}
          >
            {/* Line number */}
            <span className="text-xs text-gray-400 w-4 pt-1 flex-shrink-0">{index + 1}</span>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{line.product?.name ?? '—'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">
                  {formatCents(line.unitPrice, 'de-DE', 'EUR')} / Stk.
                </span>
                {line.discountAmount > 0 && (
                  <span className="text-xs text-green-600">
                    -{formatCents(line.discountAmount, 'de-DE', 'EUR')}
                  </span>
                )}
                {line.taxRate > 0 && (
                  <span className="text-xs text-gray-300">
                    {line.taxRate / 100}% MwSt.
                  </span>
                )}
              </div>
              {line.notes && (
                <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                  <MessageSquare size={10} />
                  {line.notes}
                </p>
              )}
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => handleDecrement(line, e)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                {qty <= 1 ? <Trash2 size={12} className="text-red-400" /> : <Minus size={12} className="text-gray-600" />}
              </button>

              <span className="w-8 text-center text-sm font-semibold text-gray-900">
                {Number.isInteger(qty) ? qty : qty.toFixed(qty >= 1 ? 1 : 3)}
              </span>

              <button
                onClick={(e) => handleIncrement(line, e)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                <Plus size={12} className="text-gray-600" />
              </button>
            </div>

            {/* Line total */}
            <div className="flex-shrink-0 text-right min-w-[70px]">
              <p className="text-sm font-bold text-gray-900">
                {formatCents(line.lineTotal - line.discountAmount, 'de-DE', 'EUR')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
