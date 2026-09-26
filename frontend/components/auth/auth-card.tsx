import React from 'react';
import { cn } from '@/lib/utils';

export interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        'w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-blue-950/20 space-y-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
