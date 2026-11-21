'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import { processRazorpayPayment, VerifyPaymentResponse } from '@/lib/razorpay';
import { useAuth } from '@/hooks/use-auth';

export default function PaymentTestPage() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepStatus, setStepStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [receiptData, setReceiptData] = useState<{
    orderId: string;
    paymentId: string;
    signature: string;
    verification: VerifyPaymentResponse;
  } | null>(null);

  // Form custom prefill state
  const [customerName, setCustomerName] = useState(
    user?.full_name || user?.first_name || 'Sai Kumar'
  );
  const [customerEmail, setCustomerEmail] = useState(
    user?.email || 'mogilisaikumar875@gmail.com'
  );
  const [customerPhone, setCustomerPhone] = useState(
    (user?.phone as string) || (user?.phone_number as string) || '9876543210'
  );

  const handlePay = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    setReceiptData(null);
    setStepStatus('Creating order on backend (POST /api/create-order)...');

    try {
      setStepStatus('Opening Razorpay Checkout Modal...');

      const result = await processRazorpayPayment({
        amountPaise: 100, // ₹1.00 (100 paise)
        description: 'AdeptEduverse — ₹1 Test Payment',
        prefill: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          contact: customerPhone.trim(),
        },
      });

      setStepStatus('Verifying payment signature with backend...');

      setReceiptData({
        orderId: result.payment.razorpay_order_id,
        paymentId: result.payment.razorpay_payment_id,
        signature: result.payment.razorpay_signature,
        verification: result.verification,
      });

      setStepStatus('Completed!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during payment.';
      setErrorMessage(msg);
      setStepStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Razorpay Standard Checkout Integration</span>
        </div>
        <h1 className="text-3xl font-black text-slate-100 tracking-tight">
          ₹1.00 Test Payment
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Test real end-to-end Razorpay Standard Web Checkout with automated HMAC-SHA256 signature verification.
        </p>
      </div>

      {/* Main Checkout Card */}
      <Card className="bg-slate-900 border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl shadow-blue-950/20 space-y-6">
        {/* Order Summary Item */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">Standard Test Order</h2>
              <p className="text-xs text-slate-400">Razorpay Test Gateway Mode</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400">₹1.00</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">100 PAISE</p>
          </div>
        </div>

        {/* Integration Details Badges */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Key ID:</span>
            <code className="text-blue-400 font-mono text-[11px]">rzp_test_U2rAFA7UCHJKz3</code>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Verification:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              HMAC-SHA256 Backend
            </span>
          </div>
        </div>

        {/* Test Mode QR Code Explanation & Guide */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Why your PhonePe / GPay app says "Cannot pay with this QR":</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed text-[11px]">
            You are using a <strong>Razorpay Test Mode key</strong> (<code className="bg-amber-950/80 px-1 py-0.5 rounded text-amber-300 font-mono">rzp_test_...</code>). Real banking apps (Google Pay, PhonePe, Paytm, BHIM) automatically reject test sandbox QR codes because banks do not transfer real money in test mode.
          </p>

          <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
            <span className="font-bold text-amber-200 block text-[11px]">
              👉 How to test in Razorpay Test Mode (Takes 5 seconds):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 space-y-1">
                <span className="font-bold text-blue-400 block">Method 1: Test UPI ID</span>
                <p className="text-[10px] text-slate-400">Click UPI & enter:</p>
                <code className="text-emerald-400 font-mono font-bold block bg-slate-900 px-1.5 py-0.5 rounded">success@razorpay</code>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 space-y-1">
                <span className="font-bold text-blue-400 block">Method 2: Indian Domestic Card</span>
                <p className="text-[10px] text-slate-400">Card number:</p>
                <code className="text-emerald-400 font-mono font-bold block bg-slate-900 px-1.5 py-0.5 rounded select-all">4100 2800 0000 1007</code>
                <span className="text-[10px] text-slate-400 block">Expiry: 12/28 | CVV: 123</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 space-y-1">
                <span className="font-bold text-blue-400 block">Method 3: Netbanking</span>
                <p className="text-[10px] text-slate-400">Choose SBI / HDFC / ICICI</p>
                <span className="text-emerald-400 text-[10px] font-bold block">Click "Success" button</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-amber-300/80 pt-1 border-t border-amber-500/10">
            💡 <strong>Want to scan & pay with real ₹1 using PhonePe/GPay?</strong> Switch your Razorpay Dashboard toggle from "Test Mode" to "Live Mode" and replace with your <code className="font-mono text-amber-200">rzp_live_...</code> key in <code className="font-mono">.env</code>.
          </p>
        </div>

        {/* Customer Prefill Form */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-slate-300 block">Prefill Details for Razorpay Modal</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Mobile</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Live Status Message */}
        {isProcessing && stepStatus && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-center gap-2.5 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{stepStatus}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Payment could not be completed</p>
              <p className="text-rose-300 text-[11px]">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success / Receipt Card */}
        {receiptData && (
          <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Payment Verified Successfully!</span>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-950/80 p-3.5 rounded-lg border border-emerald-500/20 text-slate-300">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400 font-sans">Amount Paid:</span>
                <span className="font-bold text-emerald-400 font-sans">₹1.00 INR</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400 font-sans">Payment ID:</span>
                <span className="text-blue-400">{receiptData.paymentId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400 font-sans">Order ID:</span>
                <span className="text-blue-400">{receiptData.orderId}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-sans">Signature Status:</span>
                <span className="text-emerald-400 font-bold">HMAC-SHA256 Match ✓</span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-300">
              The backend verified the signature using Razorpay Key Secret. Test transaction completed.
            </p>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handlePay}
          disabled={isProcessing}
          className="w-full py-4 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : receiptData ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Pay Again (₹1.00 Test)</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Pay ₹1.00 with Razorpay</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" />
          <span>Secured by Razorpay Standard Web Checkout. Test credentials active.</span>
        </p>
      </Card>
    </div>
  );
}
