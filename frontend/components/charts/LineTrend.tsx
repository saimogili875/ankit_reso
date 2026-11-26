'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import { Table, Eye, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';

export interface LineSeries {
  key: string;
  name: string;
  color?: string;
  strokeWidth?: number;
  areaGradient?: boolean;
}

export interface LineTrendProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: LineSeries[];
  title?: string;
  description?: string;
  height?: number;
  valueFormatter?: (val: number) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function LineTrend({
  data,
  xKey,
  series,
  title,
  description,
  height = 280,
  valueFormatter = (v) => `${v}`,
  isLoading = false,
  error = null,
  emptyMessage = 'No trend data recorded yet.',
  onRetry,
  className = '',
}: LineTrendProps) {
  const [showTableFallback, setShowTableFallback] = useState(false);

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className={`glass-card rounded-2xl p-5 border border-border space-y-4 animate-pulse ${className}`}>
        {title && <div className="h-5 w-48 bg-muted/20 rounded" />}
        {description && <div className="h-3 w-72 bg-muted/15 rounded" />}
        <div style={{ height }} className="w-full bg-muted/10 rounded-xl flex items-end p-4 gap-3">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className="flex-1 bg-muted/20 rounded-t-lg transition-all"
            />
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className={`glass-card rounded-2xl p-6 border border-rose-500/30 bg-rose-500/5 text-center space-y-3 ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-foreground">Failed to render trend chart</p>
        <p className="text-[11px] text-muted max-w-sm mx-auto">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border hover:bg-muted/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (!data || data.length === 0) {
    return (
      <div className={`glass-card rounded-2xl p-8 border border-border text-center space-y-2 ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
          <BarChart2 className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-foreground">{title || 'Trend Chart'}</p>
        <p className="text-[11px] text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`glass-card rounded-2xl p-5 border border-border shadow-sm space-y-4 ${className}`}>
      {/* Header with Title & Accessible Table Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div>
          {title && <h3 className="text-sm font-bold text-foreground font-heading">{title}</h3>}
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>

        <button
          type="button"
          onClick={() => setShowTableFallback((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-foreground rounded-lg border border-border bg-surface hover:bg-muted/10 transition-colors self-start sm:self-auto"
          aria-label={showTableFallback ? 'Show visual chart' : 'Show accessible data table'}
        >
          {showTableFallback ? <Eye className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5" />}
          <span>{showTableFallback ? 'View Chart' : 'Accessible Table'}</span>
        </button>
      </div>

      {/* Accessible Table Fallback */}
      {showTableFallback ? (
        <div className="overflow-x-auto max-h-72 rounded-xl border border-border">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border text-muted font-semibold">
                <th className="p-2.5 capitalize">{xKey}</th>
                {series.map((s) => (
                  <th key={s.key} className="p-2.5">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-surface/50 font-mono">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/5 transition-colors">
                  <td className="p-2.5 font-medium text-foreground">{String(row[xKey] ?? '')}</td>
                  {series.map((s) => (
                    <td key={s.key} className="p-2.5 text-foreground">
                      {typeof row[s.key] === 'number'
                        ? valueFormatter(row[s.key] as number)
                        : String(row[s.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Recharts SVG Chart */
        <div style={{ width: '100%', height }} className="relative select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                {series.map((s, idx) => {
                  const strokeColor = s.color || `var(--chart-${idx + 1}, var(--primary))`;
                  return (
                    <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                tickFormatter={(val) => (typeof val === 'number' ? valueFormatter(val) : val)}
                dx={-4}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="rounded-xl border border-border p-3 shadow-xl backdrop-blur-md bg-[var(--chart-tooltip-bg)] text-foreground text-xs space-y-1.5 min-w-[140px]">
                      <p className="font-bold text-foreground border-b border-border/60 pb-1">{label}</p>
                      {payload.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 font-mono">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}:
                          </span>
                          <span className="font-bold text-foreground">
                            {typeof entry.value === 'number' ? valueFormatter(entry.value) : entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {series.map((s, idx) => {
                const strokeColor = s.color || `var(--chart-${idx + 1}, var(--primary))`;
                return (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={strokeColor}
                    strokeWidth={s.strokeWidth || 2.5}
                    fillOpacity={1}
                    fill={`url(#gradient-${s.key})`}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
