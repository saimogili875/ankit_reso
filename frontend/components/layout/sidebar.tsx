'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  BookOpen,
  BookCheck,
  Edit3,
  CalendarDays,
  BarChart3,
  MessageSquare,
  GraduationCap,
  User,
  Settings,
  ChevronRight,
  Award,
} from 'lucide-react';

export const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Courses', href: '/courses', icon: GraduationCap },
  { label: 'Books', href: '/books', icon: BookCheck },
  { label: 'Learn', href: '/learn', icon: BookOpen },
  { label: 'Practice', href: '/practice', icon: Edit3 },
  { label: 'Exams', href: '/exams', icon: Award },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays },
  { label: 'Analysis', href: '/analysis', icon: BarChart3 },
  { label: 'Doubt Solver', href: '/doubt-solver', icon: MessageSquare },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-100 border-r border-slate-800/80 min-h-screen fixed left-0 top-0 z-30 shadow-xl shadow-black/40">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center p-1.5 shadow-md shadow-blue-500/10 border border-slate-700/60 group-hover:scale-105 transition-transform flex-shrink-0">
            <Image
              src="/images/logo-icon.png"
              alt="Adept Eduverse Logo"
              width={34}
              height={34}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1">
              ADEPT <span className="text-blue-500">EDUVERSE</span>
            </h1>
            <p className="text-[9px] uppercase font-bold tracking-widest text-rose-400">
              A SKILLFUL LEARNING
            </p>
          </div>
        </Link>
      </div>

      {/* Main Student Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 font-bold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Access Navigation - Visually Separated at Bottom */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950">
        <Link
          href="/admin/login"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-slate-800/80 transition-all duration-150 group"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
            <span>Admin Access</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </aside>
  );
};
