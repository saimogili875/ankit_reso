'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Target, CheckCircle2, Flame, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SubjectBreakdown {
  id: string;
  name: string;
  slug: string;
  accuracy: number;
  questions_attempted: number;
  questions_correct: number;
}

interface ProgressData {
  streak_days: number;
  accuracy_rate: number;
  syllabus_covered: number;
  questions_solved: number;
  total_attempts: number;
  completed_lectures: number;
  total_lectures: number;
  subject_breakdown: SubjectBreakdown[];
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<ProgressData>('/progress/')
      .then((res) => {
        if (!isMounted) return;
        setData(res);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const streakDays = data?.streak_days ?? 0;
  const accuracyRate = data?.accuracy_rate ?? 0;
  const syllabusCovered = data?.syllabus_covered ?? 0;
  const questionsSolved = data?.questions_solved ?? 0;
  const breakdown = data?.subject_breakdown ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Student Progress & Analytics</h1>
        <p className="text-sm text-slate-400">Detailed breakdown of real attempts, study hours, and subject accuracy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Daily Study Streak"
          value={`${streakDays} Day${streakDays === 1 ? '' : 's'}`}
          subtitle={streakDays > 0 ? 'Active study habit' : 'Complete a study activity today'}
          icon={Flame}
          iconColor="text-amber-400 bg-amber-500/10"
        />
        <StatsCard
          title="Accuracy Rate"
          value={`${accuracyRate}%`}
          subtitle={
            data && data.total_attempts > 0
              ? `${questionsSolved} questions answered correctly`
              : 'No practice problems attempted yet'
          }
          icon={Target}
          iconColor="text-emerald-400 bg-emerald-500/10"
        />
        <StatsCard
          title="Syllabus Covered"
          value={`${syllabusCovered}%`}
          subtitle={
            data && data.total_lectures > 0
              ? `${data.completed_lectures} of ${data.total_lectures} lectures completed`
              : 'Lectures completed'
          }
          icon={CheckCircle2}
          iconColor="text-blue-400 bg-blue-500/10"
        />
      </div>

      <Card className="space-y-4">
        <h3 className="font-bold text-base text-slate-100">Subject Accuracy Breakdown</h3>
        {breakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No subjects configured or attempted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {breakdown.map((subj) => {
              const hasAttempts = subj.questions_attempted > 0;
              return (
                <div key={subj.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">{subj.name}</span>
                    <span className="text-blue-400 font-semibold font-mono">
                      {hasAttempts
                        ? `${subj.accuracy}% (${subj.questions_correct}/${subj.questions_attempted} correct)`
                        : '0% (No attempts yet)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${subj.accuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
