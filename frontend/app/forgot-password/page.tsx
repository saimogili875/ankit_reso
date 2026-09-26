'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { Mail, ArrowLeft, Send } from 'lucide-react';

export default function StudentForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Please enter your registered email or mobile number.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage(
        `Password recovery instructions have been sent to ${identifier}. Please check your inbox or SMS.`
      );
    }, 1000);
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Forgot your password?"
          subtitle="Enter your registered email or mobile number and we’ll help you recover your account."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label="Registered Email or Mobile Number"
            type="text"
            placeholder="student@example.com or 9876543210"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            icon={Mail}
            autoComplete="email"
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <span>Continue</span>
            {!isLoading && <Send className="w-4 h-4" />}
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
