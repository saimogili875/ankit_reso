'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  FileText,
  Target,
  PlayCircle,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface ScheduleEventItem {
  id: string;
  course: string;
  course_title: string;
  event_type: 'EXAM' | 'PRACTICE_DEADLINE' | 'RECORDED_CLASS' | 'OTHER';
  title: string;
  description?: string;
  subject?: string;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  start_time: string;
  end_time?: string;
  link?: string;
  status_label: 'Upcoming' | 'Done' | 'Missed' | 'Cancelled' | 'Active';
  is_attended: boolean;
  is_completed: boolean;
}

interface ScheduleTodayResponse {
  events: ScheduleEventItem[];
  live_now?: unknown;
}

export const TodayScheduleWidget: React.FC = () => {
  const [data, setData] = useState<ScheduleTodayResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<ScheduleTodayResponse>('/schedule/today/')
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="h-32 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
    );
  }

  const events = data?.events || [];

  return (
    <div className="space-y-6">
      {/* TODAY'S SCHEDULE SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              Today&apos;s Schedule
            </h3>
            <p className="text-xs text-slate-400">Lectures, exams, and daily deadlines for today</p>
          </div>
          <Link
            href="/schedule"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 group"
          >
            <span>View Full Timetable</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 text-blue-400 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-200">
                  No sessions scheduled for today
                </p>
                <p className="text-xs text-slate-400">
                  Check upcoming lectures, tests, and DPP submissions in your timetable.
                </p>
              </div>
            </div>
            <Link
              href="/schedule"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shrink-0"
            >
              Open Schedule
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl border flex flex-col justify-between transition-all bg-slate-900/80 border-slate-800 hover:border-slate-700"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                        <Clock className="w-3 h-3 text-blue-400" />
                        {formatTime(ev.start_time)}
                      </span>

                      <Badge
                        variant={
                          ev.event_type === 'EXAM'
                            ? 'purple'
                            : ev.event_type === 'PRACTICE_DEADLINE'
                            ? 'amber'
                            : 'blue'
                        }
                        className="text-[10px] py-0 px-2"
                      >
                        {ev.event_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 line-clamp-1">
                      {ev.title}
                    </h4>

                    {(ev.subject_name || ev.chapter_name) && (
                      <p className="text-[11px] text-blue-400 truncate">
                        {[ev.subject_name, ev.chapter_name].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {ev.course_title}
                    </span>

                    {ev.event_type === 'EXAM' ? (
                      <Link
                        href={ev.link || '/tests'}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Test
                      </Link>
                    ) : ev.event_type === 'PRACTICE_DEADLINE' ? (
                      <Link
                        href={ev.link || '/practice'}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white flex items-center gap-1"
                      >
                        <Target className="w-3 h-3" />
                        DPP
                      </Link>
                    ) : (
                      <Link
                        href={ev.link || '/learn'}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white flex items-center gap-1"
                      >
                        <PlayCircle className="w-3 h-3" />
                        Learn
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
