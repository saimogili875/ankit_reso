'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { asList, PaginatedResponse } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  Loader2,
  Filter,
} from 'lucide-react';

interface PaymentItem {
  id: string;
  user_email: string;
  user_name?: string;
  course_title: string;
  amount_paise: number;
  amount_rupees: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | string;
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  created_at: string;
  paid_at?: string | null;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'created' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [prevPageUrl, setPrevPageUrl] = useState<string | null>(null);

  const fetchPayments = useCallback(
    async (url?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        let endpoint = url;
        if (!endpoint) {
          const params = new URLSearchParams();
          if (statusFilter !== 'all') {
            params.set('status', statusFilter);
          }
          if (searchQuery.trim()) {
            params.set('search', searchQuery.trim());
          }
          const queryStr = params.toString();
          endpoint = queryStr ? `/admin/payments/?${queryStr}` : '/admin/payments/';
        }

        const res = await apiClient.get<PaymentItem[] | PaginatedResponse<PaymentItem>>(endpoint);
        const list = asList<PaymentItem>(res);
        setPayments(list);

        const paginated = res as unknown as PaginatedResponse<PaymentItem>;
        setTotalCount(paginated.count ?? list.length);
        setNextPageUrl(paginated.next || null);
        setPrevPageUrl(paginated.previous || null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch payment transactions.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>PAID</span>
          </span>
        );
      case 'created':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>CREATED</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>FAILED</span>
          </span>
        );
      default:
        return <Badge variant="slate">{status.toUpperCase()}</Badge>;
    }
  };

  const paidCount = payments.filter((p) => p.status.toLowerCase() === 'paid').length;
  const totalPaidRevenue = payments
    .filter((p) => p.status.toLowerCase() === 'paid')
    .reduce((acc, p) => acc + (p.amount_rupees || p.amount_paise / 100), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5 tracking-tight">
            <CreditCard className="w-7 h-7 text-indigo-400" />
            <span>Razorpay Payments & Transactions</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit real-time Razorpay Standard Checkout orders, webhooks, and enrollment transactions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPayments()}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Transactions</div>
            <div className="text-2xl font-black text-white mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Successful Purchases</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{paidCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Settled Revenue</div>
            <div className="text-2xl font-black text-blue-400 mt-1">₹{totalPaidRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
            ₹
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/80 border-slate-800 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Status:</span>
          </span>
          {(['all', 'paid', 'created', 'failed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by student email, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="text-xs font-bold border-slate-800">
            Search
          </Button>
        </form>
      </Card>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Listing */}
      <Card className="overflow-hidden bg-slate-900/60 border-slate-800 shadow-xl">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="text-xs">Loading transaction records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-200">No Payment Records Found</h4>
            <p className="text-xs text-slate-500">
              Transactions created through the checkout button or API will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Razorpay Order ID</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{p.user_email}</div>
                      {p.user_name && <div className="text-[10px] text-slate-400">{p.user_name}</div>}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-300 max-w-xs truncate">
                      {p.course_title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-100 font-mono">
                        ₹{(p.amount_rupees || p.amount_paise / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">{p.currency}</span>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-indigo-300 select-all">
                      {p.razorpay_order_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300 select-all">
                      {p.razorpay_payment_id || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(p.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {(nextPageUrl || prevPageUrl) && (
          <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {payments.length} of {totalCount} records</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => prevPageUrl && fetchPayments(prevPageUrl)}
                disabled={!prevPageUrl || isLoading}
                className="gap-1 border-slate-800 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => nextPageUrl && fetchPayments(nextPageUrl)}
                disabled={!nextPageUrl || isLoading}
                className="gap-1 border-slate-800 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
