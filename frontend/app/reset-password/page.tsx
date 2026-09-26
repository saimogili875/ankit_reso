'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function StudentResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Your password has been reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    }, 1200);
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Create a new password"
          subtitle="Please set a strong password to secure your Ankit JEE account."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="New Password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordStrength password={password} />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <span>Reset Password</span>
            {!isLoading && <CheckCircle2 className="w-4 h-4" />}
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <Link
            href="/login"
            className="text-xs text-slate-400 hover:text-slate-200 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
