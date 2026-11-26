'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Table, Eye, AlertCircle, RefreshCw, PieChart as PieIcon } from 'lucide-react';

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  data: DonutSlice[];
  title?: string;
  description?: string;
  centerValue?: string | number;
  centerLabel?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  valueFormatter?: (val: number) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function Donut({
  data,
  title,
  description,
  centerValue,
  centerLabel,
  height = 280,
  innerRadius = 60,
  outerRadius = 88,
  valueFormatter = (v) => `${v}`,
  isLoading = false,
  error = null,
  emptyMessage = 'No breakdown data available.',
  onRetry,
  className = '',
}: DonutProps) {
  const [showTableFallback, setShowTableFallback] = useState(false);

  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className={`glass-card rounded-2xl p-5 border border-border space-y-4 animate-pulse ${className}`}>
        {title && <div className="h-5 w-48 bg-muted/20 rounded" />}
        {description && <div className="h-3 w-72 bg-muted/15 rounded" />}
        <div style={{ height }} className="w-full flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-8 border-muted/20 border-t-primary animate-spin" />
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
        <p className="text-xs font-bold text-foreground">Failed to render donut chart</p>
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
  const totalValue = data ? data.reduce((acc, d) => acc + (d.value || 0), 0) : 0;
  if (!data || data.length === 0 || totalValue === 0) {
    return (
      <div className={`glass-card rounded-2xl p-8 border border-border text-center space-y-2 ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
          <PieIcon className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-foreground">{title || 'Distribution Chart'}</p>
        <p className="text-[11px] text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`glass-card rounded-2xl p-5 border border-border shadow-sm space-y-4 ${className}`}>
      {/* Header */}
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
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Value</th>
                <th className="p-2.5">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 bg-surface/50 font-mono">
              {data.map((row, idx) => {
                const pct = totalValue > 0 ? ((row.value / totalValue) * 100).toFixed(1) : '0';
                return (
                  <tr key={idx} className="hover:bg-muted/5 transition-colors">
                    <td className="p-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="p-2.5 text-foreground">{valueFormatter(row.value)}</td>
                    <td className="p-2.5 text-muted">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Recharts Donut Chart */
        <div style={{ width: '100%', height }} className="relative select-none flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0];
                  const val = Number(item.value) || 0;
                  const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0';
                  return (
                    <div className="rounded-xl border border-border p-2.5 shadow-xl backdrop-blur-md bg-[var(--chart-tooltip-bg)] text-foreground text-xs space-y-1 min-w-[120px]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.payload?.fill || item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
                        <span className="text-muted">{valueFormatter(val)}</span>
                        <span className="font-bold text-foreground">({pct}%)</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: 11, color: 'var(--muted)', paddingTop: 8 }}
                iconSize={8}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="46%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={3}
                stroke="var(--surface)"
                strokeWidth={2}
              >
                {data.map((entry, index) => {
                  const sliceColor = entry.color || `var(--chart-${(index % 5) + 1}, var(--primary))`;
                  return <Cell key={`cell-${index}`} fill={sliceColor} />;
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered KPI display inside donut hole */}
          {(centerValue !== undefined || centerLabel) && (
            <div className="absolute inset-0 top-[-20px] flex flex-col items-center justify-center pointer-events-none">
              {centerValue !== undefined && (
                <span className="text-xl sm:text-2xl font-extrabold text-foreground font-heading">
                  {centerValue}
                </span>
              )}
              {centerLabel && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted mt-0.5">
                  {centerLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
