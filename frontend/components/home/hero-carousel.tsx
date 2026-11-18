'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowRight, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnrollment } from '@/hooks/use-enrollment';
import { EnrollmentModal } from './enrollment-modal';
import { apiClient } from '@/lib/api-client';

export interface SlideData {
  id: string | number;
  badge: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  features: string[];
  pricing: {
    originalPrice: string;
    offerPrice: string;
    discount: string;
  };
  ctaText: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
}

interface ApiHeroSlide {
  id: string;
  title: string;
  title_highlight?: string;
  subtitle?: string;
  badge?: string;
  features?: string[];
  original_price?: string;
  offer_price?: string;
  discount_badge?: string;
  cta_text?: string;
  cta_href?: string;
  image_url?: string;
  order: number;
  is_active: boolean;
}

export const HeroCarousel: React.FC = () => {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { isEnrolled } = useEnrollment();
  const enrolled = isEnrolled();

  useEffect(() => {
    let isMounted = true;
    async function fetchSlides() {
      try {
        const data = await apiClient.get<ApiHeroSlide[]>('/content/hero-slides/');
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const mapped: SlideData[] = data.map((item) => ({
            id: item.id,
            badge: item.badge || 'JEE Preparation',
            title: item.title,
            titleHighlight: item.title_highlight || '',
            subtitle: item.subtitle || '',
            features: item.features || [],
            pricing: {
              originalPrice: item.original_price || '',
              offerPrice: item.offer_price || '₹0',
              discount: item.discount_badge || 'Free',
            },
            ctaText: item.cta_text || 'Start Learning',
            ctaHref: item.cta_href || '/learn',
            imageSrc: item.image_url || '/images/hero/slide-1.jpg',
            imageAlt: item.title,
          }));
          setSlides(mapped);
        } else {
          setSlides([]);
        }
      } catch {
        if (isMounted) setSlides([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchSlides();
    return () => {
      isMounted = false;
    };
  }, []);

  const nextSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto switch every 5 seconds (5000ms)
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, slides.length]);

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-12 flex flex-col items-center justify-center min-h-[360px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-sm">Loading course highlights...</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-8 sm:p-12 text-center shadow-xl">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">Welcome to ANKIT JEE Platform</h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Begin your JEE preparation with interactive video lectures, chapter-wise formula notes, and daily practice problem sets.
          </p>
          <div className="pt-2">
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-brand-500/20"
            >
              <span>Explore Curriculum</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide] || slides[0];

  return (
    <>
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl shadow-blue-950/20 group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background Gradient & Light Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 z-0" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Main Slide Content */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-10 min-h-[380px] sm:min-h-[420px] flex flex-col justify-between">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left Text & Pricing Details */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>{slide.badge}</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                  {slide.title} <br />
                  {slide.titleHighlight && (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                      {slide.titleHighlight}
                    </span>
                  )}
                </h2>
                {slide.subtitle && (
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                    {slide.subtitle}
                  </p>
                )}
              </div>

              {/* Feature Checklist Badges */}
              {slide.features && slide.features.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-w-md pt-1">
                  {slide.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Price Structure & CTA Button */}
              <div className="pt-4 flex flex-wrap items-center gap-4 border-t border-slate-800/80">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{slide.pricing.offerPrice}</span>
                  {slide.pricing.originalPrice && (
                    <span className="text-xs text-slate-500 line-through">{slide.pricing.originalPrice}</span>
                  )}
                  {slide.pricing.discount && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      {slide.pricing.discount}
                    </span>
                  )}
                </div>

                {enrolled ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={slide.ctaHref || '/learn'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Enrolled (Go to Learn)</span>
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 active:scale-[0.98]"
                  >
                    <span>{slide.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Visual Image Showcase */}
            <div className="lg:col-span-5 relative aspect-video lg:aspect-square w-full rounded-xl overflow-hidden border border-slate-800/80 shadow-lg">
              <Image
                src={slide.imageSrc}
                alt={slide.imageAlt}
                fill
                priority
                className="object-cover transition-all duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            </div>

          </div>

          {/* Carousel Controls: Arrows & Pagination Dots */}
          {slides.length > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-800/60 mt-4">
              {/* Pagination Dots */}
              <div className="flex items-center gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300',
                      currentSlide === index
                        ? 'w-8 bg-blue-500 shadow-sm shadow-blue-500/50'
                        : 'w-2 bg-slate-700 hover:bg-slate-600'
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>

              {/* Slide Indicator Text */}
              <div className="text-[11px] font-mono text-slate-400">
                0{currentSlide + 1} / 0{slides.length}
              </div>

              {/* Arrow Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevSlide}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enrollment Confirmation Modal */}
      <EnrollmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
