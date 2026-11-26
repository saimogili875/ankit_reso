'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  sparklineData?: number[];
  isLoading?: boolean;
  className?: string;
  badgeText?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  subtitle,
  sparklineData,
  isLoading = false,
  className,
  badgeText,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className={cn('glass-card rounded-2xl p-5 border border-border space-y-3 animate-pulse', className)}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-muted/20 rounded" />
          <div className="h-8 w-8 bg-muted/20 rounded-xl" />
        </div>
        <div className="h-8 w-28 bg-muted/20 rounded" />
        <div className="h-3 w-36 bg-muted/20 rounded" />
      </div>
    );
  }

  // Auto-detect trend if not explicitly provided
  const computedTrend = trend ?? (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);

  return (
    <div
      className={cn(
        'glass-card rounded-2xl p-5 border border-border shadow-sm hover:border-primary/30 transition-all duration-200 flex flex-col justify-between group',
        className
      )}
    >
      {/* Top Row: Title + Icon */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted line-clamp-1">
          {title}
        </span>
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 flex-shrink-0 group-hover:scale-105 transition-transform">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="mt-2.5 mb-1 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
          {value}
        </span>
        {badgeText && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {badgeText}
          </span>
        )}
      </div>

      {/* Bottom Row: Trend Badge + Sparkline / Subtitle */}
      <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        {computedTrend ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md',
                computedTrend === 'up' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                computedTrend === 'down' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                computedTrend === 'neutral' && 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20'
              )}
            >
              {computedTrend === 'up' && <TrendingUp className="w-3 h-3" />}
              {computedTrend === 'down' && <TrendingDown className="w-3 h-3" />}
              {computedTrend === 'neutral' && <Minus className="w-3 h-3" />}
              <span>{change !== undefined ? `${change > 0 ? '+' : ''}${change}%` : ''}</span>
            </span>
            {changeLabel && <span className="text-[11px] text-muted">{changeLabel}</span>}
          </div>
        ) : subtitle ? (
          <span className="text-xs text-muted truncate">{subtitle}</span>
        ) : (
          <div />
        )}

        {/* Mini SVG Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="w-16 h-6 flex-shrink-0">
            <svg viewBox="0 0 64 24" className="w-full h-full overflow-visible">
              <path
                d={sparklineData.reduce((acc, val, i) => {
                  const min = Math.min(...sparklineData);
                  const max = Math.max(...sparklineData);
                  const range = max - min || 1;
                  const x = (i / (sparklineData.length - 1)) * 64;
                  const y = 22 - ((val - min) / range) * 20;
                  return `${acc} ${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
                }, '')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  computedTrend === 'down' ? 'text-rose-500' : 'text-primary'
                )}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
