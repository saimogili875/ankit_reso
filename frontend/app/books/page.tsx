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
  GraduationCap,
  Share2,
  Check
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
      'Targeted for JEE Advanced Top rank aspirants',
      'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
      'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
      'Detailed analytical problem breakdowns with IIT Kharagpur pedagogical rigor',
    ],
  },
];

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>(OFFICIAL_BOOKS);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'discount'>('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalBook, setActiveModalBook] = useState<BookItem | null>(null);
  const [modalFormat, setModalFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Check URL hash or query param (?book=<slug>) to auto-scroll & light up in gold
  useEffect(() => {
    function checkHighlight() {
      if (typeof window === 'undefined') return;
      let targetSlug = '';
      const hash = window.location.hash;
      if (hash && hash.startsWith('#book-')) {
        targetSlug = hash.replace('#book-', '').trim();
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const qBook = urlParams.get('book');
        if (qBook) targetSlug = qBook.trim();
      }

      if (targetSlug) {
        setHighlightedSlug(targetSlug);
        setTimeout(() => {
          const el = document.getElementById(`book-${targetSlug}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 400);
      }
    }

    checkHighlight();
    window.addEventListener('hashchange', checkHighlight);
    return () => window.removeEventListener('hashchange', checkHighlight);
  }, []);

  const handleShareBook = async (e: React.MouseEvent, book: BookItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const targetSlug = book.slug || book.id || '';
    const shareUrl = `${origin}/books?book=${targetSlug}#book-${targetSlug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${book.title} | Adept Eduverse Official Bookstore`,
          text: `Check out "${book.title}" by Ankit Kumar Sir (B.Tech IIT Kharagpur, 2019) on Adept Eduverse! Available in instant Digital PDF & Doorstep Physical Delivery:`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedSlug(targetSlug);
      setTimeout(() => setCopiedSlug(null), 3000);
    } catch {
      prompt('Copy this link to share:', shareUrl);
    }
  };

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
    return books
      .filter((b) => {
        const label = (b as { class_label?: string }).class_label || '';
        const titleAndSub = `${b.title} ${b.subtitle || ''} ${label}`.toLowerCase();
        const slug = (b.slug || '').toLowerCase();
        
        // Class filter
        if (selectedClass !== 'all') {
          if (selectedClass === 'class10') {
            const isClass10 = titleAndSub.includes('10th') || titleAndSub.includes('class x') || titleAndSub.includes('cbse');
            if (!isClass10) return false;
          } else if (selectedClass === 'jee') {
            const isJee = titleAndSub.includes('jee') || titleAndSub.includes('olympiad') || slug.includes('adv-prob');
            if (!isJee) return false;
          }
        }

        // Type filter
        if (selectedType !== 'all') {
          if (selectedType === 'pyq' && !slug.includes('pyq') && !titleAndSub.includes('pyq') && !titleAndSub.includes('previous years')) {
            return false;
          }
          if (selectedType === 'textbook' && !slug.includes('complete') && !titleAndSub.includes('textbook') && !titleAndSub.includes('complete syllabus')) {
            return false;
          }
          if (selectedType === 'reasoning' && !slug.includes('reasoning') && !slug.includes('mental-ability') && !titleAndSub.includes('reasoning')) {
            return false;
          }
          if (selectedType === 'question-bank' && !slug.includes('question-bank') && !slug.includes('adv-prob') && !titleAndSub.includes('question bank')) {
            return false;
          }
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return titleAndSub.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.digital_price ?? a.digitalPrice ?? 299);
        const priceB = Number(b.digital_price ?? b.digitalPrice ?? 299);
        const origA = Number(a.original_price ?? a.originalPrice ?? 499);
        const origB = Number(b.original_price ?? b.originalPrice ?? 499);
        const discA = origA - priceA;
        const discB = origB - priceB;

        if (sortBy === 'price-low') return priceA - priceB;
        if (sortBy === 'price-high') return priceB - priceA;
        if (sortBy === 'discount') return discB - discA;
        return 0; // featured default
      });
  }, [books, selectedClass, selectedType, sortBy, searchQuery]);

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
          <div className="mt-10 space-y-4 max-w-5xl mx-auto pt-6 border-t border-slate-800/80">
            {/* Row 1: Class Pills & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Filter Pills */}
              <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedClass('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedClass === 'all'
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Classes ({books.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('class10')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedClass === 'class10'
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>CBSE Class X</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('jee')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedClass === 'jee'
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>JEE &amp; Olympiad</span>
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, chapter..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            {/* Row 2: Book Type Filter & Sort by Dropdown */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
                <span className="text-slate-500 font-semibold mr-1 text-[11px] shrink-0">Type:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pyq', label: 'Past Solved PYQ' },
                  { id: 'textbook', label: 'Textbook' },
                  { id: 'question-bank', label: 'Question Bank' },
                  { id: 'reasoning', label: 'Mental Ability' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                      selectedType === t.id
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-slate-500 text-[11px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as 'featured' | 'price-low' | 'price-high' | 'discount')}
                  className="px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="featured">Featured First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="discount">Biggest Discount</option>
                </select>
              </div>
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
            const bookSlug = book.slug || book.id || '';
            const isHighlighted = highlightedSlug === bookSlug;

            return (
              <div
                key={bookSlug}
                id={`book-${bookSlug}`}
                className={`group relative rounded-3xl bg-[#0B1120] transition-all duration-500 flex flex-col justify-between overflow-hidden shadow-lg ${
                  isHighlighted
                    ? 'border-2 border-amber-400 ring-4 ring-amber-400/80 shadow-[0_0_45px_rgba(245,200,66,0.7)] scale-[1.02] z-20'
                    : 'border border-slate-800 hover:border-indigo-500/60 hover:shadow-2xl hover:shadow-indigo-950/40'
                }`}
              >
                {/* Gold Highlight Banner for direct shared link */}
                {isHighlighted && (
                  <div className="py-1.5 px-3 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 text-[11px] font-black text-center tracking-wider uppercase shadow-md flex items-center justify-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                    <span>Shared Book Selection • Direct View</span>
                  </div>
                )}

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

                    {/* Quick Floating Share Button on Cover */}
                    <button
                      type="button"
                      onClick={(e) => handleShareBook(e, book)}
                      title="Share this book"
                      aria-label={`Share ${book.title}`}
                      className="absolute bottom-3 right-3 z-20 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-700/80 hover:border-amber-400/60 transition-all backdrop-blur-md shadow-md flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSlug === bookSlug ? (
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

                    {/* Authentic 3D Book Cover View with Link to Details */}
                    <Link
                      href={`/books/${book.slug || book.id}`}
                      className="relative aspect-[3/4] w-full max-w-[210px] rounded-xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1 bg-slate-950 block"
                    >
                      <Image
                        src={coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    </Link>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    {/* Title with Link */}
                    <Link href={`/books/${book.slug || book.id}`} className="block">
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors leading-snug line-clamp-2">
                        {book.title}
                      </h3>
                    </Link>

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

                  {/* Dual Action Buttons + Details Link */}
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
                      className="py-2 px-2.5 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" /> Hard Copy
                    </button>
                  </div>

                  {/* Dedicated Share Button */}
                  <button
                    type="button"
                    onClick={(e) => handleShareBook(e, book)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-amber-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedSlug === bookSlug ? (
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

                  <Link
                    href={`/books/${book.slug || book.id}`}
                    className="block text-center text-[11px] font-semibold text-slate-400 hover:text-amber-400 transition-colors pt-0.5"
                  >
                    View Table of Contents &amp; Previews →
                  </Link>
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
                Authored by Ankit Sir (B.Tech IIT KGP). Every question is structured with first-principles depth and official marking criteria.
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
