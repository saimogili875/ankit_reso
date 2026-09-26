'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, BookOpen, Edit3, BarChart3, User } from 'lucide-react';

const mobileNavItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Learn', href: '/learn', icon: BookOpen },
  { label: 'Practice', href: '/practice', icon: Edit3 },
  { label: 'Analysis', href: '/analysis', icon: BarChart3 },
  { label: 'Profile', href: '/profile', icon: User },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-2 shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 px-2 rounded-xl min-w-[56px] transition-colors',
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-0.5', isActive ? 'text-blue-400 scale-110' : 'text-slate-400')} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
