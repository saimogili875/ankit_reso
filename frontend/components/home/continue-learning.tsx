'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayCircle, Clock, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  progress_percent: number;
  timestamp: string;
  href: string;
}

export const ContinueLearning: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<ActivityItem[]>('/progress/recent/')
      .then((data) => {
        if (!isMounted) return;
        setActivities(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Continue Learning</h3>
          <p className="text-xs text-slate-400">Pick up where you left off</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No study activity recorded yet</p>
          <p className="text-xs text-slate-500">
            Watch a lecture or attempt a practice problem to track your progress here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activities.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-4 hover:border-slate-700 transition-all duration-200 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={item.type === 'dpp' ? 'purple' : 'blue'}>
                    {item.type === 'dpp' ? 'Practice DPP' : 'Lecture Video'}
                  </Badge>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-100 line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-blue-400">{item.progress_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.progress_percent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <Link
                  href={item.href}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-md shadow-blue-600/20"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Resume</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
