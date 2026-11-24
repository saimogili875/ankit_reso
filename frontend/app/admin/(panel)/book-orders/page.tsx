'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Package, 
  Search, 
  Download, 
  RefreshCw, 
  Truck, 
  Mail, 
  X, 
  Loader2, 
  Eye, 
  Ban, 
  MapPin, 
  User as UserIcon
} from 'lucide-react';
import { 
  PageHeader, 
  Notice, 
  useNotice, 
  Field, 
  Pill, 
  primaryBtn, 
  ghostBtn, 
  inputClass, 
  formatDate, 
  useDebounced, 
  errMsg 
} from '@/components/admin/ui';
import { apiClient, buildApiUrl } from '@/lib/api-client';

interface BookOrderAdmin {
  id: number;
  public_id: string;
  product: number;
  product_title: string;
  product_slug: string;
  format: 'DIGITAL' | 'HARDCOPY';
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  shipping_address: string;
  city: string;
  state: string;
  pincode: string;
  base_amount: string | number;
  gst_amount: string | number;
  total_amount_paise: number;
  total_inr: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  shipping_status: 'NA' | 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  tracking_id: string;
  courier: string;
  admin_note: string;
  download_token: string;
  download_expires_at: string | null;
  download_count: number;
  max_downloads: number;
  invoice_number: string;
  paid_at: string | null;
  created_at: string;
}

export default function AdminBookOrdersPage() {
  const { notice, success, error, clear } = useNotice();

  const [orders, setOrders] = useState<BookOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [shippingFilter, setShippingFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  // Detail & Fulfillment Drawer
  const [selectedOrder, setSelectedOrder] = useState<BookOrderAdmin | null>(null);
  const [updatingShipping, setUpdatingShipping] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Shipping form inputs in drawer
  const [drawerShippingStatus, setDrawerShippingStatus] = useState<string>('PENDING');
  const [drawerTrackingId, setDrawerTrackingId] = useState('');
  const [drawerCourier, setDrawerCourier] = useState('');
  const [drawerAdminNote, setDrawerAdminNote] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (shippingFilter) params.set('shipping_status', shippingFilter);
      if (formatFilter) params.set('format', formatFilter);

      const data = await apiClient.get<BookOrderAdmin[] | { results: BookOrderAdmin[]; count: number }>(`/api/admin/books/orders/?${params.toString()}`);
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders(data.results || []);
      }
    } catch (err) {
      error(errMsg(err, 'Failed to fetch book orders.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, shippingFilter, formatFilter, error]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openOrderDetail = (order: BookOrderAdmin) => {
    setSelectedOrder(order);
    setDrawerShippingStatus(order.shipping_status);
    setDrawerTrackingId(order.tracking_id || '');
    setDrawerCourier(order.courier || '');
    setDrawerAdminNote(order.admin_note || '');
  };

  const handleUpdateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setUpdatingShipping(true);
    try {
      await apiClient.post(`/api/admin/books/orders/${selectedOrder.id}/update-shipping/`, {
        shipping_status: drawerShippingStatus,
        tracking_id: drawerTrackingId.trim(),
        courier: drawerCourier.trim(),
        admin_note: drawerAdminNote.trim(),
      });
      success(`Updated shipping for order #${selectedOrder.public_id.slice(0, 8)}.`);
      fetchOrders();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              shipping_status: drawerShippingStatus as BookOrderAdmin['shipping_status'],
              tracking_id: drawerTrackingId.trim(),
              courier: drawerCourier.trim(),
              admin_note: drawerAdminNote.trim(),
            }
          : null
      );
    } catch (err) {
      error(errMsg(err, 'Failed to update shipping.'));
    } finally {
      setUpdatingShipping(false);
    }
  };

  const handleResendEmail = async (orderId: number) => {
    setResendingEmail(true);
    try {
      await apiClient.post(`/api/admin/books/orders/${orderId}/resend-email/`);
      success('Order confirmation email resent successfully!');
    } catch (err) {
      error(errMsg(err, 'Failed to resend email.'));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleMarkRefunded = async (orderId: number) => {
    if (!confirm('Are you sure you want to mark this order as REFUNDED? Digital downloads will be revoked.')) {
      return;
    }
    try {
      await apiClient.post(`/api/admin/books/orders/${orderId}/mark-refunded/`);
      success('Order marked as REFUNDED.');
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'REFUNDED' } : null));
      }
    } catch (err) {
      error(errMsg(err, 'Failed to refund order.'));
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (shippingFilter) params.set('shipping_status', shippingFilter);
    if (formatFilter) params.set('format', formatFilter);

    const exportUrl = buildApiUrl(`/api/admin/books/orders/export-csv/?${params.toString()}`);
    window.open(exportUrl, '_blank');
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Pill tone="green">Paid</Pill>;
      case 'CREATED':
        return <Pill tone="amber">Pending</Pill>;
      case 'REFUNDED':
        return <Pill tone="violet">Refunded</Pill>;
      default:
        return <Pill tone="red">{status}</Pill>;
    }
  };

  const getShippingPill = (shipping: string) => {
    switch (shipping) {
      case 'DELIVERED':
        return <Pill tone="green">Delivered</Pill>;
      case 'SHIPPED':
        return <Pill tone="indigo">Shipped</Pill>;
      case 'PACKED':
        return <Pill tone="slate">Packed</Pill>;
      case 'PENDING':
        return <Pill tone="amber">Pending</Pill>;
      case 'CANCELLED':
        return <Pill tone="red">Cancelled</Pill>;
      default:
        return <Pill tone="slate">N/A</Pill>;
    }
  };

  return (
    <div className="space-y-6">
      <Notice notice={notice} onClose={clear} />

      <PageHeader
        icon={Package}
        title="Book Orders & Fulfillment"
        description="Fulfill physical book shipments, track courier consignments, manage receipts and refunds."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className={ghostBtn}
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className={ghostBtn}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by buyer, phone, email, tracking..."
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Payment Statuses</option>
            <option value="PAID">Paid</option>
            <option value="CREATED">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          {/* Shipping */}
          <select
            value={shippingFilter}
            onChange={(e) => setShippingFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Shipping Statuses</option>
            <option value="PENDING">Pending Dispatch</option>
            <option value="PACKED">Packed</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Format */}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Formats</option>
            <option value="DIGITAL">Digital PDF</option>
            <option value="HARDCOPY">Physical Hard Copy</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        {loading && orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm">Loading book orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <h3 className="text-sm font-bold text-white">No orders found</h3>
            <p className="text-xs">Try adjusting your search criteria or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Invoice / Order</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Book & Format</th>
                  <th className="py-3.5 px-4">Buyer Info</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Shipping</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Invoice & Order ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-[11px]">
                        {o.invoice_number || `#${o.public_id.slice(0, 8)}`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {o.public_id.slice(0, 13)}...
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatDate(o.created_at)}
                    </td>

                    {/* Book */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white max-w-[200px] truncate" title={o.product_title}>
                        {o.product_title}
                      </div>
                      <div className="mt-0.5">
                        <Pill tone={o.format === 'DIGITAL' ? 'indigo' : 'slate'}>
                          {o.format === 'DIGITAL' ? 'Digital PDF' : 'Hard Copy'}
                        </Pill>
                      </div>
                    </td>

                    {/* Buyer */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-200">{o.buyer_name}</div>
                      <div className="text-[11px] text-slate-400">{o.buyer_phone}</div>
                      <div className="text-[11px] text-slate-500">{o.buyer_email}</div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-bold text-white">
                      ₹{o.total_inr.toFixed(2)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4">
                      {getStatusPill(o.status)}
                    </td>

                    {/* Shipping Status */}
                    <td className="py-3.5 px-4">
                      <div>{getShippingPill(o.shipping_status)}</div>
                      {o.tracking_id && (
                        <div className="text-[10px] font-mono text-indigo-400 mt-1" title={o.tracking_id}>
                          {o.courier ? `${o.courier}: ` : ''}{o.tracking_id}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrderDetail(o)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail & Fulfillment Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full overflow-y-auto p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-indigo-400">Order Details</span>
                    {getStatusPill(selectedOrder.status)}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {selectedOrder.invoice_number || `Order #${selectedOrder.public_id.slice(0, 8)}`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Publication:</span>
                  <span className="font-bold text-white text-xs">{selectedOrder.product_title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Format:</span>
                  <Pill tone={selectedOrder.format === 'DIGITAL' ? 'indigo' : 'slate'}>
                    {selectedOrder.format === 'DIGITAL' ? 'Digital PDF' : 'Physical Printed Copy'}
                  </Pill>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Charged:</span>
                  <span className="font-black text-white text-sm">₹{selectedOrder.total_inr.toFixed(2)} (incl. 18% GST)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Razorpay Payment ID:</span>
                  <span className="font-mono text-xs text-indigo-400">{selectedOrder.razorpay_payment_id || '—'}</span>
                </div>
              </div>

              {/* Buyer & Shipping Address */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-white text-xs mb-1 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" /> Buyer Contact Details
                </div>
                <div><strong>Name:</strong> {selectedOrder.buyer_name}</div>
                <div><strong>Phone:</strong> {selectedOrder.buyer_phone}</div>
                <div><strong>Email:</strong> {selectedOrder.buyer_email}</div>

                {selectedOrder.format === 'HARDCOPY' && (
                  <div className="pt-2 border-t border-slate-800/80 mt-2 space-y-1">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Shipping Address
                    </div>
                    <p className="text-slate-300">
                      {selectedOrder.shipping_address}<br />
                      {selectedOrder.city}, {selectedOrder.state} - {selectedOrder.pincode}
                    </p>
                  </div>
                )}
              </div>

              {/* Digital Download Inspection */}
              {selectedOrder.format === 'DIGITAL' && (
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/60 space-y-2 text-xs">
                  <div className="font-bold text-indigo-300">Digital Delivery Status</div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Downloads Made:</span>
                    <span className="font-bold text-white">{selectedOrder.download_count} of {selectedOrder.max_downloads}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Download Link Active:</span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      {selectedOrder.download_token ? 'Active Token' : 'Unissued'}
                    </span>
                  </div>
                </div>
              )}

              {/* Physical Fulfillment Update Form */}
              {selectedOrder.format === 'HARDCOPY' && (
                <form onSubmit={handleUpdateShipping} className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-400" /> Update Courier & Shipping
                  </div>

                  <Field label="Shipping Status">
                    <select
                      value={drawerShippingStatus}
                      onChange={(e) => setDrawerShippingStatus(e.target.value)}
                      className={inputClass}
                    >
                      <option value="PENDING">Pending Dispatch</option>
                      <option value="PACKED">Packed</option>
                      <option value="SHIPPED">Shipped / In Transit</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Courier Partner">
                      <input
                        type="text"
                        value={drawerCourier}
                        onChange={(e) => setDrawerCourier(e.target.value)}
                        placeholder="e.g. Blue Dart, Delhivery"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Tracking / AWB Number">
                      <input
                        type="text"
                        value={drawerTrackingId}
                        onChange={(e) => setDrawerTrackingId(e.target.value)}
                        placeholder="e.g. AWB12345678"
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="Internal Admin Note">
                    <input
                      type="text"
                      value={drawerAdminNote}
                      onChange={(e) => setDrawerAdminNote(e.target.value)}
                      placeholder="e.g. Dispatched on Monday evening batch"
                      className={inputClass}
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={updatingShipping}
                    className={`${primaryBtn} w-full mt-2`}
                  >
                    {updatingShipping && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Shipping & Dispatch Update
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    Note: Marking status as &quot;Shipped&quot; automatically emails the student their consignment tracking details.
                  </p>
                </form>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={resendingEmail}
                  onClick={() => handleResendEmail(selectedOrder.id)}
                  className={`${ghostBtn} w-full text-xs`}
                >
                  {resendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Resend Confirmation
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkRefunded(selectedOrder.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" /> Mark Refunded
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
