'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList, PaginatedResponse } from '@/lib/api-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Key,
  TrendingUp,
  UserCheck,
  UserX,
  Calendar,
  Phone,
  Mail,
  Download,
  Trash2,
  Plus,
  BookOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable, ColumnDef } from '@/components/admin/data-table';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

interface EnrolledCourse {
  course__id: string;
  course__title: string;
  enrolled_at: string;
}

interface StudentItem {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_active: boolean;
  is_verified: boolean;
  last_login?: string | null;
  date_joined: string;
  target_exam?: string | null;
  target_year?: number | null;
  enrolled_courses: EnrolledCourse[];
  test_attempts_count: number;
  dpp_attempts_count: number;
  completed_videos_count: number;
  overall_accuracy: number;
}

interface CourseOption {
  id: string;
  title: string;
}

interface StudentProgressData {
  student_id: string;
  email: string;
  name: string;
  test_attempts: Array<{
    id: string;
    test_title: string;
    score: number;
    total_marks: number;
    accuracy: number;
    completed_at: string;
  }>;
  dpp_attempts: Array<{
    id: string;
    dpp_title: string;
    score: number;
    accuracy: number;
    completed_at: string;
  }>;
  video_progress: Array<{
    id: string;
    video_title: string;
    watched_seconds: number;
    completed: boolean;
  }>;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection for bulk actions (Task 4)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    action: async () => {},
  });
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset Password Modal
  const [passwordModalStudent, setPasswordModalStudent] = useState<StudentItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Enrollment Modal
  const [enrollModalStudent, setEnrollModalStudent] = useState<StudentItem | null>(null);
  const [selectedCourseToEnroll, setSelectedCourseToEnroll] = useState('');
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false);

  // Progress Modal
  const [progressModalStudent, setProgressModalStudent] = useState<StudentItem | null>(null);
  const [studentProgress, setStudentProgress] = useState<StudentProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Pagination & Load More state
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchStudents = useCallback(async (query = '', url?: string, isAppending = false) => {
    if (isAppending) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      let endpoint = url;
      if (!endpoint) {
        endpoint = query.trim()
          ? `/admin-panel/students/?search=${encodeURIComponent(query.trim())}`
          : '/admin-panel/students/';
      }
      const res = await apiClient.get<StudentItem[] | PaginatedResponse<StudentItem>>(endpoint);
      const list = asList<StudentItem>(res);
      const paginated = res as unknown as PaginatedResponse<StudentItem>;

      if (isAppending) {
        setStudents((prev) => [...prev, ...list]);
      } else {
        setStudents(list);
      }
      setNextPageUrl(paginated?.next || null);
      setTotalCount(paginated?.count ?? (isAppending ? students.length + list.length : list.length));
    } catch (err: unknown) {
      console.error('[Admin Students fetchStudents error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load students.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [students.length]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stuRes, courseRes] = await Promise.all([
        apiClient.get<StudentItem[] | PaginatedResponse<StudentItem>>('/admin-panel/students/'),
        apiClient.get<CourseOption[]>('/admin-panel/courses/'),
      ]);
      const list = asList<StudentItem>(stuRes);
      setStudents(list);
      const paginated = stuRes as unknown as PaginatedResponse<StudentItem>;
      setNextPageUrl(paginated?.next || null);
      setTotalCount(paginated?.count ?? list.length);
      setCourses(asList<CourseOption>(courseRes));
    } catch (err: unknown) {
      console.error('[Admin Students fetchData error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load student directory.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (nextPageUrl && !isLoadingMore) {
      fetchStudents(searchQuery, nextPageUrl, true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = (student: StudentItem) => {
    const actionWord = student.is_active ? 'deactivate' : 'activate';
    setConfirmState({
      open: true,
      title: `${student.is_active ? 'Deactivate' : 'Activate'} Student Account?`,
      description: `Are you sure you want to ${actionWord} the account for ${student.email}? ${
        student.is_active ? 'They will no longer be able to log in or access coursework.' : 'They will regain access immediately.'
      }`,
      confirmText: student.is_active ? 'Deactivate' : 'Activate',
      variant: student.is_active ? 'danger' : 'primary',
      action: async () => {
        try {
          const res = await apiClient.post<{ message: string; is_active: boolean }>(
            `/admin-panel/students/${student.id}/toggle-status/`,
            {}
          );
          setFeedback({ type: 'success', message: res.message });
          fetchData();
        } catch {
          setFeedback({ type: 'error', message: 'Failed to toggle account status.' });
        }
      },
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalStudent) return;
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await apiClient.post<{ message: string }>(
        `/admin-panel/students/${passwordModalStudent.id}/reset-password/`,
        { new_password: newPassword }
      );
      setFeedback({ type: 'success', message: res.message });
      setPasswordModalStudent(null);
      setNewPassword('');
    } catch {
      setFeedback({ type: 'error', message: 'Failed to reset password.' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleEnrollCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollModalStudent || !selectedCourseToEnroll) return;

    setIsUpdatingEnrollment(true);
    try {
      await apiClient.post(`/admin-panel/students/${enrollModalStudent.id}/enroll/`, {
        course_id: selectedCourseToEnroll,
      });
      setFeedback({ type: 'success', message: 'Student enrolled in course successfully.' });
      fetchData();
      const updated = students.find((s) => s.id === enrollModalStudent.id);
      if (updated) setEnrollModalStudent(updated);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to enroll student.' });
    } finally {
      setIsUpdatingEnrollment(false);
    }
  };

  const handleUnenrollCourse = (courseId: string, courseTitle: string) => {
    if (!enrollModalStudent) return;
    setConfirmState({
      open: true,
      title: 'Un-enroll Student from Course?',
      description: `Are you sure you want to remove ${enrollModalStudent.email} from "${courseTitle}"?`,
      confirmText: 'Un-enroll',
      variant: 'danger',
      action: async () => {
        setIsUpdatingEnrollment(true);
        try {
          await apiClient.post(`/admin-panel/students/${enrollModalStudent.id}/unenroll/`, {
            course_id: courseId,
          });
          setFeedback({ type: 'success', message: 'Course un-enrolled successfully.' });
          fetchData();
          const updated = students.find((s) => s.id === enrollModalStudent.id);
          if (updated) setEnrollModalStudent(updated);
        } catch {
          setFeedback({ type: 'error', message: 'Failed to un-enroll student.' });
        } finally {
          setIsUpdatingEnrollment(false);
        }
      },
    });
  };

  const openProgressModal = async (student: StudentItem) => {
    setProgressModalStudent(student);
    setIsLoadingProgress(true);
    try {
      const data = await apiClient.get<StudentProgressData>(
        `/admin-panel/students/${student.id}/progress/`
      );
      setStudentProgress(data);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load student progress metrics.' });
    } finally {
      setIsLoadingProgress(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      const query = searchQuery.toLowerCase();
      return (
        fullName.includes(query) ||
        s.email.toLowerCase().includes(query) ||
        (s.phone_number && s.phone_number.includes(query)) ||
        s.username.toLowerCase().includes(query)
      );
    });
  }, [students, searchQuery]);

  // CSV Export (Task 4)
  const exportToCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['ID', 'Email', 'Username', 'Name', 'Phone', 'Active', 'Joined', 'Target Exam', 'Target Year', 'Enrolled Courses', 'Accuracy (%)'];
    const rows = filteredStudents.map((s) => [
      `"${s.id}"`,
      `"${s.email}"`,
      `"${s.username}"`,
      `"${(s.first_name + ' ' + s.last_name).trim()}"`,
      `"${s.phone_number || ''}"`,
      s.is_active ? 'Yes' : 'No',
      `"${new Date(s.date_joined).toISOString()}"`,
      `"${s.target_exam || ''}"`,
      s.target_year || '',
      `"${s.enrolled_courses.map((c) => c.course__title).join('; ')}"`,
      s.overall_accuracy,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adept_students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk actions handler
  const handleBulkStatusChange = (activate: boolean) => {
    if (selectedIds.length === 0) return;
    setConfirmState({
      open: true,
      title: `${activate ? 'Activate' : 'Deactivate'} ${selectedIds.length} Students?`,
      description: `Are you sure you want to ${activate ? 'activate' : 'deactivate'} access for all ${selectedIds.length} selected student accounts?`,
      confirmText: activate ? 'Activate All' : 'Deactivate All',
      variant: activate ? 'primary' : 'danger',
      action: async () => {
        for (const id of selectedIds) {
          const s = students.find((st) => st.id === id);
          if (s && s.is_active !== activate) {
            await apiClient.post(`/admin-panel/students/${id}/toggle-status/`, {}).catch(() => null);
          }
        }
        setFeedback({ type: 'success', message: `Updated status for ${selectedIds.length} students.` });
        setSelectedIds([]);
        fetchData();
      },
    });
  };

  const columns: ColumnDef<StudentItem>[] = [
    {
      key: 'student',
      header: 'Student Details',
      sortable: true,
      sortKey: 'first_name',
      render: (s) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {`${s.first_name} ${s.last_name}`.trim() || s.username}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
            <Mail className="w-3 h-3 text-slate-400" />
            {s.email}
          </div>
          {s.phone_number && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              {s.phone_number}
            </div>
          )}
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            Joined {new Date(s.date_joined).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'target_exam',
      header: 'Target',
      sortable: true,
      render: (s) =>
        s.target_exam ? (
          <div>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 text-xs">
              {s.target_exam}
            </Badge>
            {s.target_year && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Class of {s.target_year}</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">Unspecified</span>
        ),
    },
    {
      key: 'enrollments',
      header: 'Enrollments',
      render: (s) => (
        <div className="space-y-1">
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {s.enrolled_courses.length} Course{s.enrolled_courses.length !== 1 ? 's' : ''}
          </div>
          {s.enrolled_courses.slice(0, 2).map((c, idx) => (
            <div key={idx} className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
              • {c.course__title}
            </div>
          ))}
          {s.enrolled_courses.length > 2 && (
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
              +{s.enrolled_courses.length - 2} more
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEnrollModalStudent(s)}
            className="text-[11px] h-6 px-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 mt-1 p-0"
          >
            Manage Courses
          </Button>
        </div>
      ),
    },
    {
      key: 'overall_accuracy',
      header: 'Progress & Accuracy',
      sortable: true,
      render: (s) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-700 dark:text-slate-200">
            <span className="text-slate-400">Tests:</span> {s.test_attempts_count} • <span className="text-slate-400">DPPs:</span> {s.dpp_attempts_count}
          </div>
          <div className="text-slate-700 dark:text-slate-200">
            <span className="text-slate-400">Videos:</span> {s.completed_videos_count}
          </div>
          <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {s.overall_accuracy}% Accuracy
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      render: (s) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(s)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            s.is_active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          {s.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
          <span>{s.is_active ? 'Active' : 'Disabled'}</span>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openProgressModal(s)}
            className="h-8 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-500"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            <span>Analytics</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPasswordModalStudent(s);
              setNewPassword('');
            }}
            className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            title="Reset Password"
          >
            <Key className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="Students Directory & Enrollment Management"
        description="Monitor registered students, inspect learning progress, manage enrollments, and control access."
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {totalCount || students.length} enrolled
          </span>
        }
        secondaryActions={
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredStudents.length === 0}
            className="gap-1.5 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        }
      />

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Shared DataTable */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          fetchStudents(q);
        }}
        searchPlaceholder="Search student by name, email, phone number, or username..."
        selectable={true}
        selectedIds={selectedIds}
        onSelectRow={(id, sel) => {
          setSelectedIds((prev) => (sel ? [...prev, id] : prev.filter((i) => i !== id)));
        }}
        onSelectAll={(sel) => {
          setSelectedIds(sel ? filteredStudents.map((s) => s.id) : []);
        }}
        bulkActions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {selectedIds.length} selected:
            </span>
            <button
              type="button"
              onClick={() => handleBulkStatusChange(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            >
              Activate
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusChange(false)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
            >
              Deactivate
            </button>
          </div>
        }
        emptyState={{
          icon: Users,
          title: 'No Students Found',
          description: 'No students matched your search criteria or are registered yet.',
        }}
        pagination={{
          totalItems: totalCount || filteredStudents.length,
          hasNext: Boolean(nextPageUrl),
          onNext: handleLoadMore,
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState((p) => ({ ...p, open: false }))}
        onConfirm={async () => {
          setIsConfirming(true);
          try {
            await confirmState.action();
          } finally {
            setIsConfirming(false);
            setConfirmState((p) => ({ ...p, open: false }));
          }
        }}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
        isLoading={isConfirming}
      />

      {/* Password Reset Modal */}
      {passwordModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Reset Student Password
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Set a temporary password for{' '}
              <span className="text-slate-900 dark:text-slate-200 font-semibold">{passwordModalStudent.email}</span>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPasswordModalStudent(null)}
                  disabled={isResettingPassword}
                  className="text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResettingPassword}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Resetting...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Enrollment Modal */}
      {enrollModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Manage Course Enrollments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enrolled courses for{' '}
              <span className="text-slate-900 dark:text-slate-200 font-semibold">{enrollModalStudent.email}</span>
            </p>

            {/* Currently enrolled list */}
            <div className="space-y-2 mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Enrollments ({enrollModalStudent.enrolled_courses.length})
              </h3>
              {enrollModalStudent.enrolled_courses.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  This student is not enrolled in any course.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {enrollModalStudent.enrolled_courses.map((c) => (
                    <div
                      key={c.course__id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-200">{c.course__title}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          Enrolled on {new Date(c.enrolled_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnenrollCourse(c.course__id, c.course__title)}
                        disabled={isUpdatingEnrollment}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 h-7 px-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Un-enroll
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enroll in new course form */}
            <form onSubmit={handleEnrollCourse} className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enroll In Another Course
              </h3>
              <div className="flex gap-2">
                <select
                  value={selectedCourseToEnroll}
                  onChange={(e) => setSelectedCourseToEnroll(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a Course --</option>
                  {courses
                    .filter(
                      (c) =>
                        !enrollModalStudent.enrolled_courses.some(
                          (ec) => ec.course__id === c.id
                        )
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
                <Button
                  type="submit"
                  disabled={!selectedCourseToEnroll || isUpdatingEnrollment}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs whitespace-nowrap"
                >
                  {isUpdatingEnrollment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Enroll
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="flex justify-end pt-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEnrollModalStudent(null)}
                className="border-slate-300 dark:border-slate-700 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Analytics Modal */}
      {progressModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Student Performance & Progress Analytics
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Inspecting activity for{' '}
                  <span className="text-slate-900 dark:text-slate-200 font-semibold">{progressModalStudent.email}</span>
                </p>
              </div>
              <button
                onClick={() => setProgressModalStudent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6">
              {isLoadingProgress ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs">Fetching performance history...</p>
                </div>
              ) : !studentProgress ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No progress data available for this student.
                </div>
              ) : (
                <>
                  {/* Test Attempts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      CBT Test Attempts ({studentProgress.test_attempts.length})
                    </h3>
                    {studentProgress.test_attempts.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        No test attempts recorded.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {studentProgress.test_attempts.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs"
                          >
                            <span className="font-semibold text-slate-900 dark:text-slate-200">{t.test_title}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {t.score} / {t.total_marks}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {t.accuracy}% Acc
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DPP Attempts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Daily Practice Problems ({studentProgress.dpp_attempts.length})
                    </h3>
                    {studentProgress.dpp_attempts.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        No DPP submissions recorded.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {studentProgress.dpp_attempts.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs"
                          >
                            <span className="font-semibold text-slate-900 dark:text-slate-200">{d.dpp_title}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {d.accuracy}% Acc
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Video Lectures */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Completed Lecture Videos ({studentProgress.video_progress.length})
                    </h3>
                    {studentProgress.video_progress.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-slate-800">
                        No video watch events recorded.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {studentProgress.video_progress.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs"
                          >
                            <span className="font-semibold text-slate-900 dark:text-slate-200">{v.video_title}</span>
                            <Badge variant={v.completed ? 'emerald' : 'outline'} className="text-[10px]">
                              {v.completed ? 'Completed' : `${Math.floor(v.watched_seconds / 60)} mins`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProgressModalStudent(null)}
                className="border-slate-300 dark:border-slate-700 text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
