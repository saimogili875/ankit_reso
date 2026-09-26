'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  BookOpen,
  Edit3,
  BarChart3,
  MessageSquare,
  User,
  GraduationCap,
  Settings,
  ChevronRight,
} from 'lucide-react';

export const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Learn', href: '/learn', icon: BookOpen },
  { label: 'Practice', href: '/practice', icon: Edit3 },
  { label: 'Analysis', href: '/analysis', icon: BarChart3 },
  { label: 'Doubt Solver', href: '/doubt-solver', icon: MessageSquare },
  { label: 'Profile', href: '/profile', icon: User },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-100 border-r border-slate-800/80 min-h-screen fixed left-0 top-0 z-30 shadow-xl shadow-black/40">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-blue-400/30">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-wide text-white flex items-center gap-1">
            ANKIT <span className="text-blue-500">JEE</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
            MAIN & ADVANCED
          </p>
        </div>
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
