import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className={variant === 'danger' ? 'rounded-full bg-red-50 p-2 text-red-600' : 'rounded-full bg-amber-50 p-2 text-amber-700'}><AlertTriangle className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-950">{title}</h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button type="button" aria-label="Fechar" disabled={loading} onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} type="button" variant="outline" disabled={loading} onClick={onCancel}>{cancelLabel}</Button>
          <Button type="button" variant={variant === 'danger' ? 'danger' : 'primary'} disabled={loading} onClick={onConfirm}>{loading ? 'Processando...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};
