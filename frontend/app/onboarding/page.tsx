'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { apiClient } from '@/lib/api-client';
import { ArrowRight, Sparkles, MapPin, Building, Globe, Phone } from 'lucide-react';

interface OnboardingResponse {
  is_onboarded: boolean;
  academic_class?: string;
  target_exam?: string;
  target_year?: number;
  city?: string;
  state?: string;
  school_or_coaching?: string;
  preferred_language?: string;
  contact_phone?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [academicClass, setAcademicClass] = useState<'11' | '12' | 'DROPPER'>('12');
  const [targetExam, setTargetExam] = useState<'JEE_MAIN' | 'JEE_ADVANCED' | 'BOTH'>('BOTH');
  const [targetYear, setTargetYear] = useState<number>(2025);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [schoolOrCoaching, setSchoolOrCoaching] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [contactPhone, setContactPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const data = await apiClient.get<OnboardingResponse>('/students/onboarding/');
        if (isMounted && data && data.is_onboarded) {
          router.replace('/');
          return;
        }
      } catch {
        // If not onboarded or endpoint is ready, allow form fill
      } finally {
        if (isMounted) setIsChecking(false);
      }
    }

    if (isLoaded) {
      checkStatus();
    }
    return () => {
      isMounted = false;
    };
  }, [isLoaded, router]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    // Validate optional phone number format (10 digits) if provided
    if (contactPhone.trim()) {
      const digits = contactPhone.replace(/\D/g, '');
      if (digits.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number or leave it blank.');
        setIsLoading(false);
        return;
      }
    }

    try {
      await apiClient.post('/students/onboarding/', {
        academic_class: academicClass,
        target_exam: targetExam,
        target_year: targetYear,
        city: city.trim(),
        state: state.trim(),
        school_or_coaching: schoolOrCoaching.trim(),
        preferred_language: preferredLanguage,
        contact_phone: contactPhone.trim().replace(/\D/g, ''),
      });

      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save your preferences. Please try again.';
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await apiClient.post('/students/onboarding/', {
        academic_class: academicClass,
        target_exam: targetExam,
        target_year: targetYear,
        city: '',
        state: '',
        school_or_coaching: '',
        preferred_language: preferredLanguage,
        contact_phone: '',
      });
    } catch {
      // Ignore
    } finally {
      router.push('/');
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-[100dvh] bg-[#F4F6F8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B2FB8]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] py-8 px-4 sm:px-6 flex flex-col justify-center items-center">
      {/* Brand Header */}
      <div className="w-full max-w-xl text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#F5B63D]" />
          <span>One-Time Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#101828] font-heading">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}! Let&apos;s personalize your prep.
        </h1>
        <p className="text-sm text-[#5B6475] mt-1 font-body">
          Tell us about your target goals so we can customize your lecture plan and mock tests.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-xl bg-white border border-[#E3E7EE] rounded-2xl shadow-sm p-6 sm:p-8">
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Academic Class */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-2">
              Current Academic Stage
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: '11', label: 'Class 11' },
                { id: '12', label: 'Class 12' },
                { id: 'DROPPER', label: 'Dropper / Repeater' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setAcademicClass(item.id as '11' | '12' | 'DROPPER')}
                  className={`min-h-[44px] px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-all text-center flex items-center justify-center ${
                    academicClass === item.id
                      ? 'border-[#2B2FB8] bg-indigo-50/60 text-[#2B2FB8] shadow-xs'
                      : 'border-[#E3E7EE] bg-white text-[#101828] hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Target Exam */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-2">
              Target Exam
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'JEE_MAIN', label: 'JEE Main' },
                { id: 'JEE_ADVANCED', label: 'JEE Advanced' },
                { id: 'BOTH', label: 'Both (Recommended)' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setTargetExam(item.id as 'JEE_MAIN' | 'JEE_ADVANCED' | 'BOTH')}
                  className={`min-h-[44px] px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-all text-center flex items-center justify-center ${
                    targetExam === item.id
                      ? 'border-[#2B2FB8] bg-indigo-50/60 text-[#2B2FB8] shadow-xs'
                      : 'border-[#E3E7EE] bg-white text-[#101828] hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Target Year */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-2">
              Target Year
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[2025, 2026, 2027].map((year) => (
                <button
                  type="button"
                  key={year}
                  onClick={() => setTargetYear(year)}
                  className={`min-h-[44px] px-3 py-2.5 text-sm font-semibold rounded-xl border transition-all text-center flex items-center justify-center ${
                    targetYear === year
                      ? 'border-[#2B2FB8] bg-indigo-50/60 text-[#2B2FB8] shadow-xs'
                      : 'border-[#E3E7EE] bg-white text-[#101828] hover:border-slate-300'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Location: City & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-1.5">
                City (Optional)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6475]" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Kota, Hyderabad, Delhi"
                  className="w-full pl-10 pr-3.5 min-h-[44px] rounded-xl border border-[#E3E7EE] text-base text-[#101828] placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-1.5">
                State (Optional)
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Rajasthan, Telangana"
                className="w-full px-3.5 min-h-[44px] rounded-xl border border-[#E3E7EE] text-base text-[#101828] placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8]"
              />
            </div>
          </div>

          {/* 5. School or Coaching */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-1.5">
              School or Coaching Institute (Optional)
            </label>
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6475]" />
              <input
                type="text"
                value={schoolOrCoaching}
                onChange={(e) => setSchoolOrCoaching(e.target.value)}
                placeholder="e.g. Allen, Resonance, Narayana, Self Study"
                className="w-full pl-10 pr-3.5 min-h-[44px] rounded-xl border border-[#E3E7EE] text-base text-[#101828] placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8]"
              />
            </div>
          </div>

          {/* 6. Preferred Language & Mobile (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-1.5">
                Preferred Language
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6475]" />
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full pl-10 pr-3.5 min-h-[44px] rounded-xl border border-[#E3E7EE] text-base text-[#101828] bg-white focus:outline-none focus:border-[#2B2FB8]"
                >
                  <option value="English">English</option>
                  <option value="Hinglish">Hinglish</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6475] mb-1.5">
                Mobile number (optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6475]" />
                <input
                  type="tel"
                  maxLength={10}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit number"
                  className="w-full pl-10 pr-3.5 min-h-[44px] rounded-xl border border-[#E3E7EE] text-base text-[#101828] placeholder:text-slate-400 focus:outline-none focus:border-[#2B2FB8]"
                />
              </div>
              <p className="text-[11px] text-[#5B6475] mt-1">For WhatsApp class updates and mentor alerts.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:flex-1 min-h-[44px] rounded-xl bg-[#2B2FB8] hover:bg-[#202494] text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Save and Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleSkip}
              className="w-full sm:w-auto px-5 min-h-[44px] rounded-xl border border-[#E3E7EE] hover:bg-slate-50 text-[#5B6475] font-medium text-sm transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
