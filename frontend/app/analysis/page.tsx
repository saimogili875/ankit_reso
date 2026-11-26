'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Bookmark,
  Flame,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard, LineTrend, BarCompare, Donut } from '@/components/charts';

interface TrendItem {
  attempt_id: string;
  test_title: string;
  date: string;
  score: number;
  max_marks: number;
  percentage: number;
  accuracy: number;
  rank?: number | null;
  percentile?: number | null;
  time_taken_seconds: number;
}

interface AnalyticsOverviewData {
  total_tests_attempted: number;
  total_dpps_attempted: number;
  total_questions_answered: number;
  total_correct: number;
  total_incorrect: number;
  overall_accuracy: number;
  active_streak_days: number;
  syllabus_coverage_percentage: number;
  trends: TrendItem[];
  error_reasons: { [reason: string]: number };
  difficulty_accuracy: {
    [diff: string]: { total: number; correct: number; accuracy: number };
  };
}

interface ChapterPerformance {
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  total_attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  strength: 'Strong' | 'Average' | 'Weak';
}

interface ChaptersData {
  chapters: ChapterPerformance[];
  weak_chapters: ChapterPerformance[];
  strong_chapters: ChapterPerformance[];
}

interface RankPredictorData {
  has_predictor: boolean;
  has_attempts?: boolean;
  message?: string;
  exam_type?: string;
  latest_score?: number;
  average_score?: number;
  predicted_rank_min?: number;
  predicted_rank_max?: number;
  percentile_min?: number;
  percentile_max?: number;
  notes?: string;
}

export default function OverallAnalysisPage() {
  const [overview, setOverview] = useState<AnalyticsOverviewData | null>(null);
  const [chapters, setChapters] = useState<ChaptersData | null>(null);
  const [predictor, setPredictor] = useState<RankPredictorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ovData, chapData, predData] = await Promise.all([
        apiClient.get<AnalyticsOverviewData>('/analytics/overview/'),
        apiClient.get<ChaptersData>('/analytics/chapters/').catch(() => null),
        apiClient.get<RankPredictorData>('/analytics/rank-predictor/').catch(() => null),
      ]);

      if (ovData) setOverview(ovData);
      if (chapData) setChapters(chapData);
      if (predData) setPredictor(predData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load analytics.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-4">
        <LoadingState message="Aggregating performance metrics across tests and DPPs..." />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-4">
        <ErrorState title="Unable to load analytics" message={error || 'No data found.'} onRetry={loadData} />
      </div>
    );
  }

  const hasAnyAttempts = overview.total_tests_attempted > 0 || overview.total_dpps_attempted > 0;

  if (!hasAnyAttempts) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-surface border border-border text-primary mx-auto flex items-center justify-center">
          <BarChart2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground font-heading">No Analytics Data Yet</h1>
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
          Take a CBT mock test or solve daily practice problems (DPPs). Your accuracy, strength map,
          and rank predictions will automatically generate based on your real performance.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/tests" className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm">
            Attempt Mock Test
          </Link>
          <Link href="/practice" className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-surface border border-border text-foreground hover:bg-muted/10 transition-colors">
            Solve DPPs
          </Link>
        </div>
      </div>
    );
  }

  // Prepare trend data for LineTrend
  const progressionData = overview.trends.map((t) => ({
    label: t.test_title.length > 14 ? `${t.test_title.slice(0, 12)}…` : t.test_title,
    fullTitle: t.test_title,
    date: t.date,
    percentage: t.percentage,
    accuracy: t.accuracy,
    rank: t.rank || 0,
    timePerQuestion: Math.round((t.time_taken_seconds || 1800) / Math.max(t.max_marks / 4, 1)),
  }));

  // Prepare difficulty data for BarCompare
  const difficultyData = ['EASY', 'MEDIUM', 'HARD'].map((diff) => {
    const d = overview.difficulty_accuracy[diff] || { total: 0, correct: 0, accuracy: 0.0 };
    return {
      difficulty: diff,
      accuracy: Math.round(d.accuracy),
      correct: d.correct,
      incorrect: Math.max(d.total - d.correct, 0),
    };
  });

  // Prepare error reasons data for Donut
  const errorData = Object.entries(overview.error_reasons).map(([reason, count]) => ({
    name: reason.replace(/_/g, ' '),
    value: count,
  }));

  // Sparkline data for Accuracy KPI
  const accuracySpark = overview.trends.map((t) => t.accuracy);

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <BarChart2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-heading">
              Comprehensive Performance Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted">
            Multi-dimensional insights from your tests, practice sessions, and watch history.
          </p>
        </div>

        <Link
          href="/analysis/notebook"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors shrink-0"
        >
          <Bookmark className="w-4 h-4" />
          <span>Error Notebook & Bookmarks</span>
        </Link>
      </div>

      {/* Naresh-Style Glass KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KpiCard
          title="Overall Accuracy"
          value={`${overview.overall_accuracy}%`}
          change={overview.overall_accuracy >= 70 ? 5 : -2}
          changeLabel="vs target"
          sparklineData={accuracySpark}
          subtitle={`${overview.total_correct} of ${overview.total_questions_answered} correct`}
        />

        <KpiCard
          title="Study Streak"
          value={`${overview.active_streak_days} Days`}
          icon={Flame}
          subtitle="Consecutive learning days"
          badgeText="Active"
        />

        <KpiCard
          title="Tests & DPPs Done"
          value={`${overview.total_tests_attempted + overview.total_dpps_attempted}`}
          icon={CheckCircle2}
          subtitle={`${overview.total_tests_attempted} tests • ${overview.total_dpps_attempted} DPPs`}
        />

        <KpiCard
          title="Syllabus Covered"
          value={`${overview.syllabus_coverage_percentage}%`}
          icon={BookOpen}
          subtitle="Lecture & chapter progress"
        />
      </div>

      {/* OFFICIAL RANK PREDICTOR WIDGET */}
      {predictor?.has_predictor && predictor.has_attempts && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/15 via-surface to-surface border border-primary/40 space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                Official {predictor.exam_type} Rank Predictor
              </span>
              <h3 className="text-lg font-extrabold text-foreground font-heading">
                Forecasted All India Rank:{' '}
                <span className="text-primary font-mono font-black">
                  {predictor.predicted_rank_min?.toLocaleString()} – {predictor.predicted_rank_max?.toLocaleString()}
                </span>
              </h3>
              <p className="text-xs text-muted">
                Calibrated based on your latest mock test score of{' '}
                <strong className="text-foreground">{predictor.latest_score} marks</strong> (Average: {predictor.average_score} marks).
              </p>
            </div>

            {predictor.percentile_min && (
              <div className="p-3.5 rounded-xl bg-surface border border-border text-center shrink-0 shadow-sm">
                <span className="text-[10px] text-muted block uppercase font-bold">Estimated Percentile</span>
                <span className="text-lg font-extrabold text-emerald-500 font-mono">
                  {predictor.percentile_min}% – {predictor.percentile_max}%
                </span>
              </div>
            )}
          </div>
          {predictor.notes && (
            <p className="text-[11px] text-muted border-t border-border pt-2 font-mono">
              Advisor note: {predictor.notes}
            </p>
          )}
        </div>
      )}

      {/* 1. MOCK TEST SCORE & ACCURACY LINE TREND */}
      {progressionData.length > 0 && (
        <LineTrend
          title="Score & Accuracy Progression"
          description="Chronological performance across completed CBT papers and chapter tests"
          data={progressionData as unknown as Array<Record<string, unknown>>}
          xKey="label"
          series={[
            { key: 'percentage', name: 'Score %', color: 'var(--chart-1)' },
            { key: 'accuracy', name: 'Accuracy %', color: 'var(--chart-3)' },
          ]}
          height={280}
          valueFormatter={(val) => `${val}%`}
        />
      )}

      {/* 2. DIFFICULTY COMPARISON & ERROR DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* BarCompare: Accuracy by Difficulty */}
        <BarCompare
          title="Accuracy by Question Difficulty"
          description="Performance across Easy, Medium, and Hard exam simulation items"
          data={difficultyData as unknown as Array<Record<string, unknown>>}
          xKey="difficulty"
          series={[
            { key: 'accuracy', name: 'Accuracy %', color: 'var(--chart-2)' },
          ]}
          height={260}
          valueFormatter={(val) => `${val}%`}
        />

        {/* Donut: Error Reasons Distribution */}
        <Donut
          title="Mistake Pattern Breakdown"
          description="Self-tagged question errors and review notebook tags"
          data={errorData}
          centerValue={`${overview.total_incorrect}`}
          centerLabel="Missed"
          height={260}
          valueFormatter={(val) => `${val} errors`}
          emptyMessage="No question mistake tags recorded yet."
        />
      </div>

      {/* 3. TIME PER QUESTION TREND */}
      {progressionData.length > 0 && (
        <LineTrend
          title="Pacing: Average Time per Question"
          description="Speed and time management trajectory (seconds per question)"
          data={progressionData as unknown as Array<Record<string, unknown>>}
          xKey="label"
          series={[
            { key: 'timePerQuestion', name: 'Avg Seconds / Question', color: 'var(--chart-4)' },
          ]}
          height={220}
          valueFormatter={(val) => `${val}s`}
        />
      )}

      {/* 4. CHAPTER PERFORMANCE COMPARISON TABLE */}
      {chapters && chapters.weak_chapters.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground font-heading">
                Top Weak Chapters Needing Focus
              </h3>
              <p className="text-xs text-muted">Chapters where your problem-solving accuracy is below 40%</p>
            </div>
            <Link href="/practice" className="text-xs font-semibold text-primary hover:underline">
              Solve DPPs &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.weak_chapters.slice(0, 6).map((wc) => (
              <div key={wc.chapter_id} className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{wc.chapter_name}</h4>
                    <span className="text-[11px] text-primary">{wc.subject_name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono">
                    {wc.accuracy}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[11px] text-muted">
                  <span>{wc.incorrect} missed questions</span>
                  <Link href="/learn" className="text-primary hover:underline font-medium">Revise &rarr;</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
