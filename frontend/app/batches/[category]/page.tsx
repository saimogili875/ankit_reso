'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';

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

interface BatchData {
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

interface CategoryResponse {
  card: {
    id: string;
    key: string;
    title: string;
    tagline: string;
    badge: string;
    cta_label: string;
    cta_url: string;
  };
  batches: BatchData[];
}

export default function CategoryBatchesPage() {
  const params = useParams();
  const category = (params?.category as string) || 'school';

  const [data, setData] = useState<CategoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/pricing/categories/${category}/`)
      .then((res) => {
        if (!res.ok) throw new Error('Category not found');
        return res.json();
      })
      .then((resData: CategoryResponse) => {
        if (isMounted) {
          setData(resData);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to load batches for this category.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [category]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto" />
          <p className="text-sm text-slate-400">Loading curriculum &amp; batches...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d162d] border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-red-300">Category Not Found</h2>
          <p className="text-sm text-slate-400">{error || 'Could not find the requested category.'}</p>
          <Link
            href="/#batches"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to All Batches</span>
          </Link>
        </div>
      </div>
    );
  }

  const { card, batches } = data;

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100">
      {/* Top Banner Navigation */}
      <header className="border-b border-white/10 bg-[#070d1e]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/#batches"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Programs</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider hidden sm:inline">
              Adept Eduverse
            </span>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative overflow-hidden py-14 border-b border-white/10 bg-radial-[at_50%_0%] from-blue-900/20 via-transparent to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
          {card.badge && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{card.badge}</span>
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {card.title}
          </h1>
          <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {card.tagline}
          </p>
        </div>
      </section>

      {/* Batches Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {batches.map((batch) => {
            const regularItems = (batch.items || []).filter((i) => !i.is_addon);
            const addonItems = (batch.items || []).filter((i) => i.is_addon);

            return (
              <div
                key={batch.id}
                className="bg-[#0d162d]/90 border border-white/10 hover:border-amber-400/40 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1"
              >
                <div>
                  {/* Visual Header */}
                  <div className="relative aspect-[16/10] w-full bg-slate-900 overflow-hidden">
                    <Image
                      src={batch.image || '/images/ankit-sir.jpg'}
                      alt={batch.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d162d] via-transparent to-transparent" />
                    {batch.academic_class_name && (
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-300 border border-white/10 text-xs font-bold uppercase tracking-wider">
                        {batch.academic_class_name}
                      </span>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                        {batch.name}
                      </h2>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {batch.tagline || batch.description}
                      </p>
                    </div>

                    {/* Pricing Display */}
                    <div className="flex items-baseline gap-2.5 pt-2 border-t border-white/10">
                      <span className="text-2xl font-black text-amber-400">
                        ₹{Number(batch.price).toLocaleString('en-IN')}
                      </span>
                      {batch.original_price && Number(batch.original_price) > Number(batch.price) && (
                        <span className="text-sm text-slate-400 line-through">
                          ₹{Number(batch.original_price).toLocaleString('en-IN')}
                        </span>
                      )}
                      <span className="text-[11px] text-emerald-400 font-bold ml-auto">
                        All-Inclusive
                      </span>
                    </div>

                    {/* What's Included Preview */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Curriculum Highlights:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {regularItems.slice(0, 4).map((it) => (
                          <li key={it.id} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{it.title}</span>
                          </li>
                        ))}
                        {batch.features && batch.features.length > 0 && regularItems.length < 3 && (
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{batch.features[0].text}</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    {addonItems.length > 0 && (
                      <div className="px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-[11px] text-amber-200 flex items-center justify-between">
                        <span>Digital Book Add-on available</span>
                        <span className="font-bold">+₹{Number(addonItems[0].price)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-6 pt-0 space-y-2">
                  <Link
                    href={`/batches/${category}/${batch.slug}`}
                    className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-colors"
                  >
                    <span>View Details &amp; Enroll</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
