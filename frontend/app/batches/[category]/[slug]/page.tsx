'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  PlusCircle,
  Check,
  CreditCard,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { processRazorpayPayment } from '@/lib/razorpay';

interface BatchItemData {
  id: string;
  item_type: string;
  title: string;
  price: string | number;
  is_addon: boolean;
}

interface FeatureData {
  id: string;
  text: string;
  order: number;
}

interface BatchDetailData {
  id: string;
  name: string;
  slug: string;
  card_key: string;
  academic_class_name?: string;
  academic_class_slug?: string;
  tagline: string;
  description: string;
  image: string;
  price: string | number;
  original_price?: string | number | null;
  display_order: number;
  items: BatchItemData[];
  features: FeatureData[];
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const category = (params?.category as string) || 'school';
  const slug = (params?.slug as string) || '';

  const [batch, setBatch] = useState<BatchDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected add-on item IDs
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/pricing/batches/${slug}/`)
      .then((res) => {
        if (!res.ok) throw new Error('Batch not found');
        return res.json();
      })
      .then((data: BatchDetailData) => {
        if (isMounted) {
          setBatch(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to load batch details');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const toggleAddon = (itemId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const basePrice = Number(batch?.price || 0);
  const addonItems = (batch?.items || []).filter((i) => i.is_addon);
  const regularItems = (batch?.items || []).filter((i) => !i.is_addon);

  const selectedAddonsTotal = addonItems
    .filter((i) => selectedAddons.includes(i.id))
    .reduce((sum, item) => sum + Number(item.price || 0), 0);

  const totalPrice = basePrice + selectedAddonsTotal;

  const handleCheckout = async () => {
    setPaymentError(null);

    // Clerk Auth Gate: if not logged in, redirect to sign-in returning here
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname || `/batches/${category}/${slug}`);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    if (!batch) return;

    setIsProcessing(true);
    try {
      await processRazorpayPayment({
        batchId: batch.id,
        addonItemIds: selectedAddons,
        courseTitle: batch.name,
        description: `Enrollment: ${batch.name}`,
        prefill: {
          name: user?.full_name || user?.username || 'Student',
          email: user?.email || '',
          contact: user?.phone || user?.phone_number || undefined,
        },
      });

      setPaymentSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout encountered an error.';
      setPaymentError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto" />
          <p className="text-sm text-slate-400">Loading batch curriculum &amp; pricing...</p>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d162d] border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-red-300">Batch Not Found</h2>
          <p className="text-sm text-slate-400">{error || 'Could not find the requested batch.'}</p>
          <Link
            href={`/batches/${category}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Batches</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#070d1e]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href={`/batches/${category}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {category.toUpperCase()} Batches</span>
          </Link>
          <span className="text-xs text-amber-400 font-bold uppercase tracking-wider hidden sm:inline">
            Adept Eduverse
          </span>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Details, Curriculum, and Add-ons */}
          <div className="lg:col-span-7 space-y-8">
            {/* Hero Card */}
            <div className="bg-[#0d162d]/90 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
                <Image
                  src={batch.image || '/images/ankit-sir.jpg'}
                  alt={batch.name}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                {batch.academic_class_name && (
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-300 border border-white/10 text-xs font-bold uppercase tracking-wider">
                    {batch.academic_class_name}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {batch.name}
                </h1>
                <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                  {batch.tagline || batch.description}
                </p>
                {batch.description && batch.description !== batch.tagline && (
                  <p className="text-xs sm:text-sm text-slate-400 mt-3 leading-relaxed">
                    {batch.description}
                  </p>
                )}
              </div>

              {/* Feature Highlights */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  Program Features &amp; Support:
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  {(batch.features || []).map((feat, idx) => (
                    <li key={feat.id || idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Curriculum Breakdown Table */}
            <div className="bg-[#0d162d]/90 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Itemized Curriculum Components</h2>
                  <p className="text-xs text-slate-400">Everything provided with this batch package</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-bold">
                  {regularItems.length} Core Modules
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Component</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Standard Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {regularItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{item.title}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{item.item_type}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-300">
                          ₹{Number(item.price).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add-ons Section */}
            {addonItems.length > 0 && (
              <div className="bg-[#0d162d]/90 border border-amber-400/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <PlusCircle className="w-4 h-4" />
                  <span>Optional Recommended Add-ons</span>
                </div>
                <p className="text-xs text-slate-400">
                  Select additional materials to include in this order at special student rates:
                </p>

                <div className="space-y-3 pt-2">
                  {addonItems.map((addon) => {
                    const isSelected = selectedAddons.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all ${
                          isSelected
                            ? 'bg-amber-400/10 border-amber-400 text-white'
                            : 'bg-slate-950/50 border-white/10 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-amber-400 border-amber-400 text-slate-950'
                                : 'border-white/30 bg-transparent'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="font-bold text-xs sm:text-sm block">{addon.title}</span>
                            <span className="text-[11px] text-slate-400 block">
                              Instant Digital Download · Watermarked with student ID
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-amber-400 text-sm">
                            +₹{Number(addon.price).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Checkout Summary & Buy Button */}
          <div className="lg:col-span-5 sticky top-24 space-y-6">
            <div className="bg-[#0d162d] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-4">
                Enrollment Summary
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Batch Fee ({batch.name})</span>
                  <span className="font-bold text-white">₹{basePrice.toLocaleString('en-IN')}</span>
                </div>

                {selectedAddons.map((addonId) => {
                  const it = addonItems.find((i) => i.id === addonId);
                  if (!it) return null;
                  return (
                    <div key={addonId} className="flex justify-between items-center text-amber-300">
                      <span>+ {it.title}</span>
                      <span className="font-bold">₹{Number(it.price).toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-bold text-white block">Total Amount</span>
                    <span className="text-[10px] text-slate-400">Inclusive of all taxes &amp; gateway fees</span>
                  </div>
                  <span className="text-3xl font-black text-amber-400">
                    ₹{totalPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Status Notice / Feedback */}
              {paymentError && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-200">
                  {paymentError}
                </div>
              )}

              {paymentSuccess ? (
                <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-white text-base">Payment Verified!</h3>
                  <p className="text-xs text-slate-300">
                    You are now enrolled in <strong>{batch.name}</strong>. Your account has full access to the lectures, DPPs, and mock tests.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-lg"
                  >
                    Go to Student Dashboard
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="w-full h-14 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:shadow-amber-400/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Initializing Secure Payment...</span>
                      </>
                    ) : isAuthenticated ? (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Pay ₹{totalPrice.toLocaleString('en-IN')} via Razorpay</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Sign In &amp; Enroll for ₹{totalPrice.toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>256-Bit SSL Encrypted &middot; Verified Razorpay Gateway</span>
                  </div>
                </div>
              )}
            </div>

            {/* Assistance Card */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2 text-slate-300">
              <span className="font-bold text-white block">Need Help Choosing?</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connect directly with our academic admissions counseling desk on WhatsApp:
              </p>
              <a
                href={`https://wa.me/919382557693?text=Hi%2C%20I%20have%20questions%20about%20the%20${encodeURIComponent(batch.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-amber-400 font-bold hover:underline"
              >
                +91 93825 57693 &rarr;
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
