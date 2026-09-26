import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormMessageProps {
  type: 'error' | 'success';
  message: string;
}

export const FormMessage: React.FC<FormMessageProps> = ({ type, message }) => {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <div
      className={cn(
        'p-3.5 rounded-xl text-xs font-medium border flex items-start gap-2.5 transition-all duration-200 animate-in fade-in slide-in-from-top-1',
        isError
          ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
      )}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      )}
      <span className="leading-snug">{message}</span>
    </div>
  );
};
