'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Award,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  BarChart2,
  CheckCircle2,
  Timer,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useActiveCourse } from '@/hooks/use-active-course';
import { CourseSwitcher } from '@/components/courses/CourseSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';

interface ExamCardData {
  id: string;
  title: string;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  start_time?: string | null;
  end_time?: string | null;
  state: 'Start' | 'Resume' | 'View Result' | 'Starts in' | 'Expired';
  priority: number;
  exam_name?: string | null;
  series_title?: string | null;
  attempt?: {
    id: string;
    status: string;
    score: number;
    rank?: number | null;
    percentile?: number | null;
  } | null;
}

interface ExamsResponse {
  present: ExamCardData[];
  upcoming: ExamCardData[];
  completed: ExamCardData[];
}

function formatIST(isoDateString?: string | null): string {
  if (!isoDateString) return '';
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return '';
  return (
    d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

function getCountdown(isoStartDate: string): string {
  const diff = new Date(isoStartDate).getTime() - Date.now();
  if (diff <= 0) return 'Starting shortly';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `Starts in ${days}d ${hours % 24}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Starts in ${hours}h ${minutes}m`;
}

function getTestTypeLabel(type: string): string {
  switch (type) {
    case 'MOCK':
      return 'Full Length Mock';
    case 'PYQ':
      return 'Previous Year Paper';
    case 'CHAPTER':
      return 'Chapter Test';
    case 'SECTIONAL':
      return 'Sectional Test';
    default:
      return type;
  }
}

export default function ExamsPage() {
  const {
    activeCourse,
    enrolledCourses,
    enrolledCount,
    allCourses,
    setActiveCourse,
    isLoading: isCourseLoading,
  } = useActiveCourse();

  const [exams, setExams] = useState<ExamsResponse>({ present: [], upcoming: [], completed: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState<boolean>(false);

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = activeCourse?.id
        ? `/tests/exams/?course=${activeCourse.id}`
        : '/tests/exams/';
      const data = await apiClient.get<ExamsResponse>(endpoint);
      setExams(data || { present: [], upcoming: [], completed: [] });
    } catch (err: unknown) {
      console.error('[ExamsPage] fetch error:', err);
      setError('Unable to load examinations. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCourse?.id]);

  useEffect(() => {
    if (!isCourseLoading) {
      fetchExams();
    }
  }, [fetchExams, isCourseLoading]);

  const renderStateAction = (card: ExamCardData) => {
    switch (card.state) {
      case 'Start':
        return (
          <Link href={`/tests/${card.id}/attempt`}>
            <Button size="sm" className="bg-brand-500 hover:bg-brand-600 text-white font-medium gap-1.5 px-4 shadow-sm shadow-blue-500/20">
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Exam
            </Button>
          </Link>
        );
      case 'Resume':
        return (
          <Link href={`/tests/${card.id}/attempt`}>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold gap-1.5 px-4">
              <RotateCcw className="w-3.5 h-3.5" />
              Resume
            </Button>
          </Link>
        );
      case 'View Result':
        return (
          <Link href={`/tests/${card.id}/result`}>
            <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-medium gap-1.5 px-4">
              <BarChart2 className="w-3.5 h-3.5" />
              View Result
            </Button>
          </Link>
        );
      case 'Starts in':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 text-xs flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" />
            {card.start_time ? getCountdown(card.start_time) : 'Upcoming'}
          </Badge>
        );
      case 'Expired':
        return (
          <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 px-3 py-1 text-xs">
            Closed / Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderExamCard = (card: ExamCardData) => {
    return (
      <div
        key={card.id}
        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 shadow-lg transition-all flex flex-col justify-between gap-4 group"
      >
        <div className="space-y-2">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {getTestTypeLabel(card.test_type)}
            </span>
            {card.series_title && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {card.series_title}
              </span>
            )}
            {card.exam_name && (
              <span className="px-2 py-0.5 rounded-md text-[10px] text-slate-400 bg-slate-800">
                {card.exam_name}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-slate-100 group-hover:text-white transition-colors leading-snug">
            {card.title}
          </h3>

          {/* Test Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{card.duration_minutes} Mins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{card.total_marks} Marks</span>
            </div>
          </div>

          {/* Start and End Schedule */}
          <div className="space-y-1 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
            {card.start_time && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-brand-400" />
                <span>Starts: <strong className="text-slate-300">{formatIST(card.start_time)}</strong></span>
              </div>
            )}
            {card.end_time && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-rose-400" />
                <span>Ends: <strong className="text-slate-300">{formatIST(card.end_time)}</strong></span>
              </div>
            )}
          </div>

          {/* Attempt Result preview if completed */}
          {card.attempt && card.attempt.status === 'SUBMITTED' && (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Score: <strong className="text-emerald-400">{card.attempt.score}</strong>/{card.total_marks}</span>
                {card.attempt.rank && (
                  <span className="text-slate-400">Rank: <strong className="text-amber-400">#{card.attempt.rank}</strong></span>
                )}
              </div>
              {card.attempt.percentile !== null && card.attempt.percentile !== undefined && (
                <span className="text-[11px] text-purple-300 font-semibold">{card.attempt.percentile}%ile</span>
              )}
            </div>
          )}
        </div>

        {/* Action Button Row */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
          <span className="text-[11px] font-medium text-slate-400">
            {card.state === 'Starts in' ? 'Upcoming Exam' : card.state === 'View Result' ? 'Completed' : 'CBT Exam Room'}
          </span>
          {renderStateAction(card)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 lg:pb-16 pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              CBT Examinations
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Real-time All-India JEE CBT simulation tests, chapter sectional exams, and detailed performance rankings.
          </p>
        </div>

        {/* Multi-Course Switcher (Handled via CourseSwitcher) */}
        {enrolledCount > 1 && (
          <div className="flex-shrink-0">
            <CourseSwitcher
              enrolledCourses={enrolledCourses}
              allCourses={allCourses}
              activeCourse={activeCourse}
              onSelectCourse={setActiveCourse}
            />
          </div>
        )}
      </div>

      {/* 0-Course Notification Prompt */}
      {!isCourseLoading && enrolledCount === 0 && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Enroll to Unlock Full Test Series & All-India Ranks
            </h2>
            <p className="text-xs text-slate-300">
              You are currently viewing public open tests. Enroll in our JEE 2025/2026 courses to access complete national mock test series and full rank reports.
            </p>
          </div>
          <Link href="/courses">
            <Button className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs whitespace-nowrap">
              Explore Courses
            </Button>
          </Link>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchExams} className="border-rose-500/30 text-rose-300">
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <LoadingState message="Loading upcoming and live tests..." />
      ) : (
        <div className="space-y-10">
          {/* Desktop: Two Columns | Mobile: Two Stacked Rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Column 1: Present (Live Now) */}
            <section aria-labelledby="live-exams-heading" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 id="live-exams-heading" className="text-lg font-bold text-white">
                    Live Now (Present)
                  </h2>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                  {exams.present.length} Active
                </Badge>
              </div>

              {exams.present.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-sm bg-slate-950/40">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-medium text-slate-300">No tests live right now.</p>
                  <p className="text-xs text-slate-400 mt-1">Check the upcoming section for scheduled tests.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.present.map((card) => renderExamCard(card))}
                </div>
              )}
            </section>

            {/* Column 2: Upcoming (Start in Future) */}
            <section aria-labelledby="upcoming-exams-heading" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h2 id="upcoming-exams-heading" className="text-lg font-bold text-white">
                    Upcoming Scheduled Exams
                  </h2>
                </div>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                  {exams.upcoming.length} Scheduled
                </Badge>
              </div>

              {exams.upcoming.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-sm bg-slate-950/40">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-medium text-slate-300">No scheduled upcoming exams yet.</p>
                  <p className="text-xs text-slate-400 mt-1">New all-India mock tests are published weekly.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.upcoming.map((card) => renderExamCard(card))}
                </div>
              )}
            </section>
          </div>

          {/* Collapsible Completed List */}
          <section aria-labelledby="completed-exams-heading" className="border-t border-slate-800 pt-8">
            <button
              type="button"
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 id="completed-exams-heading" className="text-base font-bold text-white">
                    Completed & Past Exams
                  </h2>
                  <p className="text-xs text-slate-400">
                    Review submissions, accuracy breakdowns, percentile metrics, and unlock rank boards.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <span>{exams.completed.length} Completed</span>
                {isCompletedExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isCompletedExpanded && (
              <div className="mt-4 pt-2">
                {exams.completed.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-sm bg-slate-950/40">
                    You have not attempted or completed any exams yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.completed.map((card) => renderExamCard(card))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
