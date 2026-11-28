'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  Calendar,
  Lock,
  Unlock,
  UserPlus,
  UserMinus,
} from 'lucide-react';

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  thumbnail_url: string;
  exam?: string | null;
  exam_name?: string | null;
  exam_type: 'JEE_MAIN' | 'JEE_ADVANCED' | 'BOTH';
  price: string | number;
  original_price: string | number;
  discount_badge: string;
  is_free: boolean;
  features: string[];
  start_date?: string | null;
  end_date?: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  is_published: boolean;
  allow_self_enrollment: boolean;
  classes?: number[];
  subjects?: number[];
  classes_names?: string[];
  subjects_names?: string[];
  enrolled_count: number;
  created_at: string;
}

interface ExamOption {
  id: string;
  name: string;
  slug: string;
}

interface OptionItem {
  id: number | string;
  name: string;
  code?: string;
  exam_id?: string;
  exam_name?: string;
  academic_class_id?: number;
  class_name?: string;
  subject_label?: string;
}

interface EnrolledStudent {
  id: string;
  email: string;
  name: string;
  phone_number?: string;
  enrolled_at: string;
}

interface AdminTestSeriesItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  is_published: boolean;
  price?: number | string | null;
  tests_count: number;
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [examsList, setExamsList] = useState<ExamOption[]>([]);
  const [classesList, setClassesList] = useState<OptionItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<OptionItem[]>([]);
  const [allStudentsList, setAllStudentsList] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    thumbnail_url: '/images/hero/slide-1.jpg',
    exam: '',
    exam_type: 'BOTH' as 'JEE_MAIN' | 'JEE_ADVANCED' | 'BOTH',
    price: 0,
    original_price: 7999,
    discount_badge: '100% OFF (FREE)',
    is_free: true,
    features: ['HD Video Lectures', 'Daily Practice Problems (DPP)', 'Chapter Formula Maps', 'All-India CBT Mock Tests'],
    newFeatureInput: '',
    start_date: '',
    end_date: '',
    status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED',
    allow_self_enrollment: true,
    classes: [] as number[],
    subjects: [] as number[],
  });

  // Enrolled Students Modal
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<CourseItem | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState('');
  const [isEnrollingStudent, setIsEnrollingStudent] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  // Test Series Modal Tab
  const [modalTab, setModalTab] = useState<'details' | 'test-series'>('details');
  const [testSeriesList, setTestSeriesList] = useState<AdminTestSeriesItem[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [seriesFormData, setSeriesFormData] = useState({
    title: '',
    description: '',
    order: 0,
    is_published: true,
    price: '',
  });
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);

  const loadTestSeries = async (courseId: string) => {
    setIsLoadingSeries(true);
    try {
      const res = await apiClient.get<AdminTestSeriesItem[]>(`/admin-panel/test-series/?course=${courseId}`);
      setTestSeriesList(asList<AdminTestSeriesItem>(res));
    } catch (err) {
      console.error('Failed to load test series', err);
    } finally {
      setIsLoadingSeries(false);
    }
  };

  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !seriesFormData.title.trim()) return;
    setIsSavingSeries(true);
    try {
      const payload = {
        title: seriesFormData.title.trim(),
        description: seriesFormData.description.trim(),
        order: Number(seriesFormData.order) || 0,
        is_published: seriesFormData.is_published,
        price: seriesFormData.price !== '' ? Number(seriesFormData.price) : null,
        course: editingId,
      };
      if (editingSeriesId) {
        await apiClient.patch(`/admin-panel/test-series/${editingSeriesId}/`, payload);
        setFeedback({ type: 'success', message: 'Test series updated.' });
      } else {
        await apiClient.post('/admin-panel/test-series/', payload);
        setFeedback({ type: 'success', message: 'Test series created.' });
      }
      setEditingSeriesId(null);
      setSeriesFormData({ title: '', description: '', order: 0, is_published: true, price: '' });
      loadTestSeries(editingId);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save test series.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSavingSeries(false);
    }
  };

  const handleDeleteSeries = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test series?')) return;
    try {
      await apiClient.delete(`/admin-panel/test-series/${id}/`);
      setFeedback({ type: 'success', message: 'Test series deleted.' });
      if (editingId) loadTestSeries(editingId);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete test series.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [courseRes, optRes] = await Promise.all([
        apiClient.get<CourseItem[]>('/admin-panel/courses/'),
        apiClient.get<{ exams?: ExamOption[]; classes: OptionItem[]; subjects: OptionItem[] }>('/admin-panel/options/'),
      ]);
      setCourses(asList<CourseItem>(courseRes));
      setExamsList(optRes?.exams || []);
      setClassesList(optRes?.classes || []);
      setSubjectsList(optRes?.subjects || []);
    } catch (err: unknown) {
      console.error('[Admin Courses fetchData error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load courses.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setModalTab('details');
    setTestSeriesList([]);
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      thumbnail_url: '/images/hero/slide-1.jpg',
      exam: '',
      exam_type: 'BOTH',
      price: 0,
      original_price: 7999,
      discount_badge: '100% OFF (FREE)',
      is_free: true,
      features: ['HD Video Lectures', 'Daily Practice Problems (DPP)', 'Chapter Formula Maps', 'All-India CBT Mock Tests'],
      newFeatureInput: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      status: 'PUBLISHED',
      allow_self_enrollment: true,
      classes: [],
      subjects: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (course: CourseItem) => {
    setEditingId(course.id);
    setModalTab('details');
    loadTestSeries(course.id);
    setFormData({
      title: course.title,
      subtitle: course.subtitle || '',
      description: course.description || '',
      thumbnail_url: course.thumbnail_url || '/images/hero/slide-1.jpg',
      exam: course.exam ? String(course.exam) : '',
      exam_type: course.exam_type || 'BOTH',
      price: Number(course.price) || 0,
      original_price: Number(course.original_price) || 7999,
      discount_badge: course.discount_badge || '',
      is_free: course.is_free,
      features: course.features || [],
      newFeatureInput: '',
      start_date: course.start_date || '',
      end_date: course.end_date || '',
      status: course.status || (course.is_published ? 'PUBLISHED' : 'DRAFT'),
      allow_self_enrollment: course.allow_self_enrollment ?? true,
      classes: course.classes || [],
      subjects: course.subjects || [],
    });
    setIsModalOpen(true);
  };

  const handleAddFeature = () => {
    if (!formData.newFeatureInput.trim()) return;
    setFormData({
      ...formData,
      features: [...formData.features, formData.newFeatureInput.trim()],
      newFeatureInput: '',
    });
  };

  const handleRemoveFeature = (idx: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== idx),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFeedback({ type: 'error', message: 'Course title is required' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        description: formData.description.trim(),
        thumbnail_url: formData.thumbnail_url.trim() || '/images/hero/slide-1.jpg',
        exam: formData.exam || null,
        exam_type: formData.exam_type,
        price: Number(formData.price) || 0,
        original_price: Number(formData.original_price) || 0,
        discount_badge: formData.discount_badge.trim(),
        is_free: Number(formData.price) === 0,
        features: formData.features,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        is_published: formData.status === 'PUBLISHED',
        allow_self_enrollment: formData.allow_self_enrollment,
        classes: formData.classes,
        subjects: formData.subjects,
      };

      if (editingId) {
        await apiClient.patch(`/admin-panel/courses/${editingId}/`, payload);
        setFeedback({ type: 'success', message: 'Course updated successfully.' });
      } else {
        await apiClient.post('/admin-panel/courses/', payload);
        setFeedback({ type: 'success', message: 'Course created successfully.' });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      let message = 'Failed to save course.';
      if (err instanceof ApiError) {
        if (err.data && typeof err.data === 'object') {
          const fieldEntries = Object.entries(err.data as Record<string, unknown>).filter(
            ([k]) => !['status_code', 'detail'].includes(k)
          );
          if (fieldEntries.length > 0) {
            message = fieldEntries
              .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${Array.isArray(v) ? v.join(' ') : String(v)}`)
              .join(' | ');
          } else {
            message = err.message || `API Error (${err.status})`;
          }
        } else {
          message = err.message || `API Error (${err.status})`;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setFeedback({ type: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course? Enrolled students will lose access.')) return;
    try {
      await apiClient.delete(`/admin-panel/courses/${id}/`);
      setFeedback({ type: 'success', message: 'Course deleted successfully.' });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete course.';
      setFeedback({ type: 'error', message });
    }
  };

  const handleToggleStatus = async (course: CourseItem) => {
    const nextStatus = course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await apiClient.patch(`/admin-panel/courses/${course.id}/`, {
        status: nextStatus,
        is_published: nextStatus === 'PUBLISHED',
      });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update course status.';
      setFeedback({ type: 'error', message });
    }
  };

  const loadStudentsForEnroll = async (query = '') => {
    setIsSearchingStudents(true);
    try {
      const endpoint = query.trim()
        ? `/admin-panel/students/?search=${encodeURIComponent(query.trim())}`
        : '/admin-panel/students/';
      const res = await apiClient.get<Array<{ id: string; email: string; first_name: string; last_name: string; username: string }>>(endpoint);
      const list = asList<{ id: string; email: string; first_name: string; last_name: string; username: string }>(res);
      setAllStudentsList(
        list.map((s) => ({
          id: s.id,
          email: s.email,
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username || s.email,
        }))
      );
    } catch (err) {
      console.error('[loadStudentsForEnroll error]', err);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const openStudentsModal = async (course: CourseItem) => {
    setSelectedCourseForStudents(course);
    setIsLoadingStudents(true);
    setSelectedStudentToEnroll('');
    setStudentSearchQuery('');
    loadStudentsForEnroll('');
    try {
      const data = await apiClient.get<EnrolledStudent[]>(`/admin-panel/courses/${course.id}/students/`);
      setEnrolledStudents(asList<EnrolledStudent>(data));
    } catch (err: unknown) {
      console.error('[openStudentsModal error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load enrolled students.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForStudents || !selectedStudentToEnroll) return;
    setIsEnrollingStudent(true);
    try {
      await apiClient.post(`/admin-panel/courses/${selectedCourseForStudents.id}/enroll-student/`, {
        user_id: selectedStudentToEnroll,
      });
      setFeedback({ type: 'success', message: 'Student enrolled in course successfully.' });
      setSelectedStudentToEnroll('');
      openStudentsModal(selectedCourseForStudents);
      fetchData();
    } catch (err: unknown) {
      console.error('[handleEnrollStudent error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to enroll student.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsEnrollingStudent(false);
    }
  };

  const handleUnenrollStudent = async (studentId: string) => {
    if (!selectedCourseForStudents) return;
    if (!confirm('Are you sure you want to un-enroll this student?')) return;
    try {
      await apiClient.post(`/admin-panel/courses/${selectedCourseForStudents.id}/unenroll-student/`, {
        user_id: studentId,
      });
      setFeedback({ type: 'success', message: 'Student un-enrolled from course.' });
      openStudentsModal(selectedCourseForStudents);
      fetchData();
    } catch (err: unknown) {
      console.error('[handleUnenrollStudent error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to un-enroll student.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand-400" />
            Course Management
          </h1>
          <p className="text-sm text-slate-400">
            Create academic courses, set pricing and admissions rules, and manage student enrollments.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Create New Course
        </Button>
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

      {/* Courses List */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm">Loading course programs...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-base font-medium text-slate-300">No courses created yet</p>
            <p className="text-sm text-slate-500 mt-1">Create your first comprehensive course above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-brand-500/30 text-brand-400 bg-brand-500/10 text-xs">
                      {course.exam_name || (course.exam_type ? course.exam_type.replace('_', ' ') : 'General')}
                    </Badge>
                    <button
                      onClick={() => handleToggleStatus(course)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        course.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${course.status === 'PUBLISHED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      {course.status}
                    </button>
                    {course.allow_self_enrollment ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                        <Unlock className="w-3 h-3" /> Open Enrollment
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                        <Lock className="w-3 h-3" /> Admin Enrolled Only
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-100">{course.title}</h3>
                  {course.subtitle && <p className="text-xs text-slate-400">{course.subtitle}</p>}

                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                    <span className="text-slate-200 font-semibold">
                      Price: {Number(course.price) === 0 ? 'FREE' : `₹${course.price}`}
                      {Number(course.original_price) > 0 && (
                        <span className="text-slate-500 line-through ml-1.5">₹{course.original_price}</span>
                      )}
                    </span>
                    <span className="text-brand-400 flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5" /> {course.enrolled_count} Enrolled Student{course.enrolled_count !== 1 ? 's' : ''}
                    </span>
                    {course.start_date && (
                      <span className="text-slate-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5" /> Starts {course.start_date}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openStudentsModal(course)}
                    className="border-slate-800 text-xs text-brand-400 hover:bg-brand-500/10"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Students ({course.enrolled_count})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(course)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(course.id)}
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

      {/* Course Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-brand-400" />
                {editingId ? 'Edit Course Details' : 'Create New Course'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            {/* Tabs when editing an existing course */}
            {editingId && (
              <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setModalTab('details')}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                    modalTab === 'details'
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Course Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalTab('test-series');
                    loadTestSeries(editingId);
                  }}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    modalTab === 'test-series'
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Test Series</span>
                  {testSeriesList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-500/20 text-brand-400 font-bold">
                      {testSeriesList.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {modalTab === 'details' ? (
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. JEE Main + Advanced 2025 Complete Preparation Program"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subtitle / Tagline</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g. Structured lectures, chapter notes, and mock tests for Class 11 & 12"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Course Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Comprehensive syllabus overview and course methodology..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Academic Exam</label>
                  <select
                    value={formData.exam}
                    onChange={(e) => {
                      const newExam = e.target.value;
                      setFormData({
                        ...formData,
                        exam: newExam,
                        classes: [],
                        subjects: [],
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">No Specific Exam (General)</option>
                    {examsList.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Legacy Exam Type</label>
                  <select
                    value={formData.exam_type}
                    onChange={(e) => setFormData({ ...formData, exam_type: e.target.value as CourseItem['exam_type'] })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="BOTH">JEE Main & Advanced</option>
                    <option value="JEE_MAIN">JEE Main Only</option>
                    <option value="JEE_ADVANCED">JEE Advanced Focus</option>
                  </select>
                </div>
              </div>

              {/* Dependent Classes Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enrolled Academic Classes {formData.exam && <span className="text-slate-500">(Filtered by selected exam)</span>}
                </label>
                <div className="flex flex-wrap gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg max-h-32 overflow-y-auto">
                  {classesList
                    .filter((cls) => !formData.exam || String(cls.exam_id) === formData.exam)
                    .map((cls) => {
                      const idNum = Number(cls.id);
                      const isSelected = formData.classes.includes(idNum);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            const newClasses = isSelected
                              ? formData.classes.filter((c) => c !== idNum)
                              : [...formData.classes, idNum];
                            const newSubjects = formData.subjects.filter((sId) => {
                              const sObj = subjectsList.find((s) => Number(s.id) === sId);
                              return sObj && sObj.academic_class_id && newClasses.includes(sObj.academic_class_id);
                            });
                            setFormData({ ...formData, classes: newClasses, subjects: newSubjects });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            isSelected
                              ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {cls.name} {cls.code ? `(${cls.code})` : ''}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Dependent Subjects Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enrolled Subjects {formData.classes.length > 0 && <span className="text-slate-500">(Filtered by selected classes)</span>}
                </label>
                <div className="flex flex-wrap gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg max-h-36 overflow-y-auto">
                  {subjectsList
                    .filter((sub) => {
                      if (formData.classes.length > 0) {
                        return sub.academic_class_id && formData.classes.includes(sub.academic_class_id);
                      }
                      if (formData.exam) {
                        return String(sub.exam_id) === formData.exam;
                      }
                      return true;
                    })
                    .map((sub) => {
                      const idNum = Number(sub.id);
                      const isSelected = formData.subjects.includes(idNum);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            const newSubs = isSelected
                              ? formData.subjects.filter((s) => s !== idNum)
                              : [...formData.subjects, idNum];
                            setFormData({ ...formData, subjects: newSubs });
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {sub.subject_label || (sub.class_name ? `${sub.class_name} · ${sub.name}` : sub.name)}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Offer Price (₹)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    value={formData.original_price}
                    onChange={(e) => setFormData({ ...formData, original_price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Thumbnail Image URL</label>
                <input
                  type="text"
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  placeholder="/images/hero/slide-1.jpg or https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Course Features List */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Course Features List</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.newFeatureInput}
                    onChange={(e) => setFormData({ ...formData, newFeatureInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                    placeholder="e.g. 50+ Full-length Mock Tests with NTA CBT Analytics"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                  <Button type="button" onClick={handleAddFeature} size="sm" className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-200">
                    Add Feature
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {formData.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                      <span>• {feat}</span>
                      <button type="button" onClick={() => handleRemoveFeature(idx)} className="text-rose-400 hover:text-rose-300">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status and Self-Enrollment Toggles */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">Publication Status</span>
                    <span className="text-[11px] text-slate-500">Draft courses remain hidden from student catalog</span>
                  </div>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CourseItem['status'] })}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="PUBLISHED">Published Live</option>
                    <option value="DRAFT">Draft Only</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">Allow Student Self-Enrollment</span>
                    <span className="text-[11px] text-slate-500">If disabled, only admins can enroll students into this course</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allow_self_enrollment}
                    onChange={(e) => setFormData({ ...formData, allow_self_enrollment: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-brand-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-slate-800 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-brand-500 hover:bg-brand-600 text-white">
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? 'Update Course' : 'Create Course'}
                </Button>
              </div>
            </form>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Form to add or edit a test series */}
                <form onSubmit={handleSaveSeries} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-xs font-semibold text-slate-200">
                      {editingSeriesId ? 'Edit Test Series' : 'Add New Test Series'}
                    </h3>
                    {editingSeriesId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeriesId(null);
                          setSeriesFormData({ title: '', description: '', order: 0, is_published: true, price: '' });
                        }}
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Series Title *</label>
                    <input
                      type="text"
                      required
                      value={seriesFormData.title}
                      onChange={(e) => setSeriesFormData({ ...seriesFormData, title: e.target.value })}
                      placeholder="e.g. JEE Advanced Full Syllabus Mock Series"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={seriesFormData.order}
                        onChange={(e) => setSeriesFormData({ ...seriesFormData, order: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Add-on Price (₹, optional)</label>
                      <input
                        type="number"
                        value={seriesFormData.price}
                        onChange={(e) => setSeriesFormData({ ...seriesFormData, price: e.target.value })}
                        placeholder="Leave blank if included"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer pb-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={seriesFormData.is_published}
                          onChange={(e) => setSeriesFormData({ ...seriesFormData, is_published: e.target.checked })}
                          className="rounded border-slate-800 bg-slate-950 text-brand-500"
                        />
                        Published Live
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSavingSeries} size="sm" className="bg-brand-500 hover:bg-brand-600 text-white text-xs">
                      {isSavingSeries && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {editingSeriesId ? 'Save Changes' : 'Create Series'}
                    </Button>
                  </div>
                </form>

                {/* List of existing test series */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Existing Test Series ({testSeriesList.length})
                  </h4>
                  {isLoadingSeries ? (
                    <div className="py-6 flex justify-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : testSeriesList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
                      No test series created for this course yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {testSeriesList.map((ts) => (
                        <div key={ts.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">{ts.title}</span>
                              {ts.is_published ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Live</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-400">Draft</Badge>
                              )}
                              {ts.price ? (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">Add-on ₹{ts.price}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">Included</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ts.tests_count} test(s) • Order: {ts.order}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-slate-200 h-7 w-7 p-0"
                              onClick={() => {
                                setEditingSeriesId(ts.id);
                                setSeriesFormData({
                                  title: ts.title,
                                  description: ts.description || '',
                                  order: ts.order,
                                  is_published: ts.is_published,
                                  price: ts.price !== null && ts.price !== undefined ? String(ts.price) : '',
                                });
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-rose-400 hover:text-rose-300 h-7 w-7 p-0"
                              onClick={() => handleDeleteSeries(ts.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enrolled Students Modal */}
      {selectedCourseForStudents && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-400" />
                  Enrolled Students
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCourseForStudents.title}</p>
              </div>
              <button onClick={() => setSelectedCourseForStudents(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Enroll new student form with dynamic search */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Enroll a Student</div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student by name, email, or phone..."
                    value={studentSearchQuery}
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value);
                      loadStudentsForEnroll(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  {isSearchingStudents && (
                    <div className="absolute right-2.5 top-2 text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                  )}
                </div>

                <form onSubmit={handleEnrollStudent} className="flex gap-2">
                  <select
                    value={selectedStudentToEnroll}
                    onChange={(e) => setSelectedStudentToEnroll(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">
                      {allStudentsList.length === 0
                        ? isSearchingStudents ? 'Searching...' : 'No students found (type to search)'
                        : 'Select student to enroll...'}
                    </option>
                    {allStudentsList.map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.name} ({stu.email})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    disabled={!selectedStudentToEnroll || isEnrollingStudent}
                    className="bg-brand-500 hover:bg-brand-600 text-white text-xs shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    {isEnrollingStudent ? 'Enrolling...' : 'Enroll'}
                  </Button>
                </form>
              </div>

              {/* Enrolled list */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Active Enrolled Students ({enrolledStudents.length})
                </h3>

                {isLoadingStudents ? (
                  <div className="py-8 flex justify-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                  </div>
                ) : enrolledStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-950 rounded-lg border border-slate-800 text-center">
                    No students currently enrolled in this course.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {enrolledStudents.map((st) => (
                      <div
                        key={st.id}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{st.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{st.email}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Enrolled: {new Date(st.enrolled_at).toLocaleDateString()}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnenrollStudent(st.id)}
                          className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-1" />
                          Unenroll
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedCourseForStudents(null)} className="border-slate-800 text-slate-300">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
