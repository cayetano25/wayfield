'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _seq = 0;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-white border-teal-400 text-gray-800',
  error:   'bg-white border-red-400 text-gray-800',
  info:    'bg-white border-sky-400 text-gray-800',
};

const VARIANT_ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-teal-500 shrink-0" />,
  error:   <AlertTriangle size={16} className="text-red-500 shrink-0" />,
  info:    <Info size={16} className="text-sky-500 shrink-0" />,
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 min-w-[280px] max-w-sm rounded-xl border shadow-lg px-4 py-3 animate-slide-in ${VARIANT_STYLES[item.variant]}`}
      role="alert"
    >
      {VARIANT_ICONS[item.variant]}
      <span className="text-sm flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++_seq;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastItem item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
