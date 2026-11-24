'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Download, 
  Truck, 
  CheckCircle2, 
  ShieldCheck, 
  Star, 
  BookOpen, 
  Clock, 
  Share2, 
  FileText, 
  GraduationCap, 
  ChevronRight,
  MessageCircle,
  HelpCircle,
  Check
} from 'lucide-react';
import { BookItem, BookPurchaseModal, getBookCoverImage } from '@/components/books/BookPurchaseModal';
import { buildApiUrl } from '@/lib/api-client';

const FALLBACK_BOOKS: Record<string, BookItem & { 
  pages: number; 
  has_solutions: boolean; 
  chapters: string[];
  sample_previews?: string[];
}> = {
  'cbse-10-pyq-mathematics': {
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
    pages: 288,
    has_solutions: true,
    cover_image: '/images/books/cbse-10-pyq-mathematics.jpg',
    highlights: [
      '10+ Years of chapter-wise CBSE official board questions (2014–2024)',
      'Official CBSE marking scheme step-by-step point presentation',
      'High-weightage recurring question trend analysis for standard & basic math',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
    chapters: [
      'Real Numbers & Fundamental Theorem of Arithmetic',
      'Polynomials & Relationship between Zeroes and Coefficients',
      'Pair of Linear Equations in Two Variables',
      'Quadratic Equations & Discriminant Analysis',
      'Arithmetic Progressions (AP) & Sum of n Terms',
      'Triangles & Similarity Theorems with Proofs',
      'Coordinate Geometry & Distance / Section Formulas',
      'Introduction to Trigonometry & Trigonometric Identities',
      'Some Applications of Trigonometry (Heights and Distances)',
      'Circles & Tangents Theorems',
      'Areas Related to Circles',
      'Surface Areas and Volumes',
      'Statistics: Mean, Median, Mode of Grouped Data',
      'Probability: Classical Definition and Applications',
    ],
    sample_previews: [
      '/images/books/cbse-10-pyq-mathematics.jpg',
    ]
  },
  'cbse-10-mathematics-complete': {
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
    pages: 412,
    has_solutions: true,
    cover_image: '/images/books/cbse-10-mathematics-complete.jpg',
    highlights: [
      'Complete NCERT & CBSE board syllabus with deep conceptual derivations',
      'Over 1,500+ solved examples, graded practice problems & theorems',
      'Special board exam presentation tips to avoid common step marks deduction',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
    chapters: [
      'First-Principles Real Number Systems',
      'Algebraic Polynomials & Graphical Intuition',
      'Linear Systems with Determinant Approach',
      'Complete Quadratic Theory with Nature of Roots',
      'Sequence & Series Foundations (AP & GP Primer)',
      'Geometry Mastery: Similarity & Circle Tangents',
      'Coordinate Systems and Distance Geometry',
      'Trigonometric Functions, Identities & Applications',
      'Solid Mensuration & Surface Calculations',
      'Statistical Foundations and Probability',
    ],
    sample_previews: [
      '/images/books/cbse-10-mathematics-complete.jpg',
    ]
  },
  'cbse-10-mental-ability-reasoning': {
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
    pages: 324,
    has_solutions: true,
    cover_image: '/images/books/cbse-10-mental-ability-reasoning.jpg',
    highlights: [
      'Verbal & Non-Verbal reasoning patterns with visual mental models',
      'Numerical ability shortcuts and speed math mental calculations',
      'Targeted for NTSE, Olympiads, and early competitive foundation tests',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
    chapters: [
      'Number, Alphabet & Alpha-Numeric Series',
      'Coding-Decoding & Substitution Patterns',
      'Direction Sense & Blood Relations Matrix',
      'Venn Diagrams & Syllogisms',
      'Mathematical Operations & Speed Arithmetic',
      'Non-Verbal Series, Analogy & Classification',
      'Pattern Folding, Paper Cutting & Mirror Images',
      'Cube & Dice Spatial Visualization',
      'Analytical Puzzles & Seating Arrangements',
      'Data Sufficiency & Critical Reasoning',
    ],
    sample_previews: [
      '/images/books/cbse-10-mental-ability-reasoning.jpg',
    ]
  },
  'cbse-10-advanced-question-bank': {
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
    pages: 368,
    has_solutions: true,
    cover_image: '/images/books/cbse-10-advanced-question-bank.jpg',
    highlights: [
      'Over 1,200+ advanced non-routine problems extending Class X to JEE',
      'Multi-concept problems bridging Algebra, Geometry & Trigonometry',
      'Detailed analytical and graphical step-by-step solutions',
      'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
    ],
    chapters: [
      'High-Yield Number Theory & Diophantine Equations',
      'Polynomial Roots, Symmetric Functions & Vieta Formulas',
      'Inequalities (AM-GM, Cauchy-Schwarz Primer for High School)',
      'Advanced Coordinate Geometry & Conic Sections Bridge',
      'Trigonometric Equations, Identities & Telescoping Sums',
      'Euclidean Geometry Theorems (Ceva, Menelaus, Ptolemy)',
      'Permutations, Combinations & Counting Principles',
      'Bridge Calculus: Limits, Rates & Continuity Intuition',
    ],
    sample_previews: [
      '/images/books/cbse-10-advanced-question-bank.jpg',
    ]
  },
  'adv-prob-math': {
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
    pages: 456,
    has_solutions: true,
    cover_image: '/images/books/cbse-10-advanced-question-bank.jpg',
    highlights: [
      'Targeted for JEE Advanced Top rank aspirants',
      'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
      'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
      'Detailed analytical problem breakdowns with IIT Kharagpur pedagogical rigor',
    ],
    chapters: [
      'Functions, Domain-Range Extremes & Functional Equations',
      'Differential Calculus: Tangents, Normals & Monotonicity',
      'Integral Calculus: Definite Integrals & Area Under Curves',
      'Differential Equations & Physical Trajectories',
      'Vectors & 3D Geometry Multi-Plane Intersections',
      'Complex Numbers & Geometric Transformations',
      'Matrices, Determinants & System of Linear Equations',
      'Probability Distributions & Bayes Theorem Problems',
    ],
    sample_previews: [
      '/images/books/cbse-10-advanced-question-bank.jpg',
    ]
  }
};

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params?.slug || '');

  const [book, setBook] = useState<any>(FALLBACK_BOOKS[slug] || null);
  const [format, setFormat] = useState<'DIGITAL' | 'HARDCOPY'>('DIGITAL');
  const [modalOpen, setModalOpen] = useState(false);
  const [activePreview, setActivePreview] = useState<string>('');

  useEffect(() => {
    async function loadBook() {
      try {
        const res = await fetch(buildApiUrl(`/api/books/${slug}/`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.slug) {
            setBook((prev: any) => ({
              ...(FALLBACK_BOOKS[slug] || {}),
              ...data,
              cover_image: getBookCoverImage(data),
            }));
          }
        }
      } catch {
        // Fall back to pre-seeded static book
      }
    }
    if (slug) {
      loadBook();
    }
  }, [slug]);

  const currentBook = book || FALLBACK_BOOKS[slug] || FALLBACK_BOOKS['cbse-10-pyq-mathematics'];
  const coverImage = getBookCoverImage(currentBook);

  const price = format === 'DIGITAL' 
    ? Number(currentBook.digital_price || 299)
    : Number(currentBook.hardcopy_price || 399);

  const originalPrice = currentBook.original_price ? Number(currentBook.original_price) : 499;
  const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);

  // Product JSON-LD structured schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    'name': currentBook.title,
    'description': currentBook.subtitle || currentBook.description,
    'image': `https://www.adepteduverse.com${coverImage}`,
    'bookFormat': format === 'DIGITAL' ? 'https://schema.org/EBook' : 'https://schema.org/Hardcover',
    'numberOfPages': currentBook.pages || 320,
    'author': {
      '@type': 'Person',
      'name': 'Ankit Kumar',
      'jobTitle': 'Founder & Academic Head',
      'alumniOf': 'Indian Institute of Technology Kharagpur'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Adept Eduverse'
    },
    'offers': {
      '@type': 'Offer',
      'price': price,
      'priceCurrency': 'INR',
      'availability': 'https://schema.org/InStock',
      'url': `https://www.adepteduverse.com/books/${slug}`
    }
  };

  return (
    <div className="min-h-screen bg-[#060B18] text-slate-100">
      {/* Inject JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0A1128]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt="Adept Eduverse"
                width={32}
                height={32}
                className="rounded-lg object-contain"
              />
              <span className="text-base font-bold text-white tracking-wide hidden sm:inline">Adept Eduverse</span>
            </Link>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <Link href="/books" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors">
              Official Bookstore
            </Link>
          </div>

          <Link
            href="/books"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Books</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-white">Home</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <Link href="/books" className="hover:text-white">Bookstore</Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-slate-200 truncate max-w-xs">{currentBook.title}</span>
        </nav>

        {/* Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Book Cover Display & Thumbnail Gallery (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent z-10 pointer-events-none" />
              
              {/* Discount Chip */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg">
                ↓ {discountPercent}% OFF
              </div>

              {/* Badge */}
              {currentBook.badge && (
                <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-lg">
                  {currentBook.badge}
                </div>
              )}

              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={activePreview || coverImage}
                  alt={currentBook.title}
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
            </div>

            {/* Guarantee Strip */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">RBI Verified Razorpay Payment</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300">All-India Safe Courier Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Book Details & Format Toggle & Order Card (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {currentBook.class_label || 'CBSE Class X'}
                </span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  100% Verified Solutions Included
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                {currentBook.title}
              </h1>
              {currentBook.subtitle && (
                <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                  {currentBook.subtitle}
                </p>
              )}
            </div>

            {/* Author Attribution Box */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400/50 shrink-0">
                <Image
                  src="/images/ankit/ankit-headshot.webp"
                  alt="Ankit Kumar"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <div className="text-xs text-slate-400">Written &amp; Curated by</div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Ankit Kumar Sir</span>
                  <span className="text-[11px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                    B.Tech, IIT Kharagpur (2019)
                  </span>
                </div>
              </div>
            </div>

            {/* Format Selection Switcher */}
            <div className="p-5 rounded-3xl bg-[#0B1120] border border-amber-500/30 space-y-4 shadow-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Choose Book Format:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Digital PDF Option */}
                <button
                  type="button"
                  onClick={() => setFormat('DIGITAL')}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    format === 'DIGITAL'
                      ? 'bg-amber-400/10 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white text-sm">Digital PDF Edition</span>
                      </div>
                      {format === 'DIGITAL' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>✓ Instant secure download link</li>
                      <li>✓ Searchable, high-res PDF</li>
                      <li>✓ Read on Mobile, Tablet &amp; PC</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-800 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Instant Access</span>
                    <span className="text-lg font-black text-amber-400">₹{Number(currentBook.digital_price || 299)}</span>
                  </div>
                </button>

                {/* Hard Copy Option */}
                <button
                  type="button"
                  onClick={() => setFormat('HARDCOPY')}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    format === 'HARDCOPY'
                      ? 'bg-amber-400/10 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-white text-sm">Printed Hard Copy</span>
                      </div>
                      {format === 'HARDCOPY' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1">
                      <li>✓ Premium 80 GSM paper binding</li>
                      <li>✓ Doorstep delivery across India</li>
                      <li>✓ Dispatched in 24–48 hours</li>
                    </ul>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-800 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Doorstep Delivery</span>
                    <span className="text-lg font-black text-amber-400">₹{Number(currentBook.hardcopy_price || 399)}</span>
                  </div>
                </button>
              </div>

              {/* Price Breakdown & Buy Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-amber-400">
                      ₹{price}
                    </span>
                    <span className="text-base text-slate-500 line-through">
                      ₹{originalPrice}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      (18% GST Included)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {format === 'DIGITAL' ? 'Instant download immediately after checkout' : 'Free bubble-mail delivery across India'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-400/25 transition-all hover:scale-105 cursor-pointer flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Buy Now — No Login Needed</span>
                </button>
              </div>
            </div>

            {/* Book Highlights */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Key Features &amp; Pedagogical Highlights
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                {(currentBook.highlights || []).map((h: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What is Inside / Technical Specifications Table */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Book Specifications</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Total Pages</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{currentBook.pages || 320} Pages</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Solutions</span>
                  <span className="font-bold text-emerald-400 text-sm mt-0.5 block">100% Step-by-Step</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Target Syllabus</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{currentBook.class_label || 'CBSE 10th'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Publisher</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">Adept Eduverse</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Language</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">English Medium</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block">Academic Session</span>
                  <span className="font-bold text-amber-300 text-sm mt-0.5 block">2025–2026</span>
                </div>
              </div>
            </div>

            {/* Chapters Index */}
            {currentBook.chapters && currentBook.chapters.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Table of Contents ({currentBook.chapters.length} Chapters)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                  {currentBook.chapters.map((ch: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                      <span className="text-amber-400 font-bold w-5 shrink-0">{String(idx + 1).padStart(2, '0')}.</span>
                      <span className="truncate">{ch}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help / WhatsApp Assistance */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">Have questions about syllabus edition or delivery?</span>
              </div>
              <a
                href={`https://wa.me/919382557693?text=Hi%2C%20I%20have%20a%20question%20about%20${encodeURIComponent(currentBook.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat on WhatsApp (+91 93825 57693)</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Guest Checkout Modal */}
      {modalOpen && (
        <BookPurchaseModal
          book={currentBook}
          initialFormat={format}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
