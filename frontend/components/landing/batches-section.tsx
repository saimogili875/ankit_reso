'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  CheckCircle2, 
  GraduationCap, 
  Clock, 
  Sparkles,
  Layers,
  ShieldCheck,
  MessageCircle,
  Video
} from 'lucide-react';

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

const DEFAULT_PRICING_CARDS: PricingCardData[] = [
  {
    id: 'school',
    key: 'school',
    title: 'School Batches, Class VI-X',
    tagline: 'Foundation excellence bridging school curriculum with Olympiad and early JEE training.',
    badge: 'Foundation & Olympiad',
    rotate_seconds: 5,
    cta_label: 'View all Class VI-X batches',
    cta_url: '#school-batches',
    order: 1,
    batches: [
      {
        id: 'batch-vi',
        slug: 'class-6-foundation-star',
        name: 'Foundation Star Batch',
        card_key: 'school',
        academic_class_name: 'Class 6',
        tagline: 'Math & Science fundamentals with Olympiad aptitude primer.',
        description: 'Comprehensive year-long foundation program for Class 6 students focusing on conceptual clarity, speed calculations, and analytical thinking.',
        image: '/images/ankit-sir.jpg',
        price: 2000,
        display_order: 1,
        items: [
          { id: '1', item_type: 'SP', title: 'Study Package & Practice Notes', price: 500, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'Chapter-wise Solved Question Bank', price: 300, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Logical Aptitude', price: 400, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'Olympiad Foundation Drills', price: 500, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'Weekly Assessment Mock Tests', price: 300, is_addon: false },
        ],
        features: [
          { id: 'f1', text: '4 live interactive sessions per week with two-way audio & chat', order: 1 },
          { id: 'f2', text: 'School textbook mastery + Olympiad foundation problem solving', order: 2 },
          { id: 'f3', text: 'Full HD video recordings uploaded within 2 hours of every class', order: 3 },
          { id: 'f4', text: 'Weekly mock test series with individual student progress reports', order: 4 },
        ],
      },
      {
        id: 'batch-vii',
        slug: 'class-7-foundation-plus',
        name: 'Foundation Plus Batch',
        card_key: 'school',
        academic_class_name: 'Class 7',
        tagline: 'Pre-Algebra, Geometry visualization and logical thinking.',
        description: 'Prepares Class 7 students for school excellence while developing strong pre-algebraic intuition, mental math agility, and competitive readiness.',
        image: '/images/ankit-sir.jpg',
        price: 2000,
        display_order: 2,
        items: [
          { id: '6', item_type: 'SP', title: 'Study Package & Notes', price: 500, is_addon: false },
          { id: '7', item_type: 'PYQ', title: 'Chapter-wise Solved Question Bank', price: 300, is_addon: false },
          { id: '8', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Logical Reasoning', price: 400, is_addon: false },
          { id: '9', item_type: 'OLYMPIAD', title: 'Olympiad Foundation Drills', price: 500, is_addon: false },
          { id: '10', item_type: 'TEST_SERIES', title: 'Weekly Assessment Mock Tests', price: 300, is_addon: false },
        ],
        features: [
          { id: 'f5', text: 'Step-by-step conceptual derivations for school syllabus', order: 1 },
          { id: 'f6', text: 'NTSE & NMTC orientation with graded practice worksheets', order: 2 },
          { id: 'f7', text: 'Live two-way doubt clarification in every single session', order: 3 },
          { id: 'f8', text: 'Comprehensive chapter formula sheets and quick revision mindmaps', order: 4 },
        ],
      },
      {
        id: 'batch-viii',
        slug: 'class-8-olympiad-ready',
        name: 'Olympiad Ready Batch',
        card_key: 'school',
        academic_class_name: 'Class 8',
        tagline: 'Bridge to higher secondary mathematics and national Olympiads.',
        description: 'Rigorous foundation bridge preparing students for IOQM, PRMO, and early JEE Advanced problem dissection.',
        image: '/images/ankit-sir.jpg',
        price: 3000,
        display_order: 3,
        items: [
          { id: '11', item_type: 'SP', title: 'Comprehensive Study Package', price: 500, is_addon: false },
          { id: '12', item_type: 'PYQ', title: 'Past 10 Years Solved Questions', price: 500, is_addon: false },
          { id: '13', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Analytical Reasoning', price: 500, is_addon: false },
          { id: '14', item_type: 'OLYMPIAD', title: 'Olympiad & PRMO Level Drills', price: 800, is_addon: false },
          { id: '15', item_type: 'TEST_SERIES', title: 'All-India CBT Pattern Test Series', price: 500, is_addon: false },
        ],
        features: [
          { id: 'f9', text: 'Rigorous Olympiad and PRMO mathematics problem sets', order: 1 },
          { id: 'f10', text: 'Curated Daily Practice Problems (DPP) with complete solutions', order: 2 },
          { id: 'f11', text: 'Introduction to Coordinate Geometry and pre-calculus concepts', order: 3 },
          { id: 'f12', text: 'Personalized doubt solving on WhatsApp Academic Desk', order: 4 },
        ],
      },
      {
        id: 'batch-ix',
        slug: 'class-9-board-booster',
        name: 'Board Booster Batch',
        card_key: 'school',
        academic_class_name: 'Class 9',
        tagline: 'Complete NCERT mastery + early JEE Advanced conceptual foundation.',
        description: 'Combines full school academic syllabus coverage with rigorous Olympiad problem-solving and Kota foundation methodologies.',
        image: '/images/ankit-sir.jpg',
        price: 3000,
        display_order: 4,
        items: [
          { id: '16', item_type: 'SP', title: 'Comprehensive Study Package & DPPs', price: 1000, is_addon: false },
          { id: '17', item_type: 'PYQ', title: 'Chapter-wise Solved Question Bank', price: 500, is_addon: false },
          { id: '18', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Logical Reasoning', price: 500, is_addon: false },
          { id: '19', item_type: 'OLYMPIAD', title: 'Olympiad Foundation Modules', price: 800, is_addon: false },
          { id: '20', item_type: 'TEST_SERIES', title: 'Sunday Test Series with Rank Benchmarking', price: 500, is_addon: false },
        ],
        features: [
          { id: 'f13', text: 'Complete NCERT & NCERT Exemplar exhaustive dissection', order: 1 },
          { id: 'f14', text: 'Early JEE Advanced concept bridging for Algebra and Geometry', order: 2 },
          { id: 'f15', text: 'Weekly computer-based Sunday tests matching real exam format', order: 3 },
          { id: 'f16', text: 'Direct mentorship and error analysis sessions by Ankit Sir', order: 4 },
        ],
      },
      {
        id: 'batch-x',
        slug: 'class-10-board-topper',
        name: 'Board Topper Batch',
        card_key: 'school',
        academic_class_name: 'Class 10',
        tagline: 'Target 100/100 in CBSE Board exams with Kota problem methodology.',
        description: 'Comprehensive Class 10 Board exam perfection with 10 years chapter-wise solved papers, marking scheme strategies, and early JEE transition.',
        image: '/images/books/cbse-10-pyq-mathematics.jpg',
        price: 3000,
        display_order: 5,
        items: [
          { id: '21', item_type: 'SP', title: 'Study Package & Practice Problems', price: 1000, is_addon: false },
          { id: '22', item_type: 'PYQ', title: '10 Years Chapter-wise Solved Board Archive', price: 500, is_addon: false },
          { id: '23', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & NTSE Aptitude', price: 500, is_addon: false },
          { id: '24', item_type: 'OLYMPIAD', title: 'Olympiad Mastery Drills', price: 800, is_addon: false },
          { id: '25', item_type: 'TEST_SERIES', title: 'Board Pattern Mock Test Series', price: 500, is_addon: false },
        ],
        features: [
          { id: 'f17', text: '100% Board exam perfection with official CBSE marking scheme', order: 1 },
          { id: 'f18', text: '10+ years solved previous question archive with step points', order: 2 },
          { id: 'f19', text: 'High-frequency recurring question trend analysis & common mistakes', order: 3 },
          { id: 'f20', text: 'Pre-board marathons and timed writing speed practice drills', order: 4 },
        ],
      },
    ],
    features: [
      { id: 'f21', text: '4 live interactive sessions per week with two-way audio and chat', order: 1 },
      { id: 'f22', text: 'Chapter-wise DPP sheets with full step-by-step video solutions', order: 2 },
      { id: 'f23', text: 'Weekly All-India Sunday Mock Test with percentile analysis', order: 3 },
      { id: 'f24', text: 'Direct WhatsApp Academic Desk access (+91 93825 57693)', order: 4 },
    ],
  },
  {
    id: 'senior',
    key: 'senior',
    title: 'Class XI & XII, JEE + Board',
    tagline: 'Evening live classes designed to fit harmoniously around school hours, building foundational theory to JEE Advanced mastery.',
    badge: 'Most Popular · School Friendly',
    rotate_seconds: 5,
    cta_label: 'Get Fee Details on WhatsApp',
    cta_url: 'https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Class%2011%2F12%20Live%20batch',
    order: 2,
    batches: [
      {
        id: 'batch-xi',
        slug: 'class-11-jee-foundation',
        name: 'JEE Foundation Batch (Class 11)',
        card_key: 'senior',
        academic_class_name: 'Class 11',
        tagline: 'Evening live classes building foundational theory to JEE Advanced mastery.',
        description: 'Comprehensive Class 11 batch designed to fit harmoniously around school hours.',
        image: '/images/ankit-sir.jpg',
        price: 5500,
        display_order: 1,
        items: [],
        features: [],
      },
      {
        id: 'batch-xii',
        slug: 'class-12-jee-advanced',
        name: 'JEE Mains + Advanced Batch (Class 12)',
        card_key: 'senior',
        academic_class_name: 'Class 12',
        tagline: 'Syllabus completion by October followed by 4 months of intensive mock drills.',
        description: 'Full syllabus mastery for Board 95%+ and JEE Advanced top rank.',
        image: '/images/ankit-sir.jpg',
        price: 5500,
        display_order: 2,
        items: [],
        features: [],
      },
    ],
    features: [
      { id: 'sf1', text: 'Mon–Sat, 6:30–8:30 pm evening live classes designed for school goers', order: 1 },
      { id: 'sf2', text: 'Comprehensive coverage from basic NCERT concepts to JEE Advanced', order: 2 },
      { id: 'sf3', text: 'Curated Daily Practice Problems (DPP) with complete step solutions', order: 3 },
      { id: 'sf4', text: 'Weekly All-India Sunday Mock Test with percentile analysis', order: 4 },
      { id: 'sf5', text: 'Full HD video recordings uploaded within 2 hours of every class', order: 5 },
    ],
  },
  {
    id: 'dropper',
    key: 'dropper',
    title: 'Dropper Immersion',
    tagline: 'A rigorous morning schedule for dedicated aspirants giving their entire undivided focus to secure an elite All-India Rank.',
    badge: 'Full-Year Accelerator',
    rotate_seconds: 5,
    cta_label: 'Get Fee Details on WhatsApp',
    cta_url: 'https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Dropper%20live%20batch',
    order: 3,
    batches: [
      {
        id: 'batch-dropper',
        slug: 'dropper-immersion',
        name: 'Dropper Immersion (Entire XI + XII)',
        card_key: 'dropper',
        academic_class_name: 'Dropper',
        tagline: 'Complete XI + XII Intensive Curriculum with 20 Years of Solved PYQs.',
        description: 'The definitive full-year accelerator for droppers determined to secure an elite All-India Rank.',
        image: '/images/ankit-sir-thumbsup.jpg',
        price: 9999,
        display_order: 1,
        items: [],
        features: [],
      },
    ],
    features: [
      { id: 'df1', text: 'Mon–Sat, 9:00 am–12:00 noon (18 hours of weekly live instruction)', order: 1 },
      { id: 'df2', text: 'Intensive dissection of the last 20 years of JEE Advanced PYQs', order: 2 },
      { id: 'df3', text: 'Special focus on high-weightage Calculus, Coordinate Geometry & Algebra', order: 3 },
      { id: 'df4', text: 'Personalized performance feedback and test error analysis by Ankit Sir', order: 4 },
      { id: 'df5', text: 'Priority WhatsApp doubt resolution desk (+91 93825 57693)', order: 5 },
    ],
  },
];

export function BatchesSection() {
  const [cards, setCards] = useState<PricingCardData[]>(DEFAULT_PRICING_CARDS);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(4); // Default to Class 10
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/pricing/cards/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PricingCardData[] | null) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCards(data);
        }
      })
      .catch((err) => {
        console.warn('Using seeded default pricing cards on landing page:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const schoolCard = cards.find((c) => c.key === 'school') || DEFAULT_PRICING_CARDS[0];
  const seniorCard = cards.find((c) => c.key === 'senior') || DEFAULT_PRICING_CARDS[1];
  const dropperCard = cards.find((c) => c.key === 'dropper') || DEFAULT_PRICING_CARDS[2];

  const schoolBatches = schoolCard?.batches?.length ? schoolCard.batches : DEFAULT_PRICING_CARDS[0].batches;
  const schoolCount = schoolBatches.length;
  const rotateSeconds = schoolCard?.rotate_seconds || 5;

  // Auto-advance school carousel
  useEffect(() => {
    if (schoolCount <= 1 || isPaused) return;

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

  const scrollToSchoolBatches = (index?: number) => {
    if (typeof index === 'number') {
      setSelectedClassIndex(index);
    }
    const el = document.getElementById('school-batches');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const activeSchoolBatch = schoolBatches[carouselIndex] || schoolBatches[0];
  const selectedBatchDetail = schoolBatches[selectedClassIndex] || schoolBatches[0];

  return (
    <section className="landing-section batches-section" id="batches" aria-label="Curated Batches">
      <div className="landing-wrap">
        <div className="section-tag center">Curated Programs</div>
        <h2>Choose Your Learning Pathway</h2>
        <p className="section-subtitle">
          Every batch rigorously prepares you for school exams and JEE Mains, with intense Advanced problem-solving for students determined to earn seats at the top IITs. Full class recordings always included.
        </p>

        {/* 3 Main Pathway Cards */}
        <div className="batches-grid mt-6">
          {/* =================================================================
              CARD 1 (LEFT): SCHOOL BATCHES (CLASS VI - X)
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
                    className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg group focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    tabIndex={0}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="Class VI to X Batches Carousel"
                    onClick={() => scrollToSchoolBatches(carouselIndex)}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselIndex(idx);
                            }}
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

                {/* Point-wise list of the 5 batch names (VI..X) scrolling smoothly on front page */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Included Foundation Batches:
                  </span>
                  <ul className="space-y-1 text-xs">
                    {schoolBatches.map((b, idx) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => scrollToSchoolBatches(idx)}
                          className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-amber-300 transition-colors group text-left cursor-pointer"
                        >
                          <span className="font-semibold">
                            {getRomanClass(b.academic_class_name)}: {b.name}
                          </span>
                          <span className="text-amber-400/90 font-bold flex items-center gap-1">
                            ₹{Number(b.price).toLocaleString('en-IN')}
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </button>
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

              {/* Card Footer CTA - Smooth scroll down to Class 6-10 breakdown on front page */}
              <div className="batch-footer mt-6">
                <button
                  type="button"
                  onClick={() => scrollToSchoolBatches()}
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>View all Class VI-X batches</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              CARD 2 (MIDDLE): CLASS 11 & 12 (SENIOR)
              ================================================================= */}
          {seniorCard && (
            <div className="batch-card featured flex flex-col justify-between">
              <div>
                {seniorCard.badge && <div className="batch-badge">{seniorCard.badge}</div>}
                <div className="batch-type">Live Comprehensive Batch</div>
                <h3>{seniorCard.title}</h3>
                <p className="batch-desc">{seniorCard.tagline}</p>

                {/* Schedule Chip */}
                <div className="batch-schedule-chip mt-4">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="schedule-text-group">
                    <span className="schedule-sub">Live Class Timing</span>
                    <span className="schedule-main">Mon–Sat, 6:30–8:30 pm</span>
                  </div>
                </div>

                {/* Fixed Image */}
                <div className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg aspect-[16/10]">
                  <Image
                    src={seniorCard.batches?.[0]?.image || '/images/ankit-sir.jpg'}
                    alt="Class 11 and 12 Batch"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white drop-shadow">Class 11 &amp; 12 Live Masterclass</span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-md">
                      ₹5,500
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="batch-features mt-5 pt-4 border-t border-white/10">
                  {(seniorCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6 space-y-2">
                <a
                  href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Class%2011%2F12%20Live%20batch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-gold w-full text-center flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Get Fee Details on WhatsApp</span>
                </a>
                <a
                  href="https://www.youtube.com/@adepteduverse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Watch Class 11/12 Demo</span>
                </a>
              </div>
            </div>
          )}

          {/* =================================================================
              CARD 3 (RIGHT): DROPPER IMMERSION
              ================================================================= */}
          {dropperCard && (
            <div className="batch-card flex flex-col justify-between">
              <div>
                {dropperCard.badge && <div className="batch-badge">{dropperCard.badge}</div>}
                <div className="batch-type">Full-Year Accelerator</div>
                <h3>{dropperCard.title}</h3>
                <p className="batch-desc">{dropperCard.tagline}</p>

                {/* Schedule Chip */}
                <div className="batch-schedule-chip mt-4">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="schedule-text-group">
                    <span className="schedule-sub">Live Class Timing</span>
                    <span className="schedule-main">Mon–Sat, 9:00 am–12:00 noon</span>
                  </div>
                </div>

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
                      ₹9,999
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="batch-features mt-5 pt-4 border-t border-white/10">
                  {(dropperCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6 space-y-2">
                <a
                  href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Dropper%20live%20batch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Get Fee Details on WhatsApp</span>
                </a>
                <a
                  href="https://www.youtube.com/@adepteduverse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Watch Dropper Demo</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================================
             DEDICATED CLASS VI TO X BREAKDOWN SECTION (Right on Front Page)
             ==================================================================== */}
        <div id="school-batches" className="mt-20 pt-16 border-t border-slate-800/80">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Complete Class VI to X Curriculum Breakdown
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Foundation Batches for Class 6, 7, 8, 9 &amp; 10
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Every class is structured with Kota coaching rigor by <strong>IIT Kharagpur Alumnus Ankit Sir</strong>. Select any class below to see all included modules, practice papers, and fee details.
            </p>

            {/* Class Selector Tabs */}
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              {schoolBatches.map((b, idx) => {
                const isSelected = idx === selectedClassIndex;
                const roman = getRomanClass(b.academic_class_name);
                return (
                  <button
                    key={b.id || idx}
                    type="button"
                    onClick={() => setSelectedClassIndex(idx)}
                    className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20 scale-105'
                        : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>{roman}</span>
                    <span className="text-[11px] opacity-80 font-normal">
                      (₹{Number(b.price).toLocaleString('en-IN')})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Class Highlight Panel */}
          {selectedBatchDetail && (
            <div className="rounded-3xl bg-[#0B1120] border border-amber-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-10">
                {/* Left 2 Cols: Details & Included Curriculum Items */}
                <div className="lg:col-span-2 space-y-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow">
                        {getRomanClass(selectedBatchDetail.academic_class_name)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        Foundation &amp; Olympiad Series
                      </span>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                      {selectedBatchDetail.name}
                    </h4>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {selectedBatchDetail.description || selectedBatchDetail.tagline}
                    </p>
                  </div>

                  {/* Included Subject Materials Breakdown */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-3">
                      <Layers className="w-4 h-4" />
                      <span>Included Curriculum Modules &amp; Study Materials</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(selectedBatchDetail.items && selectedBatchDetail.items.length > 0
                        ? selectedBatchDetail.items
                        : [
                            { id: '1', title: 'Comprehensive Study Package', price: 500 },
                            { id: '2', title: 'Chapter-wise Solved Question Bank', price: 300 },
                            { id: '3', title: 'Mental Ability & Logical Reasoning', price: 400 },
                            { id: '4', title: 'Olympiad Foundation Drills', price: 500 },
                            { id: '5', title: 'Weekly Assessment Mock Test Series', price: 300 },
                          ]
                      ).map((item, i) => (
                        <div
                          key={item.id || i}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 text-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-medium">{item.title}</span>
                          </div>
                          <span className="text-slate-400 font-bold ml-2">₹{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Batch Features */}
                  <div className="pt-2">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      {(selectedBatchDetail.features && selectedBatchDetail.features.length > 0
                        ? selectedBatchDetail.features
                        : [
                            { id: '1', text: '4 live interactive sessions per week by Kota veteran faculty' },
                            { id: '2', text: 'School textbook mastery + Olympiad foundation problem solving' },
                            { id: '3', text: 'Full HD video recordings uploaded within 2 hours' },
                            { id: '4', text: 'Direct WhatsApp Academic Desk for doubts (+91 93825 57693)' },
                          ]
                      ).map((feat, idx) => (
                        <li key={feat.id || idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span>{feat.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Col: Price Box & Direct Enrollment */}
                <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-6 space-y-5 text-center flex flex-col justify-between h-full">
                  <div>
                    <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                      Total All-Inclusive Course Fee
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-amber-400 mt-2">
                      ₹{Number(selectedBatchDetail.price).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Complete Annual Academic Program
                    </div>

                    <div className="mt-5 p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-left space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Mon–Sat Evening Live Sessions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Video className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>24/7 HD Recorded Class Access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Personal Doubt Clearing by Ankit Sir</span>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Direct Enrollment */}
                  <div className="space-y-2.5 pt-4">
                    <a
                      href={`https://wa.me/919382557693?text=Hi%2C%20I%20want%20to%20enroll%20in%20the%20${encodeURIComponent(
                        getRomanClass(selectedBatchDetail.academic_class_name) + ' ' + selectedBatchDetail.name
                      )}%20(Fee%3A%20₹${selectedBatchDetail.price})`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-btn btn-gold w-full text-center flex items-center justify-center gap-2 py-3"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Enroll on WhatsApp</span>
                    </a>
                    <a
                      href="https://www.youtube.com/@adepteduverse"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Watch Free Demo Class</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick All-5-Classes Summary Grid for Parents */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {schoolBatches.map((b, idx) => {
              const isSelected = idx === selectedClassIndex;
              return (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => setSelectedClassIndex(idx)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-400/10 border-amber-400/60 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-[10px] font-black uppercase text-amber-400">
                      {getRomanClass(b.academic_class_name)}
                    </div>
                    <div className="text-xs font-bold text-white mt-1 line-clamp-1">{b.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{b.tagline}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-amber-300">
                      ₹{Number(b.price).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-0.5">
                      Details →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
