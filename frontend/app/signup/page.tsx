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
import {
  User,
  Mail,
  Phone,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AtSign,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { OtpSendResponse, OtpVerifyResponse, SignupResponse } from '@/types';

export default function SignupPage() {
  const router = useRouter();

  // Basic Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email OTP State
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isEmailVerifying, setIsEmailVerifying] = useState(false);
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [emailToken, setEmailToken] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Phone OTP State
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneSending, setIsPhoneSending] = useState(false);
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // General Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Countdown timers
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    setErrorMessage('');
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid Gmail / Email address.');
      return;
    }

    setIsEmailSending(true);
    try {
      const res = await apiClient.post<OtpSendResponse>('/auth/signup/email/send-otp/', {
        email: email.trim().toLowerCase(),
      });
      setIsEmailOtpSent(true);
      setEmailCooldown(res.cooldown || 60);
      setSuccessMessage('Verification code sent to your email.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email verification code.';
      setErrorMessage(msg);
    } finally {
      setIsEmailSending(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    setErrorMessage('');
    if (!emailOtp.trim() || emailOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.');
      return;
    }

    setIsEmailVerifying(true);
    try {
      const res = await apiClient.post<OtpVerifyResponse>('/auth/signup/email/verify-otp/', {
        email: email.trim().toLowerCase(),
        otp: emailOtp.trim(),
      });
      if (res.verified && res.email_token) {
        setEmailToken(res.email_token);
        setSuccessMessage('Email verified successfully!');
      } else {
        setErrorMessage(res.error || 'Failed to verify email.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setErrorMessage(msg);
    } finally {
      setIsEmailVerifying(false);
    }
  };

  // Send Phone OTP
  const handleSendPhoneOtp = async () => {
    setErrorMessage('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsPhoneSending(true);
    try {
      const res = await apiClient.post<OtpSendResponse>('/auth/signup/phone/send-otp/', {
        phone: phone.trim(),
      });
      setIsPhoneOtpSent(true);
      setPhoneCooldown(res.cooldown || 60);
      setSuccessMessage('Verification code sent to your mobile number.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send mobile verification code.';
      setErrorMessage(msg);
    } finally {
      setIsPhoneSending(false);
    }
  };

  // Verify Phone OTP
  const handleVerifyPhoneOtp = async () => {
    setErrorMessage('');
    if (!phoneOtp.trim() || phoneOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit code sent to your mobile.');
      return;
    }

    setIsPhoneVerifying(true);
    try {
      const res = await apiClient.post<OtpVerifyResponse>('/auth/signup/phone/verify-otp/', {
        phone: phone.trim(),
        otp: phoneOtp.trim(),
      });
      if (res.verified && res.phone_token) {
        setPhoneToken(res.phone_token);
        setSuccessMessage('Mobile number verified successfully!');
      } else {
        setErrorMessage(res.error || 'Failed to verify mobile number.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setErrorMessage(msg);
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  // Final Signup Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Please choose a username.');
      return;
    }
    if (!emailToken) {
      setErrorMessage('Please verify your Gmail / Email address before submitting.');
      return;
    }
    if (!phoneToken) {
      setErrorMessage('Please verify your Mobile number before submitting.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<SignupResponse>('/auth/signup/', {
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        confirm_password: confirmPassword,
        email_token: emailToken,
        phone_token: phoneToken,
      });

      setSuccessMessage(res.message || 'Account created successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = Boolean(
    fullName.trim() &&
    username.trim() &&
    emailToken &&
    phoneToken &&
    password.length >= 8 &&
    password === confirmPassword
  );

  return (
    <AuthLayout>
      <AuthCard className="max-w-lg w-full">
        <AuthHeader
          title="Create Your Account"
          subtitle="Join ANKIT JEE | AdeptEduverse with verified credentials."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSignupSubmit} className="space-y-4">
          {/* Full Name */}
          <AuthInput
            label="Full Name"
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={User}
            autoComplete="name"
            required
          />

          {/* Username */}
          <AuthInput
            label="Username"
            type="text"
            placeholder="e.g. rahul_jee2025"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
            icon={AtSign}
            autoComplete="username"
            required
          />

          {/* Email / Gmail with Verify */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <AuthInput
                  label="Gmail / Email Address"
                  type="email"
                  placeholder="student@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailToken) {
                      setEmailToken(null);
                      setIsEmailOtpSent(false);
                    }
                  }}
                  icon={Mail}
                  disabled={Boolean(emailToken)}
                  autoComplete="email"
                  required
                />
              </div>

              {!emailToken ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendEmailOtp}
                  disabled={isEmailSending || emailCooldown > 0 || !email.includes('@')}
                  className="mb-[2px] h-[46px] px-4 text-xs font-semibold whitespace-nowrap border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {isEmailSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : emailCooldown > 0 ? (
                    `Resend in ${emailCooldown}s`
                  ) : isEmailOtpSent ? (
                    'Resend OTP'
                  ) : (
                    'Verify Email'
                  )}
                </Button>
              ) : (
                <div className="mb-[2px] h-[46px] flex items-center gap-1.5 px-3 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified</span>
                </div>
              )}
            </div>

            {/* Email OTP Input Section */}
            {isEmailOtpSent && !emailToken && (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-900/80 border border-blue-500/30 flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit Email OTP"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-md text-slate-100 tracking-widest text-center font-mono focus:border-blue-500 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleVerifyEmailOtp}
                  disabled={isEmailVerifying || emailOtp.length < 6}
                  className="px-4 py-2 text-xs font-semibold h-[38px]"
                >
                  {isEmailVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile with Verify */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <AuthInput
                  label="Mobile Number"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneToken) {
                      setPhoneToken(null);
                      setIsPhoneOtpSent(false);
                    }
                  }}
                  icon={Phone}
                  disabled={Boolean(phoneToken)}
                  autoComplete="tel"
                  required
                />
              </div>

              {!phoneToken ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendPhoneOtp}
                  disabled={isPhoneSending || phoneCooldown > 0 || phone.replace(/\D/g, '').length < 10}
                  className="mb-[2px] h-[46px] px-4 text-xs font-semibold whitespace-nowrap border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {isPhoneSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : phoneCooldown > 0 ? (
                    `Resend in ${phoneCooldown}s`
                  ) : isPhoneOtpSent ? (
                    'Resend OTP'
                  ) : (
                    'Verify Mobile'
                  )}
                </Button>
              ) : (
                <div className="mb-[2px] h-[46px] flex items-center gap-1.5 px-3 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified</span>
                </div>
              )}
            </div>

            {/* Phone OTP Input Section */}
            {isPhoneOtpSent && !phoneToken && (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-900/80 border border-blue-500/30 flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit Mobile OTP"
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-md text-slate-100 tracking-widest text-center font-mono focus:border-blue-500 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleVerifyPhoneOtp}
                  disabled={isPhoneVerifying || phoneOtp.length < 6}
                  className="px-4 py-2 text-xs font-semibold h-[38px]"
                >
                  {isPhoneVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                </Button>
              </div>
            )}
          </div>

          {/* Password & Confirm */}
          <PasswordInput
            label="Create Password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <PasswordStrength password={password} />

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
            disabled={!isFormValid || isLoading}
            isLoading={isLoading}
          >
            <span>Create Account</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </Button>

          {!isFormValid && (
            <p className="text-xs text-center text-slate-400">
              {!emailToken || !phoneToken
                ? 'Please verify both your Email and Mobile number to proceed.'
                : password !== confirmPassword
                ? 'Passwords do not match.'
                : 'Please complete all required fields.'}
            </p>
          )}
        </form>

        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
