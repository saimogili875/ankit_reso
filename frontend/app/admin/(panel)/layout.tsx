'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  ShieldCheck,
  LayoutDashboard,
  HelpCircle,
  FolderTree,
  Video,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Loader2,
  Clock,
  FileText,
  MessageSquare,
  Bell,
  Users,
  Sliders,
  Calendar,
  GraduationCap,
  BarChart2,
  Image as ImageIcon,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';


const adminNav = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Courses & Batches', href: '/admin/courses', icon: GraduationCap },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Schedule', href: '/admin/schedule', icon: Calendar },
  { label: 'Home & Slides', href: '/admin/home', icon: Sliders },
  { label: 'Banner Sliders', href: '/admin/banners', icon: ImageIcon },
  { label: 'Curriculum & Modules', href: '/admin/modules', icon: FolderTree },
  { label: 'Question Bank', href: '/admin/questions', icon: HelpCircle },
  { label: 'Videos & Media', href: '/admin/videos', icon: Video },
  { label: 'CBT Mock Tests', href: '/admin/tests', icon: Clock },
  { label: 'Test Analytics', href: '/admin/test-analytics', icon: BarChart2 },
  { label: 'Study Materials', href: '/admin/materials', icon: FileText },
  { label: 'Doubt Solver', href: '/admin/doubts', icon: MessageSquare },
  { label: 'Announcements', href: '/admin/announcements', icon: Bell },
  { label: 'Students', href: '/admin/students', icon: Users },
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: adminUser, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!adminUser || !adminUser.is_admin) {
        router.replace('/login?role=admin');
      }
    }
  }, [adminUser, isLoading, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Verifying administrator permissions...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 border border-indigo-500/40">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <div className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5">
                  ADEPT <span className="text-indigo-400">EDUVERSE</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Admin
                  </span>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  Management Console
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 ml-6 pl-6 border-l border-slate-800">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Student Portal</span>
            </Link>

            {adminUser && (
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-medium truncate max-w-[150px]">
                  {adminUser.email}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-400 text-xs gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 pt-2 pb-4 space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${isActive
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-900'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-800 mt-2">
              <Link
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Student Portal</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Admin Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
