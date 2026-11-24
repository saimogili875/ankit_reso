'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Download, 
  Truck, 
  AlertCircle, 
  Printer, 
  ArrowLeft, 
  BookOpen, 
  Loader2
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-client';

interface OrderDetail {
  public_id: string;
  product_title: string;
  product_slug: string;
  product_cover_image?: string;
  format: 'DIGITAL' | 'HARDCOPY';
  buyer_name: string;
  masked_email: string;
  masked_phone: string;
  shipping_address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  base_amount: string | number;
  gst_amount: string | number;
  total_amount_paise: number;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
  shipping_status: 'NA' | 'PENDING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  tracking_id?: string;
  courier?: string;
  paid_at?: string;
  invoice_number?: string;
  download_expires_at?: string;
  download_count: number;
  max_downloads: number;
  can_download: boolean;
  download_url?: string;
  created_at: string;
}

export default function BookOrderReceiptPage() {
  const params = useParams();
  const publicId = params?.public_id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) return;

    async function fetchOrder() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(buildApiUrl(`/api/books/orders/${publicId}/`), { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Order not found or link has expired.');
        }
        const data = await res.json();
        setOrder(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load order receipt.');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [publicId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-xs text-slate-400">Loading order receipt...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4 text-white">
        <div className="p-8 max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Order Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'Unable to retrieve order details.'}</p>
          <Link
            href="/books"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2B2FB8] text-white hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Browse Publications
          </Link>
        </div>
      </div>
    );
  }

  const totalInr = (order.total_amount_paise / 100).toFixed(2);
  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Payment Verified</span>;
      case 'CREATED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Payment Pending</span>;
      case 'REFUNDED':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Refunded</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
    }
  };

  const getShippingBadge = (shipStatus: string) => {
    switch (shipStatus) {
      case 'DELIVERED':
        return <span className="text-emerald-400 font-bold">Delivered</span>;
      case 'SHIPPED':
        return <span className="text-sky-400 font-bold">Shipped / In Transit</span>;
      case 'PACKED':
        return <span className="text-indigo-400 font-bold">Packed</span>;
      case 'PENDING':
        return <span className="text-amber-400 font-bold">Pending Dispatch</span>;
      default:
        return <span className="text-slate-400">{shipStatus}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 selection:bg-indigo-500 selection:text-white py-10 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link href="/books" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Books Catalog
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>
        </div>

        {/* Receipt Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-8">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Official Publication Order
                </span>
                {getStatusBadge(order.status)}
              </div>
              <h1 className="text-2xl font-black text-white">Order #{order.public_id.slice(0, 8)}</h1>
              <p className="text-xs text-slate-400 mt-1">Placed on {formattedDate}</p>
            </div>
            {order.invoice_number && (
              <div className="sm:text-right">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Invoice Number</div>
                <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">{order.invoice_number}</div>
              </div>
            )}
          </div>

          {/* Book Summary Card */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{order.product_title}</h3>
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  {order.format === 'DIGITAL' ? (
                    <>
                      <Download className="w-3.5 h-3.5 text-indigo-400" /> Digital PDF Edition
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5 text-emerald-400" /> Physical Printed Copy
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Total Paid</div>
              <div className="text-lg font-black text-white">₹{totalInr}</div>
            </div>
          </div>

          {/* Fulfillment Section: Digital Download vs Hard Copy Tracking */}
          {order.format === 'DIGITAL' ? (
            <div className="p-6 rounded-2xl bg-indigo-950/30 border border-indigo-900/60 space-y-4">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <Download className="w-4 h-4 text-indigo-400" /> Digital PDF Delivery
              </div>

              {order.status === 'PAID' && order.can_download && order.download_url ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Your digital book is ready for secure download. Click below to save the PDF directly to your device.
                  </p>
                  <a
                    href={buildApiUrl(order.download_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download Book (PDF)
                  </a>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      Downloads remaining: <strong className="text-slate-200">{Math.max(0, order.max_downloads - order.download_count)}</strong> of {order.max_downloads}
                    </span>
                    <span>Valid for 7 days</span>
                  </div>
                </div>
              ) : order.status === 'PAID' ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="text-amber-400 font-semibold">Download limit or link validity expired.</p>
                  <p>If you need access restored, please contact support with your invoice number: <strong>{order.invoice_number}</strong>.</p>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Awaiting payment verification before PDF link is issued.
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Truck className="w-4 h-4" /> Physical Book Delivery Status
                </div>
                <div>{getShippingBadge(order.shipping_status)}</div>
              </div>

              {/* Courier & Tracking Details */}
              {order.tracking_id ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Courier Partner:</span>
                    <span className="font-bold text-white">{order.courier || 'Express Courier'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Tracking / Consignment ID:</span>
                    <span className="font-mono font-bold text-emerald-400">{order.tracking_id}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Your book is being packed at our fulfillment center. Consignment tracking will be updated here as soon as handed over to the courier partner.
                </p>
              )}

              {/* Shipping Address */}
              <div className="pt-3 border-t border-slate-800 text-xs space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Delivery Address</div>
                <div className="text-slate-200">
                  {order.shipping_address}, {order.city}, {order.state} - {order.pincode}
                </div>
              </div>
            </div>
          )}

          {/* Buyer & Payment Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800 text-xs">
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-500">Buyer Contact Information</div>
              <p className="text-slate-200 font-medium">{order.buyer_name}</p>
              <p className="text-slate-400">Phone: {order.masked_phone}</p>
              <p className="text-slate-400">Email: {order.masked_email}</p>
            </div>

            <div className="space-y-2 sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Payment Breakdown</div>
              <div className="flex justify-between sm:justify-end gap-6 text-slate-400">
                <span>Base Price</span>
                <span className="text-slate-200">₹{Number(order.base_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-6 text-slate-400">
                <span>GST (18%)</span>
                <span className="text-slate-200">₹{Number(order.gst_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-6 font-bold text-sm text-white pt-1 border-t border-slate-800">
                <span>Total Charged</span>
                <span className="text-indigo-400">₹{totalInr}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Support Notice */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>Need help with your order? Email us at <strong className="text-slate-400">support@adepteduverse.com</strong></p>
          <p>Adept Eduverse • Kota Methodology JEE Mastery • Ankit Sir</p>
        </div>
      </div>
    </div>
  );
}
