'use client';

import React, { useState } from 'react';
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
import { User, Mail, Phone, CheckCircle } from 'lucide-react';

type TargetExamType = 'BOTH' | 'JEE_MAIN' | 'JEE_ADVANCED';
type CurrentClassType = 'CLASS_11' | 'CLASS_12' | 'DROPPER';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetExam, setTargetExam] = useState<TargetExamType>('BOTH');
  const [currentClass, setCurrentClass] = useState<CurrentClassType>('CLASS_12');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
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

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    }, 1200);
  };

  return (
    <AuthLayout>
      <AuthCard className="max-w-lg">
        <AuthHeader
          title="Create Your Account"
          subtitle="Start your JEE preparation with Ankit JEE."
        />

        <FormMessage type="error" message={errorMessage} />
        <FormMessage type="success" message={successMessage} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label="Full Name"
            type="text"
            placeholder="e.g. Ankit Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={User}
            autoComplete="name"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AuthInput
              label="Email Address"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              autoComplete="email"
              required
            />

            <AuthInput
              label="Mobile Number"
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              icon={Phone}
              autoComplete="tel"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PasswordInput
              label="Password"
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
          </div>

          {/* Password Strength Indicator */}
          <PasswordStrength password={password} />

          {/* Exam Target Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-300 tracking-wide block">
              Exam Target
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'BOTH' as TargetExamType, label: 'JEE Main & Adv' },
                { id: 'JEE_MAIN' as TargetExamType, label: 'JEE Main Only' },
                { id: 'JEE_ADVANCED' as TargetExamType, label: 'JEE Adv Only' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTargetExam(item.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                    targetExam === item.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-semibold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Class Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-300 tracking-wide block">
              Current Academic Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'CLASS_11' as CurrentClassType, label: 'Class 11' },
                { id: 'CLASS_12' as CurrentClassType, label: 'Class 12' },
                { id: 'DROPPER' as CurrentClassType, label: 'Dropper' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentClass(item.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                    currentClass === item.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-semibold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold shadow-lg shadow-blue-600/20 gap-2 mt-2"
            isLoading={isLoading}
          >
            <span>Create Account</span>
            {!isLoading && <CheckCircle className="w-4 h-4" />}
          </Button>
        </form>

        <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            Login
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
