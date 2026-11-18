'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  Video,
  FileText,
  Target,
  PlayCircle,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface LiveClassData {
  id: string;
  course: string;
  course_title: string;
  title: string;
  description?: string;
  subject?: string;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  teacher?: string;
  start_time: string;
  end_time?: string;
  platform: 'YOUTUBE_LIVE' | 'ZOOM' | 'MEET' | 'OTHER';
  join_url: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  recording_url?: string;
  recording_published: boolean;
  is_attended: boolean;
}

interface ScheduleEventItem {
  id: string;
  course: string;
  course_title: string;
  event_type: 'LIVE_CLASS' | 'EXAM' | 'PRACTICE_DEADLINE' | 'RECORDED_CLASS' | 'OTHER';
  title: string;
  description?: string;
  subject?: string;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  start_time: string;
  end_time?: string;
  link?: string;
  live_class?: LiveClassData | null;
  status_label: 'Upcoming' | 'Live now' | 'Done' | 'Missed' | 'Cancelled' | 'Active';
  is_attended: boolean;
  is_completed: boolean;
}

interface ScheduleTodayResponse {
  events: ScheduleEventItem[];
  live_now: LiveClassData | null;
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

  const liveNow = data?.live_now;
  const events = data?.events || [];

  return (
    <div className="space-y-6">
      {/* 1. "LIVE NOW" BANNER (When an active live class is happening) */}
      {liveNow && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 border border-rose-500/40 p-5 sm:p-6 shadow-xl shadow-rose-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500 text-white shadow-sm">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Live Now
                </span>
                <span className="text-xs text-rose-300/80 font-medium truncate max-w-xs">
                  {liveNow.course_title}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {liveNow.title}
              </h3>
              <p className="text-xs text-slate-300">
                {[liveNow.subject_name, liveNow.chapter_name, liveNow.teacher ? `By ${liveNow.teacher}` : '']
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={`/live/${liveNow.id}`}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Video className="w-4 h-4" />
                <span>Join Live Classroom</span>
                <Radio className="w-3.5 h-3.5 ml-0.5 animate-pulse" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 2. TODAY'S SCHEDULE SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              Today&apos;s Schedule
            </h3>
            <p className="text-xs text-slate-400">Live sessions, exams, and daily deadlines for today</p>
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
              const isLive = ev.status_label === 'Live now';

              return (
                <div
                  key={ev.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    isLive
                      ? 'bg-slate-900/90 border-rose-500/40 shadow-md shadow-rose-950/20'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                        <Clock className="w-3 h-3 text-blue-400" />
                        {formatTime(ev.start_time)}
                      </span>

                      {isLive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          Live Now
                        </span>
                      ) : (
                        <Badge
                          variant={
                            ev.event_type === 'LIVE_CLASS'
                              ? 'rose'
                              : ev.event_type === 'EXAM'
                              ? 'purple'
                              : ev.event_type === 'PRACTICE_DEADLINE'
                              ? 'amber'
                              : 'blue'
                          }
                          className="text-[10px] py-0 px-2"
                        >
                          {ev.event_type.replace('_', ' ')}
                        </Badge>
                      )}
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

                    {ev.live_class ? (
                      <Link
                        href={`/live/${ev.live_class.id}`}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                          isLive
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        <Video className="w-3 h-3" />
                        <span>{isLive ? 'Join Live' : 'Class'}</span>
                      </Link>
                    ) : ev.event_type === 'EXAM' ? (
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
