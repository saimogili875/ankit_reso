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
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function AdminResetPasswordPage() {
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
      setErrorMessage('Admin password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Administrator password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/admin/login');
      }, 1000);
    }, 1200);
  };

  return (
    <AuthLayout isAdmin>
      <AuthCard className="border-indigo-900/60 shadow-indigo-950/20">
        <AuthHeader
          isAdmin
          title="Reset Admin Password"
          subtitle="Set a new administrative security credential."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="New Admin Password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordInput
            label="Confirm Admin Password"
            placeholder="Re-enter new admin password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordStrength password={password} />

          <Button
            type="submit"
            variant="secondary"
            className="w-full py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-200" />
            <span>Reset Admin Password</span>
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <Link
            href="/admin/login"
            className="text-xs text-slate-400 hover:text-slate-200 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Login</span>
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
