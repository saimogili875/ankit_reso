'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Download, 
  Truck, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Share2,
  Check
} from 'lucide-react';
import { 
  BookItem, 
  BookPurchaseModal, 
  getBookCoverImage, 
  getBookShortAlias, 
  isBookMatch 
} from '@/components/books/BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const DEFAULT_BOOKS: BookItem[] = [
  {
    id: 'cbse-10-pyq-mathematics',
    slug: 'cbse-10-pyq-mathematics',
    title: "CBSE Class X — Chapter-Wise Previous Years' Questions (Mathematics)",
    subtitle: 'Past 10 Years Chapter-Wise Solved Questions with IITian Pedagogical Insights',
    class_label: 'CBSE Class X',
    badge: 'Official PYQ',
    digital_price: 299,
    hardcopy_price: 399,
    original_price: 499,
    gst_percent: 18,
    cover_image: '/images/books/cbse-10-pyq-mathematics.jpg',
    highlights: [
      '10+ Years of chapter-wise CBSE official board questions',
      'Official CBSE marking scheme step-by-step point presentation',
      'High-weightage recurring question trend analysis',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
  },
  {
    id: 'cbse-10-mathematics-complete',
    slug: 'cbse-10-mathematics-complete',
    title: 'Mathematics Complete Syllabus — Class X',
    subtitle: 'Best School Book Across India — Comprehensive Theory, Proofs & Graded Problems',
    class_label: 'CBSE Class X',
    badge: 'Best School Book',
    digital_price: 299,
    hardcopy_price: 399,
    original_price: 499,
    gst_percent: 18,
    cover_image: '/images/books/cbse-10-mathematics-complete.jpg',
    highlights: [
      'Complete NCERT & CBSE board syllabus with deep conceptual derivations',
      'Over 1,500+ solved examples, graded practice problems & theorems',
      'Special board exam presentation tips to avoid common step mistakes',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
  },
  {
    id: 'cbse-10-mental-ability-reasoning',
    slug: 'cbse-10-mental-ability-reasoning',
    title: 'Mental Ability & Logical Reasoning — Class X',
    subtitle: 'Verbal, Non-Verbal, Numerical & Analytical Critical Thinking',
    class_label: 'CBSE Class X',
    badge: 'Olympiad & NTSE',
    digital_price: 299,
    hardcopy_price: 399,
    original_price: 499,
    gst_percent: 18,
    cover_image: '/images/books/cbse-10-mental-ability-reasoning.jpg',
    highlights: [
      'Verbal & Non-Verbal reasoning patterns with visual mental models',
      'Numerical ability shortcuts and speed math techniques',
      'Targeted for NTSE, Olympiads, and early competitive aptitude tests',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
  },
  {
    id: 'cbse-10-advanced-question-bank',
    slug: 'cbse-10-advanced-question-bank',
    title: 'Advanced Level Question Bank — Mathematics Complete Syllabus',
    subtitle: 'Class X to Early JEE Advanced Bridge Mastery',
    class_label: 'CBSE Class X',
    badge: 'JEE Foundation',
    digital_price: 299,
    hardcopy_price: 399,
    original_price: 499,
    gst_percent: 18,
    cover_image: '/images/books/cbse-10-advanced-question-bank.jpg',
    highlights: [
      'Over 1,200+ advanced non-routine problems extending Class X to JEE',
      'Multi-concept problems bridging Algebra, Geometry & Trigonometry',
      'Detailed analytical and graphical step-by-step solutions',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
  },
];

export const BooksSection: React.FC = () => {
  const [books, setBooks] = useState<BookItem[]>(DEFAULT_BOOKS);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [modalFormat, setModalFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');
  const [highlightedAlias, setHighlightedAlias] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const isSharingInProgress = useRef(false);

  // Check URL hash (#advanced-10, #pyq-10, #book-<slug>) or query parameter (?b=..., ?book=...) to auto-scroll & highlight in gold
  useEffect(() => {
    function checkHighlight() {
      if (typeof window === 'undefined') return;
      let target = '';
      const hash = window.location.hash;
      if (hash) {
        // Strip leading # and optional book- prefix: e.g. #advanced-10 or #book-advanced-10
        target = hash.replace(/^#book-/, '').replace(/^#/, '').trim();
      }
      if (!target) {
        const urlParams = new URLSearchParams(window.location.search);
        const qBook = urlParams.get('b') || urlParams.get('book');
        if (qBook) target = qBook.trim();
      }

      if (target) {
        const matched = books.find((b) => isBookMatch(b, target));
        if (matched) {
          const alias = getBookShortAlias(matched);
          setHighlightedAlias(alias);
          setTimeout(() => {
            const el = document.getElementById(`book-${alias}`) || 
                       document.getElementById(`book-${matched.slug}`) || 
                       document.getElementById(alias);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 350);
        }
      }
    }

    checkHighlight();
    window.addEventListener('hashchange', checkHighlight);
    return () => window.removeEventListener('hashchange', checkHighlight);
  }, [books]);

  useEffect(() => {
    async function loadBooks() {
      try {
        const res = await fetch(buildApiUrl('/api/books/'), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const items: BookItem[] = Array.isArray(data) ? data : (data.results || []);
          if (items.length > 0) {
            // Strictly filter out obsolete duplicates and ensure real book covers
            const sanitized = items
              .filter((b) => b.slug !== 'adv-qb-10' && b.slug !== 'pyq-cbse-10')
              .map((b) => ({
                ...b,
                cover_image: getBookCoverImage(b),
              }));
            if (sanitized.length > 0) {
              setBooks(sanitized);
            }
          }
        }
      } catch (err) {
        console.warn('Using default books fallback on landing page:', err);
      }
    }
    loadBooks();
  }, []);

  const handleOpenPurchase = (book: BookItem, format: 'DIGITAL' | 'HARDCOPY') => {
    setSelectedBook(book);
    setModalFormat(format);
  };

  /**
   * Clean, debounced single-copy share handler:
   * 1. Generates clean short link: https://www.adepteduverse.com/#advanced-10
   * 2. Prevents double-clicks with isSharingInProgress mutex.
   * 3. On mobile: uses navigator.share({ title, url }) WITHOUT embedding url into text,
   *    preventing WhatsApp / mobile messages from duplicating the link!
   * 4. Silently handles user abort without falling back to secondary clipboard copy.
   * 5. On desktop: copies directly to clipboard once with visual feedback.
   */
  const handleShareBook = async (e: React.MouseEvent, book: BookItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSharingInProgress.current) return;
    isSharingInProgress.current = true;
    setTimeout(() => {
      isSharingInProgress.current = false;
    }, 1200);

    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const shortAlias = getBookShortAlias(book);
    // Clean, short, beautiful link (e.g. https://www.adepteduverse.com/#advanced-10)
    const shareUrl = `${origin}/#${shortAlias}`;

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    if (isMobile && typeof navigator.share === 'function') {
      try {
        // Pass title and url only to prevent messaging apps like WhatsApp from duplicating the text
        await navigator.share({
          title: `${book.title} | Adept Eduverse`,
          url: shareUrl,
        });
        setCopiedSlug(shortAlias);
        setTimeout(() => setCopiedSlug(null), 3000);
        return;
      } catch (err: unknown) {
        // If the user cancelled the share dialog, do NOT fall through to copy to clipboard!
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Desktop or mobile fallback: Single clipboard copy
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSlug(shortAlias);
      setTimeout(() => setCopiedSlug(null), 3000);
    } catch {
      prompt('Copy this short link:', shareUrl);
    }
  };

  return (
    <section className="landing-section books-section" id="books" aria-label="Official Books and Publications">
      <div className="landing-wrap">
        <div className="section-tag center">
          <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
          Official Publications
        </div>
        <h2>Study Books &amp; Problem Banks by Ankit Sir</h2>
        <p className="section-subtitle">
          Authored by Ankit Kumar Sir (B.Tech, IIT Kharagpur, 2019). Choose instant <strong>Digital PDF access</strong> or have the premium printed <strong>Physical Book delivered</strong> to your doorstep. No login required.
        </p>

        {/* 4-Column Books Grid (or responsive) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {books.slice(0, 4).map((book) => {
            const rawDigital = Number(book.digital_price ?? book.digitalPrice ?? 299);
            const rawHardcopy = Number(book.hardcopy_price ?? book.hardcopyPrice ?? 399);
            const rawOriginal = Number(book.original_price ?? book.originalPrice ?? 499);
            const discountPercent = Math.round(((rawOriginal - rawDigital) / rawOriginal) * 100);
            const coverUrl = getBookCoverImage(book);
            const bookSlug = book.slug || book.id || '';
            const shortAlias = getBookShortAlias(book);
            const isHighlighted = highlightedAlias === shortAlias || isBookMatch(book, highlightedAlias || '');

            return (
              <div
                key={bookSlug}
                id={`book-${shortAlias}`}
                data-slug={bookSlug}
                data-alias={shortAlias}
                className={`group relative rounded-3xl bg-[#0B1120] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-xl ${
                  isHighlighted
                    ? 'border-2 border-amber-400 ring-4 ring-amber-400/90 shadow-[0_0_50px_rgba(245,200,66,0.85)] scale-[1.02] z-20'
                    : 'border border-slate-800 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-950/40'
                }`}
              >
                {/* Anchor target for clean native #advanced-10 scrolling */}
                <div id={shortAlias} className="scroll-mt-28" />

                {/* Gold Highlight Banner for direct shared link */}
                {isHighlighted && (
                  <div className="py-2 px-3 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 text-[11px] font-black text-center tracking-wider uppercase shadow-lg flex items-center justify-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                    <span>Shared Book • Direct Focus (No Login Required)</span>
                  </div>
                )}

                <div>
                  {/* Visual Header / Real Book Cover Display */}
                  <div className="relative pt-6 pb-4 px-4 bg-gradient-to-b from-slate-950 to-[#0B1120] flex items-center justify-center border-b border-slate-800/60 overflow-hidden">
                    {/* Discount & Class Badges */}
                    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 items-start">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-md">
                        ↓ {discountPercent}% OFF
                      </span>
                      {book.class_label && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {book.class_label}
                        </span>
                      )}
                    </div>

                    {/* Badge */}
                    {book.badge && (
                      <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md">
                        {book.badge}
                      </div>
                    )}

                    {/* Quick Floating Share Button on Cover */}
                    <button
                      type="button"
                      onClick={(e) => handleShareBook(e, book)}
                      title="Share this book"
                      aria-label={`Share ${book.title}`}
                      className="absolute bottom-3 right-3 z-20 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-700/80 hover:border-amber-400/60 transition-all backdrop-blur-md shadow-md flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSlug === shortAlias ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-bold pr-1">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold pr-1">Share</span>
                        </>
                      )}
                    </button>

                    {/* Book Cover */}
                    <div className="relative aspect-[3/4] w-full max-w-[190px] rounded-xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1 bg-slate-950">
                      <Image
                        src={coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2.5">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug line-clamp-2">
                      {book.title}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Ankit Sir (IIT Kharagpur)</span>
                    </div>

                    {/* Highlights Bullet Points */}
                    {book.highlights && book.highlights.length > 0 && (
                      <ul className="space-y-1 pt-1.5 border-t border-slate-800/60">
                        {book.highlights.slice(0, 2).map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Footer with Pricing and Buy Buttons */}
                <div className="p-4 pt-0 space-y-2.5">
                  {/* Price Box */}
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-extrabold text-white">
                          ₹{rawDigital}
                        </span>
                        <span className="text-[11px] text-slate-500 line-through">
                          ₹{rawOriginal}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        Digital PDF
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-400">Printed:</span>
                      <span className="font-bold text-amber-300">
                        ₹{rawHardcopy} <span className="text-[9px] text-slate-500 font-normal">+18% GST</span>
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPurchase(book, 'DIGITAL')}
                      className="py-2 px-2 rounded-xl font-bold text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Digital
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPurchase(book, 'HARDCOPY')}
                      className="py-2 px-2 rounded-xl font-bold text-xs bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3 h-3" /> Order Book
                    </button>
                  </div>

                  {/* Dedicated Share Button */}
                  <button
                    type="button"
                    onClick={(e) => handleShareBook(e, book)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-amber-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedSlug === shortAlias ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-bold">✓ Direct Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Share Book Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA linking to full /books store */}
        <div className="mt-10 text-center">
          <Link
            href="/books"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-[#0B1120] border border-slate-700 hover:border-indigo-500 text-slate-200 hover:text-white transition-all shadow-md group"
          >
            <span>View All Official Publications &amp; Class X Textbooks</span>
            <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
          </Link>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Instant guest checkout via Razorpay • UPI, Cards, Netbanking • Official GST Invoice</span>
          </div>
        </div>
      </div>

      {/* Guest Checkout Modal */}
      {selectedBook && (
        <BookPurchaseModal
          book={selectedBook}
          initialFormat={modalFormat}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </section>
  );
};
