'use client';

import React, { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      {/* Brand Header */}
      <div className="mb-6 text-center flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-3">
          <Image
            src="/images/logo.png"
            alt="AdeptEduverse Logo"
            width={160}
            height={44}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[#2B2FB8] text-xs font-semibold">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Student Registration</span>
        </div>
      </div>

      {/* Embedded Clerk SignUp */}
      <div className="w-full max-w-md flex justify-center">
        <Suspense fallback={
          <div className="w-full h-96 flex items-center justify-center bg-white rounded-2xl border border-[#E3E7EE] shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2B2FB8]"></div>
          </div>
        }>
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/auth/redirect"
            appearance={{
              variables: {
                colorPrimary: '#2B2FB8',
                borderRadius: '1rem',
              },
              elements: {
                card: 'shadow-sm border border-[#E3E7EE] rounded-2xl bg-white p-6 sm:p-8',
                formButtonPrimary: 'bg-[#2B2FB8] hover:bg-[#202494] text-white font-medium min-h-[44px] rounded-xl text-base transition-colors',
                formFieldInput: 'min-h-[44px] rounded-xl border-[#E3E7EE] text-base text-[#101828] focus:border-[#2B2FB8]',
                footerActionLink: 'text-[#2B2FB8] font-semibold hover:underline',
              },
            }}
          />
        </Suspense>
      </div>

      {/* Already registered */}
      <div className="mt-6 text-center">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1.5 text-xs text-[#5B6475] hover:text-[#2B2FB8] transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Are you an administrator? Admin Portal &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
