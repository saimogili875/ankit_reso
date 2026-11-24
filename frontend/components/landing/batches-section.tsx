'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  BookOpen,
  Check,
  HelpCircle,
  Plus
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-client';

export interface BatchItemData {
  id: string;
  item_type: string;
  title: string;
  price: string | number;
  is_addon: boolean;
}

export interface FeatureData {
  id: string;
  text: string;
  order: number;
}

export interface BatchData {
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
  has_live_classes?: boolean;
  display_order: number;
  items: BatchItemData[];
  features: FeatureData[];
}

export interface PricingCardData {
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

const ORDERED_ROMAN_CLASSES = ['VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function getRomanClass(className?: string): string {
  if (!className) return '';
  const num = className.replace(/\D/g, '');
  return ROMAN_NUMERALS[num] ? `Class ${ROMAN_NUMERALS[num]}` : className;
}

function getRomanOnly(className?: string): string {
  if (!className) return '';
  const num = className.replace(/\D/g, '');
  return ROMAN_NUMERALS[num] || className;
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
    cta_url: '#class-selector',
    order: 1,
    batches: [
      {
        id: 'batch-vi',
        slug: 'foundation-star-class-6',
        name: 'Foundation Star Batch',
        card_key: 'school',
        academic_class_name: 'Class 6',
        tagline: 'Math & Science fundamentals with Olympiad aptitude primer.',
        description: 'Comprehensive year-long foundation program for Class 6 students focusing on conceptual clarity, speed calculations, and analytical thinking.',
        image: '/images/ankit/ankit-hero.webp',
        price: 2000,
        original_price: 4000,
        has_live_classes: false,
        display_order: 1,
        items: [
          { id: '1', item_type: 'SP', title: 'Subject Practice Sheets (SP)', price: 500, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'Previous Years Solved Questions (PYQ)', price: 300, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Reasoning Module', price: 400, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'Junior Olympiad Prep Pack', price: 500, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'Chapterwise Foundation Test Series', price: 300, is_addon: false },
          { id: '6', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Class 10th Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Self-paced access 24/7 on web and mobile app', order: 1 },
          { id: '2', text: 'School textbook mastery plus early Olympiad problem drills', order: 2 },
          { id: '3', text: 'Step-by-step verified solutions for every exercise', order: 3 },
          { id: '4', text: 'Direct WhatsApp doubt resolution desk (+91 93825 57693)', order: 4 },
        ],
      },
      {
        id: 'batch-vii',
        slug: 'foundation-plus-class-7',
        name: 'Foundation Plus Batch',
        card_key: 'school',
        academic_class_name: 'Class 7',
        tagline: 'Step-up conceptual problem solving for Class 7 mathematics.',
        description: 'Builds analytical intuition for higher secondary mathematics and science with guided proofs and competitive drills.',
        image: '/images/ankit/ankit-headshot.webp',
        price: 2000,
        original_price: 4000,
        has_live_classes: false,
        display_order: 2,
        items: [
          { id: '1', item_type: 'SP', title: 'Subject Practice Sheets (SP)', price: 500, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'Previous Years Solved Questions (PYQ)', price: 300, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Logical Reasoning Module', price: 400, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'Junior Olympiad Prep Pack', price: 500, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'Chapterwise Foundation Test Series', price: 300, is_addon: false },
          { id: '6', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Class 10th Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Complete conceptual coverage of Class 7 curriculum', order: 1 },
          { id: '2', text: 'Step-by-step solutions for every practice problem', order: 2 },
          { id: '3', text: '24/7 high-definition video lecture vault', order: 3 },
          { id: '4', text: 'WhatsApp doubt desk support directly by academic team', order: 4 },
        ],
      },
      {
        id: 'batch-viii',
        slug: 'olympiad-ready-class-8',
        name: 'Olympiad Ready Batch',
        card_key: 'school',
        academic_class_name: 'Class 8',
        tagline: 'Class 8 Foundation, IOQM & NMTC Olympiad Edge.',
        description: 'Pre-JEE foundation focusing on algebra, geometry theorems, number theory, and mental ability competitions.',
        image: '/images/ankit/ankit-hero.webp',
        price: 3000,
        original_price: 6000,
        has_live_classes: false,
        display_order: 3,
        items: [
          { id: '1', item_type: 'SP', title: 'Subject Practice Sheets (SP)', price: 500, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'Previous Years Solved Questions (PYQ)', price: 500, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'Mental Ability & Advanced Reasoning', price: 500, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'IOQM / NMTC Olympiad Training Material', price: 800, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'All-India Junior Mock Test Series', price: 500, is_addon: false },
          { id: '6', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Class 10th Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Pre-JEE foundational algebra and Euclidean geometry', order: 1 },
          { id: '2', text: 'IOQM and junior mathematics olympiad question patterns', order: 2 },
          { id: '3', text: 'Solutions for every paper with analytical insights', order: 3 },
          { id: '4', text: 'Direct WhatsApp doubt resolution desk (+91 93825 57693)', order: 4 },
        ],
      },
      {
        id: 'batch-ix',
        slug: 'board-booster-class-9',
        name: 'Board Booster Batch',
        card_key: 'school',
        academic_class_name: 'Class 9',
        tagline: 'Class 9 CBSE Board Mastery + Early JEE Foundation.',
        description: 'Covers the critical transition year. Deep mastery of coordinate geometry, polynomials, and mathematical proofs.',
        image: '/images/ankit/ankit-headshot.webp',
        price: 3000,
        original_price: 6000,
        has_live_classes: false,
        display_order: 4,
        items: [
          { id: '1', item_type: 'SP', title: 'Subject Practice & Problem Practice (SP + PP)', price: 1000, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'CBSE 10-Year Solved PYQs', price: 500, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'Aptitude & Mental Ability Module', price: 500, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'Olympiad Stage-1 Prep Pack', price: 800, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'Full Syllabus Board Mock Tests', price: 500, is_addon: false },
          { id: '6', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Class 10th Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Exhaustive CBSE Class 9 syllabus coverage with proofs', order: 1 },
          { id: '2', text: 'Olympiad & competitive foundation question banks', order: 2 },
          { id: '3', text: 'Self-paced access 24/7 on mobile and desktop', order: 3 },
          { id: '4', text: 'Doubt support on WhatsApp with step-by-step guidance', order: 4 },
        ],
      },
      {
        id: 'batch-x',
        slug: 'board-topper-class-10',
        name: 'Board Topper Batch',
        card_key: 'school',
        academic_class_name: 'Class 10',
        tagline: 'Class 10 CBSE 100/100 Target + JEE Foundation Bridge.',
        description: 'Complete board preparation with chapterwise question bank, 10 years of solved CBSE PYQs, and bridging into Class 11 concepts.',
        image: '/images/ankit/ankit-thumbsup.webp',
        price: 3000,
        original_price: 6000,
        has_live_classes: false,
        display_order: 5,
        items: [
          { id: '1', item_type: 'SP', title: 'Subject Practice & Problem Practice (SP + PP)', price: 1000, is_addon: false },
          { id: '2', item_type: 'PYQ', title: 'CBSE Board 10-Year Solved Papers (PYQ)', price: 500, is_addon: false },
          { id: '3', item_type: 'MENTAL_ABILITY', title: 'NTSE / Aptitude Reasoning Module', price: 500, is_addon: false },
          { id: '4', item_type: 'OLYMPIAD', title: 'Olympiad & Advanced Problem Set', price: 800, is_addon: false },
          { id: '5', item_type: 'TEST_SERIES', title: 'Board Pre-Board Simulated Test Series', price: 500, is_addon: false },
          { id: '6', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Class 10th Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Complete CBSE Class 10 Board exam syllabus with marking scheme', order: 1 },
          { id: '2', text: 'Chapter-wise solved past 10 years board questions', order: 2 },
          { id: '3', text: 'Solutions for every paper and practice worksheet', order: 3 },
          { id: '4', text: 'Direct WhatsApp Academic Desk for doubts (+91 93825 57693)', order: 4 },
        ],
      },
    ],
    features: [
      { id: 'f1', text: 'Comprehensive self-paced video lectures covering NCERT & Olympiads', order: 1 },
      { id: 'f2', text: 'Curated Daily Practice Problems (DPP) with complete step solutions', order: 2 },
      { id: 'f3', text: 'Chapterwise foundation mock tests with solution keys', order: 3 },
      { id: 'f4', text: 'Dedicated mental ability & logical reasoning problem modules', order: 4 },
      { id: 'f5', text: 'Doubt support on WhatsApp directly with academic team', order: 5 },
    ],
  },
  {
    id: 'senior',
    key: 'senior',
    title: 'Class XI & XII, JEE + Board',
    tagline: 'Foundational theory escalating to JEE Advanced multi-concept problem solving.',
    badge: 'JEE Main & Advanced',
    rotate_seconds: 5,
    cta_label: 'Explore Class 11 & 12 Batches',
    cta_url: '#class-selector',
    order: 2,
    batches: [
      {
        id: 'batch-xi',
        slug: 'jee-foundation-class-11',
        name: 'JEE Foundation Batch (Class 11)',
        card_key: 'senior',
        academic_class_name: 'Class 11',
        tagline: 'Class 11 Comprehensive: Basic NCERT to JEE Advanced Mastery.',
        description: 'Master Class 11 mathematics from vectors and trigonometry to calculus foundations with 24/7 lecture vault access.',
        image: '/images/ankit/ankit-hero.webp',
        price: 5500,
        original_price: 12000,
        has_live_classes: false,
        display_order: 1,
        items: [
          { id: '1', item_type: 'MODULE', title: 'Complete Class 11 Comprehensive Modules', price: 3000, is_addon: false },
          { id: '2', item_type: 'JEE_MAINS_TEST', title: 'JEE Mains Regular Test Series', price: 500, is_addon: false },
          { id: '3', item_type: 'JEE_ADVANCED_TEST', title: 'JEE Advanced Multi-Concept Test Series', price: 500, is_addon: false },
          { id: '4', item_type: 'SHORT_NOTES', title: 'Formula Cheat Sheets & Short Notes', price: 500, is_addon: false },
          { id: '5', item_type: 'OLYMPIAD', title: 'Senior Olympiad & Higher Math Drills', price: 1000, is_addon: false },
          { id: '6', item_type: 'TEST_SERIES', title: 'All-India Sunday Mock Tests', price: 500, is_addon: false },
          { id: '7', item_type: 'COACHING_TEST_SERIES', title: 'National Coaching Mock Series', price: 600, is_addon: false },
          { id: '8', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Self-paced access 24/7 with full-year validity', order: 1 },
          { id: '2', text: 'Comprehensive coverage from basic NCERT concepts to JEE Advanced', order: 2 },
          { id: '3', text: 'Solutions for every paper, DPP, and assignment sheet', order: 3 },
          { id: '4', text: 'Dedicated WhatsApp Academic Desk for doubts (+91 93825 57693)', order: 4 },
        ],
      },
      {
        id: 'batch-xii',
        slug: 'jee-mains-advanced-class-12',
        name: 'JEE Mains + Advanced Batch (Class 12)',
        card_key: 'senior',
        academic_class_name: 'Class 12',
        tagline: 'Class 12 Comprehensive + Complete XI Revision.',
        description: 'Rigorous Class 12 syllabus plus revision drills, high-weightage topics, and full-length JEE mock series.',
        image: '/images/ankit/ankit-teacher.webp',
        price: 5500,
        original_price: 12000,
        has_live_classes: false,
        display_order: 2,
        items: [
          { id: '1', item_type: 'MODULE', title: 'Complete Class 12 Modules + 11th Revision', price: 3000, is_addon: false },
          { id: '2', item_type: 'JEE_MAINS_TEST', title: 'JEE Mains Full Mock Papers', price: 500, is_addon: false },
          { id: '3', item_type: 'JEE_ADVANCED_TEST', title: 'JEE Advanced High-Weightage Tests', price: 500, is_addon: false },
          { id: '4', item_type: 'SHORT_NOTES', title: 'Quick-Revision Handwritten Notes', price: 500, is_addon: false },
          { id: '5', item_type: 'OLYMPIAD', title: 'Olympiad & Challenging Problem Sessions', price: 1000, is_addon: false },
          { id: '6', item_type: 'TEST_SERIES', title: 'Weekly All-India Test Series with Analysis', price: 500, is_addon: false },
          { id: '7', item_type: 'COACHING_TEST_SERIES', title: 'National Mock Test Series', price: 600, is_addon: false },
          { id: '8', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Full Class 12 Board + JEE Advanced syllabus and revision', order: 1 },
          { id: '2', text: 'Over 20+ years of chapterwise JEE Advanced solved archives', order: 2 },
          { id: '3', text: 'Solutions for every paper and weekly mock examination', order: 3 },
          { id: '4', text: 'Direct WhatsApp doubt resolution desk (+91 93825 57693)', order: 4 },
        ],
      },
    ],
    features: [
      { id: 'sf1', text: 'Comprehensive coverage from basic NCERT concepts to JEE Advanced', order: 1 },
      { id: 'sf2', text: 'Curated Daily Practice Problems (DPP) with complete step solutions', order: 2 },
      { id: 'sf3', text: 'Solutions for every paper and regular mock tests', order: 3 },
      { id: 'sf4', text: 'Self-paced access 24/7 on web and mobile devices', order: 4 },
      { id: 'sf5', text: 'Direct WhatsApp doubt resolution desk (+91 93825 57693)', order: 5 },
    ],
  },
  {
    id: 'dropper',
    key: 'dropper',
    title: 'Dropper Immersion',
    tagline: 'Intensive full-year accelerator for dedicated aspirants targeting elite ranks.',
    badge: 'Full-Year Accelerator',
    rotate_seconds: 5,
    cta_label: 'Get Fee Details on WhatsApp',
    cta_url: 'https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Dropper%20batch',
    order: 3,
    batches: [
      {
        id: 'batch-dropper',
        slug: 'dropper-immersion',
        name: 'Dropper Immersion (Entire XI + XII)',
        card_key: 'dropper',
        academic_class_name: 'Dropper',
        tagline: 'Complete XI + XII Intensive Curriculum with 20 Years of Solved PYQs.',
        description: 'The definitive full-year accelerator for droppers determined to secure an elite rank in JEE Advanced.',
        image: '/images/ankit/ankit-thumbsup.webp',
        price: 9999,
        original_price: 20000,
        has_live_classes: false,
        display_order: 1,
        items: [
          { id: '1', item_type: 'MODULE', title: 'Complete XI & XII Comprehensive Masterclass', price: 5000, is_addon: false },
          { id: '2', item_type: 'PYQ', title: '20-Year JEE Advanced Solved Papers', price: 1500, is_addon: false },
          { id: '3', item_type: 'JEE_ADVANCED_TEST', title: 'Elite JEE Advanced Test Series', price: 1500, is_addon: false },
          { id: '4', item_type: 'SHORT_NOTES', title: 'Formulas & Rapid Revision Mindmaps', price: 1000, is_addon: false },
          { id: '5', item_type: 'ADVANCED_BOOK_DIGITAL', title: 'Digital Advanced Problem Book', price: 299, is_addon: true },
        ],
        features: [
          { id: '1', text: 'Complete XI & XII syllabus dissection from first principles', order: 1 },
          { id: '2', text: 'Intensive dissection of the last 20 years of JEE Advanced PYQs', order: 2 },
          { id: '3', text: 'Solutions for every paper and full-length simulated test', order: 3 },
          { id: '4', text: 'Priority WhatsApp doubt resolution desk (+91 93825 57693)', order: 4 },
        ],
      },
    ],
    features: [
      { id: 'df1', text: 'Intensive dissection of the last 20 years of JEE Advanced PYQs', order: 1 },
      { id: 'df2', text: 'Special focus on high-weightage Calculus, Coordinate Geometry & Algebra', order: 2 },
      { id: 'df3', text: 'Personalized performance feedback and error analysis by Ankit Sir', order: 3 },
      { id: 'df4', text: 'Self-paced access 24/7 plus WhatsApp doubt desk', order: 4 },
      { id: 'df5', text: 'Priority WhatsApp doubt resolution desk (+91 93825 57693)', order: 5 },
    ],
  },
];

export function BatchesSection() {
  const [cards, setCards] = useState<PricingCardData[]>(DEFAULT_PRICING_CARDS);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedRoman, setSelectedRoman] = useState<string>('X'); // Default to Class X
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Read ?class= query param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const classParam = params.get('class')?.toUpperCase();
      if (classParam && ORDERED_ROMAN_CLASSES.includes(classParam)) {
        setSelectedRoman(classParam);
      }
    }
  }, []);

  // Fetch dynamic cards from Django API
  useEffect(() => {
    let isMounted = true;
    fetch(buildApiUrl('/api/pricing/cards/'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PricingCardData[] | null) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCards(data);
        }
      })
      .catch(() => {
        // Fall back cleanly to seeded defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const schoolCard = cards.find((c) => c.key === 'school') || DEFAULT_PRICING_CARDS[0];
  const seniorCard = cards.find((c) => c.key === 'senior') || DEFAULT_PRICING_CARDS[1];
  const dropperCard = cards.find((c) => c.key === 'dropper') || DEFAULT_PRICING_CARDS[2];

  const schoolBatches = schoolCard?.batches?.length ? schoolCard.batches : DEFAULT_PRICING_CARDS[0].batches;
  const seniorBatches = seniorCard?.batches?.length ? seniorCard.batches : DEFAULT_PRICING_CARDS[1].batches;

  // Compile unified 7-class batches map: 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  const allBatchesMap: Record<string, BatchData> = {};
  
  // Map school batches (6-10)
  schoolBatches.forEach((b) => {
    const roman = getRomanOnly(b.academic_class_name);
    if (roman) allBatchesMap[roman] = b;
  });

  // Map senior batches (11-12)
  seniorBatches.forEach((b) => {
    const roman = getRomanOnly(b.academic_class_name);
    if (roman) allBatchesMap[roman] = b;
  });

  // Fallback map if any class is missing from API
  DEFAULT_PRICING_CARDS[0].batches.forEach((b) => {
    const roman = getRomanOnly(b.academic_class_name);
    if (roman && !allBatchesMap[roman]) allBatchesMap[roman] = b;
  });
  DEFAULT_PRICING_CARDS[1].batches.forEach((b) => {
    const roman = getRomanOnly(b.academic_class_name);
    if (roman && !allBatchesMap[roman]) allBatchesMap[roman] = b;
  });

  const currentBatch = allBatchesMap[selectedRoman] || allBatchesMap['X'];

  // Handle Tab Selection with URL sync
  const handleSelectTab = (roman: string) => {
    setSelectedRoman(roman);
    setSelectedAddons({});
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('class', roman);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Keyboard navigation for tablist
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = (index + 1) % ORDERED_ROMAN_CLASSES.length;
      handleSelectTab(ORDERED_ROMAN_CLASSES[nextIdx]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = (index - 1 + ORDERED_ROMAN_CLASSES.length) % ORDERED_ROMAN_CLASSES.length;
      handleSelectTab(ORDERED_ROMAN_CLASSES[prevIdx]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleSelectTab(ORDERED_ROMAN_CLASSES[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleSelectTab(ORDERED_ROMAN_CLASSES[ORDERED_ROMAN_CLASSES.length - 1]);
    }
  };

  // Auto-advance school carousel
  const schoolCount = schoolBatches.length;
  const rotateSeconds = schoolCard?.rotate_seconds || 5;

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

  const scrollToClassSelector = (romanTarget?: string) => {
    if (romanTarget) {
      handleSelectTab(romanTarget);
    }
    const el = document.getElementById('class-selector');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const activeSchoolBatch = schoolBatches[carouselIndex] || schoolBatches[0];

  // Financial calculations
  const rawBasePrice = Number(currentBatch?.price) || 0;
  const rawOriginalPrice = currentBatch?.original_price ? Number(currentBatch.original_price) : null;
  
  const includedItems = (currentBatch?.items || []).filter((item) => !item.is_addon);
  const addonItems = (currentBatch?.items || []).filter((item) => item.is_addon);

  const includedItemsTotalValue = includedItems.reduce((acc, i) => acc + (Number(i.price) || 0), 0);
  const trueSavings = includedItemsTotalValue > rawBasePrice ? includedItemsTotalValue - rawBasePrice : 0;

  // Add-on calculations
  const activeAddonsCost = addonItems.reduce((acc, item) => {
    if (selectedAddons[item.id]) {
      return acc + (Number(item.price) || 0);
    }
    return acc;
  }, 0);

  const finalTotalPrice = rawBasePrice + activeAddonsCost;

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) => ({
      ...prev,
      [addonId]: !prev[addonId],
    }));
  };

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
                    onClick={() => {
                      const roman = getRomanOnly(activeSchoolBatch.academic_class_name);
                      scrollToClassSelector(roman);
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="relative aspect-[16/10] w-full bg-slate-900">
                      <Image
                        src={activeSchoolBatch.image || '/images/ankit/ankit-hero.webp'}
                        alt={activeSchoolBatch.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />

                      {/* Top Overlay Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-amber-400/40 text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{getRomanClass(activeSchoolBatch.academic_class_name)}</span>
                      </div>

                      {/* Bottom Info Banner */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-extrabold text-white drop-shadow">
                            {activeSchoolBatch.name}
                          </div>
                          <div className="text-[11px] text-slate-300 line-clamp-1">
                            {activeSchoolBatch.tagline}
                          </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-md shrink-0 ml-2">
                          ₹{Number(activeSchoolBatch.price).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Carousel Navigation Arrows */}
                    <button
                      type="button"
                      aria-label="Previous Batch"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next Batch"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Dot Indicators */}
                    <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center gap-1 py-1">
                      {schoolBatches.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            dotIdx === carouselIndex
                              ? 'w-4 bg-amber-400'
                              : 'w-1.5 bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Features */}
                <ul className="batch-features mt-4 pt-3 border-t border-white/10">
                  {(schoolCard.features || []).map((feat, idx) => (
                    <li key={feat.id || idx}>
                      <span className="check-icon">✓</span>
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer CTA */}
              <div className="batch-footer mt-6">
                <button
                  type="button"
                  onClick={() => scrollToClassSelector('X')}
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Select Class (VI to X)</span>
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
                <div className="batch-type">JEE Main &amp; Advanced Comprehensive</div>
                <h3>{seniorCard.title}</h3>
                <p className="batch-desc">{seniorCard.tagline}</p>

                {/* Verified Access Chip */}
                <div className="batch-schedule-chip mt-4">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="schedule-text-group">
                    <span className="schedule-sub">Access Mode</span>
                    <span className="schedule-main">Self-Paced 24/7 + WhatsApp Doubt Desk</span>
                  </div>
                </div>

                {/* Fixed Image */}
                <div className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg aspect-[16/10]">
                  <Image
                    src={seniorCard.batches?.[0]?.image || '/images/ankit/ankit-teacher.webp'}
                    alt="Class 11 and 12 Batch"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white drop-shadow">Class 11 &amp; 12 Masterclass</span>
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
                <button
                  type="button"
                  onClick={() => scrollToClassSelector('XI')}
                  className="landing-btn btn-gold w-full text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>View Class XI &amp; XII Details</span>
                </button>
                <a
                  href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Class%2011%2F12%20batch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Ask on WhatsApp</span>
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

                {/* Verified Access Chip */}
                <div className="batch-schedule-chip mt-4">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="schedule-text-group">
                    <span className="schedule-sub">Access Mode</span>
                    <span className="schedule-main">Self-Paced 24/7 + WhatsApp Doubt Desk</span>
                  </div>
                </div>

                {/* Fixed Image */}
                <div className="relative w-full rounded-2xl overflow-hidden mt-4 border border-white/10 bg-slate-950/60 shadow-lg aspect-[16/10]">
                  <Image
                    src={dropperCard.batches?.[0]?.image || '/images/ankit/ankit-thumbsup.webp'}
                    alt="Dropper Batch"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-white drop-shadow">Complete XI + XII Syllabus</span>
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
                  href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20fee%20details%20and%20enrolment%20for%20the%20Dropper%20batch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn btn-primary w-full text-center flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enroll via WhatsApp Desk</span>
                </a>
                <Link
                  href="/books"
                  className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Browse Official Books</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================================
             CLASS SELECTOR SECTION (VI TO XII SINGLE-ROW TABS + DETAILED PANEL)
             ==================================================================== */}
        <div id="class-selector" className="mt-20 pt-16 border-t border-slate-800/80">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive Class Curriculum Selector</span>
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Select Your Class: VI to XII
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Every class is structured by <strong>Ankit Kumar (B.Tech Mechanical, IIT Kharagpur, 2019)</strong>. Select your class below to see all included modules, problem banks, optional add-ons, and computed bundle savings.
            </p>

            {/* Accessible 7-Tab Bar (Single Row, Mobile Scrollable with Snap & Fade) */}
            <div className="relative mt-8">
              {/* Fade Indicator on Mobile */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#060B18] to-transparent pointer-events-none md:hidden z-10" />

              <div
                ref={tablistRef}
                role="tablist"
                aria-label="Class Selector Tabs"
                className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory px-2 py-2"
              >
                {ORDERED_ROMAN_CLASSES.map((roman, idx) => {
                  const isSelected = roman === selectedRoman;
                  const batchForClass = allBatchesMap[roman];
                  const price = batchForClass ? Number(batchForClass.price).toLocaleString('en-IN') : '2,000';

                  return (
                    <button
                      key={roman}
                      role="tab"
                      id={`tab-class-${roman}`}
                      aria-selected={isSelected}
                      aria-controls={`panel-class-${roman}`}
                      tabIndex={isSelected ? 0 : -1}
                      type="button"
                      onClick={() => handleSelectTab(roman)}
                      onKeyDown={(e) => handleTabKeyDown(e, idx)}
                      className={`px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 snap-center cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-xl shadow-amber-400/20 scale-105 ring-2 ring-amber-400/50'
                          : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>Class {roman}</span>
                      <span className={`text-[11px] font-semibold ${isSelected ? 'text-slate-900/90' : 'text-slate-400'}`}>
                        (₹{price})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Class Highlight Panel */}
          {currentBatch && (
            <div
              id={`panel-class-${selectedRoman}`}
              role="tabpanel"
              aria-labelledby={`tab-class-${selectedRoman}`}
              className="rounded-3xl bg-[#0B1120] border border-amber-500/30 p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-10">
                {/* Left 2 Cols: Details, Included Modules & Optional Addons */}
                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow">
                        Class {selectedRoman}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {selectedRoman === 'XI' || selectedRoman === 'XII'
                          ? 'JEE Main & Advanced Mastery'
                          : 'Foundation & Olympiad Series'}
                      </span>
                      {currentBatch.has_live_classes ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Live Interactive
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Self-Paced 24/7 Access
                        </span>
                      )}
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                      {currentBatch.name}
                    </h4>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {currentBatch.description || currentBatch.tagline}
                    </p>
                  </div>

                  {/* Included Subject Materials Breakdown */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center justify-between gap-1.5 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>Included Curriculum Modules ({includedItems.length} items)</span>
                      </div>
                      <span className="text-[11px] text-slate-400 lowercase font-normal">
                        Individual value: ₹{includedItemsTotalValue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {includedItems.map((item, i) => (
                        <div
                          key={item.id || i}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 text-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-semibold">{item.title}</span>
                          </div>
                          <span className="text-amber-300 font-bold ml-2 shrink-0">
                            ₹{Number(item.price).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Add-ons Section with interactive checkboxes */}
                  {addonItems.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-indigo-400" />
                          <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                            Optional Recommended Add-ons
                          </h5>
                        </div>
                        <span className="text-[11px] text-slate-400">Add to your bundle</span>
                      </div>

                      <div className="space-y-2">
                        {addonItems.map((addon) => {
                          const isChecked = Boolean(selectedAddons[addon.id]);
                          return (
                            <label
                              key={addon.id}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-indigo-950/40 border-indigo-400/60 text-white'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAddon(addon.id)}
                                  className="w-4 h-4 rounded border-slate-700 text-amber-400 focus:ring-amber-400/30 bg-slate-900"
                                />
                                <div>
                                  <span className="font-semibold block">{addon.title}</span>
                                  <span className="text-[10px] text-slate-400">
                                    Instant digital download token unlocked upon checkout
                                  </span>
                                </div>
                              </div>
                              <span className="text-amber-300 font-bold ml-3 shrink-0">
                                +₹{Number(addon.price).toLocaleString('en-IN')}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Batch Features Bullet Points */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Pedagogical Highlights &amp; Inclusions
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                      {(currentBatch.features && currentBatch.features.length > 0
                        ? currentBatch.features
                        : [
                            { id: '1', text: 'Self-paced access 24/7 on web and mobile app', order: 1 },
                            { id: '2', text: 'Solutions for every practice problem and test paper', order: 2 },
                            { id: '3', text: 'First-principles conceptual derivations and proofs', order: 3 },
                            { id: '4', text: 'Direct WhatsApp Academic Desk for doubts (+91 93825 57693)', order: 4 },
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

                {/* Right Col: Sticky Price Card & Direct Action Buttons */}
                <div className="lg:sticky lg:top-24 rounded-2xl bg-slate-950/95 border border-slate-800 p-6 space-y-6 text-center shadow-2xl flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400">
                      Complete Pack Price
                    </div>

                    <div className="flex items-baseline justify-center gap-2 mt-2">
                      <span className="text-4xl sm:text-5xl font-black text-amber-400">
                        ₹{finalTotalPrice.toLocaleString('en-IN')}
                      </span>
                      {rawOriginalPrice && (
                        <span className="text-lg text-slate-500 line-through">
                          ₹{rawOriginalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* True Computed Savings Chip (Only renders if savings > 0) */}
                    {trueSavings > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold mt-3">
                        <Check className="w-3.5 h-3.5" />
                        <span>You save ₹{trueSavings.toLocaleString('en-IN')} vs individual items!</span>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 mt-2">
                      All-Inclusive Complete Academic Year Access
                    </div>

                    {/* Trust Highlights */}
                    <div className="mt-5 p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-left space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>24/7 Self-Paced Learning Access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Full Solutions for Every Test Paper</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>WhatsApp Doubt Support Desk</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2.5 pt-2">
                    <a
                      href={`https://wa.me/919382557693?text=Hi%20Ankit%20Sir%2C%20I%20want%20to%20enroll%20in%20Class%20${selectedRoman}%20(${encodeURIComponent(
                        currentBatch.name
                      )})%20for%20₹${finalTotalPrice}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-btn btn-gold w-full text-center flex items-center justify-center gap-2 py-3"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Enroll in Class {selectedRoman} Now</span>
                    </a>
                    
                    <a
                      href={`https://wa.me/919382557693?text=Hi%2C%20I%20have%20questions%20about%20Class%20${selectedRoman}%20batch%20curriculum`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="landing-btn btn-glass btn-sm w-full text-center flex items-center justify-center gap-2"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ask Academic Desk on WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default BatchesSection;
