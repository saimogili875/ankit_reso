'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { EnrollmentModal } from '@/components/home/enrollment-modal';

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

export default function CoursesCatalogPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handleSelfEnroll = async (course: CourseData) => {
    if (!course.allow_self_enrollment) {
      alert('This course requires direct administrator admission.');
      return;
    }
    setEnrollModalTarget(course);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2.5">
          <GraduationCap className="w-8 h-8 text-brand-400" />
          <span>JEE Academic Courses & Batches</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Structured JEE Main and Advanced batches crafted by expert faculty. Enroll to access live classes, curriculum modules, and computer-based mock tests.
        </p>
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
          <button onClick={() => setFeedback(null)} className="text-xs uppercase opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <p className="text-sm">Loading course programs...</p>
        </div>
      ) : courses.length === 0 ? (
        <Card className="p-12 text-center bg-slate-900/50 border-slate-800 space-y-3">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Courses Published Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Faculty and administrators will publish upcoming JEE batches here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {courses.map((course) => {
            const priceNum = Number(course.price) || 0;
            const originalPriceNum = Number(course.original_price) || 0;

            return (
              <Card
                key={course.id}
                className="overflow-hidden bg-slate-900/70 border-slate-800 flex flex-col justify-between shadow-2xl hover:border-slate-700 transition-all"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge className="bg-brand-500/90 text-white border-0 text-xs shadow-md">
                        {course.exam_type.replace('_', ' ')}
                      </Badge>
                      {course.discount_badge && (
                        <Badge className="bg-emerald-500/90 text-white border-0 text-xs shadow-md">
                          {course.discount_badge}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-slate-100">{course.title}</h3>
                      {course.subtitle && (
                        <p className="text-xs text-slate-400 font-medium">{course.subtitle}</p>
                      )}
                    </div>

                    {course.description && (
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                        {course.description}
                      </p>
                    )}

                    {/* Classes & Subjects chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {course.classes &&
                        course.classes.map((c) => (
                          <span
                            key={c.id}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                          >
                            {c.name}
                          </span>
                        ))}
                      {course.subjects &&
                        course.subjects.map((s) => (
                          <span
                            key={s.id}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-950 text-brand-400 border border-slate-800"
                          >
                            {s.name}
                          </span>
                        ))}
                    </div>

                    {/* Features list */}
                    {course.features && course.features.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Course Inclusions
                        </span>
                        <div className="space-y-1">
                          {course.features.slice(0, 4).map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                              <span className="line-clamp-1">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {course.start_date && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pt-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Batch Starts: {new Date(course.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Pricing & CTA */}
                <div className="p-6 pt-0 border-t border-slate-800/80 mt-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-black text-white">
                      {priceNum === 0 ? 'FREE' : `₹${priceNum}`}
                    </div>
                    {originalPriceNum > 0 && (
                      <div className="text-xs text-slate-500 line-through">₹{originalPriceNum}</div>
                    )}
                  </div>

                  {course.is_enrolled ? (
                    <Link
                      href="/schedule"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enrolled ✓ (View Schedule)</span>
                    </Link>
                  ) : course.allow_self_enrollment ? (
                    <Button
                      onClick={() => handleSelfEnroll(course)}
                      className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold gap-2 px-5 py-2.5 shadow-lg shadow-brand-500/20"
                    >
                      <span>Enroll in Course</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400 text-xs font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Admin Admission Only</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
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
        />
      )}
    </div>
  );
}
