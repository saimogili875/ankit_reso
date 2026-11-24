'use client';

import React, { useState, useEffect } from 'react';
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
  Star
} from 'lucide-react';
import { BookPurchaseModal, BookItem } from '@/components/books/BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const FALLBACK_BOOKS: BookItem[] = [
  {
    id: 'adv-qb-10',
    slug: 'adv-qb-10',
    title: 'Advanced Question Bank — Class 10th',
    subtitle: 'Comprehensive Board & Foundation Mastery',
    badge: 'Bestseller',
    digital_price: 299,
    hardcopy_price: 399,
    gst_percent: 18,
    cover_image: '/images/ankit-sir-thumbsup.jpg',
    highlights: [
      'Over 1,200+ curated problems across Mathematics and Science',
      'Step-by-step rigorous solutions directly authored by Ankit Sir',
      'Three-tier progression: Board Level, NTSE/Olympiad, and Early JEE',
      'Chapter-wise formula sheets and quick revision mindmaps',
    ],
  },
  {
    id: 'pyq-cbse-10',
    slug: 'pyq-cbse-10',
    title: 'PYQ CBSE Class 10th — Previous Years Solved',
    subtitle: 'Past 10 Years Chapter-wise Solved Papers',
    badge: 'Exam Essential',
    digital_price: 299,
    hardcopy_price: 399,
    gst_percent: 18,
    cover_image: '/images/ankit-sir.jpg',
    highlights: [
      '10 complete years of chapter-wise CBSE official questions',
      'Step-by-step marking scheme alignment for full marks presentation',
      'Trend analysis identifying recurring high-weightage topics',
      'Timed self-evaluation mock papers with answer keys',
    ],
  },
  {
    id: 'adv-prob-math',
    slug: 'adv-prob-math',
    title: 'Advanced Problem Book in Mathematics',
    subtitle: 'For JEE Advanced & Olympiad Aspirants',
    badge: 'JEE Elite',
    digital_price: 299,
    hardcopy_price: 399,
    gst_percent: 18,
    cover_image: '/images/ankit-sir-headshot.jpg',
    highlights: [
      'Targeted for JEE Advanced Top 500 rank aspirants',
      'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
      'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
      'Detailed historical exam insights from Kota coaching methodology',
    ],
  },
];

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>(FALLBACK_BOOKS);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'class10' | 'jee'>('all');
  const [activeModalBook, setActiveModalBook] = useState<BookItem | null>(null);
  const [modalFormat, setModalFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await fetch(buildApiUrl('/api/books/'), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.results || []);
          if (items.length > 0) {
            setBooks(items);
          }
        }
      } catch (err) {
        console.warn('Using seeded books catalog fallback:', err);
      }
    }
    fetchBooks();
  }, []);

  const filteredBooks = books.filter((b) => {
    if (selectedCategory === 'all') return true;
    const label = (b as { class_label?: string }).class_label || '';
    const titleAndSub = `${b.title} ${b.subtitle || ''} ${label}`.toLowerCase();
    if (selectedCategory === 'class10') return titleAndSub.includes('10th') || titleAndSub.includes('cbse');
    if (selectedCategory === 'jee') return titleAndSub.includes('jee') || titleAndSub.includes('math') || titleAndSub.includes('advanced');
    return true;
  });

  const handleOpenModal = (book: BookItem, format: 'DIGITAL' | 'HARDCOPY') => {
    setActiveModalBook(book);
    setModalFormat(format);
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar Bar */}
      <header className="sticky top-0 z-40 bg-[#070B14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-slate-300 hover:text-white text-xs font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Instant Delivery • No Login Required
            </span>
            <Link
              href="/#contact"
              className="text-xs text-slate-400 hover:text-white transition-colors hidden sm:inline-block"
            >
              Need Help?
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Official Adept Eduverse Publications
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-tight">
            Curated Problem Banks & PYQs by{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200">
              Ankit Sir
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Every problem selected and solved with precision. Choose instant Digital PDF access or have the premium printed physical edition delivered right to your doorstep.
          </p>

          {/* Quick Value Metrics */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-lg sm:text-xl font-black text-white">1,200+</div>
              <div className="text-[11px] text-slate-400">Curated Problems</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-lg sm:text-xl font-black text-emerald-400">10 Years</div>
              <div className="text-[11px] text-slate-400">Official Solved PYQs</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-lg sm:text-xl font-black text-sky-400">Instant</div>
              <div className="text-[11px] text-slate-400">Digital PDF Delivery</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-lg sm:text-xl font-black text-amber-400">Pan-India</div>
              <div className="text-[11px] text-slate-400">Tracked Courier Shipping</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-12 inline-flex items-center p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#2B2FB8] text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Publications
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('class10')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'class10'
                  ? 'bg-[#2B2FB8] text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Class 10th Board
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('jee')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === 'jee'
                  ? 'bg-[#2B2FB8] text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JEE Advanced & Olympiad
            </button>
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <section className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredBooks.map((book) => {
            const rawDigital = Number(book.digital_price ?? book.digitalPrice ?? 299);
            const rawHardcopy = Number(book.hardcopy_price ?? book.hardcopyPrice ?? 399);

            return (
              <div
                key={book.slug || book.id}
                className="group relative rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 flex flex-col overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-indigo-950/30"
              >
                {/* Book Card Visual Header */}
                <div className="relative h-64 w-full bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                  {book.cover_image ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={book.cover_image}
                        alt={book.title}
                        fill
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900/60 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                      <BookOpen className="w-12 h-12 text-indigo-400 mb-3" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        {book.badge || 'Adept Eduverse'}
                      </span>
                    </div>
                  )}

                  {/* Badge */}
                  {book.badge && (
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                      {book.badge}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug">
                      {book.title}
                    </h3>
                    {book.subtitle && (
                      <p className="text-xs text-slate-400 font-medium">
                        {book.subtitle}
                      </p>
                    )}

                    {/* Highlights */}
                    {book.highlights && book.highlights.length > 0 && (
                      <ul className="space-y-2 pt-2 border-t border-slate-800/60">
                        {book.highlights.slice(0, 4).map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Pricing and Action Buttons */}
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                          <Download className="w-3 h-3 text-indigo-400" /> Digital PDF
                        </div>
                        <div className="text-base font-extrabold text-white mt-0.5">
                          ₹{rawDigital} <span className="text-[10px] text-slate-500 font-normal">+18% GST</span>
                        </div>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                          <Truck className="w-3 h-3 text-emerald-400" /> Printed Copy
                        </div>
                        <div className="text-base font-extrabold text-white mt-0.5">
                          ₹{rawHardcopy} <span className="text-[10px] text-slate-500 font-normal">+18% GST</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(book, 'DIGITAL')}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Buy Digital
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenModal(book, 'HARDCOPY')}
                        className="py-2.5 px-3 rounded-xl font-bold text-xs bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" /> Order Book
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Guarantee Section */}
      <section className="py-16 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-white">Why Study From Ankit Sir&apos;s Books?</h2>
            <p className="mt-2 text-xs text-slate-400">Engineered for absolute conceptual clarity and top examination ranks.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Authored by Kota Veteran</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every problem, derivation, and solution reflects years of classroom excellence producing top JEE Advanced ranks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Instant Safe Digital Access</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Immediately after Razorpay payment verification, your personalized high-resolution PDF download link is active for 7 days.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Pan-India Courier Dispatch</h3>
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
