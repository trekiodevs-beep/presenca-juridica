import React, { useEffect, useId, useRef } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { Button } from './Button';

type TextPromptDialogProps = {
  open: boolean; title: string; description: string; label: string; value: string;
  minimumLength?: number; confirmLabel?: string; loading?: boolean;
  onValueChange: (value: string) => void; onConfirm: () => void | Promise<void>; onCancel: () => void;
};

export const TextPromptDialog = ({ open, title, description, label, value, minimumLength = 1, confirmLabel = 'Confirmar', loading = false, onValueChange, onConfirm, onCancel }: TextPromptDialogProps) => {
  const titleId = useId(); const descriptionId = useId(); const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const length = value.trim().length;
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onCancel(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel, open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onCancel(); }}><div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start gap-3"><div className="rounded-full bg-brand-50 p-2 text-brand-700"><MessageSquareText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 id={titleId} className="text-lg font-bold text-slate-950">{title}</h2><p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div><button type="button" aria-label="Fechar" disabled={loading} onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-5 w-5" /></button></div><label htmlFor={inputId} className="mt-5 block text-sm font-semibold text-slate-700">{label}</label><textarea id={inputId} ref={inputRef} rows={4} value={value} disabled={loading} onChange={event => onValueChange(event.target.value)} className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100" /><p className={length >= minimumLength ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-amber-700'}>{length}/{minimumLength} caracteres mínimos</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={loading} onClick={onCancel}>Cancelar</Button><Button type="button" disabled={loading || length < minimumLength} onClick={onConfirm}>{loading ? 'Enviando...' : confirmLabel}</Button></div></div></div>;
};
