import React, { createContext, useContext, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4000) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const toast = {
    success: (msg: string, title?: string) => showToast('success', msg, title),
    error: (msg: string, title?: string) => showToast('error', msg, title),
    warning: (msg: string, title?: string) => showToast('warning', msg, title),
    info: (msg: string, title?: string) => showToast('info', msg, title),
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-teal-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-slate-900/95',
    error: 'border-rose-500/30 bg-slate-900/95',
    warning: 'border-amber-500/30 bg-slate-900/95',
    info: 'border-teal-500/30 bg-slate-900/95',
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, toast }}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'pointer-events-auto rounded-xl p-3.5 glass-panel border shadow-2xl flex items-start gap-3 animate-slide-up transition-all',
              borders[t.type]
            )}
          >
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t.title}</h4>}
              <p className="text-xs text-slate-300 leading-relaxed mt-0.5 break-words">{t.message}</p>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
