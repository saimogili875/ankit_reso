'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Radio,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  Video,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';

interface CourseOption {
  id: string;
  title: string;
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

interface LiveClassItem {
  id: string;
  course: string;
  course_title: string;
  title: string;
  description: string;
  subject?: number;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  teacher: string;
  start_time: string;
  end_time: string;
  platform: 'YOUTUBE_LIVE' | 'ZOOM' | 'MEET' | 'OTHER';
  join_url: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  recording_url?: string;
  recording_published: boolean;
  recording_lecture?: string;
  attendances_count: number;
  created_at: string;
}

interface ScheduleEventItem {
  id: string;
  course: string;
  course_title: string;
  event_type: 'LIVE_CLASS' | 'EXAM' | 'PRACTICE_DEADLINE' | 'RECORDED_CLASS' | 'OTHER';
  title: string;
  description: string;
  subject?: number;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  start_time: string;
  end_time?: string;
  link: string;
  live_class?: string;
  live_class_title?: string;
  test?: string;
  test_title?: string;
  dpp?: string;
  dpp_title?: string;
  lecture?: string;
  lecture_title?: string;
  is_published: boolean;
  created_at: string;
}

interface Attendee {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  joined_at: string;
}

export default function AdminSchedulePage() {
  const [activeTab, setActiveTab] = useState<'live' | 'events'>('live');

  // Entities
  const [liveClasses, setLiveClasses] = useState<LiveClassItem[]>([]);
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

  // Live Class Modal
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [isSavingLive, setIsSavingLive] = useState(false);
  const [editingLiveId, setEditingLiveId] = useState<string | null>(null);
  const [liveFormData, setLiveFormData] = useState({
    course: '',
    title: '',
    description: '',
    subject: '' as string | number,
    chapter: '',
    teacher: 'Er. Ankit Sharma (IIT Bombay)',
    start_time: '',
    end_time: '',
    platform: 'YOUTUBE_LIVE' as LiveClassItem['platform'],
    join_url: '',
    status: 'SCHEDULED' as LiveClassItem['status'],
  });

  // Recording Modal
  const [recordingTarget, setRecordingTarget] = useState<LiveClassItem | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingLectureId, setRecordingLectureId] = useState('');
  const [isPublishingRecording, setIsPublishingRecording] = useState(false);

  // Attendance Modal
  const [attendanceTarget, setAttendanceTarget] = useState<LiveClassItem | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

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
    live_class: '',
    is_published: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [liveRes, evRes, optRes] = await Promise.all([
        apiClient.get<LiveClassItem[]>('/admin-panel/live-classes/'),
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

      setLiveClasses(liveRes || []);
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

  // Format local ISO datetime for inputs (YYYY-MM-DDTHH:mm)
  const toLocalInputDateTime = (d?: string | Date) => {
    const dt = d ? new Date(d) : new Date();
    const offset = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
  };

  // Open Live Class Modal
  const openCreateLiveModal = () => {
    setEditingLiveId(null);
    const now = new Date();
    const later = new Date(now.getTime() + 90 * 60000);
    setLiveFormData({
      course: courses.length > 0 ? courses[0].id : '',
      title: '',
      description: '',
      subject: subjects.length > 0 ? subjects[0].id : '',
      chapter: '',
      teacher: 'Er. Ankit Sharma (IIT Bombay)',
      start_time: toLocalInputDateTime(now),
      end_time: toLocalInputDateTime(later),
      platform: 'YOUTUBE_LIVE',
      join_url: '',
      status: 'SCHEDULED',
    });
    setIsLiveModalOpen(true);
  };

  const openEditLiveModal = (item: LiveClassItem) => {
    setEditingLiveId(item.id);
    setLiveFormData({
      course: item.course,
      title: item.title,
      description: item.description || '',
      subject: item.subject || '',
      chapter: item.chapter || '',
      teacher: item.teacher || 'Faculty Educator',
      start_time: toLocalInputDateTime(item.start_time),
      end_time: toLocalInputDateTime(item.end_time),
      platform: item.platform,
      join_url: item.join_url,
      status: item.status,
    });
    setIsLiveModalOpen(true);
  };

  const handleSaveLiveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveFormData.title.trim() || !liveFormData.course || !liveFormData.start_time || !liveFormData.end_time) {
      setFeedback({ type: 'error', message: 'Title, Course, and Start/End times are required.' });
      return;
    }

    setIsSavingLive(true);
    try {
      const payload = {
        course: liveFormData.course,
        title: liveFormData.title.trim(),
        description: liveFormData.description.trim(),
        subject: liveFormData.subject ? Number(liveFormData.subject) : null,
        chapter: liveFormData.chapter || null,
        teacher: liveFormData.teacher.trim(),
        start_time: new Date(liveFormData.start_time).toISOString(),
        end_time: new Date(liveFormData.end_time).toISOString(),
        platform: liveFormData.platform,
        join_url: liveFormData.join_url.trim(),
        status: liveFormData.status,
      };

      if (editingLiveId) {
        await apiClient.patch(`/admin-panel/live-classes/${editingLiveId}/`, payload);
        setFeedback({ type: 'success', message: 'Live class session updated.' });
      } else {
        await apiClient.post('/admin-panel/live-classes/', payload);
        setFeedback({ type: 'success', message: 'Live class scheduled and timetable event added.' });
      }
      setIsLiveModalOpen(false);
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save live class.' });
    } finally {
      setIsSavingLive(false);
    }
  };

  const handleToggleLiveStatus = async (item: LiveClassItem, nextStatus: LiveClassItem['status']) => {
    try {
      await apiClient.patch(`/admin-panel/live-classes/${item.id}/`, {
        status: nextStatus,
      });
      setFeedback({ type: 'success', message: `Class status updated to ${nextStatus}.` });
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update status.' });
    }
  };

  const handleDeleteLiveClass = async (id: string) => {
    if (!confirm('Are you sure you want to delete this live class session?')) return;
    try {
      await apiClient.delete(`/admin-panel/live-classes/${id}/`);
      setFeedback({ type: 'success', message: 'Live class deleted.' });
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete live class.' });
    }
  };

  // Open Recording publish modal
  const openPublishRecordingModal = (item: LiveClassItem) => {
    setRecordingTarget(item);
    setRecordingUrl(item.recording_url || item.join_url || '');
    setRecordingLectureId(item.recording_lecture || '');
  };

  const handlePublishRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingTarget || !recordingUrl.trim()) return;

    setIsPublishingRecording(true);
    try {
      await apiClient.post(`/admin-panel/live-classes/${recordingTarget.id}/publish-recording/`, {
        recording_url: recordingUrl.trim(),
        lecture_id: recordingLectureId || null,
      });
      setFeedback({
        type: 'success',
        message: 'Recording published! Enrolled students have been notified and it is added to Learn.',
      });
      setRecordingTarget(null);
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to publish recording.' });
    } finally {
      setIsPublishingRecording(false);
    }
  };

  // View Attendance modal
  const openAttendanceModal = async (item: LiveClassItem) => {
    setAttendanceTarget(item);
    setIsLoadingAttendance(true);
    try {
      const data = await apiClient.get<Attendee[]>(`/admin-panel/live-classes/${item.id}/attendance/`);
      setAttendees(data || []);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load attendees.' });
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  // Event Modal handlers
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
      live_class: '',
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
      live_class: item.live_class || '',
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
        live_class: eventFormData.live_class || null,
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
            Schedule & Live Class Management
          </h1>
          <p className="text-sm text-slate-400">
            Schedule live video sessions, exams, and practice deadlines per course timetable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'live' ? (
            <Button onClick={openCreateLiveModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
              <Radio className="w-4 h-4 mr-2" />
              Schedule Live Class
            </Button>
          ) : (
            <Button onClick={openCreateEventModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Timetable Event
            </Button>
          )}
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('live')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'live' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          Live Classes & Recordings ({liveClasses.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'events' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Timetable Events & Deadlines ({events.length})
        </button>
      </div>

      {/* TAB 1: LIVE CLASSES */}
      {activeTab === 'live' && (
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <span>Loading live classes...</span>
            </div>
          ) : liveClasses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Radio className="w-12 h-12 mx-auto mb-3 opacity-30 text-rose-400" />
              <p className="text-base font-medium text-slate-300">No live classes scheduled</p>
              <p className="text-xs text-slate-500 mt-1">Schedule a live YouTube, Zoom, or Meet session above.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {liveClasses.map((item) => (
                <div
                  key={item.id}
                  className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={
                          item.status === 'LIVE'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                            : item.status === 'ENDED'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }
                      >
                        {item.status === 'LIVE' ? '● LIVE NOW' : item.status}
                      </Badge>
                      <Badge variant="outline" className="border-slate-800 bg-slate-950 text-slate-300 text-xs">
                        {item.course_title}
                      </Badge>
                      {item.subject_name && (
                        <span className="text-xs text-brand-400 font-semibold">{item.subject_name}</span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        {item.platform.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                    {item.description && <p className="text-xs text-slate-400">{item.description}</p>}

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                      <span className="text-slate-300 flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-brand-400" /> Teacher: {item.teacher}
                      </span>
                      <span className="text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(item.start_time).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span className="text-emerald-400 font-medium">
                        {item.attendances_count} Student{item.attendances_count !== 1 ? 's' : ''} Attended
                      </span>
                    </div>

                    {item.recording_published && (
                      <div className="pt-1 text-xs text-emerald-400 flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Recording Published in Learn</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Link
                      href={`/admin/live/${item.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 transition shadow-md shadow-indigo-600/30"
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse text-rose-300" />
                      <span>{item.status === 'LIVE' ? 'Enter Live Studio' : 'Go Live (Studio)'}</span>
                    </Link>

                    {item.status === 'SCHEDULED' && (
                      <Button
                        size="sm"
                        onClick={() => handleToggleLiveStatus(item, 'LIVE')}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8"
                      >
                        Go Live Now
                      </Button>
                    )}
                    {item.status === 'LIVE' && (
                      <Button
                        size="sm"
                        onClick={() => handleToggleLiveStatus(item, 'ENDED')}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8"
                      >
                        End Class
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPublishRecordingModal(item)}
                      className="border-slate-800 text-xs text-slate-200 hover:bg-slate-800 h-8"
                    >
                      <Video className="w-3.5 h-3.5 mr-1 text-brand-400" />
                      {item.recording_published ? 'Update Recording' : 'Publish Recording'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAttendanceModal(item)}
                      className="text-xs text-slate-400 hover:text-slate-200 h-8"
                    >
                      Attendance ({item.attendances_count})
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditLiveModal(item)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLiveClass(item.id)}
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
      )}

      {/* TAB 2: SCHEDULE EVENTS */}
      {activeTab === 'events' && (
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
                            : ev.event_type === 'LIVE_CLASS'
                            ? 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                            : 'border-blue-500/40 text-blue-400 bg-blue-500/10'
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
      )}

      {/* LIVE CLASS MODAL */}
      {isLiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-400" />
                {editingLiveId ? 'Edit Live Class' : 'Schedule New Live Class'}
              </h2>
              <button onClick={() => setIsLiveModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSaveLiveClass} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Course Batch *</label>
                <select
                  required
                  value={liveFormData.course}
                  onChange={(e) => setLiveFormData({ ...liveFormData, course: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Class Title *</label>
                <input
                  type="text"
                  required
                  value={liveFormData.title}
                  onChange={(e) => setLiveFormData({ ...liveFormData, title: e.target.value })}
                  placeholder="e.g. Electromagnetism - Faraday's Law & Induced EMF"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                  <select
                    value={liveFormData.subject}
                    onChange={(e) => setLiveFormData({ ...liveFormData, subject: e.target.value })}
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
                    value={liveFormData.chapter}
                    onChange={(e) => setLiveFormData({ ...liveFormData, chapter: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">No Chapter Linked</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Faculty Teacher *</label>
                  <input
                    type="text"
                    required
                    value={liveFormData.teacher}
                    onChange={(e) => setLiveFormData({ ...liveFormData, teacher: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={liveFormData.start_time}
                    onChange={(e) => setLiveFormData({ ...liveFormData, start_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={liveFormData.end_time}
                    onChange={(e) => setLiveFormData({ ...liveFormData, end_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Streaming Platform</label>
                  <select
                    value={liveFormData.platform}
                    onChange={(e) => setLiveFormData({ ...liveFormData, platform: e.target.value as LiveClassItem['platform'] })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="YOUTUBE_LIVE">YouTube Live</option>
                    <option value="ZOOM">Zoom Meeting</option>
                    <option value="MEET">Google Meet</option>
                    <option value="OTHER">Custom Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Class Join / Stream URL *</label>
                  <input
                    type="text"
                    required
                    value={liveFormData.join_url}
                    onChange={(e) => setLiveFormData({ ...liveFormData, join_url: e.target.value })}
                    placeholder="https://youtube.com/live/... or https://zoom.us/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Status</label>
                <select
                  value={liveFormData.status}
                  onChange={(e) => setLiveFormData({ ...liveFormData, status: e.target.value as LiveClassItem['status'] })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="SCHEDULED">Scheduled (Upcoming)</option>
                  <option value="LIVE">Live Now</option>
                  <option value="ENDED">Ended</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsLiveModalOpen(false)} className="border-slate-800 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingLive} className="bg-brand-500 hover:bg-brand-600 text-white">
                  {isSavingLive && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingLiveId ? 'Update Session' : 'Save & Publish Live Class'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUBLISH RECORDING MODAL */}
      {recordingTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Video className="w-5 h-5 text-brand-400" />
              Publish Live Class Recording
            </h2>
            <p className="text-xs text-slate-400">
              Publishing adds the recording to the student Learn curriculum and timetable, and notifies enrolled students.
            </p>

            <form onSubmit={handlePublishRecording} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recording URL (YouTube Video or Cloud R2 link) *
                </label>
                <input
                  type="text"
                  required
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or R2 key"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Attach to Curriculum Lecture (Optional)
                </label>
                <select
                  value={recordingLectureId}
                  onChange={(e) => setRecordingLectureId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="">No lecture link (Schedule only)</option>
                  {lectures.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setRecordingTarget(null)} className="border-slate-800 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPublishingRecording} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  {isPublishingRecording && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Publish & Broadcast Alert
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ATTENDANCE MODAL */}
      {attendanceTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-400" />
                  Live Attendance Records
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{attendanceTarget.title}</p>
              </div>
              <button onClick={() => setAttendanceTarget(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {isLoadingAttendance ? (
                <div className="py-8 flex justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                </div>
              ) : attendees.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center p-6 bg-slate-950 rounded-lg border border-slate-800">
                  No student has joined this live session yet.
                </p>
              ) : (
                attendees.map((att) => (
                  <div key={att.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{att.student_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{att.student_email}</div>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      Joined {new Date(att.joined_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setAttendanceTarget(null)} className="border-slate-800 text-slate-300">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  <option value="LIVE_CLASS">Live Class</option>
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
