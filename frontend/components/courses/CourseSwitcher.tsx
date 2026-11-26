'use client';

import React from 'react';
import Link from 'next/link';
import { CourseData } from '@/hooks/use-active-course';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  ArrowRight,
} from 'lucide-react';

interface CourseSwitcherProps {
  activeCourse: CourseData | null;
  courses: CourseData[];
  onSelectCourse: (course: CourseData) => void;
  isEnrolledInAny?: boolean;
  enrolledCount?: number;
}

export const CourseSwitcher: React.FC<CourseSwitcherProps> = ({
  activeCourse,
  courses,
  onSelectCourse,
}) => {
  if (!activeCourse) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Course Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Current Course:
              </span>
              <span className="font-bold text-slate-100 text-sm sm:text-base">
                {activeCourse.title}
              </span>
              {activeCourse.is_enrolled ? (
                <Badge variant="outline" className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[10px]">
                  ✓ Enrolled
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-950/60 text-amber-400 border-amber-500/30 text-[10px]">
                  Previewing (Locked)
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
              {activeCourse.description || 'Structured JEE syllabus lectures, practice sets, and mock tests.'}
            </p>
          </div>
        </div>

        {/* Switcher Dropdown (Shown when 2+ courses available) */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {courses.length > 1 ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
                Switch Course:
              </label>
              <select
                value={activeCourse.id}
                onChange={(e) => {
                  const found = courses.find((c) => c.id === e.target.value);
                  if (found) onSelectCourse(found);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.is_enrolled ? '(Enrolled)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!activeCourse.is_enrolled && (
            <Link href={`/courses`}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold gap-1 px-3">
                <span>Enroll Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
