'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  HelpCircle,
  BookOpen,
  Video,
  Layers,
  FolderTree,
  Plus,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Clock,
  FileText,
  MessageSquare,
  Bell,
  Sparkles,
} from 'lucide-react';

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

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverview = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get<OverviewData>('/admin-panel/overview/');
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch overview analytics';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const statCards = [
    {
      title: 'Active Students',
      value: data?.students_count ?? 0,
      icon: Users,
      color: 'from-blue-600 to-indigo-600',
      badge: 'Registered',
      href: '/admin/students',
    },
    {
      title: 'Curriculum Chapters',
      value: data?.chapters_count ?? 0,
      icon: FolderTree,
      color: 'from-emerald-600 to-teal-600',
      badge: 'Modules',
      href: '/admin/modules',
    },
    {
      title: 'Video Lectures',
      value: data?.lectures_count ?? 0,
      icon: BookOpen,
      color: 'from-sky-600 to-cyan-600',
      badge: 'Published',
      href: '/admin/modules?tab=lectures',
    },
    {
      title: 'Teaching Videos',
      value: data?.videos_count ?? 0,
      icon: Video,
      color: 'from-violet-600 to-purple-600',
      badge: 'R2 & YouTube',
      href: '/admin/videos',
    },
    {
      title: 'Question Bank',
      value: data?.questions_count ?? 0,
      icon: HelpCircle,
      color: 'from-amber-600 to-orange-600',
      badge: 'Single/Multi/Num',
      href: '/admin/questions',
    },
    {
      title: 'DPP Practice Sets',
      value: data?.dpps_count ?? 0,
      icon: Layers,
      color: 'from-rose-600 to-pink-600',
      badge: 'Daily Problems',
      href: '/admin/modules?tab=dpps',
    },
    {
      title: 'CBT Mock Tests',
      value: data?.tests_count ?? 0,
      icon: Clock,
      color: 'from-indigo-600 to-blue-700',
      badge: 'Timed CBT',
      href: '/admin/tests',
    },
    {
      title: 'Study Materials',
      value: data?.materials_count ?? 0,
      icon: FileText,
      color: 'from-teal-600 to-emerald-700',
      badge: 'PDF Handouts',
      href: '/admin/materials',
    },
    {
      title: 'Open Doubts',
      value: data?.open_doubts_count ?? 0,
      icon: MessageSquare,
      color: 'from-amber-500 to-red-600',
      badge: 'Pending Reply',
      href: '/admin/doubts',
    },
    {
      title: 'Announcements',
      value: data?.announcements_count ?? 0,
      icon: Bell,
      color: 'from-purple-600 to-pink-700',
      badge: 'Active Alerts',
      href: '/admin/announcements',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Admin Control Panel</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Faculty Mode
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time curriculum metrics, question bank totals, and student activity overview
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={isLoading}
            className="gap-2 text-xs border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/admin/questions?new=true">
            <Button variant="primary" size="sm" className="gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;

          return (
            <Link key={idx} href={card.href}>
              <Card className="p-5 bg-slate-900/60 border-slate-800/80 hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 shadow-lg group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                    {card.badge}
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                    ) : (
                      card.value.toLocaleString()
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5">{card.title}</div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-indigo-400 transition-colors">
                  <span>Manage</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Launchpad */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Faculty Launchpad</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <Link href="/admin/home" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Home Slides</span>
            <span className="text-[10px] text-slate-500 block">Carousel & Quick</span>
          </Link>
          <Link href="/admin/modules" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Curriculum</span>
            <span className="text-[10px] text-slate-500 block">Modules & DPPs</span>
          </Link>
          <Link href="/admin/videos" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Videos</span>
            <span className="text-[10px] text-slate-500 block">R2 & YouTube</span>
          </Link>
          <Link href="/admin/tests" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Mock Tests</span>
            <span className="text-[10px] text-slate-500 block">CBT Papers</span>
          </Link>
          <Link href="/admin/doubts" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Doubts</span>
            <span className="text-[10px] text-slate-500 block">Resolve Inquiries</span>
          </Link>
          <Link href="/admin/students" className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-center space-y-1 block transition-colors">
            <span className="text-xs font-bold text-slate-200 block">Students</span>
            <span className="text-[10px] text-slate-500 block">View & Manage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
