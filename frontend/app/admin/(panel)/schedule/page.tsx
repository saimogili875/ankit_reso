'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

interface SubjectOption {
  id: number;
  name: string;
}

interface ChapterOption {
  id: string;
  name: string;
}

interface TestOption {
  id: string;
  title: string;
}

interface DPPOption {
  id: string;
  title: string;
}

interface LectureOption {
  id: string;
  title: string;
}

interface ScheduleEventItem {
  id: string;
  course: string;
  course_title: string;
  event_type: 'EXAM' | 'PRACTICE_DEADLINE' | 'RECORDED_CLASS' | 'OTHER';
  title: string;
  description: string;
  subject?: number;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  start_time: string;
  end_time?: string;
  link: string;
  test?: string;
  test_title?: string;
  dpp?: string;
  dpp_title?: string;
  lecture?: string;
  lecture_title?: string;
  is_published: boolean;
  created_at: string;
}

export default function AdminSchedulePage() {
  const [events, setEvents] = useState<ScheduleEventItem[]>([]);

  // Options
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [dpps, setDpps] = useState<DPPOption[]>([]);
  const [lectures, setLectures] = useState<LectureOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Event Modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormData, setEventFormData] = useState({
    course: '',
    event_type: 'OTHER' as ScheduleEventItem['event_type'],
    title: '',
    description: '',
    subject: '' as string | number,
    chapter: '',
    start_time: '',
    end_time: '',
    link: '',
    test: '',
    dpp: '',
    lecture: '',
    is_published: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [evRes, optRes] = await Promise.all([
        apiClient.get<ScheduleEventItem[]>('/admin-panel/schedule/'),
        apiClient.get<{
          courses: CourseOption[];
          subjects: SubjectOption[];
          chapters: ChapterOption[];
          tests: TestOption[];
          dpps: DPPOption[];
          lectures: LectureOption[];
        }>('/admin-panel/options/'),
      ]);

      setEvents(evRes || []);
      setCourses(optRes?.courses || []);
      setSubjects(optRes?.subjects || []);
      setChapters(optRes?.chapters || []);
      setTests(optRes?.tests || []);
      setDpps(optRes?.dpps || []);
      setLectures(optRes?.lectures || []);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load schedule items.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toLocalInputDateTime = (d?: string | Date) => {
    const dt = d ? new Date(d) : new Date();
    const offset = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
  };

  const openCreateEventModal = () => {
    setEditingEventId(null);
    const now = new Date();
    setEventFormData({
      course: courses.length > 0 ? courses[0].id : '',
      event_type: 'OTHER',
      title: '',
      description: '',
      subject: '',
      chapter: '',
      start_time: toLocalInputDateTime(now),
      end_time: toLocalInputDateTime(new Date(now.getTime() + 60 * 60000)),
      link: '',
      test: '',
      dpp: '',
      lecture: '',
      is_published: true,
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (item: ScheduleEventItem) => {
    setEditingEventId(item.id);
    setEventFormData({
      course: item.course,
      event_type: item.event_type,
      title: item.title,
      description: item.description || '',
      subject: item.subject || '',
      chapter: item.chapter || '',
      start_time: toLocalInputDateTime(item.start_time),
      end_time: item.end_time ? toLocalInputDateTime(item.end_time) : '',
      link: item.link || '',
      test: item.test || '',
      dpp: item.dpp || '',
      lecture: item.lecture || '',
      is_published: item.is_published,
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFormData.title.trim() || !eventFormData.course || !eventFormData.start_time) {
      setFeedback({ type: 'error', message: 'Title, Course, and Start time are required.' });
      return;
    }

    setIsSavingEvent(true);
    try {
      const payload = {
        course: eventFormData.course,
        event_type: eventFormData.event_type,
        title: eventFormData.title.trim(),
        description: eventFormData.description.trim(),
        subject: eventFormData.subject ? Number(eventFormData.subject) : null,
        chapter: eventFormData.chapter || null,
        start_time: new Date(eventFormData.start_time).toISOString(),
        end_time: eventFormData.end_time ? new Date(eventFormData.end_time).toISOString() : null,
        link: eventFormData.link.trim(),
        test: eventFormData.test || null,
        dpp: eventFormData.dpp || null,
        lecture: eventFormData.lecture || null,
        is_published: eventFormData.is_published,
      };

      if (editingEventId) {
        await apiClient.patch(`/admin-panel/schedule/${editingEventId}/`, payload);
        setFeedback({ type: 'success', message: 'Schedule event updated.' });
      } else {
        await apiClient.post('/admin-panel/schedule/', payload);
        setFeedback({ type: 'success', message: 'Schedule event published.' });
      }
      setIsEventModalOpen(false);
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save event.' });
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule event?')) return;
    try {
      await apiClient.delete(`/admin-panel/schedule/${id}/`);
      setFeedback({ type: 'success', message: 'Schedule event deleted.' });
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete event.' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-400" />
            Schedule & Timetable Management
          </h1>
          <p className="text-sm text-slate-400">
            Schedule exams, practice deadlines, recorded class releases, and course timetable events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={openCreateEventModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Timetable Event
          </Button>
        </div>
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
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {feedback.message}
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* SCHEDULE EVENTS CARD */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            <span>Loading schedule events...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-brand-400" />
            <p className="text-base font-medium text-slate-300">No timetable events added</p>
            <p className="text-xs text-slate-500 mt-1">Add exam dates, practice deadlines, or assignments.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        ev.event_type === 'EXAM'
                          ? 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                          : ev.event_type === 'PRACTICE_DEADLINE'
                          ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                          : ev.event_type === 'RECORDED_CLASS'
                          ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                          : 'border-slate-500/40 text-slate-400 bg-slate-500/10'
                      }
                    >
                      {ev.event_type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="border-slate-800 bg-slate-950 text-slate-300 text-xs">
                      {ev.course_title}
                    </Badge>
                    {ev.subject_name && (
                      <span className="text-xs text-brand-400 font-semibold">{ev.subject_name}</span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-100">{ev.title}</h3>
                  {ev.description && <p className="text-xs text-slate-400">{ev.description}</p>}

                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-brand-400" />
                      {new Date(ev.start_time).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    {ev.link && (
                      <span className="text-brand-400 flex items-center gap-1 font-sans">
                        <ExternalLink className="w-3 h-3" /> {ev.link}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditEventModal(ev)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* TIMETABLE EVENT MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                {editingEventId ? 'Edit Timetable Event' : 'Add Timetable Event'}
              </h2>
              <button onClick={() => setIsEventModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Course Batch *</label>
                <select
                  required
                  value={eventFormData.course}
                  onChange={(e) => setEventFormData({ ...eventFormData, course: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Event Type *</label>
                <select
                  value={eventFormData.event_type}
                  onChange={(e) => {
                    const t = e.target.value as ScheduleEventItem['event_type'];
                    let defaultLink = '';
                    if (t === 'EXAM') defaultLink = '/tests';
                    if (t === 'PRACTICE_DEADLINE') defaultLink = '/practice';
                    if (t === 'RECORDED_CLASS') defaultLink = '/learn';
                    setEventFormData({ ...eventFormData, event_type: t, link: defaultLink });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="EXAM">Exam / Mock Test</option>
                  <option value="PRACTICE_DEADLINE">Practice / DPP Deadline</option>
                  <option value="RECORDED_CLASS">Recorded Class Release</option>
                  <option value="OTHER">Assignment / Custom Event</option>
                </select>
              </div>

              {/* Automatic entity linking dropdowns */}
              {eventFormData.event_type === 'EXAM' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Link Mock Test (Auto-sets title & link)</label>
                  <select
                    value={eventFormData.test}
                    onChange={(e) => {
                      const tId = e.target.value;
                      const matched = tests.find((t) => t.id === tId);
                      setEventFormData({
                        ...eventFormData,
                        test: tId,
                        title: matched ? matched.title : eventFormData.title,
                        link: '/tests',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select published CBT test...</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {eventFormData.event_type === 'PRACTICE_DEADLINE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Link Practice DPP (Auto-sets title & link)</label>
                  <select
                    value={eventFormData.dpp}
                    onChange={(e) => {
                      const dId = e.target.value;
                      const matched = dpps.find((d) => d.id === dId);
                      setEventFormData({
                        ...eventFormData,
                        dpp: dId,
                        title: matched ? matched.title : eventFormData.title,
                        link: '/practice',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select published DPP...</option>
                    {dpps.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {eventFormData.event_type === 'RECORDED_CLASS' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Link Lecture (Auto-sets title & link)</label>
                  <select
                    value={eventFormData.lecture}
                    onChange={(e) => {
                      const lId = e.target.value;
                      const matched = lectures.find((l) => l.id === lId);
                      setEventFormData({
                        ...eventFormData,
                        lecture: lId,
                        title: matched ? matched.title : eventFormData.title,
                        link: '/learn',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select lecture...</option>
                    {lectures.map((l) => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  placeholder="e.g. Physics Part Test 1 Due"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject (Optional)</label>
                  <select
                    value={eventFormData.subject}
                    onChange={(e) => setEventFormData({ ...eventFormData, subject: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">General Academic</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Chapter (Optional)</label>
                  <select
                    value={eventFormData.chapter}
                    onChange={(e) => setEventFormData({ ...eventFormData, chapter: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">No Chapter Linked</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventFormData.start_time}
                    onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={eventFormData.end_time}
                    onChange={(e) => setEventFormData({ ...eventFormData, end_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Action Link (e.g. /tests or /practice)</label>
                <input
                  type="text"
                  value={eventFormData.link}
                  onChange={(e) => setEventFormData({ ...eventFormData, link: e.target.value })}
                  placeholder="/tests"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ev_published"
                  checked={eventFormData.is_published}
                  onChange={(e) => setEventFormData({ ...eventFormData, is_published: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-brand-500"
                />
                <label htmlFor="ev_published" className="text-xs text-slate-300 cursor-pointer">
                  Publish to student schedule timetable
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEventModalOpen(false)} className="border-slate-800 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingEvent} className="bg-brand-500 hover:bg-brand-600 text-white">
                  {isSavingEvent && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingEventId ? 'Update Event' : 'Save Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
