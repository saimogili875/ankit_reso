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
import { Mail, ArrowRight } from 'lucide-react';

export default function StudentLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or mobile number.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    // Simulate login API loading state
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Successfully signed in! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/');
      }, 800);
    }, 1000);
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Welcome Back"
          subtitle="Continue your JEE Main & Advanced preparation."
        />

        {/* Global Form Feedback Banners */}
        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label="Email or Mobile Number"
            type="text"
            placeholder="student@example.com or 9876543210"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            icon={Mail}
            autoComplete="username"
            required
          />

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
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
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <span>Remember me</span>
            </label>

            <Link
              href="/forgot-password"
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <span>Login to Dashboard</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          Don’t have an account?{' '}
          <Link
            href="/register"
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors inline-flex items-center gap-1"
          >
            Create account
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
