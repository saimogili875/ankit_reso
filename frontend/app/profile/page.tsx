'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserButton, useClerk } from '@clerk/nextjs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
  User,
  GraduationCap,
  Phone,
  Calendar,
  LogOut,
  Target,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

interface UserData {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  phone_number?: string;
  is_admin: boolean;
  student_profile?: {
    target_year?: number;
    target_exam?: string;
    bio?: string;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { openUserProfile, signOut } = useClerk();
  const { user: authUser, isLoading: authLoading, refresh } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editable Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [targetExam, setTargetExam] = useState('JEE Main & Advanced 2025');
  const [targetYear, setTargetYear] = useState('2025');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (authUser) {
        const u = authUser as unknown as UserData;
        setUser(u);
        setFirstName(u.first_name || '');
        setLastName(u.last_name || '');
        setPhoneNumber(u.phone_number || '');
        setTargetExam(u.student_profile?.target_exam || 'JEE Main & Advanced');
        setTargetYear(String(u.student_profile?.target_year || 2025));
        setBio(u.student_profile?.bio || '');
      }
      setIsLoading(false);
    }
  }, [authUser, authLoading]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await apiClient.patch<{ message: string; user: UserData }>('/auth/me/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
        target_exam: targetExam.trim(),
        target_year: parseInt(targetYear, 10) || 2025,
        bio: bio.trim(),
      });

      if (res && res.user) {
        setUser(res.user);
        await refresh();
        setFeedback({ type: 'success', message: 'Profile settings saved to database successfully!' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save changes. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await apiClient.logout();
      await signOut({ redirectUrl: '/' }).catch(() => null);
    } finally {
      router.push('/');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    user?.email.split('@')[0] ||
    'Student';
  const initial = (displayName.charAt(0) || 'S').toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <User className="w-6 h-6 text-brand-400" />
          Student Profile & Settings
        </h1>
        <p className="text-sm text-slate-400">
          Account details and target examination configuration saved directly to your database profile.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Info */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold border-2 border-blue-400/40 shadow-lg shadow-blue-500/20">
            {initial}
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-100">{displayName}</h2>
              <Badge variant={user?.is_admin ? 'purple' : 'blue'}>
                {user?.role === 'ADMIN' ? 'Administrator' : 'JEE Aspirant'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-mono">
              <Mail className="w-3.5 h-3.5 text-slate-500" /> {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <UserButton />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openUserProfile()}
            className="border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold"
          >
            Manage Account
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-slate-800 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Profile Form */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 shadow-xl">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <GraduationCap className="w-4 h-4 text-brand-400" />
            <span>Academic Target & Profile Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address (Account ID)
              </label>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm font-mono text-slate-400 flex items-center justify-between">
                <span>{user?.email}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Examination
              </label>
              <div className="relative">
                <Target className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="JEE Main & Advanced">JEE Main & Advanced</option>
                  <option value="JEE Main Only">JEE Main Only</option>
                  <option value="JEE Advanced Focus">JEE Advanced Focus</option>
                  <option value="Foundation (Class 11)">Foundation (Class 11)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Passing Year
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="2025">2025 Examination</option>
                  <option value="2026">2026 Examination</option>
                  <option value="2027">2027 Examination</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Bio & Personal Study Objectives (Optional)
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Aiming for Top 500 AIR in JEE Advanced, focusing on strengthening Organic Chemistry mechanisms."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 leading-relaxed resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Changes update immediately in your student record and header badge.
            </span>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-brand-500 hover:bg-brand-600 text-white gap-2 font-medium"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
