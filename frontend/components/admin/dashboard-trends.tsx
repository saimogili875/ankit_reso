'use client';

import React, { useEffect, useState, useId } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  TrendingUp,
  Users,
  CreditCard,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface TrendDay {
  date: string;
  label: string;
  signups: number;
  payments_count: number;
  payments_amount: number;
}

interface OverviewTrendsData {
  total_signups_30d: number;
  total_payments_count_30d: number;
  total_revenue_30d: number;
  start_date: string;
  end_date: string;
  trends: TrendDay[];
}

export function DashboardTrends() {
  const gradientId = useId();
  const [data, setData] = useState<OverviewTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<'signups' | 'revenue'>('signups');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetchTrends = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OverviewTrendsData>('/admin-panel/overview/trends/');
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load 30-day trends.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  const trends = data?.trends || [];
  const isAllZero =
    trends.length > 0 &&
    trends.every((t) => (activeMetric === 'signups' ? t.signups === 0 : t.payments_amount === 0));

  // Chart coordinate calculation
  const width = 760;
  const height = 180;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartInnerWidth = width - paddingX * 2;
  const chartInnerHeight = height - paddingTop - paddingBottom;

  const values = trends.map((t) =>
    activeMetric === 'signups' ? t.signups : t.payments_amount
  );
  const maxValue = Math.max(...values, activeMetric === 'signups' ? 5 : 500);

  const points = trends.map((t, index) => {
    const val = activeMetric === 'signups' ? t.signups : t.payments_amount;
    const x = paddingX + (index / (Math.max(trends.length - 1, 1))) * chartInnerWidth;
    const y = paddingTop + chartInnerHeight - (val / maxValue) * chartInnerHeight;
    return { x, y, val, day: t };
  });

  const pathD = points.length > 0
    ? points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x.toFixed(1)},${(paddingTop + chartInnerHeight).toFixed(1)} L ${points[0].x.toFixed(1)},${(paddingTop + chartInnerHeight).toFixed(1)} Z`
    : '';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm p-5 space-y-4">
      {/* Header and Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/40">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Last 30 days</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {data ? `${data.start_date} &rarr; ${data.end_date}` : 'Daily Trends'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform growth, signups, and verified revenue over the last 30 days.
            </p>
          </div>
        </div>

        {/* Metric Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveMetric('signups')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                activeMetric === 'signups'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Signups ({data?.total_signups_30d ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                activeMetric === 'revenue'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Revenue (₹{Math.round(data?.total_revenue_30d ?? 0).toLocaleString('en-IN')})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchTrends}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50 transition-colors"
            title="Refresh trends"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Body: Loading, Error, Empty, or SVG Chart */}
      {isLoading ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <p className="text-xs">Computing 30-day analytics...</p>
        </div>
      ) : error ? (
        <div className="h-44 p-6 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 flex flex-col items-center justify-center text-center gap-2">
          <AlertCircle className="w-6 h-6 text-rose-500" />
          <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchTrends}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : isAllZero ? (
        <div className="h-48 flex flex-col items-center justify-center text-center p-6 gap-2">
          <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No {activeMetric === 'signups' ? 'new signups' : 'transactions'} in the last 30 days
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Activity recorded in production will automatically render on this timeline chart.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Active tooltip badge */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <div
              className="absolute -top-2 transform -translate-x-1/2 -translate-y-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-lg px-2.5 py-1 shadow-lg pointer-events-none transition-all z-10 whitespace-nowrap"
              style={{ left: `${(points[hoveredIndex].x / width) * 100}%` }}
            >
              <div className="font-bold">
                {activeMetric === 'signups'
                  ? `${points[hoveredIndex].day.signups} student signup${points[hoveredIndex].day.signups === 1 ? '' : 's'}`
                  : `₹${points[hoveredIndex].day.payments_amount.toLocaleString('en-IN')} (${points[hoveredIndex].day.payments_count} paid)`}
              </div>
              <div className="text-[10px] opacity-75">{points[hoveredIndex].day.label}</div>
            </div>
          )}

          {/* SVG Trend Chart */}
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`trend-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line
                x1={paddingX}
                y1={paddingTop}
                x2={width - paddingX}
                y2={paddingTop}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800/80 stroke-dasharray-2"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={paddingTop + chartInnerHeight / 2}
                x2={width - paddingX}
                y2={paddingTop + chartInnerHeight / 2}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800/80 stroke-dasharray-2"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={paddingTop + chartInnerHeight}
                x2={width - paddingX}
                y2={paddingTop + chartInnerHeight}
                stroke="currentColor"
                className="text-slate-300 dark:text-slate-800"
                strokeWidth="1"
              />

              {/* Filled Area */}
              <path d={areaD} fill={`url(#trend-grad-${gradientId})`} />

              {/* Trend Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points & Interactive Hover Columns */}
              {points.map((p, idx) => {
                const isHovered = hoveredIndex === idx;
                const colWidth = chartInnerWidth / points.length;
                return (
                  <g key={p.day.date}>
                    {/* Invisible hover trigger column */}
                    <rect
                      x={p.x - colWidth / 2}
                      y={0}
                      width={colWidth}
                      height={height}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Point Circle */}
                    {(p.val > 0 || isHovered) && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5 : 3.5}
                        className={`transition-all ${
                          isHovered
                            ? 'fill-indigo-600 stroke-white stroke-2'
                            : 'fill-indigo-500'
                        }`}
                      />
                    )}
                  </g>
                );
              })}

              {/* X Axis Date Labels (every 5-6 days) */}
              {points.map((p, idx) => {
                if (idx % 5 === 0 || idx === points.length - 1) {
                  return (
                    <text
                      key={`lbl-${p.day.date}`}
                      x={p.x}
                      y={height - 8}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400 dark:fill-slate-500 font-medium select-none"
                    >
                      {p.day.label}
                    </text>
                  );
                }
                return null;
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
