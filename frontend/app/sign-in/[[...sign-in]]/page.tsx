'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignIn } from '@clerk/nextjs';
import { ShieldCheck, GraduationCap, User, Lock, ArrowRight, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, setAuthCookies } from '@/lib/api-client';
import { useAuth, AuthUser } from '@/hooks/use-auth';

export default function SignInPage() {
  const router = useRouter();
  const { setUser, refresh } = useAuth();

  const [activeTab, setActiveTab] = useState<'credentials' | 'google'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter your Student Username or Email and Password.');
      return;
    }

    setBusy(true);
    try {
      const res = await apiClient.post<{ message: string; user: AuthUser }>('/auth/login/', {
        identifier: identifier.trim(),
        email: identifier.trim(),
        password,
        portal: 'student',
        remember_me: rememberMe,
      });

      if (!res.user) {
        throw new Error('Login failed. Please verify your credentials.');
      }

      setAuthCookies(res.user.role || 'STUDENT', rememberMe);
      setUser(res.user);
      await refresh().catch(() => null);
      router.push('/dashboard');
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your username and password.';
      setError(msg);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      {/* Brand Header */}
      <div className="mb-6 text-center flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-3">
          <Image
            src="/images/logo.png"
            alt="AdeptEduverse Logo"
            width={160}
            height={44}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[#2B2FB8] text-xs font-semibold">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Student Portal</span>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Login Method Tabs */}
        <div className="flex bg-[#E9ECEF] p-1 rounded-xl mb-4 text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => { setActiveTab('credentials'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-center transition-all ${
              activeTab === 'credentials'
                ? 'bg-white text-[#2B2FB8] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student ID & Password
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('google'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-center transition-all ${
              activeTab === 'google'
                ? 'bg-white text-[#2B2FB8] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google & Social
          </button>
        </div>

        {activeTab === 'credentials' ? (
          <div className="bg-white rounded-2xl border border-[#E3E7EE] shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-6">Enter your student username or registered email.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. SriNri@2026 or email"
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E3E7EE] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8] focus:ring-2 focus:ring-[#2B2FB8]/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E3E7EE] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8] focus:ring-2 focus:ring-[#2B2FB8]/10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[#E3E7EE] text-[#2B2FB8] focus:ring-[#2B2FB8]"
                  />
                  <span>Keep me signed in</span>
                </label>
                <Link href="/contact" className="text-[#2B2FB8] hover:underline font-medium">
                  Need help?
                </Link>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 min-h-[44px] bg-[#2B2FB8] hover:bg-[#202494] text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex justify-center">
            <Suspense fallback={
              <div className="w-full h-96 flex items-center justify-center bg-white rounded-2xl border border-[#E3E7EE] shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B2FB8]"></div>
              </div>
            }>
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                fallbackRedirectUrl="/auth/redirect"
                appearance={{
                  variables: {
                    colorPrimary: '#2B2FB8',
                    borderRadius: '1rem',
                  },
                  elements: {
                    card: 'shadow-sm border border-[#E3E7EE] rounded-2xl bg-white p-6 sm:p-8',
                    formButtonPrimary: 'bg-[#2B2FB8] hover:bg-[#202494] text-white font-medium min-h-[44px] rounded-xl text-base transition-colors',
                    formFieldInput: 'min-h-[44px] rounded-xl border-[#E3E7EE] text-base text-[#101828] focus:border-[#2B2FB8]',
                    footerActionLink: 'text-[#2B2FB8] font-semibold hover:underline',
                  },
                }}
              />
            </Suspense>
          </div>
        )}

        {/* Free Guest Browsing & Books Link */}
        <div className="mt-6 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Looking for official books & question banks? No login required.</span>
          </div>
          <Link
            href="/books"
            className="font-semibold text-amber-800 hover:text-amber-950 underline shrink-0 inline-flex items-center gap-0.5"
          >
            Browse Books &rarr;
          </Link>
        </div>

        {/* Admin Login Switcher */}
        <div className="mt-4 text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-[#5B6475] hover:text-[#2B2FB8] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Are you a faculty member or administrator? Admin Login &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
