'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList, PaginatedResponse } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Key,
  BookOpen,
  TrendingUp,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Calendar,
  Phone,
  Mail,
  Video,
  FileQuestion,
  Award,
} from 'lucide-react';

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

  const handleToggleStatus = async (student: StudentItem) => {
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
      // refresh local modal student
      const updated = students.find((s) => s.id === enrollModalStudent.id);
      if (updated) setEnrollModalStudent(updated);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to enroll student.' });
    } finally {
      setIsUpdatingEnrollment(false);
    }
  };

  const handleUnenrollCourse = async (courseId: string) => {
    if (!enrollModalStudent) return;
    if (!confirm('Are you sure you want to un-enroll this student from this course?')) return;

    setIsUpdatingEnrollment(true);
    try {
      await apiClient.post(`/admin-panel/students/${enrollModalStudent.id}/unenroll/`, {
        course_id: courseId,
      });
      setFeedback({ type: 'success', message: 'Course un-enrolled successfully.' });
      fetchData();
      // refresh local modal student
      const updated = students.find((s) => s.id === enrollModalStudent.id);
      if (updated) setEnrollModalStudent(updated);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to un-enroll student.' });
    } finally {
      setIsUpdatingEnrollment(false);
    }
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

  const filteredStudents = students.filter((s) => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      s.email.toLowerCase().includes(query) ||
      (s.phone_number && s.phone_number.includes(query)) ||
      s.username.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            Students Directory & Enrollment Management
          </h1>
          <p className="text-sm text-slate-400">
            Monitor registered students, inspect learning progress, manage enrollments, and control access.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
          Total Enrolled Students: <span className="text-slate-100 font-bold">{totalCount || students.length}</span>
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
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <Card className="p-4 bg-slate-900/40 border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student by name, email, phone number, or username..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              fetchStudents(val);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </Card>

      {/* Students Table */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm">Loading student directory...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-base font-medium text-slate-300">No students registered yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Registered students will appear here with real database activity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Student Details</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Enrollments</th>
                  <th className="px-5 py-3.5">Progress & Accuracy</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-100">
                        {`${s.first_name} ${s.last_name}`.trim() || s.username}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {s.email}
                      </div>
                      {s.phone_number && (
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          {s.phone_number}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        Joined {new Date(s.date_joined).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {s.target_exam ? (
                        <div>
                          <Badge variant="outline" className="border-brand-500/30 text-brand-400 bg-brand-500/10 text-xs">
                            {s.target_exam}
                          </Badge>
                          {s.target_year && (
                            <div className="text-[11px] text-slate-400 mt-1">Class of {s.target_year}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Unspecified</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-300 font-medium">
                          {s.enrolled_courses.length} Course{s.enrolled_courses.length !== 1 ? 's' : ''}
                        </div>
                        {s.enrolled_courses.slice(0, 2).map((c, idx) => (
                          <div key={idx} className="text-[11px] text-slate-400 line-clamp-1">
                            • {c.course__title}
                          </div>
                        ))}
                        {s.enrolled_courses.length > 2 && (
                          <div className="text-[10px] text-brand-400">
                            +{s.enrolled_courses.length - 2} more
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEnrollModalStudent(s)}
                          className="text-[11px] h-6 px-2 text-brand-400 hover:text-brand-300 mt-1 p-0"
                        >
                          Manage Courses
                        </Button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="text-slate-200">
                          <span className="text-slate-400">Tests:</span> {s.test_attempts_count} • <span className="text-slate-400">DPPs:</span> {s.dpp_attempts_count}
                        </div>
                        <div className="text-slate-200">
                          <span className="text-slate-400">Videos:</span> {s.completed_videos_count}
                        </div>
                        <div className="text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {s.overall_accuracy}% Accuracy
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          s.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        }`}
                      >
                        {s.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {s.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProgressModal(s)}
                          className="h-8 px-2.5 text-xs text-brand-400 hover:bg-brand-500/10 hover:text-brand-300"
                        >
                          <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          Analytics
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPasswordModalStudent(s);
                            setNewPassword('');
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextPageUrl && (
          <div className="p-4 border-t border-slate-800 flex justify-center bg-slate-900/30">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
              className="border-slate-800 text-xs text-slate-300 hover:text-white"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Loading more students...
                </>
              ) : (
                `Load More Students (Showing ${students.length} of ${totalCount})`
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Password Reset Modal */}
      {passwordModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-brand-400" />
              Reset Student Password
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enter a new secure password for <strong className="text-slate-200">{passwordModalStudent.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordModalStudent(null)}
                  className="border-slate-800 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResettingPassword}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  {isResettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirm Reset
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Enrollment Modal */}
      {enrollModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-400" />
                  Course Enrollments
                </h2>
                <p className="text-xs text-slate-400">{enrollModalStudent.email}</p>
              </div>
              <button
                onClick={() => setEnrollModalStudent(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Active Enrolled Courses
                </h3>
                {enrollModalStudent.enrolled_courses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No courses currently enrolled.</p>
                ) : (
                  <div className="space-y-2">
                    {enrollModalStudent.enrolled_courses.map((ec) => (
                      <div
                        key={ec.course__id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800"
                      >
                        <span className="text-sm font-medium text-slate-200">{ec.course__title}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isUpdatingEnrollment}
                          onClick={() => handleUnenrollCourse(ec.course__id)}
                          className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Unenroll
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Enroll in New Course
                </h3>
                <form onSubmit={handleEnrollCourse} className="flex gap-2">
                  <select
                    value={selectedCourseToEnroll}
                    onChange={(e) => setSelectedCourseToEnroll(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select course to assign...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    disabled={!selectedCourseToEnroll || isUpdatingEnrollment}
                    className="bg-brand-500 hover:bg-brand-600 text-white shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Enroll
                  </Button>
                </form>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setEnrollModalStudent(null)}
                className="border-slate-800 text-slate-300"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Results Modal */}
      {progressModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-400" />
                  Student Learning & Test Results
                </h2>
                <p className="text-xs text-slate-400">
                  {progressModalStudent.first_name} {progressModalStudent.last_name} ({progressModalStudent.email})
                </p>
              </div>
              <button
                onClick={() => setProgressModalStudent(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isLoadingProgress ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                  <p className="text-xs">Computing student metrics...</p>
                </div>
              ) : !studentProgress ? (
                <p className="text-sm text-slate-400">No activity data found for this student.</p>
              ) : (
                <>
                  {/* Test attempts */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      CBT Mock Test Submissions ({studentProgress.test_attempts.length})
                    </h3>
                    {studentProgress.test_attempts.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                        Student has not submitted any CBT mock tests yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {studentProgress.test_attempts.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-medium text-slate-200">{t.test_title}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Completed: {new Date(t.completed_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-100 font-bold">
                                {t.score} / {t.total_marks} marks
                              </div>
                              <div className="text-emerald-400 text-[11px] font-medium">
                                {t.accuracy}% accuracy
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DPP attempts */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <FileQuestion className="w-3.5 h-3.5 text-brand-400" />
                      Daily Practice Problems (DPP) ({studentProgress.dpp_attempts.length})
                    </h3>
                    {studentProgress.dpp_attempts.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                        No DPP practice attempts recorded.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {studentProgress.dpp_attempts.map((d) => (
                          <div
                            key={d.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-medium text-slate-200">{d.dpp_title}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Completed: {new Date(d.completed_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-slate-100 font-bold">{d.score} correct</div>
                              <div className="text-emerald-400 text-[11px] font-medium">
                                {d.accuracy}% accuracy
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Video watch history */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                      Lectures & Videos Watched ({studentProgress.video_progress.length})
                    </h3>
                    {studentProgress.video_progress.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-lg border border-slate-800">
                        No video lectures watched yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {studentProgress.video_progress.map((v) => (
                          <div
                            key={v.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div className="font-medium text-slate-200">{v.video_title}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono">
                                {Math.floor(v.watched_seconds / 60)} mins
                              </span>
                              <Badge
                                className={
                                  v.completed
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }
                              >
                                {v.completed ? 'Completed' : 'In Progress'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setProgressModalStudent(null)}
                className="border-slate-800 text-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
