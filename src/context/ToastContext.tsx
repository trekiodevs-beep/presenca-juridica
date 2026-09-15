import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number | null;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { durationMs?: number | null }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', options?: { durationMs?: number | null }) => {
    const id = crypto.randomUUID();
    const durationMs = options?.durationMs ?? (type === 'error' ? 6000 : type === 'info' ? 4500 : 3500);
    setToasts((prev) => [...prev.slice(-3), { id, message, type, durationMs }]);

    if (durationMs !== null) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
              role={toast.type === 'error' ? 'alert' : 'status'}
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
              className="pointer-events-auto w-full bg-white rounded-xl shadow-lg border border-slate-100 p-4 flex items-start gap-3 overflow-hidden"
            >
              {/* Icon based on type */}
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                {toast.type === 'error' && (
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                )}
                {toast.type === 'info' && (
                  <Info className="w-5 h-5 text-blue-500" />
                )}
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 leading-tight">
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 rounded-lg p-0.5 hover:bg-slate-50 transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
