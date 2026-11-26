'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  TrendingUp,
  Users,
  CreditCard,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { LineTrend, KpiCard } from '@/components/charts';

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
  const [data, setData] = useState<OverviewTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<'signups' | 'revenue' | 'orders'>('signups');

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

  // Sparkline data arrays for top KPI cards
  const signupsSpark = trends.map((t) => t.signups);
  const ordersSpark = trends.map((t) => t.payments_count);
  const revenueSpark = trends.map((t) => t.payments_amount);

  return (
    <div className="space-y-5">
      {/* 30-Day Growth KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KpiCard
          title="30-Day Signups"
          value={isLoading ? '...' : (data?.total_signups_30d ?? 0).toLocaleString()}
          icon={Users}
          sparklineData={signupsSpark}
          subtitle="New student accounts"
          isLoading={isLoading}
        />
        <KpiCard
          title="30-Day Book Orders"
          value={isLoading ? '...' : (data?.total_payments_count_30d ?? 0).toLocaleString()}
          icon={CreditCard}
          sparklineData={ordersSpark}
          subtitle="Paid orders & enrollments"
          isLoading={isLoading}
        />
        <KpiCard
          title="30-Day Revenue"
          value={
            isLoading
              ? '...'
              : `₹${Math.round(data?.total_revenue_30d ?? 0).toLocaleString('en-IN')}`
          }
          icon={TrendingUp}
          sparklineData={revenueSpark}
          subtitle="Gross platform receipts"
          isLoading={isLoading}
        />
      </div>

      {/* Main Recharts Line Trend with Metric Switcher */}
      <div className="glass-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 font-heading">
                <span>30-Day Growth Trends</span>
                {data?.start_date && (
                  <span className="text-xs font-normal text-muted flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" />
                    {data.start_date} &rarr; {data.end_date}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted">
                Daily new accounts, order completions, and verified fee receipts.
              </p>
            </div>
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex p-1 rounded-xl bg-surface border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveMetric('signups')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMetric === 'signups'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Signups</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric('revenue')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMetric === 'revenue'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Revenue</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric('orders')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMetric === 'orders'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchTrends}
              disabled={isLoading}
              className="w-8 h-8 rounded-xl border border-border bg-surface text-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Refresh trends"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Recharts Line Trend */}
        <LineTrend
          data={trends as unknown as Array<Record<string, unknown>>}
          xKey="label"
          series={
            activeMetric === 'signups'
              ? [{ key: 'signups', name: 'New Signups', color: 'var(--chart-1)' }]
              : activeMetric === 'revenue'
              ? [{ key: 'payments_amount', name: 'Revenue', color: 'var(--chart-3)' }]
              : [{ key: 'payments_count', name: 'Orders', color: 'var(--chart-2)' }]
          }
          height={260}
          valueFormatter={(val) =>
            activeMetric === 'revenue'
              ? `₹${Math.round(val).toLocaleString('en-IN')}`
              : `${val}`
          }
          isLoading={isLoading}
          error={error}
          onRetry={fetchTrends}
          emptyMessage="No activity recorded in the selected 30-day window."
        />
      </div>
    </div>
  );
}
