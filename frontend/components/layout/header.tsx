'use client';

import React from 'react';
import { Search, Bell, ChevronDown, GraduationCap } from 'lucide-react';

export const Header: React.FC = () => {
  const exam = 'JEE Main & Advanced';

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search topics, PYQs, tests, concepts..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Exam Selector, Bell, User Profile */}
      <div className="flex items-center gap-3">
        {/* Exam Selector Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 cursor-pointer hover:border-slate-700 transition-colors">
          <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
          <span>{exam}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </button>

        {/* User Profile Avatar & Badge */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center border border-blue-400/40 shadow-sm">
            A
          </div>
          <div className="hidden md:block text-left">
            <span className="text-xs font-bold text-slate-100 block -mb-0.5">Ankit</span>
            <span className="text-[10px] text-slate-400 block font-medium">Student</span>
          </div>
        </div>
      </div>
    </header>
  );
};
