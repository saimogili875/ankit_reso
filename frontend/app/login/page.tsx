'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { Mail, ShieldCheck, Lock, ArrowRight, GraduationCap } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type PortalRole = 'student' | 'admin';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roleParam = searchParams.get('role');
  const initialRole: PortalRole = roleParam?.toLowerCase() === 'admin' ? 'admin' : 'student';

  const [portal, setPortal] = useState<PortalRole>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const studentTabRef = useRef<HTMLButtonElement>(null);
  const adminTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (roleParam?.toLowerCase() === 'admin') {
      setPortal('admin');
    }
  }, [roleParam]);

  const handlePortalSwitch = (newPortal: PortalRole) => {
    setPortal(newPortal);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentPortal: PortalRole) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextPortal: PortalRole = currentPortal === 'student' ? 'admin' : 'student';
      handlePortalSwitch(nextPortal);
      if (nextPortal === 'student') {
        studentTabRef.current?.focus();
      } else {
        adminTabRef.current?.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!identifier.trim()) {
      setErrorMessage(
        portal === 'admin'
          ? 'Please enter your administrator email.'
          : 'Please enter your email or mobile number.'
      );
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        email: identifier.trim(),
        identifier: identifier.trim(),
        password,
        portal,
        remember_me: rememberMe,
      };

      const response = await apiClient.post<{ message: string; user: { is_admin: boolean; role: string } }>(
        '/auth/login/',
        payload
      );

      // Set client session cookies for Next.js middleware and immediate state
      const role = response.user?.role || (response.user?.is_admin ? 'ADMIN' : 'STUDENT');
      const maxAge = rememberMe ? '; max-age=1209600' : '';
      document.cookie = `auth_session=1; path=/; SameSite=Lax${maxAge}`;
      document.cookie = `user_role=${role}; path=/; SameSite=Lax${maxAge}`;

      setIsLoading(false);
      setSuccessMessage('Successfully signed in! Redirecting...');

      const targetPath = portal === 'admin' || response.user?.is_admin ? '/admin' : '/';
      setTimeout(() => {
        router.push(targetPath);
      }, 500);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Login failed. Please verify your credentials.';
      setErrorMessage(msg);
      if (msg.includes('Use Admin login')) {
        // Helpful tip to switch tabs
        setTimeout(() => {
          handlePortalSwitch('admin');
        }, 1200);
      }
    }
  };

  const isAdmin = portal === 'admin';

  return (
    <AuthLayout isAdmin={isAdmin}>
      <AuthCard className={isAdmin ? 'border-indigo-900/60 shadow-indigo-950/20' : ''}>
        {/* Accessible Segmented Role Toggle */}
        <div className="mb-6 p-1 bg-slate-900/80 border border-slate-800 rounded-xl" role="tablist" aria-label="Portal Selection">
          <div className="grid grid-cols-2 gap-1">
            <button
              ref={studentTabRef}
              type="button"
              role="tab"
              id="student-tab"
              aria-selected={!isAdmin}
              aria-controls="login-form-panel"
              tabIndex={!isAdmin ? 0 : -1}
              onClick={() => handlePortalSwitch('student')}
              onKeyDown={(e) => handleKeyDown(e, 'student')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                !isAdmin
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Student</span>
            </button>

            <button
              ref={adminTabRef}
              type="button"
              role="tab"
              id="admin-tab"
              aria-selected={isAdmin}
              aria-controls="login-form-panel"
              tabIndex={isAdmin ? 0 : -1}
              onClick={() => handlePortalSwitch('admin')}
              onKeyDown={(e) => handleKeyDown(e, 'admin')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isAdmin
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administrator</span>
            </button>
          </div>
        </div>

        {/* Dynamic Header */}
        <AuthHeader
          isAdmin={isAdmin}
          title={isAdmin ? 'Administrator Sign In' : 'Welcome Back'}
          subtitle={
            isAdmin
              ? 'Secure access to the AdeptEduverse management dashboard.'
              : 'Continue your JEE Main & Advanced preparation.'
          }
        />

        {/* Form Feedback Banners */}
        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form
          id="login-form-panel"
          role="tabpanel"
          aria-labelledby={isAdmin ? 'admin-tab' : 'student-tab'}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <AuthInput
            label={isAdmin ? 'Administrator Email' : 'Email or Mobile Number'}
            type={isAdmin ? 'email' : 'text'}
            placeholder={isAdmin ? 'admin@adepteduverse.com' : 'student@example.com or 9876543210'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            icon={isAdmin ? ShieldCheck : Mail}
            autoComplete="username"
            required
          />

          <PasswordInput
            label="Password"
            placeholder={isAdmin ? 'Enter admin password' : 'Enter your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={`w-4 h-4 rounded border-slate-700 bg-slate-900 focus:ring-offset-slate-900 ${
                  isAdmin
                    ? 'text-indigo-600 focus:ring-indigo-500'
                    : 'text-blue-600 focus:ring-blue-500'
                }`}
              />
              <span>Remember me (14 days)</span>
            </label>

            <Link
              href={isAdmin ? '/admin/forgot-password' : '/forgot-password'}
              className={`font-medium transition-colors ${
                isAdmin
                  ? 'text-indigo-400 hover:text-indigo-300'
                  : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant={isAdmin ? 'secondary' : 'primary'}
            className={`w-full py-3 text-sm font-semibold shadow-lg gap-2 mt-2 ${
              isAdmin
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-indigo-600/20'
                : 'shadow-blue-600/20'
            }`}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isAdmin ? (
              <>
                <Lock className="w-4 h-4 text-indigo-200" />
                <span>Sign In to Admin Portal</span>
              </>
            ) : (
              <>
                <span>Login to Dashboard</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          {!isAdmin ? (
            <>
              Don’t have an account?{' '}
              <Link
                href="/register"
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors inline-flex items-center gap-1"
              >
                Create account
              </Link>
            </>
          ) : (
            <>
              Need administrator credentials? Contact the lead system administrator.
            </>
          )}
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Loading sign in portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
