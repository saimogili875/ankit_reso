'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { ShieldCheck, Mail, Lock, ArrowRight, GraduationCap } from 'lucide-react';
import { apiClient, setAuthCookies } from '@/lib/api-client';
import { useAuth, AuthUser } from '@/hooks/use-auth';

function AdminLoginForm() {
  const router = useRouter();
  const { user: authUser, isLoading: authLoading, setUser, refresh } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // If already authenticated as admin, redirect to admin dashboard
  useEffect(() => {
    if (!authLoading && authUser) {
      if (authUser.is_admin || authUser.role === 'ADMIN') {
        router.replace('/admin');
      }
    }
  }, [authUser, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Please enter your administrator email.');
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
        portal: 'admin',
        remember_me: rememberMe,
      };

      const response = await apiClient.post<{ message: string; user: AuthUser }>(
        '/auth/login/',
        payload
      );

      const role = response.user?.role || 'ADMIN';
      setAuthCookies(role, rememberMe);
      if (response.user) {
        setUser(response.user);
      }

      await refresh().catch(() => null);

      setIsLoading(false);
      setSuccessMessage('Admin login successful! Redirecting...');
      router.push('/admin');
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your admin username/password.';
      setErrorMessage(msg);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Administrator Portal"
          subtitle="Authorized faculty and content management console"
        />

        <div className="mb-6 flex items-center justify-center gap-2 p-2 rounded-xl bg-purple-900/20 border border-purple-800/40 text-purple-300 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Django Admin Session Authentication</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && <FormMessage type="error" message={errorMessage} />}
          {successMessage && <FormMessage type="success" message={successMessage} />}

          <AuthInput
            id="admin-email"
            label="Administrator Email"
            type="email"
            autoComplete="email"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@adepteduverse.com"
            icon={Mail}
          />

          <PasswordInput
            id="admin-password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-950"
              />
              <span>Remember me</span>
            </label>
            <Link
              href="/admin/forgot-password"
              className="text-purple-400 hover:text-purple-300 hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-all shadow-lg shadow-purple-600/20 rounded-xl"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In to Console
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
            <span>Looking for student prep? </span>
            <Link href="/sign-in" className="text-blue-400 hover:underline font-semibold inline-flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              Student Sign In
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}
