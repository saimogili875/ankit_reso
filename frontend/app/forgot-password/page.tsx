'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthInput } from '@/components/auth/auth-input';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import { Mail, ArrowLeft, Send, CheckCircle2, KeyRound } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { OtpVerifyResponse } from '@/types';

type RecoveryStep = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS';

export default function StudentForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<RecoveryStep>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Step 1: Send Forgot Password OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post<{ message: string }>('/auth/password/forgot/', {
        email: email.trim().toLowerCase(),
      });
      setSuccessMessage('If an account exists with this email, a 6-digit verification code has been sent.');
      setCooldown(60);
      setStep('OTP');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to send recovery code. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!otp.trim() || otp.length < 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<OtpVerifyResponse>('/auth/password/reset/verify-otp/', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      if (res.verified && res.reset_token) {
        setResetToken(res.reset_token);
        setSuccessMessage('Code verified. Please choose your new password.');
        setStep('NEW_PASSWORD');
      } else {
        setErrorMessage(res.error || 'Invalid or expired verification code.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<{ message: string }>('/auth/password/reset/', {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage(res.message || 'Password reset successfully! Redirecting to login...');
      setStep('SUCCESS');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password. Token may have expired.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard className="max-w-md w-full">
        <AuthHeader
          title={
            step === 'EMAIL'
              ? 'Forgot Password?'
              : step === 'OTP'
              ? 'Enter Verification Code'
              : step === 'NEW_PASSWORD'
              ? 'Create New Password'
              : 'Password Reset Complete'
          }
          subtitle={
            step === 'EMAIL'
              ? 'Enter your registered Gmail or email to receive a recovery code.'
              : step === 'OTP'
              ? `A 6-digit code was sent to ${email}.`
              : step === 'NEW_PASSWORD'
              ? 'Set a strong new password for your account.'
              : 'Your password has been successfully updated.'
          }
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        {/* STEP 1: Enter Email */}
        {step === 'EMAIL' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <AuthInput
              label="Registered Email Address"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              autoComplete="email"
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
              isLoading={isLoading}
              disabled={isLoading || !email.includes('@')}
            >
              <span>Send Verification Code</span>
              {!isLoading && <Send className="w-4 h-4" />}
            </Button>
          </form>
        )}

        {/* STEP 2: Enter OTP */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">6-Digit Verification Code</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-center tracking-[8px] text-lg font-mono bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
              isLoading={isLoading}
              disabled={isLoading || otp.length < 6}
            >
              <span>Verify Code</span>
              {!isLoading && <CheckCircle2 className="w-4 h-4" />}
            </Button>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <button
                type="button"
                onClick={() => setStep('EMAIL')}
                className="hover:text-slate-200 transition-colors"
              >
                Change Email
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading || cooldown > 0}
                className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Enter New Password */}
        {step === 'NEW_PASSWORD' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <PasswordInput
              label="New Password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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

            <PasswordStrength password={newPassword} />

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
              isLoading={isLoading}
              disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              <span>Update Password</span>
              {!isLoading && <KeyRound className="w-4 h-4" />}
            </Button>
          </form>
        )}

        {/* STEP 4: Success Message */}
        {step === 'SUCCESS' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm text-slate-300">
              Your password has been changed. You will be redirected to the sign in page shortly.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        )}

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
