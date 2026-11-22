'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

export default function ForbiddenPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-[#071328] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl space-y-6">
        <div className="flex justify-center">
          <Link href="/" className="inline-block mb-2">
            <Image
              src="/images/logo-transparent.png"
              alt="Adept Eduverse"
              width={160}
              height={42}
              className="h-10 w-auto object-contain"
            />
          </Link>
        </div>

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">403 — Access Restricted</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            You are signed in, but your account role does not have authorization to access this area.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
          If you believe you should have faculty or administrator privileges, please contact your platform administrator.
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/"
            className="w-full h-11 rounded-xl bg-[#2B2FB8] hover:bg-[#202494] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="w-full h-11 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign in as different user</span>
          </button>
        </div>
      </div>
    </div>
  );
}
