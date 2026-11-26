'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewExamPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/tests?create=true');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-400">
      Loading exam builder...
    </div>
  );
}
