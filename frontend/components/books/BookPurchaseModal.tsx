'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, Download, Truck, ShieldCheck, Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { loadRazorpayScript, RazorpayOptions } from '@/lib/razorpay';

export interface BookItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  pdfFileName: string;
  digitalPrice: number; // 299
  hardcopyPrice: number; // 399
  highlights: string[];
  coverColor: string;
}

interface BookPurchaseModalProps {
  book: BookItem | null;
  initialFormat?: 'digital' | 'hardcopy';
  onClose: () => void;
}

export const BookPurchaseModal: React.FC<BookPurchaseModalProps> = ({
  book,
  initialFormat = 'digital',
  onClose,
}) => {
  const [format, setFormat] = useState<'digital' | 'hardcopy'>(initialFormat);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{
    downloadUrl?: string | null;
    fileName?: string | null;
    paymentId?: string;
  } | null>(null);

  if (!book) return null;

  const basePrice = format === 'hardcopy' ? book.hardcopyPrice : book.digitalPrice;
  const gstAmount = Math.round(basePrice * 0.18);
  const totalAmount = basePrice + gstAmount;

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (format === 'hardcopy') {
      if (!shippingAddress.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
        setErrorMessage('Please provide complete delivery address, city, state, and pincode.');
        return;
      }
    } else {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address to receive your receipt.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Could not load Razorpay payment gateway. Please verify your connection.');
      }

      // Step 1: Create Order
      const res = await fetch('/api/payments/create-book-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          bookTitle: book.title,
          format,
          customer: {
            name: fullName,
            email,
            phone,
            address: shippingAddress,
            city,
            state: stateName,
            pincode,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize payment order.');
      }

      const orderData = await res.json();

      // Step 2: Open Razorpay Checkout Modal
      const paymentResponse = await new Promise<{
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Adept Eduverse',
          description: `${book.title} (${format === 'hardcopy' ? 'Hard Copy Book' : 'Digital PDF'})`,
          image: '/images/logo.png',
          order_id: orderData.order_id,
          prefill: {
            name: fullName,
            email: email || undefined,
            contact: phone,
          },
          theme: {
            color: '#2B2FB8',
          },
          handler: (response) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment was canceled by user.')),
          },
        };

        const rzp = new window.Razorpay!(options);
        rzp.open();
      });

      // Step 3: Verify Payment
      const verifyRes = await fetch('/api/payments/verify-book-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          bookId: book.id,
          format,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed.');
      }

      setSuccessData({
        downloadUrl: verifyData.downloadUrl || verifyData.download_url,
        fileName: verifyData.fileName || verifyData.book_title,
        paymentId: verifyData.payment_id || verifyData.paymentId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E3E7EE] dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-[#2B2FB8] dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {book.title}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{book.badge}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {successData ? (
            <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Payment Successful!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Payment ID: <span className="font-mono text-indigo-600 dark:text-indigo-400">{successData.paymentId}</span>
                </p>
              </div>

              {format === 'digital' && successData.downloadUrl ? (
                <div className="p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 space-y-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Your digital edition is ready for instant download. Click below to save your PDF copy:
                  </p>
                  <a
                    href={successData.downloadUrl}
                    download={successData.fileName || book.pdfFileName}
                    className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#2B2FB8] hover:bg-[#202494] text-white font-bold text-sm shadow-md transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {successData.fileName || book.pdfFileName}</span>
                  </a>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 text-left space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <Truck className="w-5 h-5" />
                    <span>Order Confirmed for Hard Copy Delivery</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    We have received your delivery order for <strong>{fullName}</strong>. Your physical book will be packaged and dispatched to <strong>{shippingAddress}, {city}, {stateName} - {pincode}</strong> within 24-48 business hours. Tracking link will be sent to your phone.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handlePayNow} className="space-y-5">
              {/* Format Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('digital')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      format === 'digital'
                        ? 'border-[#2B2FB8] bg-indigo-50/60 dark:bg-indigo-950/30 text-[#2B2FB8] dark:text-indigo-400 ring-2 ring-[#2B2FB8]/20'
                        : 'border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">Digital PDF Book</span>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">₹299</span>
                      <span className="text-[10px] text-slate-500">+ GST</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Instant Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('hardcopy')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      format === 'hardcopy'
                        ? 'border-[#2B2FB8] bg-indigo-50/60 dark:bg-indigo-950/30 text-[#2B2FB8] dark:text-indigo-400 ring-2 ring-[#2B2FB8]/20'
                        : 'border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">Hard Copy Book</span>
                      <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">₹399</span>
                      <span className="text-[10px] text-slate-500">+ GST</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium mt-1">Doorstep Courier</span>
                  </button>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Saikumar Mogili"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-[#2B2FB8] focus:ring-1 focus:ring-[#2B2FB8] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit phone"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-[#2B2FB8] focus:ring-1 focus:ring-[#2B2FB8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address {format === 'digital' ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="email"
                      required={format === 'digital'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-[#2B2FB8] focus:ring-1 focus:ring-[#2B2FB8] outline-none"
                    />
                  </div>
                </div>

                {format === 'hardcopy' && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-200">
                      <Truck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Delivery Shipping Address</span>
                    </div>

                    <div>
                      <input
                        type="text"
                        required
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="House / Flat No, Street, Landmark"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:border-[#2B2FB8] focus:ring-1 focus:ring-[#2B2FB8] outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="w-full h-11 px-3 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:border-[#2B2FB8] outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="State"
                        className="w-full h-11 px-3 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:border-[#2B2FB8] outline-none"
                      />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="PIN Code"
                        className="w-full h-11 px-3 rounded-xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:border-[#2B2FB8] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Base Price ({format === 'hardcopy' ? 'Hard Copy Book' : 'Digital PDF'}):</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">₹{basePrice}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>GST (18%):</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Payable:</span>
                  <span className="text-[#2B2FB8] dark:text-indigo-400">₹{totalAmount}</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-[#2B2FB8] hover:bg-[#202494] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Razorpay Checkout…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Proceed to Pay ₹{totalAmount} via Razorpay</span>
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>100% Secure Checkout powered by Razorpay Payments</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
