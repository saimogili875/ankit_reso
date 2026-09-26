'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { ShieldCheck, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid administrator email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your admin password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Administrator authenticated. Loading management dashboard...');
      setTimeout(() => {
        router.push('/');
      }, 900);
    }, 1100);
  };

  return (
    <AuthLayout isAdmin>
      <AuthCard className="border-indigo-900/60 shadow-indigo-950/20">
        <AuthHeader
          isAdmin
          title="Administrator Sign In"
          subtitle="Secure access to the Ankit JEE management dashboard."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label="Admin Email Address"
            type="email"
            placeholder="admin@ankitjee.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={ShieldCheck}
            autoComplete="email"
            required
          />

          <PasswordInput
            label="Password"
            placeholder="Enter admin password"
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
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span>Remember me</span>
            </label>

            <Link
              href="/admin/forgot-password"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <Lock className="w-4 h-4 text-indigo-200" />
            <span>Sign In to Admin Portal</span>
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          Student?{' '}
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Go to Student Portal Login
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
