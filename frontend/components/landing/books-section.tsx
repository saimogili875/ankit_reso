'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  BookOpen, 
  Download, 
  Truck, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { BookItem, BookPurchaseModal } from '@/components/books/BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const DEFAULT_BOOKS: BookItem[] = [
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
      '1,200+ Curated high-yield objective & subjective problems',
      'Step-by-step solutions directly authored by Ankit Sir',
      'CBSE Board, Olympiad, and early JEE Advanced extensions',
      'Chapter-wise formula sheets & quick-revision mindmaps',
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
      'Official CBSE marking scheme breakdowns and point presentation',
      'Trend analysis highlighting recurring high-weightage topics',
      'Timed self-evaluation mock papers with complete answer keys',
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
      'Non-routine problems bridging Calculus, Algebra & Coordinate',
      'Multiple solution techniques: analytical and graphical shortcuts',
      'Detailed exam insights from Kota coaching methodology',
    ],
  },
];

export const BooksSection: React.FC = () => {
  const [books, setBooks] = useState<BookItem[]>(DEFAULT_BOOKS);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [modalFormat, setModalFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');

  useEffect(() => {
    async function loadBooks() {
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
        console.warn('Using default books fallback on landing page:', err);
      }
    }
    loadBooks();
  }, []);

  const handleOpenPurchase = (book: BookItem, format: 'DIGITAL' | 'HARDCOPY') => {
    setSelectedBook(book);
    setModalFormat(format);
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
          Designed by Kota veteran Ankit Sir (B.Tech, IIT Kharagpur). Choose instant <strong>Digital PDF access</strong> or have the premium printed <strong>Hard Copy delivered</strong> to your doorstep. No login required.
        </p>

        {/* 3-Column Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {books.map((book) => {
            const rawDigital = Number(book.digital_price ?? book.digitalPrice ?? 299);
            const rawHardcopy = Number(book.hardcopy_price ?? book.hardcopyPrice ?? 399);

            return (
              <div
                key={book.slug || book.id}
                className="group relative rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-indigo-950/40"
              >
                <div>
                  {/* Visual Header / Cover Image */}
                  <div className="relative h-60 w-full bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                    {book.cover_image ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={book.cover_image}
                          alt={book.title}
                          fill
                          className="object-cover object-top group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
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

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug">
                        {book.title}
                      </h3>
                      {book.subtitle && (
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          {book.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Highlights Bullet Points */}
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
                </div>

                {/* Footer with Pricing and Buy Buttons */}
                <div className="p-6 pt-0 space-y-4">
                  {/* Price Box */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
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

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenPurchase(book, 'DIGITAL')}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Buy Digital
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPurchase(book, 'HARDCOPY')}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs bg-[#2B2FB8] hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" /> Order Book
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner linking to full /books catalog */}
        <div className="mt-12 text-center">
          <Link
            href="/books"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 hover:text-white transition-all shadow-md group"
          >
            <span>Explore Complete Publications Catalog &amp; Details</span>
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
