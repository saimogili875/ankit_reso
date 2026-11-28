'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, GraduationCap, MoreHorizontal, Video, Award } from 'lucide-react';
import { MoreSheet } from './more-sheet';

interface NavTab {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mobileTabs: NavTab[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Courses', href: '/courses', icon: GraduationCap },
  { label: 'Learn', href: '/learn', icon: Video },
  { label: 'Exams', href: '/exams', icon: Award },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Check if More is active (when current route is one of the More subpages)
  const isMoreRoute = ['/schedule', '/analysis', '/doubt-solver', '/materials', '/profile', '/settings'].some((r) =>
    pathname.startsWith(r)
  );

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-[#E3E7EE] dark:border-slate-800/80 px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl min-h-[64px]"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {mobileTabs.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[48px]',
                  isActive
                    ? 'text-[#2B2FB8] dark:text-blue-400 font-bold scale-[1.02]'
                    : 'text-[#5B6475] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-0.5', isActive ? 'text-[#2B2FB8] dark:text-blue-400 stroke-[2.2]' : 'stroke-[1.8]')} />
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}

          {/* More Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="More navigation options"
            className={cn(
              'flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[48px]',
              isMoreRoute || isMoreOpen
                ? 'text-[#2B2FB8] dark:text-blue-400 font-bold'
                : 'text-[#5B6475] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <MoreHorizontal className={cn('w-5 h-5 mb-0.5', isMoreRoute || isMoreOpen ? 'text-[#2B2FB8] dark:text-blue-400' : '')} />
            <span className="text-[11px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
};
