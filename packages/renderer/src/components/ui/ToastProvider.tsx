// NexusPOS — Toast Notification Provider

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, XCircle, X, Info } from 'lucide-react';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />,
  error:   <XCircle     size={18} className="text-red-500 flex-shrink-0" />,
  warning: <AlertCircle size={18} className="text-orange-500 flex-shrink-0" />,
  info:    <Info        size={18} className="text-blue-500 flex-shrink-0" />,
};

const COLORS: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  warning: 'border-l-orange-500',
  info:    'border-l-blue-500',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(t => [...t, { id, type, title, message }]);
    setTimeout(() => remove(id), type === 'error' ? 6000 : 4000);
  }, [remove]);

  const ctx: ToastContextValue = {
    toast,
    success: (title, msg) => toast('success', title, msg),
    error:   (title, msg) => toast('error', title, msg),
    warning: (title, msg) => toast('warning', title, msg),
    info:    (title, msg) => toast('info', title, msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm',
              'bg-white rounded-xl border border-gray-200 shadow-lg p-3.5 border-l-4',
              COLORS[t.type],
              'animate-slide-in'
            )}
          >
            {ICONS[t.type]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              {t.message && <p className="text-xs text-gray-500 mt-0.5">{t.message}</p>}
            </div>
            <button onClick={() => remove(t.id)} className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
