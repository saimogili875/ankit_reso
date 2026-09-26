'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Target, CheckCircle2, Flame } from 'lucide-react';

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Student Progress & Analytics</h1>
        <p className="text-sm text-slate-400">Detailed breakdown of subject accuracy, study hours, and weak areas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Daily Study Streak"
          value="14 Days"
          subtitle="Consistent study habit"
          icon={Flame}
          iconColor="text-amber-400 bg-amber-500/10"
        />
        <StatsCard
          title="Accuracy Rate"
          value="78.4%"
          subtitle="Across all practice sets"
          icon={Target}
          iconColor="text-emerald-400 bg-emerald-500/10"
        />
        <StatsCard
          title="Syllabus Covered"
          value="64%"
          subtitle="Physics, Chem & Math"
          icon={CheckCircle2}
          iconColor="text-blue-400 bg-blue-500/10"
        />
      </div>

      <Card className="space-y-4">
        <h3 className="font-bold text-base text-slate-100">Subject Accuracy Breakdown</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Physics (Mechanics & Electrodynamics)</span>
              <span className="text-blue-400 font-semibold">82% Accuracy</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-[82%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Chemistry (Physical & Organic)</span>
              <span className="text-emerald-400 font-semibold">76% Accuracy</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[76%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Mathematics (Calculus & Algebra)</span>
              <span className="text-purple-400 font-semibold">68% Accuracy</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-[68%]" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
