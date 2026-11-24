'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

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

interface PricingCardData {
  id: string;
  key: string;
  title: string;
  tagline: string;
  badge: string;
  rotate_seconds: number;
  cta_label: string;
  cta_url: string;
  order: number;
  batches: BatchData[];
  features: FeatureData[];
}

const ROMAN_NUMERALS: Record<string, string> = {
  '6': 'VI',
  '7': 'VII',
  '8': 'VIII',
  '9': 'IX',
  '10': 'X',
  '11': 'XI',
  '12': 'XII',
};

function getRomanClass(className?: string): string {
  if (!className) return '';
  const num = className.replace(/\D/g, '');
  return ROMAN_NUMERALS[num] ? `Class ${ROMAN_NUMERALS[num]}` : className;
}

export function BatchesSection() {
  const [cards, setCards] = useState<PricingCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // School card carousel index
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/pricing/cards/')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load pricing cards');
        return res.json();
      })
      .then((data: PricingCardData[]) => {
        if (isMounted) {
          setCards(Array.isArray(data) ? data : []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to connect to pricing service');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const schoolCard = cards.find((c) => c.key === 'school');
  const seniorCard = cards.find((c) => c.key === 'senior');
  const dropperCard = cards.find((c) => c.key === 'dropper');

  const schoolBatches = schoolCard?.batches || [];
  const schoolCount = schoolBatches.length;
  const rotateSeconds = schoolCard?.rotate_seconds || 5;

  // Auto-advance school carousel
  useEffect(() => {
    if (schoolCount <= 1 || isPaused) return;

    // Respect user reduced-motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % schoolCount);
    }, rotateSeconds * 1000);

    return () => clearInterval(timer);
  }, [schoolCount, isPaused, rotateSeconds]);

  const handlePrev = useCallback(() => {
    if (schoolCount <= 1) return;
    setCarouselIndex((prev) => (prev - 1 + schoolCount) % schoolCount);
  }, [schoolCount]);

  const handleNext = useCallback(() => {
    if (schoolCount <= 1) return;
    setCarouselIndex((prev) => (prev + 1) % schoolCount);
  }, [schoolCount]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  if (isLoading) {
    return (
      <section className="landing-section batches-section" id="batches" aria-label="Curated Batches">
        <div className="landing-wrap">
          <div className="section-tag center">Curated Programs</div>
          <h2>Choose Your Learning Pathway</h2>
          <p className="section-subtitle">
            Every batch rigorously prepares you for JEE Mains, with intense Advanced problem-solving for students
            determined to earn seats at the top IITs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 mt-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-3xl border border-white/10 bg-[#0d162d]/80 p-6 flex flex-col justify-between min-h-[540px] animate-pulse"
              >
                <div className="space-y-4">
                  <div className="h-6 w-36 rounded-full bg-white/10" />
                  <div className="h-7 w-52 rounded-lg bg-white/15" />
                  <div className="h-44 w-full rounded-2xl bg-white/5" />
                  <div className="space-y-2 pt-3">
                    <div className="h-4 w-5/6 rounded bg-white/10" />
                    <div className="h-4 w-4/6 rounded bg-white/10" />
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                  </div>
                </div>
                <div className="h-12 w-full rounded-xl bg-white/10 mt-6" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error && cards.length === 0) {
    return (
      <section className="landing-section batches-section" id="batches">
        <div className="landing-wrap text-center py-12">
          <div className="p-6 max-w-lg mx-auto rounded-3xl bg-red-950/30 border border-red-800/40 text-red-200">
            <p className="font-semibold mb-2">Notice</p>
            <p className="text-sm opacity-80 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
            >
              Retry Loading Batches
            </button>
          </div>
        </div>
      </section>
    );
  }

  const activeSchoolBatch = schoolBatches[carouselIndex] || schoolBatches[0];

  return (
    <section className="landing-section batches-section" id="batches" aria-label="Curated Batches">
      <div className="landing-wrap">
        <div className="section-tag center">Curated Programs</div>
        <h2>Choose Your Learning Pathway</h2>
        <p className="section-subtitle">
          Every batch rigorously prepares you for JEE Mains, with intense Advanced problem-solving for students
          determined to earn seats at the top IITs. Full class recordings always included.
        </p>

        <div className="batches-grid mt-6">
          {/* =================================================================
              CARD 1 (LEFT): SCHOOL BATCHES (CLASS VI - X) with 5-BATCH CAROUSEL
              ================================================================= */}
          {schoolCard && (
            <div
              className="batch-card flex flex-col justify-between"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            >
              <div>
                {schoolCard.badge && <div className="batch-badge">{schoolCard.badge}</div>}
                <div className="batch-type">Foundation &amp; Olympiad</div>
                <h3>{schoolCard.title}</h3>
                <p className="batch-desc">{schoolCard.tagline}</p>

                {/* 5-Slide Image Carousel */}
                {schoolBatches.length > 0 && activeSchoolBatch && (
                  <div
                    className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg group focus:outline-none focus:ring-2 focus:ring-amber-400"
                    tabIndex={0}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="Class VI to X Batches Carousel"
                    onKeyDown={handleKeyDown}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="relative aspect-[16/10] w-full bg-slate-900">
                      <Image
                        src={activeSchoolBatch.image || '/images/ankit-sir.jpg'}
                        alt={activeSchoolBatch.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority={carouselIndex === 0}
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />

                      {/* Floating Name & Price Chip */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block truncate">
                            {getRomanClass(activeSchoolBatch.academic_class_name)}
                          </span>
                          <span className="text-sm font-extrabold text-white block truncate drop-shadow">
                            {activeSchoolBatch.name}
                          </span>
                        </div>
                        <div className="shrink-0 px-2.5 py-1 rounded-full bg-amber-400/90 text-slate-950 font-black text-xs shadow-md">
                          ₹{Number(activeSchoolBatch.price).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Navigation Arrows */}
                      {schoolBatches.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrev();
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            aria-label="Previous batch"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNext();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            aria-label="Next batch"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Dot Indicators */}
                    {schoolBatches.length > 1 && (
                      <div className="py-2 flex items-center justify-center gap-1.5 bg-slate-950/80">
                        {schoolBatches.map((b, idx) => (
                          <button
                            key={b.id || idx}
                            type="button"
                            onClick={() => setCarouselIndex(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              idx === carouselIndex ? 'w-6 bg-amber-400' : 'w-2 bg-white/30 hover:bg-white/60'
                            }`}
                            aria-label={`Slide ${idx + 1}: ${b.name}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Point-wise list of the 5 batch names (VI..X) linking to batch pages */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Included Foundation Batches:
                  </span>
                  <ul className="space-y-1 text-xs">
                    {schoolBatches.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/batches/school/${b.slug}`}
                          className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-amber-300 transition-colors group"
                        >
                          <span className="font-semibold">
                            {getRomanClass(b.academic_class_name)}: {b.name}
                          </span>
                          <span className="text-amber-400/90 font-bold flex items-center gap-1">
                            ₹{Number(b.price).toLocaleString('en-IN')}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checkmark Feature Bullets */}
                <ul className="batch-features mt-4 pt-3 border-t border-white/10">
                  {(schoolCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6">
                <Link
                  href={schoolCard.cta_url || '/batches/school'}
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2"
                >
                  <span>{schoolCard.cta_label || 'View all Class VI-X batches'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* =================================================================
              CARD 2 (MIDDLE): CLASS 11 & 12 (SENIOR) with Fixed Image
              ================================================================= */}
          {seniorCard && (
            <div className="batch-card featured flex flex-col justify-between">
              <div>
                {seniorCard.badge && <div className="batch-badge">{seniorCard.badge}</div>}
                <div className="batch-type">Live Comprehensive Batch</div>
                <h3>{seniorCard.title}</h3>
                <p className="batch-desc">{seniorCard.tagline}</p>

                {/* Fixed Image */}
                <div className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg aspect-[16/10]">
                  <Image
                    src={seniorCard.batches?.[0]?.image || '/images/ankit-sir.jpg'}
                    alt="Class 11 & 12 Comprehensive Batch"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white drop-shadow">Class XI &amp; XII Programs</span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-md">
                      From ₹5,500
                    </span>
                  </div>
                </div>

                {/* Batch names XI and XII as bullets */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Available Live Tracks:
                  </span>
                  <ul className="space-y-1 text-xs">
                    {(seniorCard.batches || []).map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/batches/senior/${b.slug}`}
                          className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-amber-300 transition-colors group"
                        >
                          <span className="font-semibold">
                            {getRomanClass(b.academic_class_name)}: {b.name}
                          </span>
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            ₹{Number(b.price).toLocaleString('en-IN')}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checkmark Feature Bullets */}
                <ul className="batch-features mt-4 pt-3 border-t border-white/10">
                  {(seniorCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6">
                <Link
                  href={seniorCard.cta_url || '/batches/senior'}
                  className="landing-btn btn-gold w-full text-center flex items-center justify-center gap-2"
                >
                  <span>{seniorCard.cta_label || 'Explore Class 11 & 12'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* =================================================================
              CARD 3 (RIGHT): DROPPER IMMERSION with Fixed Image
              ================================================================= */}
          {dropperCard && (
            <div className="batch-card flex flex-col justify-between">
              <div>
                {dropperCard.badge && <div className="batch-badge">{dropperCard.badge}</div>}
                <div className="batch-type">Full-Year Accelerator</div>
                <h3>{dropperCard.title}</h3>
                <p className="batch-desc">{dropperCard.tagline}</p>

                {/* Fixed Image */}
                <div className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg aspect-[16/10]">
                  <Image
                    src={dropperCard.batches?.[0]?.image || '/images/ankit-sir-thumbsup.jpg'}
                    alt="Dropper Batch Immersion"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white drop-shadow">Complete XI + XII Intensive</span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-md">
                      {dropperCard.batches?.[0]?.price
                        ? `₹${Number(dropperCard.batches[0].price).toLocaleString('en-IN')}`
                        : '₹9,999'}
                    </span>
                  </div>
                </div>

                {/* Dropper Batches Bullets */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Dropper Pathway:
                  </span>
                  <ul className="space-y-1 text-xs">
                    {(dropperCard.batches || []).map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/batches/dropper/${b.slug}`}
                          className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-amber-300 transition-colors group"
                        >
                          <span className="font-semibold">{b.name}</span>
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            ₹{Number(b.price).toLocaleString('en-IN')}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checkmark Feature Bullets */}
                <ul className="batch-features mt-4 pt-3 border-t border-white/10">
                  {(dropperCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6">
                <Link
                  href={dropperCard.cta_url || '/batches/dropper'}
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2"
                >
                  <span>{dropperCard.cta_label || 'Join Dropper Batch'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
