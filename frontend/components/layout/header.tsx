'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Bell, Search, UserCheck } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between">
      {/* Mobile Title / Desktop Search Placeholder */}
      <div className="flex items-center gap-3">
        <div className="flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            ANKIT <span className="text-blue-600 dark:text-blue-400">JEE</span>
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 text-xs w-64 border border-slate-200 dark:border-slate-700">
          <Search className="w-3.5 h-3.5" />
          <span>Search topics, PYQs, tests...</span>
        </div>
      </div>

      {/* Action badges and User Pill */}
      <div className="flex items-center gap-3">
        <Badge variant="blue" className="hidden sm:inline-flex">
          JEE Main & Advanced
        </Badge>

        <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold border border-slate-700">
            A
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              <span>Ankit</span>
              <UserCheck className="w-3 h-3 text-emerald-500" />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Student / Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
