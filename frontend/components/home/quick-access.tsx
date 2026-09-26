import React from 'react';
import Link from 'next/link';
import { BookOpen, Edit3, BarChart3, MessageSquare, FileCheck2, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAccessItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accentColor: string;
  badgeBg: string;
}

const quickAccessItems: QuickAccessItem[] = [
  {
    id: 'learn',
    title: 'Learn',
    description: 'Watch lectures and study concepts',
    href: '/learn',
    icon: BookOpen,
    accentColor: 'text-blue-400 group-hover:border-blue-500/50',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    id: 'practice',
    title: 'Practice',
    description: 'Solve questions and PYQs',
    href: '/practice',
    icon: Edit3,
    accentColor: 'text-emerald-400 group-hover:border-emerald-500/50',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    id: 'tests',
    title: 'Tests',
    description: 'Take mock tests and chapter tests',
    href: '/tests',
    icon: FileCheck2,
    accentColor: 'text-purple-400 group-hover:border-purple-500/50',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    description: 'Track your progress and improve',
    href: '/analysis',
    icon: BarChart3,
    accentColor: 'text-amber-400 group-hover:border-amber-500/50',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    id: 'doubt-solver',
    title: 'Doubt Solver',
    description: 'Ask doubts and get help',
    href: '/doubt-solver',
    icon: MessageSquare,
    accentColor: 'text-rose-400 group-hover:border-rose-500/50',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
];

export const QuickAccess: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold tracking-tight text-slate-100">Quick Access</h3>
        <p className="text-xs text-slate-400">Everything you need for JEE preparation</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {quickAccessItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'group relative p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:bg-slate-900/90 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between shadow-md',
                item.accentColor
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={cn('p-2.5 rounded-xl border flex items-center justify-center', item.badgeBg)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 group-hover:text-white group-hover:bg-slate-800 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-100 group-hover:text-white transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
