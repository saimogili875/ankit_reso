'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  BookOpen,
  Loader2,
  AlertCircle,
  CreditCard,
  Check,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { EnrollmentModal } from '@/components/home/enrollment-modal';
import { BookCatalogSection } from '@/components/books/BookCatalogSection';

interface CourseData {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  description?: string;
  thumbnail_url?: string;
  exam_type: string;
  price: string | number;
  original_price: string | number;
  discount_badge?: string;
  is_free: boolean;
  features?: string[];
  start_date?: string | null;
  end_date?: string | null;
  allow_self_enrollment: boolean;
  is_enrolled: boolean;
  classes?: Array<{ id: number; name: string }>;
  subjects?: Array<{ id: number; name: string }>;
}

type FilterChip = 'all' | 'books' | 'enrolled' | 'free' | 'paid';

export default function CoursesCatalogPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');

  // Enrollment modal state
  const [enrollModalTarget, setEnrollModalTarget] = useState<CourseData | null>(null);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CourseData[]>('/courses/');
      setCourses(asList<CourseData>(data));
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load courses from database.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const priceNum = Number(c.price) || 0;
      const isFree = c.is_free || priceNum === 0;

      if (activeFilter === 'enrolled') return c.is_enrolled;
      if (activeFilter === 'free') return isFree;
      if (activeFilter === 'paid') return !isFree;
      return true;
    });
  }, [courses, activeFilter]);

  const handleSelfEnroll = (course: CourseData) => {
    if (!course.allow_self_enrollment) {
      alert('This course requires direct administrator admission.');
      return;
    }
    setEnrollModalTarget(course);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-[#101828] dark:text-slate-100 flex items-center gap-2.5">
          <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-[#2B2FB8] dark:text-blue-400" />
          <span>JEE Academic Courses</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6475] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Structured JEE Main and Advanced courses crafted by expert faculty. Enroll to access live classes, curriculum modules, and computer-based mock tests.
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: 'all', label: 'All Programs' },
          { key: 'books', label: '📚 Books & Question Banks' },
          { key: 'enrolled', label: 'My Courses' },
          { key: 'free', label: 'Free Courses' },
          { key: 'paid', label: 'Paid Programs' },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setActiveFilter(chip.key as FilterChip)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 min-h-[44px] flex items-center gap-1.5 ${
              activeFilter === chip.key
                ? 'bg-[#2B2FB8] text-white shadow-md shadow-[#2B2FB8]/20'
                : 'bg-white dark:bg-slate-900 text-[#5B6475] dark:text-slate-300 border border-[#E3E7EE] dark:border-slate-800 hover:border-[#2B2FB8]'
            }`}
          >
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {feedback.message}
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs uppercase opacity-70 hover:opacity-100 min-h-[44px] px-2 flex items-center">
            Dismiss
          </button>
        </div>
      )}

      {activeFilter === 'books' ? (
        <BookCatalogSection />
      ) : (
        <>
          {activeFilter === 'all' && <BookCatalogSection />}

          {activeFilter === 'all' && (
            <div className="pt-6 pb-2 border-b border-[#E3E7EE] dark:border-slate-800">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#101828] dark:text-white tracking-tight">
                Academic Video Courses & Programs
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6475] dark:text-slate-400 mt-1">
                Full-year live immersion & recorded lecture programs for JEE preparation.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#2B2FB8]" />
              <p className="text-sm">Loading course programs...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <Card className="p-10 text-center bg-white dark:bg-slate-900 border-[#E3E7EE] dark:border-slate-800 space-y-3">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="font-heading text-base font-bold text-[#101828] dark:text-slate-200">
                {activeFilter === 'enrolled' ? 'You have no enrolled courses yet' : 'No Courses Found'}
              </h3>
              <p className="text-xs text-[#5B6475] dark:text-slate-400 max-w-sm mx-auto">
                {activeFilter === 'enrolled'
                  ? 'Select any course below to begin learning or purchase a course.'
                  : 'Faculty and administrators will publish upcoming JEE courses here.'}
              </p>
              {activeFilter !== 'all' && (
                <button
                  onClick={() => setActiveFilter('all')}
                  className="text-xs font-bold text-[#2B2FB8] dark:text-blue-400 underline pt-2"
                >
                  View all courses
                </button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {filteredCourses.map((course) => {
            const priceNum = Number(course.price) || 0;
            const originalPriceNum = Number(course.original_price) || 0;
            const isFree = course.is_free || priceNum === 0;

            return (
              <Card
                key={course.id}
                className="overflow-hidden bg-white dark:bg-slate-900/90 border-[#E3E7EE] dark:border-slate-800 flex flex-col justify-between shadow-md hover:border-[#2B2FB8] transition-all rounded-2xl"
              >
                <div>
                  {/* Thumbnail Banner */}
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-slate-800">
                    <Image
                      src={course.thumbnail_url || '/images/hero/slide-1.jpg'}
                      alt={course.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge className="bg-[#2B2FB8] text-white border-0 text-xs shadow-md">
                        {course.exam_type.replace('_', ' ')}
                      </Badge>
                      {course.discount_badge && (
                        <Badge className="bg-emerald-600 text-white border-0 text-xs shadow-md">
                          {course.discount_badge}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 sm:p-6 space-y-3">
                    <div className="space-y-1">
                      <h3 className="font-heading text-lg sm:text-xl font-bold text-[#101828] dark:text-slate-100">
                        {course.title}
                      </h3>
                      {course.subtitle && (
                        <p className="text-xs text-[#5B6475] dark:text-slate-400 font-medium">
                          {course.subtitle}
                        </p>
                      )}
                    </div>

                    {course.description && (
                      <p className="text-xs text-[#5B6475] dark:text-slate-300 leading-relaxed line-clamp-3">
                        {course.description}
                      </p>
                    )}

                    {/* Features list */}
                    {course.features && course.features.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[#E3E7EE] dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B6475] dark:text-slate-500">
                          Included in Course
                        </span>
                        <div className="space-y-1">
                          {course.features.slice(0, 3).map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-[#101828] dark:text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#2B2FB8] dark:text-blue-400 shrink-0" />
                              <span className="line-clamp-1">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {course.start_date && (
                      <div className="flex items-center gap-2 text-xs text-[#5B6475] dark:text-slate-400 font-mono pt-1">
                        <Calendar className="w-3.5 h-3.5 text-[#5B6475]" />
                        <span>Starts: {new Date(course.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Pricing & CTA */}
                <div className="p-5 sm:p-6 pt-0 border-t border-[#E3E7EE] dark:border-slate-800/80 mt-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-black text-[#101828] dark:text-white">
                      {isFree ? 'FREE' : `₹${priceNum}`}
                    </div>
                    {originalPriceNum > 0 && (
                      <div className="text-xs text-slate-400 line-through">₹{originalPriceNum}</div>
                    )}
                  </div>

                  {course.is_enrolled ? (
                    <Link
                      href="/learn"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 min-h-[44px]"
                    >
                      <Check className="w-4 h-4" />
                      <span>Open Course</span>
                    </Link>
                  ) : course.allow_self_enrollment ? (
                    <Button
                      onClick={() => handleSelfEnroll(course)}
                      className={
                        !isFree
                          ? "bg-[#2B2FB8] hover:bg-[#232799] text-white text-xs sm:text-sm font-bold gap-2 px-5 py-2.5 shadow-md shadow-[#2B2FB8]/20 min-h-[44px]"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold gap-2 px-5 py-2.5 shadow-md shadow-emerald-600/20 min-h-[44px]"
                      }
                    >
                      {!isFree ? (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Buy Now (₹{priceNum})</span>
                        </>
                      ) : (
                        <>
                          <span>Enroll Free</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium min-h-[44px]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Admin Only</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  )}

      {/* Enrollment Modal */}
      {enrollModalTarget && (
        <EnrollmentModal
          isOpen={Boolean(enrollModalTarget)}
          onClose={() => {
            setEnrollModalTarget(null);
            fetchCourses();
          }}
          courseTitle={enrollModalTarget.title}
          courseSubtitle={enrollModalTarget.subtitle}
          courseId={enrollModalTarget.id}
          price={enrollModalTarget.price}
          isFree={enrollModalTarget.is_free}
        />
      )}
    </div>
  );
}
