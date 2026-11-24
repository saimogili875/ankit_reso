'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { X, CheckCircle2, Download, Truck, ShieldCheck, Loader2, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import { loadRazorpayScript, RazorpayOptions } from '@/lib/razorpay';
import { buildApiUrl } from '@/lib/api-client';

export interface BookItem {
  id?: string;
  slug?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  pdfFileName?: string;
  digital_price?: number | string;
  digitalPrice?: number;
  hardcopy_price?: number | string;
  hardcopyPrice?: number;
  original_price?: number | string;
  originalPrice?: number;
  gst_percent?: number | string;
  class_label?: string;
  highlights?: string[];
  cover_image?: string;
  coverColor?: string;
}

export function getBookCoverImage(book?: { slug?: string; title?: string; cover_image?: string } | null): string {
  if (!book) return '/images/books/cbse-10-pyq-mathematics.jpg';
  const rawCover = (book.cover_image || '').trim();
  const slug = (book.slug || '').toLowerCase();
  const title = (book.title || '').toLowerCase();

  // If the cover is an Ankit Sir personal headshot or empty, map strictly to the real book cover
  const isPersonalPhoto = !rawCover || rawCover.includes('ankit-sir');

  if (slug.includes('pyq') || title.includes('previous years') || title.includes('pyq')) {
    return '/images/books/cbse-10-pyq-mathematics.jpg';
  }
  if (slug.includes('mental-ability') || title.includes('mental ability') || title.includes('logical reasoning')) {
    return '/images/books/cbse-10-mental-ability-reasoning.jpg';
  }
  if (slug.includes('complete') || title.includes('complete syllabus') || title.includes('best school book')) {
    return '/images/books/cbse-10-mathematics-complete.jpg';
  }
  if (slug.includes('advanced-question-bank') || slug.includes('adv-qb') || title.includes('question bank') || title.includes('advanced level')) {
    return '/images/books/cbse-10-advanced-question-bank.jpg';
  }
  if (slug.includes('adv-prob') || title.includes('advanced problem')) {
    return '/images/books/cbse-10-advanced-question-bank.jpg';
  }

  if (isPersonalPhoto) {
    return '/images/books/cbse-10-pyq-mathematics.jpg';
  }

  return rawCover;
}

interface BookPurchaseModalProps {
  book: BookItem | null;
  initialFormat?: 'DIGITAL' | 'HARDCOPY' | 'digital' | 'hardcopy';
  onClose: () => void;
}

export const BookPurchaseModal: React.FC<BookPurchaseModalProps> = ({
  book,
  initialFormat = 'DIGITAL',
  onClose,
}) => {
  const normalizedInitial = String(initialFormat).toUpperCase() === 'HARDCOPY' ? 'HARDCOPY' : 'DIGITAL';
  const [format, setFormat] = useState<'DIGITAL' | 'HARDCOPY'>(normalizedInitial);
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
    orderPublicId: string;
    format: 'DIGITAL' | 'HARDCOPY';
    invoiceNumber?: string;
    downloadUrl?: string | null;
    paymentId?: string;
  } | null>(null);

  if (!book) return null;

  const rawDigital = Number(book.digital_price ?? book.digitalPrice ?? 299);
  const rawHardcopy = Number(book.hardcopy_price ?? book.hardcopyPrice ?? 399);
  const basePrice = format === 'HARDCOPY' ? rawHardcopy : rawDigital;
  const gstPercent = Number(book.gst_percent ?? 18);
  const gstAmount = Math.round(basePrice * (gstPercent / 100) * 100) / 100;
  const totalAmount = Math.round((basePrice + gstAmount) * 100) / 100;

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Field validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!['6', '7', '8', '9'].includes(cleanPhone.slice(-10)[0])) {
      setErrorMessage('Indian mobile numbers must start with 6, 7, 8, or 9.');
      return;
    }

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address to receive your order receipt.');
      return;
    }

    if (format === 'HARDCOPY') {
      if (!shippingAddress.trim() || shippingAddress.trim().length < 5) {
        setErrorMessage('Please provide your complete delivery street address.');
        return;
      }
      if (!city.trim()) {
        setErrorMessage('Please provide your city.');
        return;
      }
      if (!stateName.trim()) {
        setErrorMessage('Please provide your state.');
        return;
      }
      const cleanPin = pincode.replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        setErrorMessage('Please enter a valid 6-digit Indian PIN code.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Could not load Razorpay payment gateway. Please check your internet connection.');
      }

      const bookSlug = book.slug || book.id;
      if (!bookSlug) {
        throw new Error('Book identifier is missing.');
      }

      // Step 1: Create Guest Order on Django backend
      const createRes = await fetch(buildApiUrl('/api/books/orders/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          product_slug: bookSlug,
          format,
          buyer_name: fullName.trim(),
          buyer_phone: cleanPhone.slice(-10),
          buyer_email: email.trim().toLowerCase(),
          shipping_address: format === 'HARDCOPY' ? shippingAddress.trim() : '',
          city: format === 'HARDCOPY' ? city.trim() : '',
          state: format === 'HARDCOPY' ? stateName.trim() : '',
          pincode: format === 'HARDCOPY' ? pincode.replace(/\D/g, '') : '',
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        const errDetail = errJson.error || Object.values(errJson)[0] || 'Failed to initiate book checkout.';
        throw new Error(String(errDetail));
      }

      const orderData = await createRes.json();

      // Step 2: Open Razorpay Gateway Modal
      const paymentResponse = await new Promise<{
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: orderData.key_id,
          amount: orderData.amount_paise,
          currency: orderData.currency || 'INR',
          name: 'Adept Eduverse',
          description: `${book.title} (${format === 'HARDCOPY' ? 'Printed Hard Copy' : 'Digital PDF'})`,
          image: '/images/logo.png',
          order_id: orderData.razorpay_order_id,
          prefill: {
            name: fullName.trim(),
            email: email.trim(),
            contact: cleanPhone.slice(-10),
          },
          theme: {
            color: '#2B2FB8',
          },
          handler: (response) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Checkout window closed without payment.')),
          },
        };

        const rzp = new window.Razorpay!(options);
        rzp.open();
      });

      // Step 3: Verify Signature & Finalize Order
      const verifyRes = await fetch(buildApiUrl('/api/books/orders/verify/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment signature verification failed.');
      }

      setSuccessData({
        orderPublicId: verifyData.order_public_id,
        format: verifyData.format,
        invoiceNumber: verifyData.invoice_number,
        downloadUrl: verifyData.download_url ? buildApiUrl(verifyData.download_url) : null,
        paymentId: paymentResponse.razorpay_payment_id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment process failed. Please try again.';
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
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {book.badge || 'Official Publication'}
              </span>
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
                  Payment Verified!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Invoice: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{successData.invoiceNumber}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Payment ID: <span className="font-mono text-indigo-600 dark:text-indigo-400">{successData.paymentId}</span>
                </p>
              </div>

              {successData.format === 'DIGITAL' && successData.downloadUrl ? (
                <div className="p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 space-y-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Your digital edition is ready! Click below to download your secure PDF:
                  </p>
                  <a
                    href={successData.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download Book (PDF)
                  </a>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your link is valid for 7 days (up to 5 downloads). A copy has also been sent to <strong>{email}</strong>.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 space-y-2 text-left">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <Truck className="w-4 h-4" /> Hard Copy Order Confirmed
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    We have received your physical order. Our team is packaging your book for dispatch. As soon as it ships, tracking details will be emailed to <strong>{email}</strong> and SMS sent to <strong>{phone}</strong>.
                  </p>
                  <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-emerald-200/50 dark:border-emerald-800/50">
                    <strong>Shipping To:</strong> {shippingAddress}, {city}, {stateName} - {pincode}
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/books/order/${successData.orderPublicId}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  View Order Status & Receipt <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePayNow} className="space-y-5">
              {/* Format Switcher */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Select Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('DIGITAL')}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      format === 'DIGITAL'
                        ? 'border-[#2B2FB8] bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-[#2B2FB8]/20'
                        : 'border-[#E3E7EE] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-indigo-600" /> Digital PDF
                      </span>
                      {format === 'DIGITAL' && (
                        <div className="w-2 h-2 rounded-full bg-[#2B2FB8]" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">₹{rawDigital}</span>
                      <span className="text-[10px] text-slate-500">+18% GST</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium block mt-1">
                      Instant Download
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('HARDCOPY')}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      format === 'HARDCOPY'
                        ? 'border-[#2B2FB8] bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-[#2B2FB8]/20'
                        : 'border-[#E3E7EE] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-600" /> Hard Copy
                      </span>
                      {format === 'HARDCOPY' && (
                        <div className="w-2 h-2 rounded-full bg-[#2B2FB8]" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">₹{rawHardcopy}</span>
                      <span className="text-[10px] text-slate-500">+18% GST</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                      Printed Book Delivery
                    </span>
                  </button>
                </div>
              </div>

              {/* Guest Buyer Details */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Buyer Information (No Login Required)
                </label>

                <div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Student / Buyer Full Name *"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit WhatsApp / Mobile *"
                      maxLength={14}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address *"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                    />
                  </div>
                </div>

                {/* Hardcopy Shipping Address */}
                {format === 'HARDCOPY' && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Delivery Address in India
                    </span>
                    <textarea
                      required
                      rows={2}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="House/Flat No., Building, Street Name, Area *"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City *"
                        className="w-full px-3 py-2 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                      />
                      <input
                        type="text"
                        required
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="State *"
                        className="w-full px-3 py-2 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                      />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="PIN Code *"
                        className="w-full px-3 py-2 rounded-xl text-xs border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B2FB8]/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-[#E3E7EE] dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Base Price ({format === 'HARDCOPY' ? 'Printed Edition' : 'Digital PDF'})</span>
                  <span className="font-semibold text-slate-900 dark:text-white">₹{basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>GST ({gstPercent}%)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#E3E7EE] dark:border-slate-800 flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Amount Payable</span>
                  <span className="text-base text-[#2B2FB8] dark:text-indigo-400 font-extrabold">
                    ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Initializing Razorpay Secure Checkout...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Pay ₹{totalAmount.toFixed(2)} via Razorpay
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% Secure Payment • Official Receipt via Email • UPI / Cards / Netbanking</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
