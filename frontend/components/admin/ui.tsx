'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Loader2, X, type LucideIcon } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60';

export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-50';

export const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-50';

export const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-50';

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export interface NoticeState {
  type: 'success' | 'error';
  message: string;
}

export function useNotice() {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const clear = useCallback(() => setNotice(null), []);
  const success = useCallback((message: string) => setNotice({ type: 'success', message }), []);
  const error = useCallback((message: string) => setNotice({ type: 'error', message }), []);
  useEffect(() => {
    if (notice?.type !== 'success') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  return { notice, success, error, clear };
}

export function Notice({ notice, onClose }: { notice: NoticeState | null; onClose: () => void }) {
  if (!notice) return null;
  const ok = notice.type === 'success';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${
        ok ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-200' : 'border-rose-800/60 bg-rose-950/40 text-rose-200'
      }`}
    >
      {ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="flex-1">{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded p-0.5 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-300">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-slate-700'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Pill({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'violet'; children: React.ReactNode }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
    green: 'bg-emerald-950/60 text-emerald-300 border-emerald-900',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-900',
    red: 'bg-rose-950/60 text-rose-300 border-rose-900',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-900',
    violet: 'bg-violet-950/60 text-violet-300 border-violet-900',
  } as const;
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 px-6 py-14 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-500">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
      <span>{label}</span>
    </div>
  );
}

export function Pager({ page, pageCount, total, onChange }: { page: number; pageCount: number; total?: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return total !== undefined ? <p className="text-xs text-slate-500">{total} total</p> : null;
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
      <span>{total !== undefined ? `${total} total · ` : ''}Page {page} of {pageCount}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={iconBtn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtn} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close dialog" className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative my-4 w-full ${widths[size]} rounded-xl border border-slate-800 bg-slate-900 shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export const tableWrap = 'overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40';
export const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-400 whitespace-nowrap';
export const td = 'px-3 py-2 align-middle text-slate-200';
