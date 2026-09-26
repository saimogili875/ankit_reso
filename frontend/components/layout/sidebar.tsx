'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  BookOpen,
  FileCheck2,
  TrendingUp,
  FolderDown,
  User,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Learn', href: '/learn', icon: BookOpen },
  { label: 'Tests', href: '/tests', icon: FileCheck2 },
  { label: 'Progress', href: '/progress', icon: TrendingUp },
  { label: 'Study Materials', href: '/materials', icon: FolderDown },
  { label: 'Profile', href: '/profile', icon: User },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-100 border-r border-slate-800 min-h-screen fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5">
            ANKIT <span className="text-blue-500">JEE</span>
          </h1>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
            Main & Advanced
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Main Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Target Badge Footer */}
      <div className="p-4 border-t border-slate-800 m-3 rounded-xl bg-slate-900/60 text-xs">
        <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
          <Sparkles className="w-4 h-4" />
          <span>JEE Target 2025</span>
        </div>
        <p className="text-slate-400 text-[11px]">
          Physics, Chemistry & Mathematics Prep
        </p>
      </div>
    </aside>
  );
};
