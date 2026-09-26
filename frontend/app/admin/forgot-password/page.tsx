'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { ShieldCheck, ArrowLeft, Send } from 'lucide-react';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
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

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage(
        `Administrator recovery instructions have been dispatched to ${email}.`
      );
    }, 1000);
  };

  return (
    <AuthLayout isAdmin>
      <AuthCard className="border-indigo-900/60 shadow-indigo-950/20">
        <AuthHeader
          isAdmin
          title="Admin Password Recovery"
          subtitle="Enter your registered administrator email to receive secure recovery instructions."
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

          <Button
            type="submit"
            variant="secondary"
            className="w-full py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <span>Continue</span>
            {!isLoading && <Send className="w-4 h-4" />}
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
