'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Truck, Download, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { BookItem, BookPurchaseModal } from './BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const BOOKS: BookItem[] = [
  {
    id: 'adv-qb-10',
    title: 'Advanced Question Bank — Class 10th',
    subtitle: 'Comprehensive Chapterwise Problem Solving, High-Yield Mastery & Foundation Extensions',
    badge: 'CBSE 10th & JEE Foundation',
    pdfFileName: 'Advanced Question Bank 10th.pdf',
    digitalPrice: 299,
    hardcopyPrice: 399,
    coverColor: 'from-indigo-600 to-blue-700',
    highlights: [
      '1,500+ Curated high-yield objective & subjective problems',
      'Step-by-step rigorous solutions with first-principles theory',
      'Class 10 CBSE Board & JEE Foundation bridge topics included',
      'Exam-tested practice drills designed by IIT Kharagpur faculty',
    ],
  },
  {
    id: 'pyq-cbse-10',
    title: 'PYQ CBSE Class 10th — Previous Years Solved',
    subtitle: '10 Years Complete Chapterwise Solved Papers, Marking Schemes & Examiner Insights',
    badge: '10 Years Board Papers',
    pdfFileName: 'PYQ Cbse 10th.pdf',
    digitalPrice: 299,
    hardcopyPrice: 399,
    coverColor: 'from-amber-600 to-orange-700',
    highlights: [
      'Complete 10-year authentic CBSE Board solved question archive',
      'Official CBSE marking scheme breakdowns and point distribution',
      'Common student pitfalls & high-scoring presentation tips',
      'Quick-revision mindmaps & key formula cheat sheets',
    ],
  },
];

export const BookCatalogSection: React.FC = () => {
  const [booksList, setBooksList] = useState<BookItem[]>(BOOKS);
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'digital' | 'hardcopy'>('digital');

  React.useEffect(() => {
    fetch(buildApiUrl('/api/books/'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = Array.isArray(data) ? data : (data?.results || []);
        if (Array.isArray(items) && items.length > 0) {
          const mapped: BookItem[] = items.map((b, idx) => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            subtitle: b.subtitle || '',
            badge: b.badge || 'Official Book',
            pdfFileName: `${b.title}.pdf`,
            digitalPrice: Number(b.digital_price) || 299,
            hardcopyPrice: Number(b.hardcopy_price) || 399,
            highlights: Array.isArray(b.highlights) && b.highlights.length > 0
              ? b.highlights
              : (BOOKS[idx % BOOKS.length]?.highlights || []),
            coverColor: idx === 0 ? 'from-indigo-600 to-blue-700' : 'from-amber-600 to-orange-700',
            cover_image: b.cover_image,
          }));
          setBooksList(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenPurchase = (book: BookItem, format: 'digital' | 'hardcopy') => {
    setSelectedBook(book);
    setSelectedFormat(format);
  };

  return (
    <section className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-[#E3E7EE] dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-[#2B2FB8] dark:text-indigo-400 text-xs font-bold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Official Study Materials & Books</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#101828] dark:text-white tracking-tight">
            Class 10th Specialized Study Books & Question Banks
          </h2>
          <p className="text-xs sm:text-sm text-[#5B6475] dark:text-slate-400 mt-1 max-w-2xl">
            Authored by Ankit Sir (B.Tech, IIT Kharagpur). Choose instant <strong>Digital PDF access</strong> or get a physical <strong>Hard Copy delivered</strong> to your address via courier.
          </p>
        </div>
        <Link
          href="/books"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#2B2FB8] text-white hover:bg-indigo-700 shadow-sm transition-colors shrink-0"
        >
          <span>All Publications</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Book Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {booksList.map((book) => (
          <div
            key={book.id}
            className="bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Header Visual Banner */}
              <div className={`p-6 bg-gradient-to-r ${book.coverColor} text-white relative overflow-hidden`}>
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="inline-block px-3 py-1 rounded-full bg-black/25 text-[11px] font-bold tracking-wide uppercase mb-3 backdrop-blur-sm border border-white/10">
                  {book.badge}
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold leading-snug drop-shadow-sm">
                  {book.title}
                </h3>
                <p className="text-xs text-white/90 mt-1.5 line-clamp-2 leading-relaxed">
                  {book.subtitle}
                </p>
              </div>

              {/* Highlights & Features */}
              <div className="p-6 space-y-4">
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {(book.highlights || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Price Matrix */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Digital PDF Edition
                    </span>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="text-xl font-extrabold text-[#2B2FB8] dark:text-indigo-400">
                        ₹{book.digitalPrice}
                      </span>
                      <span className="text-[10px] text-slate-500">+ GST</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 inline-flex items-center gap-1">
                      <Download className="w-3 h-3" /> Instant Download
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Physical Hard Copy
                    </span>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        ₹{book.hardcopyPrice}
                      </span>
                      <span className="text-[10px] text-slate-500">+ GST</span>
                    </div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1 inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Doorstep Courier
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 pt-0 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenPurchase(book, 'digital')}
                  className="w-full h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[#2B2FB8] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Buy Digital (₹299 + GST)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenPurchase(book, 'hardcopy')}
                  className="w-full h-11 rounded-xl bg-[#2B2FB8] hover:bg-[#202494] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Order Hard Copy (₹399 + GST)</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Instant Razorpay checkout with UPI, Cards & Netbanking</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedBook && (
        <BookPurchaseModal
          book={selectedBook}
          initialFormat={selectedFormat}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </section>
  );
};
