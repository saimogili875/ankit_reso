'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  Video,
  FileText,
  Target,
  PlayCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Calendar as CalendarIcon,
  List,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

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
  test?: string | null;
  dpp?: string | null;
  lecture?: string | null;
  status_label: 'Upcoming' | 'Live now' | 'Done' | 'Missed' | 'Cancelled' | 'Active';
  is_attended: boolean;
  is_completed: boolean;
}

interface ScheduleResponse {
  enrolled_courses_count: number;
  today: ScheduleEventItem[];
  upcoming: ScheduleEventItem[];
  past: ScheduleEventItem[];
  message?: string;
}

export default function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'past'>('today');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Calendar / filter state for upcoming
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ScheduleResponse>('/schedule/');
      if (res) {
        setScheduleData(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load schedule. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleJoinLive = async (event: ScheduleEventItem) => {
    const liveClassId = event.live_class?.id || (event.event_type === 'LIVE_CLASS' ? event.id : null);
    if (!liveClassId) return;

    setJoiningId(liveClassId);
    try {
      await apiClient.post<{ join_url: string }>(`/live-classes/${liveClassId}/join/`);

      // Update attendance locally
      setScheduleData((prev) => {
        if (!prev) return prev;
        const markAttended = (items: ScheduleEventItem[]) =>
          items.map((item) => {
            if (item.id === event.id || item.live_class?.id === liveClassId) {
              return {
                ...item,
                is_attended: true,
                live_class: item.live_class
                  ? { ...item.live_class, is_attended: true }
                  : undefined,
              };
            }
            return item;
          });
        return {
          ...prev,
          today: markAttended(prev.today),
          upcoming: markAttended(prev.upcoming),
          past: markAttended(prev.past),
        };
      });

      // Navigate into the in-app LiveKit classroom
      window.location.href = `/live/${liveClassId}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to record attendance or join class.';
      alert(msg);
    } finally {
      setJoiningId(null);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group upcoming events by ISO date string (YYYY-MM-DD)
  const groupedUpcoming = useMemo(() => {
    if (!scheduleData?.upcoming) return {};
    const groups: { [dateStr: string]: ScheduleEventItem[] } = {};
    for (const ev of scheduleData.upcoming) {
      const dateKey = ev.start_time.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(ev);
    }
    return groups;
  }, [scheduleData?.upcoming]);

  // Calendar dates for the currentMonthDate
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 for Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number; dateStr: string; hasEvents: boolean }> = [];

    // Prefix empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: 0, dateStr: '', hasEvents: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const hasEvents = Boolean(groupedUpcoming[dateStr]?.length);
      days.push({ dayNumber: d, dateStr, hasEvents });
    }

    return days;
  }, [currentMonthDate, groupedUpcoming]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4">
        <LoadingState message="Loading your personalized class schedule..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4">
        <ErrorState
          title="Could not load schedule"
          message={error}
          onRetry={fetchSchedule}
        />
      </div>
    );
  }

  // 1. Unenrolled Student Empty State
  if (!scheduleData || scheduleData.enrolled_courses_count === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 text-blue-400 mx-auto flex items-center justify-center mb-6 shadow-xl">
          <CalendarDays className="w-10 h-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight mb-3">
          No Enrolled Courses Found
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Your schedule only reflects the live lectures, exams, and daily DPP deadlines for courses
          you are officially enrolled in. Enroll in a course to access your personalized timetable.
        </p>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30"
        >
          <BookOpen className="w-4 h-4" />
          Browse JEE Courses
        </Link>
      </div>
    );
  }

  const { today = [], upcoming = [], past = [] } = scheduleData;

  const renderTypeBadge = (eventType: ScheduleEventItem['event_type']) => {
    switch (eventType) {
      case 'LIVE_CLASS':
        return (
          <Badge variant="rose" className="gap-1">
            <Video className="w-3 h-3" />
            Live Class
          </Badge>
        );
      case 'EXAM':
        return (
          <Badge variant="purple" className="gap-1">
            <FileText className="w-3 h-3" />
            Exam / Test
          </Badge>
        );
      case 'PRACTICE_DEADLINE':
        return (
          <Badge variant="amber" className="gap-1">
            <Target className="w-3 h-3" />
            DPP Deadline
          </Badge>
        );
      case 'RECORDED_CLASS':
        return (
          <Badge variant="blue" className="gap-1">
            <PlayCircle className="w-3 h-3" />
            Recorded Class
          </Badge>
        );
      default:
        return (
          <Badge variant="slate" className="gap-1">
            <CalendarIcon className="w-3 h-3" />
            Event
          </Badge>
        );
    }
  };

  const renderStatusBadge = (event: ScheduleEventItem) => {
    const isLive = event.status_label === 'Live now';

    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Live Now
        </span>
      );
    }

    if (event.status_label === 'Upcoming') {
      return (
        <Badge variant="blue">
          Upcoming
        </Badge>
      );
    }

    if (event.is_attended || event.is_completed || event.status_label === 'Done') {
      return (
        <Badge variant="emerald" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {event.is_attended ? 'Attended' : event.is_completed ? 'Completed' : 'Finished'}
        </Badge>
      );
    }

    if (event.status_label === 'Missed') {
      return (
        <Badge variant="slate" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Missed
        </Badge>
      );
    }

    return (
      <Badge variant="slate">
        {event.status_label}
      </Badge>
    );
  };

  const renderEventCard = (event: ScheduleEventItem) => {
    const isLive = event.status_label === 'Live now';
    const isJoining = joiningId === (event.live_class?.id || event.id);

    return (
      <div
        key={event.id}
        className={`p-5 rounded-2xl border transition-all ${
          isLive
            ? 'bg-slate-900/90 border-rose-500/40 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/20'
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Main Info */}
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {renderTypeBadge(event.event_type)}
              {renderStatusBadge(event)}
              {event.is_attended && (
                <Badge variant="emerald" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Attended ✓
                </Badge>
              )}
              <span className="text-xs text-slate-400 font-medium">
                {event.course_title}
              </span>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                {event.title}
              </h3>
              {(event.subject_name || event.chapter_name) && (
                <p className="text-xs text-blue-400 font-medium mt-0.5">
                  {[event.subject_name, event.chapter_name].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>

            {event.description && (
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            )}

            {/* Time slot & teacher */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-200">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {formatDate(event.start_time)}, {formatTime(event.start_time)}
                {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
              </span>
              {event.live_class?.teacher && (
                <span className="text-slate-400">
                  Instructor: <span className="text-slate-200 font-semibold">{event.live_class.teacher}</span>
                </span>
              )}
              {event.live_class?.platform && (
                <span className="text-slate-400">
                  Platform: <span className="text-slate-200 uppercase">{event.live_class.platform.replace('_', ' ')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2.5 pt-2 sm:pt-0 shrink-0">
            {/* Live Class Join Button */}
            {(event.event_type === 'LIVE_CLASS' || event.live_class) && (
              <>
                <button
                  type="button"
                  onClick={() => handleJoinLive(event)}
                  disabled={isJoining}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    isLive
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  {isJoining ? 'Joining...' : isLive ? 'Join Live Now' : 'Join Session'}
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </button>

                {/* Published Recording Link */}
                {event.live_class?.recording_published && event.live_class.recording_url && (
                  <a
                    href={event.live_class.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Watch Recording
                  </a>
                )}
              </>
            )}

            {/* Exam / Test action */}
            {event.event_type === 'EXAM' && (
              <Link
                href={event.link || '/tests'}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-purple-600/20"
              >
                <FileText className="w-3.5 h-3.5" />
                {event.is_completed ? 'Review Test' : 'Open Test Portal'}
              </Link>
            )}

            {/* DPP / Practice action */}
            {event.event_type === 'PRACTICE_DEADLINE' && (
              <Link
                href={event.link || '/practice'}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-amber-600/20"
              >
                <Target className="w-3.5 h-3.5" />
                {event.is_completed ? 'Practice Again' : 'Solve DPP'}
              </Link>
            )}

            {/* Recorded Class action */}
            {event.event_type === 'RECORDED_CLASS' && (
              <Link
                href={event.link || '/learn'}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-600/20"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Go to Lecture
              </Link>
            )}

            {/* Generic Link */}
            {event.event_type === 'OTHER' && event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                Open Details
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-950/60 border border-blue-900/60 text-blue-400">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Class Schedule & Live Sessions
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time live lectures, tests, assignments, and class recordings for your enrolled courses.
          </p>
        </div>

        {/* Course Count indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="blue" className="text-xs py-1 px-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            {scheduleData.enrolled_courses_count} Enrolled Course{scheduleData.enrolled_courses_count !== 1 ? 's' : ''}
          </Badge>
          <Link
            href="/courses"
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline ml-1"
          >
            All Courses
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Today
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {today.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Upcoming (Next 30 Days)
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {upcoming.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'past'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Past Sessions
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'past' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {past.length}
            </span>
          </button>
        </div>

        {/* View mode toggle for upcoming */}
        {activeTab === 'upcoming' && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Calendar View"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {/* 1. TODAY TAB */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {today.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <CalendarDays className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200 mb-1">
                No Sessions Scheduled for Today
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                You have no live classes, exams, or DPP deadlines scheduled for today. Check the
                Upcoming tab to see what is scheduled ahead.
              </p>
            </div>
          ) : (
            today.map((ev) => renderEventCard(ev))
          )}
        </div>
      )}

      {/* 2. UPCOMING TAB */}
      {activeTab === 'upcoming' && (
        <div>
          {upcoming.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <CalendarDays className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200 mb-1">
                No Upcoming Events
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No scheduled live lectures or test deadlines found for the next 30 days. New classes
                are scheduled weekly by faculty.
              </p>
            </div>
          ) : viewMode === 'calendar' ? (
            /* Month Calendar View */
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                {/* Month Navigator */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100">
                    {currentMonthDate.toLocaleDateString('en-IN', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = new Date(currentMonthDate);
                        prev.setMonth(prev.getMonth() - 1);
                        setCurrentMonthDate(prev);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(currentMonthDate);
                        next.setMonth(next.getMonth() + 1);
                        setCurrentMonthDate(next);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day of Week headers */}
                <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-semibold text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {calendarDays.map((day, idx) => {
                    if (day.dayNumber === 0) {
                      return <div key={`empty-${idx}`} className="h-14 sm:h-20" />;
                    }

                    const isSelected = selectedCalendarDate === day.dateStr;
                    const eventCount = groupedUpcoming[day.dateStr]?.length || 0;

                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedCalendarDate(isSelected ? null : day.dateStr)}
                        className={`h-14 sm:h-20 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-900/40 border-blue-500 text-white'
                            : day.hasEvents
                            ? 'bg-slate-800/60 border-slate-700 hover:border-slate-600 text-slate-100'
                            : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/30 text-slate-500'
                        }`}
                      >
                        <span className="text-xs font-bold">{day.dayNumber}</span>
                        {day.hasEvents && (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            <span className="text-[10px] text-blue-300 font-semibold truncate">
                              {eventCount} item{eventCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtered Events for selected calendar date */}
              {selectedCalendarDate && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-200">
                      Sessions on {new Date(selectedCalendarDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDate(null)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Show all upcoming
                    </button>
                  </div>
                  {(groupedUpcoming[selectedCalendarDate] || []).length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                      No events on this date.
                    </div>
                  ) : (
                    groupedUpcoming[selectedCalendarDate].map((ev) => renderEventCard(ev))
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Upcoming List View grouped by Date */
            <div className="space-y-6">
              {Object.entries(groupedUpcoming).map(([dateStr, events]) => (
                <div key={dateStr} className="space-y-3">
                  <div className="sticky top-16 z-10 bg-slate-950/90 backdrop-blur-sm py-1.5 px-3 rounded-lg border border-slate-800 inline-flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold text-slate-200">
                      {new Date(dateStr).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({events.length} event{events.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {events.map((ev) => renderEventCard(ev))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. PAST TAB */}
      {activeTab === 'past' && (
        <div className="space-y-4">
          {past.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
              <CalendarDays className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200 mb-1">
                No Past Sessions Found
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Completed classes, test submissions, and attendance history will appear here once
                sessions conclude.
              </p>
            </div>
          ) : (
            past.map((ev) => renderEventCard(ev))
          )}
        </div>
      )}
    </div>
  );
}
