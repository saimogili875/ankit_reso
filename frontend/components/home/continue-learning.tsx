import React from 'react';
import Link from 'next/link';
import { PlayCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProgressItem {
  id: string;
  topicName: string;
  subjectMeta: string;
  progressPercent: number;
  durationLeft: string;
  badgeVariant: 'blue' | 'emerald' | 'amber';
  href: string;
}

const recentProgress: ProgressItem[] = [
  {
    id: '1',
    topicName: 'Current Electricity',
    subjectMeta: 'Physics • Class 12',
    progressPercent: 78,
    durationLeft: '12 mins left',
    badgeVariant: 'blue',
    href: '/learn?topic=current-electricity',
  },
  {
    id: '2',
    topicName: 'Chemical Bonding',
    subjectMeta: 'Chemistry • Class 11',
    progressPercent: 45,
    durationLeft: '24 mins left',
    badgeVariant: 'emerald',
    href: '/learn?topic=chemical-bonding',
  },
  {
    id: '3',
    topicName: 'Coordinate Geometry',
    subjectMeta: 'Mathematics • Class 11',
    progressPercent: 32,
    durationLeft: '35 mins left',
    badgeVariant: 'amber',
    href: '/learn?topic=coordinate-geometry',
  },
];

export const ContinueLearning: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Continue Learning</h3>
          <p className="text-xs text-slate-400">Pick up where you left off</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recentProgress.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-4 hover:border-slate-700 transition-all duration-200 shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={item.badgeVariant}>{item.subjectMeta}</Badge>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" /> {item.durationLeft}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-base text-slate-100">{item.topicName}</h4>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Topic Progress</span>
                  <span className="text-blue-400">{item.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.progressPercent}%` }}
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
                <span>Continue</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
