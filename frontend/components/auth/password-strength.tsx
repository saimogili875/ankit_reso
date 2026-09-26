import React from 'react';
import { cn } from '@/lib/utils';

export interface PasswordStrengthProps {
  password?: string;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password = '' }) => {
  if (!password) return null;

  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-400', percent: 'w-1/3' };
    if (score <= 3) return { label: 'Medium', color: 'bg-amber-500', text: 'text-amber-400', percent: 'w-2/3' };
    return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-400', percent: 'w-full' };
  };

  const strength = getStrength(password);

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-slate-400 font-medium">Password Strength:</span>
        <span className={cn('font-bold tracking-wide uppercase', strength.text)}>
          {strength.label}
        </span>
      </div>
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div className={cn('h-full transition-all duration-300 rounded-full', strength.color, strength.percent)} />
      </div>
    </div>
  );
};
