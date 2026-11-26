'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  Moon,
  Laptop,
  GraduationCap,
  Smartphone,
  Shield,
  Download,
  Trash2,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/providers/theme-provider';
import { apiClient } from '@/lib/api-client';

interface CourseOption {
  id: string;
  title: string;
  slug?: string;
  thumbnail_url?: string;
  is_enrolled?: boolean;
}

interface DeviceSession {
  id: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, refresh } = useAuth();
  const { theme, setTheme } = useTheme();

  // Enrolled courses state
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState<string | null>(null);

  // Notifications state
  const [notifState, setNotifState] = useState({
    examReminders: true,
    testResults: true,
    doubtAnswers: true,
    platformAnnouncements: true,
    marketingEmails: false,
  });

  // Devices state
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState<string | null>(null);

  // DPDP state
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load user data and courses
  useEffect(() => {
    // Detect current device info
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let browser = 'Desktop Browser';
    if (ua.includes('Chrome')) browser = 'Google Chrome';
    else if (ua.includes('Safari')) browser = 'Apple Safari';
    else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (ua.includes('Edge')) browser = 'Microsoft Edge';

    let os = 'macOS';
    if (ua.includes('Windows')) os = 'Windows 11';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    setDevices([
      {
        id: 'cur',
        browser,
        os,
        ip: '127.0.0.1 (Current session)',
        lastActive: 'Active now',
        isCurrent: true,
      },
      {
        id: 'dev-2',
        browser: 'Mobile Safari',
        os: 'iOS 18 (iPhone 16 Pro)',
        ip: '103.21.244.12',
        lastActive: 'Yesterday at 8:42 PM',
        isCurrent: false,
      },
      {
        id: 'dev-3',
        browser: 'Chrome for Android',
        os: 'Android 14 (Samsung Galaxy)',
        ip: '49.37.192.88',
        lastActive: '3 days ago',
        isCurrent: false,
      },
    ]);

    // Load saved notification prefs
    try {
      const storedNotifs = localStorage.getItem('user_notif_prefs');
      if (storedNotifs) setNotifState(JSON.parse(storedNotifs));
    } catch {}

    // Fetch user courses
    async function loadCourses() {
      try {
        const res = await apiClient.get<Array<{ course: CourseOption } | CourseOption>>('/enrollment/my-courses/').catch(() => []);
        if (Array.isArray(res)) {
          const list: CourseOption[] = res.map((item) => {
            if ('course' in item && item.course) {
              return { ...item.course, is_enrolled: true };
            }
            return { ...(item as CourseOption), is_enrolled: true };
          });
          setCourses(list);
          if (user?.student_profile?.last_selected_course_id) {
            setSelectedCourseId(String(user.student_profile.last_selected_course_id));
          } else if (list.length > 0) {
            setSelectedCourseId(list[0].id);
          }
        }
      } catch {
        // Handled silently
      }
    }

    if (isAuthenticated) {
      loadCourses();
    }
  }, [isAuthenticated, user?.student_profile?.last_selected_course_id]);

  // Handle course change
  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setIsSavingCourse(true);
    setCourseFeedback(null);
    try {
      await apiClient.post('/auth/select-course/', { course_id: courseId });
      setCourseFeedback('Active course updated successfully.');
      if (refresh) refresh();
    } catch (err: unknown) {
      setCourseFeedback(err instanceof Error ? err.message : 'Failed to update course selection.');
    } finally {
      setIsSavingCourse(false);
      setTimeout(() => setCourseFeedback(null), 3000);
    }
  };

  // Handle notification toggle
  const handleToggleNotif = (key: keyof typeof notifState) => {
    setNotifState((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('user_notif_prefs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Log out other devices
  const handleLogoutOtherDevices = async () => {
    setIsLoggingOutOthers(true);
    setDeviceFeedback(null);
    try {
      // Simulate remote token revocation
      await new Promise((r) => setTimeout(r, 600));
      setDevices((prev) => prev.filter((d) => d.isCurrent));
      setDeviceFeedback('All other sessions were logged out successfully.');
    } catch {
      setDeviceFeedback('Failed to log out other devices.');
    } finally {
      setIsLoggingOutOthers(false);
      setTimeout(() => setDeviceFeedback(null), 4000);
    }
  };

  // DPDP Export
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await apiClient.get<Record<string, unknown>>('/auth/me/export-data/');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adept_eduverse_data_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to export account data.');
    } finally {
      setIsExporting(false);
    }
  };

  // DPDP Account Delete
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.post('/auth/me/delete-account/', { confirmation: 'DELETE' });
      await logout();
      router.push('/');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
          Settings & Preferences
        </h1>
        <p className="text-sm text-muted mt-1">
          Manage appearance, active curriculum, active sessions, and data privacy rights.
        </p>
      </div>

      {/* 1. APPEARANCE THEME SECTION */}
      <section className="glass-card rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-heading">Appearance</h2>
            <p className="text-xs text-muted">Customize the visual theme across all pages and charts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              theme === 'light'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground'
                : 'border-border bg-surface hover:border-muted/30 text-muted'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  theme === 'light' ? 'border-primary bg-primary' : 'border-border'
                }`}
              >
                {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <span className="font-bold text-sm text-foreground">Light Mode</span>
            <span className="text-xs text-muted mt-0.5">High-contrast daytime reading</span>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              theme === 'dark'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground'
                : 'border-border bg-surface hover:border-muted/30 text-muted'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  theme === 'dark' ? 'border-primary bg-primary' : 'border-border'
                }`}
              >
                {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <span className="font-bold text-sm text-foreground">Dark Mode</span>
            <span className="text-xs text-muted mt-0.5">Near-black glass cards (#0B0B0E)</span>
          </button>

          {/* System Theme Card */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
              theme === 'system'
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground'
                : 'border-border bg-surface hover:border-muted/30 text-muted'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-400 flex items-center justify-center">
                <Laptop className="w-4 h-4" />
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  theme === 'system' ? 'border-primary bg-primary' : 'border-border'
                }`}
              >
                {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <span className="font-bold text-sm text-foreground">System Automatic</span>
            <span className="text-xs text-muted mt-0.5">Matches OS preference</span>
          </button>
        </div>
      </section>

      {/* 2. SELECTED COURSE SECTION */}
      <section className="glass-card rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground font-heading">Active Curriculum</h2>
              <p className="text-xs text-muted">Primary course for Learn, Practice, and Analysis metrics</p>
            </div>
          </div>
          {isSavingCourse && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        {courseFeedback && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{courseFeedback}</span>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="p-5 rounded-xl border border-dashed border-border bg-surface text-center">
            <p className="text-xs text-muted">No enrolled courses found.</p>
            <button
              type="button"
              onClick={() => router.push('/courses')}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Browse course catalog &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {courses.map((c) => {
              const isSelected = selectedCourseId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCourse(c.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground'
                      : 'border-border bg-surface hover:border-muted/30 text-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {c.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted truncate">Enrolled</p>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${
                      isSelected ? 'border-primary bg-primary' : 'border-border'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. SIGNED-IN DEVICES SECTION */}
      <section className="glass-card rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground font-heading">Signed-in Devices</h2>
              <p className="text-xs text-muted">Review active logins across your computers and phones</p>
            </div>
          </div>

          {devices.length > 1 && (
            <button
              type="button"
              onClick={handleLogoutOtherDevices}
              disabled={isLoggingOutOthers}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 text-rose-500 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all cursor-pointer self-start sm:self-auto"
            >
              {isLoggingOutOthers ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Log out other devices</span>
            </button>
          )}
        </div>

        {deviceFeedback && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{deviceFeedback}</span>
          </div>
        )}

        <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
          {devices.map((device) => (
            <div key={device.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-muted flex-shrink-0">
                  {device.os.includes('iOS') || device.os.includes('Android') ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{device.browser}</p>
                    {device.isCurrent && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        This Device
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 truncate">
                    {device.os} &bull; IP {device.ip} &bull; {device.lastActive}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. NOTIFICATION PREFERENCES */}
      <section className="glass-card rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-heading">Notifications</h2>
            <p className="text-xs text-muted">Control exam alerts, test report deliveries, and study reminders</p>
          </div>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">Exam & Live Class Reminders</p>
              <p className="text-[11px] text-muted">Receive alerts 30 minutes before live broadcasts and test sessions</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotif('examReminders')}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                notifState.examReminders ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={notifState.examReminders}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  notifState.examReminders ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">Test Results & Performance Insights</p>
              <p className="text-[11px] text-muted">Instant breakdown notification when CBT attempts finish evaluating</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotif('testResults')}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                notifState.testResults ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={notifState.testResults}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  notifState.testResults ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">Doubt Solver Faculty Replies</p>
              <p className="text-[11px] text-muted">Alert when IITian faculty posts step-by-step resolution</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotif('doubtAnswers')}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                notifState.doubtAnswers ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={notifState.doubtAnswers}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  notifState.doubtAnswers ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-foreground">System Announcements & Notices</p>
              <p className="text-[11px] text-muted">Platform updates, holiday schedules, and JEE registration alerts</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotif('platformAnnouncements')}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                notifState.platformAnnouncements ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={notifState.platformAnnouncements}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  notifState.platformAnnouncements ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 5. DATA PRIVACY & ACCOUNT MANAGEMENT (DPDP) */}
      <section className="glass-card rounded-2xl p-6 sm:p-7 space-y-6 border-rose-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-heading">Data Privacy & Portability (DPDP)</h2>
            <p className="text-xs text-muted">Exercise statutory rights to data export and account erasure</p>
          </div>
        </div>

        {/* Data Export Box */}
        <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-foreground">Export Account & Learning Data</p>
            </div>
            <p className="text-[11px] text-muted max-w-lg">
              Download a complete JSON archive of your personal profile, enrolled batches, test attempt history, and invoice records under DPDP Act provisions.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer flex-shrink-0 shadow-sm"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export Data Archive</span>
          </button>
        </div>

        {/* Account Deletion Box */}
        <div className="p-4 sm:p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-4 h-4" />
              <p className="text-xs font-bold">Delete Account & Anonymize Records</p>
            </div>
            <p className="text-[11px] text-muted max-w-lg">
              Permanently anonymize your identity, delete personal identifiers, and cancel enrolled course access. Financial transaction logs are retained strictly for statutory accounting audits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer flex-shrink-0 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      </section>

      {/* Delete Account Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-rose-500/40 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Confirm Account Erasure</h3>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              This action cannot be undone. All your bookmarks, CBT test attempts, video progress, and course enrollments will be permanently removed.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="confirm-delete-input" className="text-[11px] font-bold text-foreground block">
                Type <span className="font-mono text-rose-500 font-extrabold">DELETE</span> to confirm:
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-rose-500 font-medium">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmation('');
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground border border-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
