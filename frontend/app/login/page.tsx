'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const role = searchParams.get('role');
    if (role?.toLowerCase() === 'admin') {
      router.replace('/admin/login');
    } else {
      router.replace('/sign-in');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8]">
      <div className="w-8 h-8 border-2 border-[#2B2FB8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  );
}
