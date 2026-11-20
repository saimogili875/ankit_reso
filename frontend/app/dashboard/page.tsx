'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/auth/form-message';
import {
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  CheckCircle2,
  LogOut,
  Edit3,
  Save,
  X,
  Loader2,
  BookOpen,
  Clock,
  BarChart2,
  AtSign,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { User, OtpSendResponse, OtpVerifyResponse } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Editable fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [targetExam, setTargetExam] = useState('BOTH');
  const [targetYear, setTargetYear] = useState('2025');
  const [bio, setBio] = useState('');

  // Re-verification Email
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailToken, setEmailToken] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Re-verification Phone
  const [isChangingPhone, setIsChangingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Cooldown timers
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const t = setInterval(() => setEmailCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const t = setInterval(() => setPhoneCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [phoneCooldown]);

  // Load User Data
  const loadUser = useCallback(async () => {
    try {
      const res = await apiClient.get<{ authenticated: boolean; user: User }>('/auth/me/');
      if (res && res.user) {
        setUser(res.user);
        setFullName(res.user.full_name || `${res.user.first_name || ''} ${res.user.last_name || ''}`.trim());
        setUsername(res.user.username || '');
        setTargetExam(res.user.student_profile?.target_exam || 'BOTH');
        setTargetYear(String(res.user.student_profile?.target_year || 2025));
        setBio(res.user.student_profile?.bio || '');
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout/', {});
    } catch {
      // Ignore
    } finally {
      document.cookie = 'auth_session=; path=/; max-age=0';
      document.cookie = 'user_role=; path=/; max-age=0';
      document.cookie = 'sessionid=; path=/; max-age=0';
      router.push('/login');
    }
  };

  // Re-verification: Send Email OTP
  const handleSendNewEmailOtp = async () => {
    setErrorMessage('');
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setErrorMessage('Please enter a valid new email address.');
      return;
    }
    try {
      const res = await apiClient.post<OtpSendResponse>('/auth/me/change-email/send-otp/', {
        email: newEmail.trim().toLowerCase(),
      });
      setEmailOtpSent(true);
      setEmailCooldown(res.cooldown || 60);
      setSuccessMessage('Verification code sent to your new email.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send verification code.');
    }
  };

  // Re-verification: Verify Email OTP
  const handleVerifyNewEmailOtp = async () => {
    setErrorMessage('');
    try {
      const res = await apiClient.post<OtpVerifyResponse>('/auth/me/change-email/verify-otp/', {
        email: newEmail.trim().toLowerCase(),
        otp: emailOtp.trim(),
      });
      if (res.verified && res.email_token) {
        setEmailToken(res.email_token);
        setSuccessMessage('New email verified! Remember to save changes.');
      } else {
        setErrorMessage(res.error || 'Failed to verify email code.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid verification code.');
    }
  };

  // Re-verification: Send Phone OTP
  const handleSendNewPhoneOtp = async () => {
    setErrorMessage('');
    const clean = newPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      const res = await apiClient.post<OtpSendResponse>('/auth/me/change-phone/send-otp/', {
        phone: newPhone.trim(),
      });
      setPhoneOtpSent(true);
      setPhoneCooldown(res.cooldown || 60);
      setSuccessMessage('Verification code sent to your new mobile number.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send mobile verification code.');
    }
  };

  // Re-verification: Verify Phone OTP
  const handleVerifyNewPhoneOtp = async () => {
    setErrorMessage('');
    try {
      const res = await apiClient.post<OtpVerifyResponse>('/auth/me/change-phone/verify-otp/', {
        phone: newPhone.trim(),
        otp: phoneOtp.trim(),
      });
      if (res.verified && res.phone_token) {
        setPhoneToken(res.phone_token);
        setSuccessMessage('New mobile number verified! Remember to save changes.');
      } else {
        setErrorMessage(res.error || 'Failed to verify mobile code.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid verification code.');
    }
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        username: username.trim(),
        target_exam: targetExam,
        target_year: parseInt(targetYear, 10) || 2025,
        bio: bio.trim(),
      };

      if (isChangingEmail && emailToken && newEmail) {
        payload.email = newEmail.trim().toLowerCase();
        payload.email_token = emailToken;
      }

      if (isChangingPhone && phoneToken && newPhone) {
        payload.phone = newPhone.trim();
        payload.phone_token = phoneToken;
      }

      const res = await apiClient.patch<{ message: string; user: User }>('/auth/me/', payload);
      setUser(res.user);
      setSuccessMessage('Profile updated successfully.');
      setIsEditing(false);
      setIsChangingEmail(false);
      setIsChangingPhone(false);
      setEmailToken(null);
      setPhoneToken(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Student Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Manage your personal profile, verified contact channels, and study progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-1.5 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>Edit Profile</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setIsChangingEmail(false);
                setIsChangingPhone(false);
              }}
              className="gap-1.5 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </Button>
          )}

          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>

      <FormMessage type="error" message={errorMessage} />
      <FormMessage type="success" message={successMessage} />

      {/* Main Student Profile Card */}
      {!isEditing ? (
        <Card className="p-6 bg-slate-900/90 border-slate-800 shadow-xl rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar & Identifiers */}
            <div className="flex items-center md:items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-600/20">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</span>
                  <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 text-xs">
                    {user.role}
                  </Badge>
                </h2>
                <p className="text-sm text-slate-400 font-mono flex items-center gap-1">
                  <AtSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.username}</span>
                </p>
              </div>
            </div>

            {/* Verified Contact Details Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 md:pt-0">
              {/* Gmail / Email */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>Gmail / Email</span>
                  </span>
                  {user.is_email_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-200 truncate">{user.email}</p>
              </div>

              {/* Mobile Number */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mobile Number</span>
                  </span>
                  {user.is_phone_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-200">{user.phone || user.phone_number || 'Not provided'}</p>
              </div>

              {/* Target Exam */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Exam</span>
                </div>
                <p className="text-sm font-medium text-slate-200">
                  {user.student_profile?.target_exam?.replace('_', ' ') || 'JEE Main & Advanced'}
                </p>
              </div>

              {/* Target Year */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Year</span>
                </div>
                <p className="text-sm font-medium text-slate-200">
                  {user.student_profile?.target_year || 2025}
                </p>
              </div>
            </div>
          </div>

          {user.student_profile?.bio && (
            <div className="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-300">
              <span className="font-semibold text-slate-400 block mb-1">Aspirant Note:</span>
              <p className="italic">{user.student_profile.bio}</p>
            </div>
          )}
        </Card>
      ) : (
        /* EDIT PROFILE FORM */
        <Card className="p-6 bg-slate-900 border-slate-800 shadow-xl rounded-2xl">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" />
              <span>Edit Account Profile</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              {/* Target Exam */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Exam</label>
                <select
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="BOTH">JEE Main & Advanced</option>
                  <option value="JEE_MAIN">JEE Main Only</option>
                  <option value="JEE_ADVANCED">JEE Advanced Only</option>
                </select>
              </div>

              {/* Target Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Year</label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>

            {/* Email Re-Verification Section */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Registered Email</span>
                  <span className="text-sm text-slate-400 font-mono">{user.email}</span>
                </div>
                {!isChangingEmail ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingEmail(true);
                      setNewEmail('');
                    }}
                    className="text-xs border-slate-700 bg-slate-900"
                  >
                    Change Email
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsChangingEmail(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Keep Current
                  </button>
                )}
              </div>

              {isChangingEmail && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="New Gmail or Email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={Boolean(emailToken)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                    {!emailToken ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSendNewEmailOtp}
                        disabled={emailCooldown > 0 || !newEmail.includes('@')}
                        className="text-xs"
                      >
                        {emailCooldown > 0 ? `Wait ${emailCooldown}s` : 'Send OTP'}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-2">
                        <CheckCircle2 className="w-4 h-4" /> Verified
                      </span>
                    )}
                  </div>

                  {emailOtpSent && !emailToken && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit Email OTP"
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-36 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-center tracking-widest"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleVerifyNewEmailOtp}
                        disabled={emailOtp.length < 6}
                        className="text-xs"
                      >
                        Confirm
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Re-Verification Section */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Registered Mobile</span>
                  <span className="text-sm text-slate-400 font-mono">{user.phone || user.phone_number || 'None'}</span>
                </div>
                {!isChangingPhone ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingPhone(true);
                      setNewPhone('');
                    }}
                    className="text-xs border-slate-700 bg-slate-900"
                  >
                    Change Mobile
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsChangingPhone(false)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Keep Current
                  </button>
                )}
              </div>

              {isChangingPhone && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      disabled={Boolean(phoneToken)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                    {!phoneToken ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSendNewPhoneOtp}
                        disabled={phoneCooldown > 0 || newPhone.replace(/\D/g, '').length < 10}
                        className="text-xs"
                      >
                        {phoneCooldown > 0 ? `Wait ${phoneCooldown}s` : 'Send OTP'}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-2">
                        <CheckCircle2 className="w-4 h-4" /> Verified
                      </span>
                    )}
                  </div>

                  {phoneOtpSent && !phoneToken && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit Mobile OTP"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-36 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-center tracking-widest"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleVerifyNewPhoneOtp}
                        disabled={phoneOtp.length < 6}
                        className="text-xs"
                      >
                        Confirm
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Aspirant Note / Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your JEE targets, prep notes, or dream college..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setIsChangingEmail(false);
                  setIsChangingPhone(false);
                }}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Quick Access Study Hub */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Quick Access Study Hub
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/learn" className="group">
            <Card className="p-4 bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-all rounded-xl h-full flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Learn</h4>
                <p className="text-xs text-slate-400 mt-1">Structured video lectures and chapter notes.</p>
              </div>
            </Card>
          </Link>

          <Link href="/tests" className="group">
            <Card className="p-4 bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-emerald-500/50 transition-all rounded-xl h-full flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Mock Tests</h4>
                <p className="text-xs text-slate-400 mt-1">Full length CBT papers with immediate scoring.</p>
              </div>
            </Card>
          </Link>

          <Link href="/materials" className="group">
            <Card className="p-4 bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all rounded-xl h-full flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Study Materials</h4>
                <p className="text-xs text-slate-400 mt-1">Formulas, revision notes, and PDF handouts.</p>
              </div>
            </Card>
          </Link>

          <Link href="/progress" className="group">
            <Card className="p-4 bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-all rounded-xl h-full flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Performance</h4>
                <p className="text-xs text-slate-400 mt-1">Chapter strength, test accuracy and percentile.</p>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
