'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Edit3,
  BarChart3,
  MessageSquare,
  FileCheck2,
  FileText,
  Sparkles,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

interface ApiQuickAccess {
  id: string;
  title: string;
  description?: string;
  icon_name?: string;
  href: string;
  badge_text?: string;
  order: number;
  is_visible: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Edit3,
  BarChart3,
  MessageSquare,
  FileCheck2,
  FileText,
  Sparkles,
};

const colorStyles = [
  { accent: 'group-hover:border-blue-500/50', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { accent: 'group-hover:border-emerald-500/50', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { accent: 'group-hover:border-purple-500/50', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { accent: 'group-hover:border-amber-500/50', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { accent: 'group-hover:border-rose-500/50', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { accent: 'group-hover:border-cyan-500/50', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
];

export const QuickAccess: React.FC = () => {
  const [items, setItems] = useState<ApiQuickAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadQuickAccess() {
      try {
        const data = await apiClient.get<ApiQuickAccess[]>('/content/quick-access/');
        if (!isMounted) return;
        if (Array.isArray(data)) {
          setItems(data.filter((i) => i.is_visible));
        }
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadQuickAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Quick Access</h3>
          <p className="text-xs text-slate-400">Everything you need for JEE preparation</p>
        </div>
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-xs">Loading portals...</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold tracking-tight text-slate-100">Quick Access</h3>
        <p className="text-xs text-slate-400">Everything you need for JEE preparation</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {items.map((item, idx) => {
          const Icon = (item.icon_name && iconMap[item.icon_name]) || BookOpen;
          const style = colorStyles[idx % colorStyles.length];

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'group relative p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:bg-slate-900/90 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between shadow-md',
                style.accent
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={cn('p-2.5 rounded-xl border flex items-center justify-center', style.badge)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 group-hover:text-white group-hover:bg-slate-800 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-base text-slate-100 group-hover:text-white transition-colors">
                      {item.title}
                    </h4>
                    {item.badge_text && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                        {item.badge_text}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
