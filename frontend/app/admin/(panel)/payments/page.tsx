'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { asList, PaginatedResponse } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  AlertCircle,
  Filter,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable, ColumnDef } from '@/components/admin/data-table';
import { Modal, Field, inputClass, primaryBtn, ghostBtn } from '@/components/admin/ui';

interface PaymentItem {
  id: string;
  user_email: string;
  user_name?: string;
  course_title: string;
  batch_name?: string | null;
  batch?: string | null;
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
  const [batchFilter, setBatchFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchesList, setBatchesList] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [prevPageUrl, setPrevPageUrl] = useState<string | null>(null);

  // Multi-select & Bulk (Task 4)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Grant Enrollment Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantBatchId, setGrantBatchId] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiClient
      .get<Array<{ id: string; name: string; slug: string }>>('/admin-panel/batches/')
      .then((res) => setBatchesList(asList(res)))
      .catch(() => {});
  }, []);

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
          if (batchFilter) {
            params.set('batch', batchFilter);
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
    [statusFilter, batchFilter, searchQuery]
  );

  const handleGrantEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim() || !grantBatchId) {
      setGrantMsg({ type: 'error', text: 'Student email and Batch selection are required.' });
      return;
    }
    setIsGranting(true);
    setGrantMsg(null);
    try {
      await apiClient.post('/admin/payments/grant-enrollment/', {
        user_email: grantEmail.trim().toLowerCase(),
        batch_id: grantBatchId,
      });
      setGrantMsg({ type: 'success', text: `Successfully granted enrollment to ${grantEmail}!` });
      setGrantEmail('');
      setGrantBatchId('');
      fetchPayments();
      setTimeout(() => setIsGrantModalOpen(false), 1500);
    } catch (err: unknown) {
      setGrantMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to grant enrollment.',
      });
    } finally {
      setIsGranting(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>PAID</span>
          </span>
        );
      case 'created':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>CREATED</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
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

  // CSV Export
  const exportToCSV = () => {
    if (payments.length === 0) return;
    const headers = ['Order ID', 'Payment ID', 'Student Email', 'Student Name', 'Course', 'Amount', 'Currency', 'Status', 'Created At'];
    const rows = payments.map((p) => [
      `"${p.razorpay_order_id}"`,
      `"${p.razorpay_payment_id || ''}"`,
      `"${p.user_email}"`,
      `"${p.user_name || ''}"`,
      `"${p.course_title.replace(/"/g, '""')}"`,
      (p.amount_rupees || p.amount_paise / 100).toFixed(2),
      p.currency,
      p.status,
      `"${new Date(p.created_at).toISOString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adept_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<PaymentItem>[] = [
    {
      key: 'user_email',
      header: 'Student',
      sortable: true,
      render: (p) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{p.user_email}</div>
          {p.user_name && <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.user_name}</div>}
        </div>
      ),
    },
    {
      key: 'course_title',
      header: 'Program / Batch',
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300 max-w-xs block truncate">
            {p.batch_name || p.course_title || 'General Enrollment'}
          </span>
          {p.batch_name && p.course_title && p.batch_name !== p.course_title && (
            <span className="text-[10px] text-slate-500 block truncate">Course: {p.course_title}</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount_rupees',
      header: 'Amount',
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
            ₹{(p.amount_rupees || p.amount_paise / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 ml-1">{p.currency}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (p) => getStatusBadge(p.status),
    },
    {
      key: 'razorpay_order_id',
      header: 'Razorpay Order ID',
      render: (p) => (
        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 select-all">
          {p.razorpay_order_id}
        </span>
      ),
    },
    {
      key: 'razorpay_payment_id',
      header: 'Payment ID',
      render: (p) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300 select-all">
          {p.razorpay_payment_id || <span className="text-slate-400 dark:text-slate-600">—</span>}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created Date',
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>{new Date(p.created_at).toLocaleString()}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Shared Page Header */}
      <PageHeader
        title="Razorpay Payments & Transactions"
        description="Audit real-time Razorpay Standard Checkout orders, webhooks, and enrollment transactions."
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {totalCount} total
          </span>
        }
        primaryAction={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPayments()}
            disabled={isLoading}
            className="gap-2 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
        secondaryActions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setGrantMsg(null);
                setIsGrantModalOpen(true);
              }}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <span>+ Grant Enrollment</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={payments.length === 0}
              className="gap-1.5 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Transactions</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Successful Purchases</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{paidCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-blue-400">Settled Revenue</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-blue-400 mt-1">₹{totalPaidRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-blue-500/10 text-indigo-600 dark:text-blue-400 border border-indigo-500/20 dark:border-blue-500/20 flex items-center justify-center font-bold">
            ₹
          </div>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Shared DataTable */}
      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by student email, order ID..."
        onSearchSubmit={() => fetchPayments()}
        selectable={true}
        selectedIds={selectedIds}
        onSelectRow={(id, sel) => {
          setSelectedIds((prev) => (sel ? [...prev, id] : prev.filter((i) => i !== id)));
        }}
        onSelectAll={(sel) => {
          setSelectedIds(sel ? payments.map((p) => p.id) : []);
        }}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
            </span>
            {(['all', 'paid', 'created', 'failed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}

            {batchesList.length > 0 && (
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 ml-2"
              >
                <option value="">All Batches</option>
                {batchesList.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
        emptyState={{
          icon: CreditCard,
          title: 'No Payment Records Found',
          description: 'Transactions created through the checkout button or API will appear here.',
        }}
        pagination={{
          totalItems: totalCount,
          hasPrev: Boolean(prevPageUrl),
          hasNext: Boolean(nextPageUrl),
          onPrev: () => prevPageUrl && fetchPayments(prevPageUrl),
          onNext: () => nextPageUrl && fetchPayments(nextPageUrl),
        }}
      />

      {/* Grant Manual Enrollment Modal */}
      <Modal
        open={isGrantModalOpen}
        title="Grant Manual Enrollment"
        description="Manually authorize a student for a batch without charging via payment gateway (e.g. offline fee payment or scholarship)."
        onClose={() => setIsGrantModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setIsGrantModalOpen(false)}
              disabled={isGranting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={handleGrantEnrollment}
              disabled={isGranting}
            >
              {isGranting ? 'Granting...' : 'Confirm Grant'}
            </button>
          </>
        }
      >
        <form onSubmit={handleGrantEnrollment} className="space-y-4">
          {grantMsg && (
            <div
              className={`p-3 rounded-lg text-xs ${
                grantMsg.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/40 border border-rose-800 text-rose-200'
              }`}
            >
              {grantMsg.text}
            </div>
          )}

          <Field label="Student Account Email *">
            <input
              type="email"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              className={inputClass}
              placeholder="student@example.com"
              required
            />
          </Field>

          <Field label="Target Batch *">
            <select
              value={grantBatchId}
              onChange={(e) => setGrantBatchId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select Batch to grant</option>
              {batchesList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.slug})
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
