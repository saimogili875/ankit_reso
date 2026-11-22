'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { useAuth } from '@/hooks/use-auth';

export interface DashboardShellProps {
  children: React.ReactNode;
}

const AUTH_PATHS = [
  '/sign-in',
  '/sign-up',
  '/onboarding',
  '/login',
  '/register',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/landing',
];

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isAuthPage = AUTH_PATHS.some(
    (path) =>
      pathname === path ||
      pathname?.startsWith('/admin/login') ||
      pathname?.startsWith('/admin/forgot') ||
      pathname?.startsWith('/admin/reset')
  );

  // Admin pages have their own dedicated admin layout and header
  const isAdminPage = pathname?.startsWith('/admin');

  // Test attempt page has its own dedicated CBT fullscreen chrome
  const isCBTAttemptPage = pathname?.includes('/attempt');

  // The landing page on /landing or / (for unauthenticated visitors) renders full-width without dashboard chrome
  const isLanding = pathname === '/landing' || (pathname === '/' && isAuthenticated !== true);

  if (isAuthPage || isAdminPage || isLanding) {
    return <div className="min-h-[100dvh] bg-[#F4F6F8] dark:bg-slate-950 text-[#101828] dark:text-slate-100 font-sans">{children}</div>;
  }

  if (isCBTAttemptPage) {
    return <div className="min-h-[100dvh] bg-slate-950 text-slate-100 font-sans">{children}</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] dark:bg-slate-950 text-[#101828] dark:text-slate-100 flex flex-col font-sans">
      {/* Desktop Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Header />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
