'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import {
  Users,
  HelpCircle,
  BookOpen,
  Video,
  Layers,
  FolderTree,
  GraduationCap,
  Plus,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
  Clock,
  FileText,
  MessageSquare,
  Bell,
  Upload,
  CreditCard,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import { DashboardTrends } from '@/components/admin/dashboard-trends';

interface OverviewData {
  students_count: number;
  courses_count: number;
  subjects_count: number;
  chapters_count: number;
  lectures_count: number;
  videos_count: number;
  dpps_count: number;
  questions_count: number;
  tests_count: number;
  materials_count: number;
  open_doubts_count: number;
  announcements_count: number;
}

interface Stat {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
}

const quickActions: { label: string; hint: string; href: string; icon: LucideIcon }[] = [
  { label: 'Add a question', hint: 'Question bank', href: '/admin/questions?new=true', icon: HelpCircle },
  { label: 'Upload a video', hint: 'Videos & media', href: '/admin/videos', icon: Upload },
  { label: 'Create a mock test', hint: 'CBT tests', href: '/admin/tests', icon: Clock },
  { label: 'Add study material', hint: 'PDFs and notes', href: '/admin/materials', icon: FileText },
  { label: 'Post an announcement', hint: 'Shown to students', href: '/admin/announcements', icon: Bell },
  { label: 'Review payments', hint: 'Orders and refunds', href: '/admin/payments', icon: CreditCard },
  { label: 'Update home banners', hint: 'Website', href: '/admin/banners', icon: ImageIcon },
];

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get<OverviewData>('/admin-panel/overview/');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load the platform totals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const n = (v?: number) => v ?? 0;

  const sections: { title: string; manage: string; stats: Stat[] }[] = [
    {
      title: 'Academics',
      manage: '/admin/modules',
      stats: [
        { label: 'Courses', value: n(data?.courses_count), icon: GraduationCap, href: '/admin/courses' },
        { label: 'Subjects', value: n(data?.subjects_count), icon: Layers, href: '/admin/modules' },
        { label: 'Chapters', value: n(data?.chapters_count), icon: FolderTree, href: '/admin/modules' },
        { label: 'Lectures', value: n(data?.lectures_count), icon: BookOpen, href: '/admin/modules?tab=lectures' },
      ],
    },
    {
      title: 'Content',
      manage: '/admin/videos',
      stats: [
        { label: 'Videos', value: n(data?.videos_count), icon: Video, href: '/admin/videos' },
        { label: 'Questions', value: n(data?.questions_count), icon: HelpCircle, href: '/admin/questions' },
        { label: 'DPP sets', value: n(data?.dpps_count), icon: Layers, href: '/admin/modules?tab=dpps' },
        { label: 'Mock tests', value: n(data?.tests_count), icon: Clock, href: '/admin/tests' },
        { label: 'Study materials', value: n(data?.materials_count), icon: FileText, href: '/admin/materials' },
      ],
    },
    {
      title: 'Students and support',
      manage: '/admin/students',
      stats: [
        { label: 'Students', value: n(data?.students_count), icon: Users, href: '/admin/students' },
        { label: 'Open doubts', value: n(data?.open_doubts_count), icon: MessageSquare, href: '/admin/doubts' },
        { label: 'Announcements', value: n(data?.announcements_count), icon: Bell, href: '/admin/announcements' },
      ],
    },
  ];

  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || 'Administrator';
  const openDoubts = n(data?.open_doubts_count);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time platform totals, daily growth trends, and management shortcuts.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          disabled={isLoading}
          className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium text-foreground hover:bg-muted/10 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={fetchOverview} className="text-xs font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {/* Needs attention banner */}
      {!isLoading && openDoubts > 0 && (
        <Link
          href="/admin/doubts"
          className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
              {openDoubts} {openDoubts === 1 ? 'doubt is' : 'doubts are'} waiting for a reply
            </span>
            <span className="block text-xs text-amber-700 dark:text-amber-200/80">Students are waiting on an answer.</span>
          </span>
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-200 flex items-center gap-1">
            Answer now <ChevronRight className="w-4 h-4" />
          </span>
        </Link>
      )}

      {/* Task 2: Last 30 Days Trends Section */}
      <DashboardTrends />

      {/* Main Grid: Totals + Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Totals by section */}
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{section.title}</h2>
                <Link
                  href={section.manage}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-0.5"
                >
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 divide-x divide-y divide-slate-100 dark:divide-slate-800">
                  {section.stats.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Link
                        key={s.label}
                        href={s.href}
                        className="group p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                          <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                          <span>{s.label}</span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {isLoading ? (
                            <span className="inline-block h-7 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                          ) : (
                            s.value.toLocaleString()
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Quick actions */}
        <aside className="rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm xl:sticky xl:top-24 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick actions</h2>
          </div>
          <ul className="p-2 divide-y divide-slate-50 dark:divide-slate-800/40">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.label}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{a.label}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">{a.hint}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
