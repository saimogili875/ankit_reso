'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  BookOpen, 
  Download, 
  Truck, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ArrowLeft,
  Star,
  Search,
  Layers,
  GraduationCap
} from 'lucide-react';
import { BookPurchaseModal, BookItem, getBookCoverImage } from '@/components/books/BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const OFFICIAL_BOOKS: BookItem[] = [
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
      'Authored by Kota veteran Ankit Kumar Sir (B.Tech, IIT Kharagpur, 2019)',
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
  {
    id: 'adv-prob-math',
    slug: 'adv-prob-math',
    title: 'Advanced Problem Book in Mathematics',
    subtitle: 'For JEE Advanced & Olympiad Aspirants',
    class_label: 'JEE Advanced',
    badge: 'JEE Elite',
    digital_price: 299,
    hardcopy_price: 399,
    original_price: 599,
    gst_percent: 18,
    cover_image: '/images/books/cbse-10-advanced-question-bank.jpg',
    highlights: [
      'Targeted for JEE Advanced Top 500 rank aspirants',
      'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
      'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
      'Detailed historical exam insights from Kota coaching methodology',
    ],
  },
];

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>(OFFICIAL_BOOKS);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'class10' | 'jee'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalBook, setActiveModalBook] = useState<BookItem | null>(null);
  const [modalFormat, setModalFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');

  useEffect(() => {
    async function fetchBooks() {
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
        console.warn('Using seeded books catalog fallback:', err);
      }
    }
    fetchBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const label = (b as { class_label?: string }).class_label || '';
      const titleAndSub = `${b.title} ${b.subtitle || ''} ${label}`.toLowerCase();
      
      // Category filter
      if (selectedCategory === 'class10') {
        const isClass10 = titleAndSub.includes('10th') || titleAndSub.includes('class x') || titleAndSub.includes('cbse') || label.toLowerCase().includes('class 10') || label.toLowerCase().includes('class x');
        if (!isClass10) return false;
      } else if (selectedCategory === 'jee') {
        const isJee = titleAndSub.includes('jee') || titleAndSub.includes('olympiad') || titleAndSub.includes('advanced problem');
        if (!isJee) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return titleAndSub.includes(q);
      }

      return true;
    });
  }, [books, selectedCategory, searchQuery]);

  const handleOpenModal = (book: BookItem, format: 'DIGITAL' | 'HARDCOPY') => {
    setActiveModalBook(book);
    setModalFormat(format);
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* ====================================================================
           TOP NAV BAR
           ==================================================================== */}
      <header className="sticky top-0 z-40 bg-[#070B14]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-slate-300 hover:text-white text-xs font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Official Book Store • No Login Required
            </span>
          </div>
        </div>
      </header>

      {/* ====================================================================
           HERO BANNER
           ==================================================================== */}
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-16 sm:pb-16 border-b border-slate-800/60 bg-gradient-to-b from-[#0B1120] to-[#070B14]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Official Adept Eduverse Publications
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Study Books &amp; Problem Banks by{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400">
              Ankit Kumar Sir
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Written and solved by <strong>IIT Kharagpur Alumnus Ankit Sir</strong>. Choose instant <strong>Digital PDF access</strong> or order the printed <strong>Physical Book delivered</strong> to your home with free tracking.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-base sm:text-lg font-black text-amber-300">CBSE Class X</div>
              <div className="text-[11px] text-slate-400">Complete Board Series</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-base sm:text-lg font-black text-emerald-400">10+ Years</div>
              <div className="text-[11px] text-slate-400">Official Solved PYQs</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-base sm:text-lg font-black text-sky-400">Instant PDF</div>
              <div className="text-[11px] text-slate-400">Safe Digital Download</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <div className="text-base sm:text-lg font-black text-indigo-400">Pan-India</div>
              <div className="text-[11px] text-slate-400">Doorstep Delivery</div>
            </div>
          </div>

          {/* Filter Tabs & Search Controls */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/80">
            {/* Filter Pills */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-[#2B2FB8] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Books ({books.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('class10')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === 'class10'
                    ? 'bg-[#2B2FB8] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>CBSE Class X Only</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('jee')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === 'jee'
                    ? 'bg-[#2B2FB8] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>JEE Advanced &amp; Olympiad</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, subject..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           E-COMMERCE BOOK CATALOG GRID (Testbook / Amazon Style)
           ==================================================================== */}
      <section className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-400" />
              <span>Available Textbooks &amp; Question Banks</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Showing {filteredBooks.length} titles authored by Ankit Sir with verified solutions.
            </p>
          </div>
        </div>

        {/* E-Commerce Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-7">
          {filteredBooks.map((book) => {
            const rawDigital = Number(book.digital_price ?? book.digitalPrice ?? 299);
            const rawHardcopy = Number(book.hardcopy_price ?? book.hardcopyPrice ?? 399);
            const rawOriginal = Number(book.original_price ?? book.originalPrice ?? (rawHardcopy + 100));
            const discountPercent = Math.round(((rawOriginal - rawDigital) / rawOriginal) * 100);
            const coverUrl = getBookCoverImage(book);

            return (
              <div
                key={book.slug || book.id}
                className="group relative rounded-3xl bg-[#0B1120] border border-slate-800 hover:border-indigo-500/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-indigo-950/40"
              >
                <div>
                  {/* Book Cover Container - Vertical Realistic Book Display */}
                  <div className="relative pt-6 pb-4 px-4 bg-gradient-to-b from-slate-950 to-[#0B1120] flex items-center justify-center border-b border-slate-800/60 overflow-hidden">
                    {/* Discount Badge (top left) */}
                    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 items-start">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-md">
                        ↓ {discountPercent}% OFF
                      </span>
                      {book.class_label && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {book.class_label}
                        </span>
                      )}
                    </div>

                    {/* Book Badge (top right) */}
                    {book.badge && (
                      <div className="absolute top-3 right-3 z-20 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md">
                        {book.badge}
                      </div>
                    )}

                    {/* Authentic 3D Book Cover View */}
                    <div className="relative aspect-[3/4] w-full max-w-[210px] rounded-xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1 bg-slate-950">
                      <Image
                        src={coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    {/* Title */}
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug line-clamp-2">
                      {book.title}
                    </h3>

                    {/* Author Credit */}
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">By Ankit Kumar Sir (IIT Kharagpur)</span>
                    </div>

                    {/* Highlights */}
                    {book.highlights && book.highlights.length > 0 && (
                      <ul className="space-y-1.5 pt-2 border-t border-slate-800/60">
                        {book.highlights.slice(0, 3).map((h, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Footer / Pricing & Actions */}
                <div className="p-5 pt-0 space-y-3">
                  {/* Pricing Box (matching Testbook reference) */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black text-white">
                          ₹{rawDigital}
                        </span>
                        <span className="text-xs text-slate-500 line-through">
                          ₹{rawOriginal}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        Digital PDF
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800/60 text-xs">
                      <span className="text-slate-400">Printed Book:</span>
                      <span className="font-extrabold text-amber-300">
                        ₹{rawHardcopy} <span className="text-[10px] text-slate-500 font-normal">+18% GST</span>
                      </span>
                    </div>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(book, 'DIGITAL')}
                      className="py-2 px-2.5 rounded-xl font-bold text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Digital
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(book, 'HARDCOPY')}
                      className="py-2 px-2.5 rounded-xl font-bold text-xs bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/30 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" /> Hard Copy
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
           TRUST & GUARANTEE SECTION
           ==================================================================== */}
      <section className="py-16 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-white">Why Study From Adept Eduverse Books?</h2>
            <p className="mt-1.5 text-xs text-slate-400">Engineered for absolute conceptual clarity and top examination ranks.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">IIT Kharagpur Pedagogy</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authored by Ankit Sir (B.Tech IIT KGP). Every question is structured with Kota coaching rigor and official marking criteria.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Instant Safe Digital Delivery</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Immediately after Razorpay payment verification, your personalized high-resolution PDF download link is active for 7 days.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0B1120] border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Pan-India Courier Dispatch</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Printed physical editions are packed with protective bubble wrap and dispatched with live SMS and email consignment tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Guest Checkout Modal */}
      {activeModalBook && (
        <BookPurchaseModal
          book={activeModalBook}
          initialFormat={modalFormat}
          onClose={() => setActiveModalBook(null)}
        />
      )}
    </div>
  );
}
