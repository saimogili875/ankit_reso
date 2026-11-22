'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BookOpen,
  Edit3,
  CalendarDays,
  BarChart3,
  MessageSquare,
  GraduationCap,
  Play,
  ArrowRight,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { LandingPage } from '@/components/landing/landing-page';

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  progress_percent: number;
  timestamp: string;
  href: string;
}

interface TestItem {
  id: string;
  title: string;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  start_time?: string | null;
  question_count?: number;
}

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  exam_type: string;
  price: string | number;
  is_free: boolean;
  is_enrolled: boolean;
  allow_self_enrollment: boolean;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  announcement_type: string;
  created_at: string;
}

export default function StudentHomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Data states
  const [continueItem, setContinueItem] = useState<RecentActivity | null>(null);
  const [nextTest, setNextTest] = useState<TestItem | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  // Loading states
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    setIsDataLoading(true);

    async function loadHomeData() {
      try {
        const [recentRes, testsUpcomingRes, testsAvailRes, coursesRes, annRes, notifRes] =
          await Promise.all([
            apiClient.get<RecentActivity[] | { results?: RecentActivity[] }>('/progress/recent/').catch(() => []),
            apiClient.get<TestItem[]>('/tests/?status=upcoming').catch(() => []),
            apiClient.get<TestItem[]>('/tests/?status=available').catch(() => []),
            apiClient.get<CourseItem[]>('/courses/').catch(() => []),
            apiClient.get<Announcement[]>('/announcements/').catch(() => []),
            apiClient.get<{ unread_count: number }>('/notifications/').catch(() => null),
          ]);

        if (!isMounted) return;

        // 1. Continue Learning Item (first recent activity)
        const recentList = asList<RecentActivity>(recentRes);
        if (recentList.length > 0) {
          setContinueItem(recentList[0]);
        }

        // 2. Next Test (first upcoming or available test)
        const upcomingList = asList<TestItem>(testsUpcomingRes);
        const availList = asList<TestItem>(testsAvailRes);
        if (upcomingList.length > 0) {
          setNextTest(upcomingList[0]);
        } else if (availList.length > 0) {
          setNextTest(availList[0]);
        }

        // 3. Courses
        setCourses(asList<CourseItem>(coursesRes));

        // 4. Announcements
        setAnnouncements(asList<Announcement>(annRes).slice(0, 3));

        // 5. Unread notifications
        if (notifRes && typeof notifRes.unread_count === 'number') {
          setUnreadNotifCount(notifRes.unread_count);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setDataError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
        }
      } finally {
        if (isMounted) setIsDataLoading(false);
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // When unauthenticated, show public landing page
  if (!authLoading && isAuthenticated === false) {
    return <LandingPage />;
  }

  // Pre-hydration placeholder
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[#5B6475]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2B2FB8]" />
      </div>
    );
  }

  const studentName =
    user?.first_name ||
    user?.full_name?.split(' ')[0] ||
    user?.username ||
    user?.email?.split('@')[0] ||
    'Student';

  // Format date helper
  const formatTestDate = (dateStr?: string | null) => {
    if (!dateStr) return 'MOCK';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'TEST';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8 font-sans">
      {/* 1. GREETING & NOTIFICATION HEADER */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <div className="text-xs sm:text-sm text-[#5B6475] dark:text-slate-400 font-medium">
            Welcome back
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-[#101828] dark:text-white">
            {studentName}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            const bell = document.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement | null;
            if (bell) bell.click();
          }}
          aria-label="Notifications"
          className="relative w-11 h-11 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-[#101828] dark:text-slate-200 shadow-xs hover:border-[#2B2FB8] transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[9px] font-extrabold text-white flex items-center justify-center animate-pulse">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {dataError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{dataError}</span>
          </div>
          <button
            onClick={() => router.refresh()}
            className="font-bold underline text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. CONTINUE LEARNING CARD */}
      {isDataLoading ? (
        <div className="h-48 rounded-2xl bg-[#2B2FB8]/10 animate-pulse border border-[#2B2FB8]/20" />
      ) : continueItem ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#2B2FB8] text-white shadow-xl shadow-[#2B2FB8]/15 space-y-4">
          <div>
            <div className="text-xs text-[#C9CBFF] font-semibold uppercase tracking-wider">
              Continue learning
            </div>
            <h2 className="font-heading text-lg sm:text-xl font-bold mt-1 line-clamp-1">
              {continueItem.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#DADCFF] mt-0.5 line-clamp-1">
              {continueItem.subtitle}
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="h-2 rounded-full bg-[#4A4FD0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F5B63D] transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, continueItem.progress_percent))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#DADCFF] font-medium">
              <span>{continueItem.progress_percent}% completed</span>
              <span>In progress</span>
            </div>
          </div>

          <Link
            href={continueItem.href || '/learn'}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-white text-[#2B2FB8] font-bold text-sm sm:text-base hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-[#2B2FB8]" />
            <span>Resume video</span>
          </Link>
        </div>
      ) : (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 text-center space-y-3 shadow-xs">
          <div className="w-11 h-11 rounded-2xl bg-[#2B2FB8]/10 dark:bg-blue-500/10 text-[#2B2FB8] dark:text-blue-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-[#101828] dark:text-slate-100">
              Pick a course to start learning
            </h3>
            <p className="text-xs text-[#5B6475] dark:text-slate-400 max-w-sm mx-auto mt-0.5">
              Explore our structured JEE curriculum lectures and daily practice problem sets.
            </p>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2B2FB8] text-white font-semibold text-xs sm:text-sm hover:bg-[#232799] transition-colors shadow-sm"
          >
            <span>Browse Courses</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 3. NEXT TEST CARD (Hidden cleanly if none) */}
      {!isDataLoading && nextTest && (
        <div className="p-4 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-xl bg-[#FFF1D6] text-[#7A4B00] flex flex-col items-center justify-center shrink-0 font-heading font-extrabold text-xs px-2 py-1 leading-tight text-center">
              <span>{formatTestDate(nextTest.start_time)}</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-[#101828] dark:text-slate-100 truncate">
                {nextTest.title}
              </h3>
              <p className="text-xs text-[#5B6475] dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{nextTest.duration_minutes} min duration</span>
                <span>•</span>
                <span>{nextTest.question_count || 3} Questions</span>
              </p>
            </div>
          </div>

          <Link
            href="/tests"
            className="h-11 px-4 rounded-xl border border-[#2B2FB8] text-[#2B2FB8] dark:text-blue-400 dark:border-blue-400 font-bold text-xs sm:text-sm flex items-center justify-center hover:bg-[#2B2FB8]/5 transition-colors shrink-0 min-w-[68px]"
          >
            Open
          </Link>
        </div>
      )}

      {/* 4. 6 QUICK ACTIONS */}
      <div className="space-y-2">
        <h2 className="font-heading font-bold text-base text-[#101828] dark:text-slate-100">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <Link
            href="/learn"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2B2FB8] dark:text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Learn
            </span>
          </Link>

          <Link
            href="/practice"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Edit3 className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Practice
            </span>
          </Link>

          <Link
            href="/schedule"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <CalendarDays className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Schedule
            </span>
          </Link>

          <Link
            href="/analysis"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Analysis
            </span>
          </Link>

          <Link
            href="/doubt-solver"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Doubt Solver
            </span>
          </Link>

          <Link
            href="/courses"
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#2B2FB8] transition-all group min-h-[88px] text-center shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 stroke-[1.8]" />
            </div>
            <span className="font-semibold text-xs text-[#101828] dark:text-slate-200">
              Courses
            </span>
          </Link>
        </div>
      </div>

      {/* 5. MY COURSES (Swipeable Cards) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-base text-[#101828] dark:text-slate-100">
            My courses
          </h2>
          <Link
            href="/courses"
            className="text-xs font-semibold text-[#2B2FB8] dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isDataLoading ? (
          <div className="flex gap-3 overflow-x-hidden">
            {[1, 2].map((i) => (
              <div key={i} className="w-60 h-36 rounded-2xl bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 animate-pulse shrink-0" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-[#5B6475] dark:text-slate-400">
              You have no courses yet.
            </p>
            <Link
              href="/courses"
              className="inline-block text-xs font-bold text-[#2B2FB8] dark:text-blue-400 underline"
            >
              Browse courses
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 no-scrollbar snap-x snap-mandatory">
            {courses.map((course) => {
              const priceNum = Number(course.price) || 0;
              const isFree = course.is_free || priceNum === 0;

              return (
                <div
                  key={course.id}
                  className="w-60 shrink-0 p-4 rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between snap-start shadow-xs"
                >
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[#5B6475] dark:text-slate-400 uppercase tracking-wider block">
                      {course.exam_type.replace('_', ' ')}
                    </span>
                    <h3 className="font-heading font-bold text-sm text-[#101828] dark:text-slate-100 line-clamp-2 leading-snug">
                      {course.title}
                    </h3>
                  </div>

                  <div className="pt-4 space-y-2">
                    {course.is_enrolled ? (
                      <div>
                        <div className="h-1.5 rounded-full bg-[#E3E7EE] dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-[#2B2FB8] w-2/3" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#5B6475] dark:text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Enrolled
                          </span>
                          <Link href="/learn" className="font-bold text-[#2B2FB8] dark:text-blue-400">
                            Resume
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-bold text-xs text-[#101828] dark:text-slate-200">
                          {isFree ? 'Free' : `₹${priceNum}`}
                        </span>
                        <Link
                          href="/courses"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2B2FB8] text-white hover:bg-[#232799] transition-colors"
                        >
                          {isFree ? 'Enroll free' : 'Buy now'}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. LATEST ANNOUNCEMENTS */}
      <div className="space-y-2">
        <h2 className="font-heading font-bold text-base text-[#101828] dark:text-slate-100">
          Announcements
        </h2>
        {isDataLoading ? (
          <div className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 animate-pulse" />
        ) : announcements.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-[#E3E7EE] dark:border-slate-800 text-xs text-[#5B6475] dark:text-slate-400 text-center">
            No active announcements.
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E3E7EE] dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-[#E3E7EE] dark:divide-slate-800 shadow-xs">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-3.5 sm:p-4 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-[#101828] dark:text-slate-100 line-clamp-1">
                    {ann.title}
                  </h3>
                  <span className="text-[10px] text-[#5B6475] dark:text-slate-400 shrink-0 font-mono">
                    {new Date(ann.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-[#5B6475] dark:text-slate-400 line-clamp-2">
                  {ann.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
