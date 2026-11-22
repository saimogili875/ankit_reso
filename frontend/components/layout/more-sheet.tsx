'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  CalendarDays,
  BarChart3,
  MessageSquare,
  FileText,
  Bookmark,
  User,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoreSheet: React.FC<MoreSheetProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    try {
      await apiClient.logout();
    } finally {
      router.push('/sign-in');
    }
  };

  const menuItems = [
    { label: 'Schedule & Timetable', href: '/schedule', icon: CalendarDays, desc: 'Live classes, exams & deadlines' },
    { label: 'Performance Analysis', href: '/analysis', icon: BarChart3, desc: 'Rank predictor, accuracy & test metrics' },
    { label: 'Doubt Solver', href: '/doubt-solver', icon: MessageSquare, desc: '24/7 expert JEE faculty solutions' },
    { label: 'Study Materials', href: '/materials', icon: FileText, desc: 'Formula sheets & revision handouts' },
    { label: 'Wrong-Answer Notebook', href: '/analysis/notebook', icon: Bookmark, desc: 'Bookmarks & error analysis' },
    { label: 'Student Profile', href: '/profile', icon: User, desc: 'Target exam, phone & personal settings' },
    { label: 'Administrator Portal', href: '/admin/login', icon: Settings, desc: 'Admin login & management console' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-up Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-t border-[#E3E7EE] dark:border-slate-800 rounded-t-3xl shadow-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-250">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EE] dark:border-slate-800">
          <div>
            <h3 className="font-heading font-bold text-lg text-[#101828] dark:text-slate-100">
              More Features
            </h3>
            <p className="text-xs text-[#5B6475] dark:text-slate-400">
              Logged in as {user?.first_name || user?.username || 'Student'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid / List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group min-h-[48px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#2B2FB8] dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-sm text-[#101828] dark:text-slate-100 block">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-[#5B6475] dark:text-slate-400 truncate block">
                      {item.desc}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="pt-2 border-t border-[#E3E7EE] dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-sm hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
