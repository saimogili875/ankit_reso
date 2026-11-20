'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface BannerSlide {
  id: string;
  image: string;
  alt_text: string;
  title: string;
  caption: string;
  link_url: string;
  duration_seconds: number;
  placement: 'home' | 'login' | 'both';
  order: number;
}

export interface BannerSliderProps {
  placement: 'home' | 'login';
  className?: string;
  isCompact?: boolean;
}

export function BannerSlider({ placement, className = '', isCompact = false }: BannerSliderProps) {
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Fetch active slides for this placement
  useEffect(() => {
    let isMounted = true;
    async function fetchBanners() {
      try {
        const data = await apiClient.get<BannerSlide[]>(`/banners/?placement=${placement}`);
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setSlides(data);
        } else {
          setSlides([]);
        }
      } catch {
        if (!isMounted) return;
        setHasError(true);
        setSlides([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchBanners();
    return () => {
      isMounted = false;
    };
  }, [placement]);

  const totalSlides = slides.length;

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(() => {
      if (totalSlides === 0) return 0;
      return (index + totalSlides) % totalSlides;
    });
  }, [totalSlides]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [goToSlide, currentIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [goToSlide, currentIndex]);

  // Per-slide variable duration auto-advance timer
  useEffect(() => {
    if (totalSlides <= 1 || isPaused || isReducedMotion) return;

    const currentSlide = slides[currentIndex];
    const durationMs = Math.max(2, Math.min(30, currentSlide?.duration_seconds || 5)) * 1000;

    const timer = setTimeout(() => {
      nextSlide();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [currentIndex, totalSlides, isPaused, isReducedMotion, slides, nextSlide]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX !== null) {
      setTouchDeltaX(e.touches[0].clientX - touchStartX);
    }
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (touchStartX !== null) {
      if (touchDeltaX > 50) {
        prevSlide();
      } else if (touchDeltaX < -50) {
        nextSlide();
      }
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  };

  // If loading, error, or no slides: render nothing
  if (isLoading || hasError || totalSlides === 0) {
    return null;
  }

  const activeSlide = slides[currentIndex];
  if (!activeSlide) return null;

  const aspectClass = isCompact ? 'aspect-[2/1] sm:aspect-[16/9]' : 'aspect-[16/9]';

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`${placement === 'home' ? 'Homepage' : 'Login'} Banner Announcements`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`group relative w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-2xl backdrop-blur-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${className}`}
    >
      {/* Slides Container */}
      <div className={`relative w-full ${aspectClass}`}>
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          const content = (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${idx + 1} of ${totalSlides}: ${slide.title || slide.alt_text}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <Image
                src={slide.image}
                alt={slide.alt_text || slide.title || 'Adept Eduverse Banner'}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
                className="object-cover"
                priority={idx === 0}
                loading={idx === 0 ? 'eager' : 'lazy'}
              />

              {/* Gradient Scrim for Text Readability */}
              {(slide.title || slide.caption) && (
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-end p-4 sm:p-6 text-white">
                  {slide.title && (
                    <h3 className={`font-extrabold tracking-tight text-white drop-shadow-md ${
                      isCompact ? 'text-sm sm:text-base' : 'text-base sm:text-lg lg:text-xl'
                    }`}>
                      {slide.title}
                    </h3>
                  )}
                  {slide.caption && (
                    <p className={`text-slate-200 mt-1 line-clamp-2 drop-shadow ${
                      isCompact ? 'text-xs' : 'text-xs sm:text-sm'
                    }`}>
                      {slide.caption}
                    </p>
                  )}
                </div>
              )}
            </div>
          );

          if (slide.link_url && isActive) {
            const isExternal = slide.link_url.startsWith('http');
            return isExternal ? (
              <a
                key={slide.id}
                href={slide.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full cursor-pointer"
              >
                {content}
              </a>
            ) : (
              <Link key={slide.id} href={slide.link_url} className="block w-full h-full cursor-pointer">
                {content}
              </Link>
            );
          }

          return content;
        })}
      </div>

      {/* Navigation Controls (Shown only if more than 1 slide) */}
      {totalSlides > 1 && (
        <>
          {/* Previous Button */}
          <button
            type="button"
            aria-label="Previous Slide"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 text-slate-200 backdrop-blur-md opacity-0 transition-opacity hover:bg-slate-800 hover:text-white group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Next Button */}
          <button
            type="button"
            aria-label="Next Slide"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 text-slate-200 backdrop-blur-md opacity-0 transition-opacity hover:bg-slate-800 hover:text-white group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Navigation Indicators / Dots */}
          <div
            className="absolute bottom-2.5 left-0 right-0 z-20 flex items-center justify-center gap-1.5"
            role="tablist"
            aria-label="Slide Selection"
          >
            {slides.map((_, dotIdx) => {
              const isDotActive = dotIdx === currentIndex;
              return (
                <button
                  key={dotIdx}
                  type="button"
                  role="tab"
                  aria-selected={isDotActive}
                  aria-label={`Jump to slide ${dotIdx + 1}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToSlide(dotIdx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    isDotActive
                      ? 'w-6 bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm shadow-amber-400/50'
                      : 'w-2 bg-slate-600/70 hover:bg-slate-400'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default BannerSlider;
