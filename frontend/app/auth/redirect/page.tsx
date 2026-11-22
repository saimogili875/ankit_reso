'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function AuthRedirectPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace('/sign-in');
      return;
    }

    const role = ((user.publicMetadata?.role as string) || 'student').toLowerCase();
    if (role === 'admin' || role === 'teacher') {
      router.replace('/admin');
    } else {
      router.replace('/');
    }
  }, [user, isLoaded, router]);

  return (
    <div className="min-h-screen bg-[#071328] flex items-center justify-center text-slate-100">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">Redirecting to your dashboard…</span>
      </div>
    </div>
  );
}
