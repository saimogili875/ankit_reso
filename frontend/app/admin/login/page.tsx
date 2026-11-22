'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, GraduationCap, Video, HelpCircle, Users, LogOut, AlertTriangle } from 'lucide-react';
import { apiClient, setAuthCookies, clearAuthCookies } from '@/lib/api-client';
import { useAuth, AuthUser } from '@/hooks/use-auth';
import { AuthInput } from '@/components/auth/auth-input';
import { PasswordInput } from '@/components/auth/password-input';
import { FormMessage } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';

const capabilities = [
  { icon: GraduationCap, title: 'Courses and curriculum', text: 'Batches, subjects, chapters, lectures and DPPs' },
  { icon: Video, title: 'Videos and materials', text: 'YouTube and R2 uploads, PDFs and notes' },
  { icon: HelpCircle, title: 'Question bank and tests', text: 'PYQs, CBT mock tests and analytics' },
  { icon: Users, title: 'Students and payments', text: 'Enrolments, doubts, orders and refunds' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, setUser, refresh, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Lockout / Rate limit state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Already signed in as an administrator: go straight to the console
  useEffect(() => {
    if (!authLoading && user?.is_admin) router.replace('/admin');
  }, [user, authLoading, router]);

  const signedInAsStudent = !authLoading && user && !user.is_admin;

  const triggerLockout = useCallback((seconds: number) => {
    setLockoutSeconds(seconds);
    setError('Too many failed login attempts. For security, admin sign-in is temporarily locked.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setError('');

    if (!email.trim() || !password) {
      setError('Enter your administrator email and password.');
      return;
    }

    setBusy(true);
    try {
      const res = await apiClient.post<{ message: string; user: AuthUser }>('/auth/login/', {
        email: email.trim(),
        identifier: email.trim(),
        password,
        portal: 'admin',
        remember_me: rememberMe,
      });

      if (!res.user?.is_admin) {
        // Never keep a non-admin session from this page
        await apiClient.logout().catch(() => null);
        clearAuthCookies();
        setUser(null);
        setError('Invalid credentials. Please verify your email and password.');
        setBusy(false);
        return;
      }

      setAuthCookies(res.user.role || 'ADMIN', rememberMe);
      setUser(res.user);
      setFailedAttempts(0);
      await refresh().catch(() => null);
      router.push('/admin');
    } catch (err: unknown) {
      setBusy(false);
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      // Check if server returned 429 or if client-side limit reached (5 attempts)
      const errStr = err instanceof Error ? err.message : '';
      const isThrottled = errStr.includes('429') || errStr.toLowerCase().includes('throttled') || errStr.toLowerCase().includes('too many');

      if (isThrottled || nextFailures >= 5) {
        triggerLockout(60);
      } else {
        // Generic error message: never reveal whether an email exists
        setError('Invalid credentials. Please verify your email and password.');
      }
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (laptop and larger) */}
      <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-slate-900/50 border-r border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-white flex items-center justify-center p-2 shadow-sm">
            <Image src="/images/logo-icon.png" alt="Adept Eduverse" width={30} height={30} className="object-contain" priority />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold text-white">Adept Eduverse</span>
            <span className="block text-sm text-slate-400">Admin Console</span>
          </span>
        </div>

        <div className="max-w-lg space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-[44px] font-bold tracking-tight text-white leading-[1.1]">
              Run the whole platform from one place
            </h1>
            <p className="text-base text-slate-400 leading-relaxed">
              Publish lectures, keep the question bank current, answer doubts and track every payment.
            </p>
          </div>

          <ul className="grid gap-3">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-100">{title}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-500">Restricted to authorised administrators.</p>
      </aside>

      {/* Login Form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          <div className="lg:hidden flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5">
              <Image src="/images/logo-icon.png" alt="Adept Eduverse" width={28} height={28} className="object-contain" />
            </span>
            <span className="font-bold text-white">Adept Eduverse Admin</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-white">Sign in to the admin console</h2>
            <p className="text-sm text-slate-400">Use the administrator credentials configured for your deployment.</p>
          </div>

          {signedInAsStudent && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 space-y-3">
              <p>You are signed in as a student ({user?.email}). Sign out to use an administrator account.</p>
              <button
                type="button"
                onClick={async () => {
                  await logout('/admin/login');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-500/10 text-amber-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out of student account
              </button>
            </div>
          )}

          {isLocked && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Account Lockout Active</p>
                <p className="text-xs text-rose-300/80 mt-1">
                  Too many consecutive failed attempts. Sign-in is locked for security. Please wait {lockoutSeconds} seconds.
                </p>
              </div>
            </div>
          )}

          {!isLocked && <FormMessage type="error" message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthInput
              label="Administrator email"
              type="email"
              placeholder="admin@adepteduverse.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              autoComplete="username"
              disabled={isLocked}
              required
            />
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLocked}
              required
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLocked}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Keep me signed in for 14 days</span>
              </label>
              <Link href="/admin/forgot-password" className="font-medium text-indigo-400 hover:text-indigo-300">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              isLoading={busy}
              disabled={busy || isLocked}
              className="w-full py-3 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLocked ? `Locked (${lockoutSeconds}s)` : 'Sign in'}</span>
            </Button>
          </form>

          <div className="pt-5 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Don&apos;t have admin access? Contact your organization administrator for credentials.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
