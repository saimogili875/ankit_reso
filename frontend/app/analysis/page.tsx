'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  TrendingUp,
  Target,
  AlertCircle,
  Bookmark,
  Flame,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

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
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-blue-400 mx-auto flex items-center justify-center">
          <BarChart2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-100">No Analytics Data Yet</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Take a CBT mock test or solve daily practice problems (DPPs). Your accuracy, strength map,
          and rank predictions will automatically generate based on your real performance.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/tests" className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white">
            Attempt Mock Test
          </Link>
          <Link href="/practice" className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200">
            Solve DPPs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-950/60 border border-blue-900/60 text-blue-400">
              <BarChart2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Comprehensive Performance Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Multi-dimensional insights from your tests, practice sessions, and watch history.
          </p>
        </div>

        <Link
          href="/analysis/notebook"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800 transition-colors shrink-0"
        >
          <Bookmark className="w-4 h-4 text-purple-400" />
          <span>Error Notebook & Bookmarks</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase block">Overall Accuracy</span>
          <span className="text-2xl font-extrabold text-blue-400">{overview.overall_accuracy}%</span>
          <span className="text-[11px] text-slate-500 block">{overview.total_correct} of {overview.total_questions_answered} correct</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase block">Study Streak</span>
          <div className="flex items-center justify-center gap-1.5 text-2xl font-extrabold text-amber-400">
            <Flame className="w-6 h-6 fill-current" />
            <span>{overview.active_streak_days} Days</span>
          </div>
          <span className="text-[11px] text-slate-500 block">Consecutive learning activity</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase block">Tests / DPPs Done</span>
          <span className="text-2xl font-extrabold text-purple-400">
            {overview.total_tests_attempted} <span className="text-sm font-normal text-slate-500">tests</span> • {overview.total_dpps_attempted} <span className="text-sm font-normal text-slate-500">dpps</span>
          </span>
          <span className="text-[11px] text-slate-500 block">Exam simulation volume</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase block">Syllabus Covered</span>
          <span className="text-2xl font-extrabold text-emerald-400">{overview.syllabus_coverage_percentage}%</span>
          <span className="text-[11px] text-slate-500 block">Verified lecture watch progress</span>
        </div>
      </div>

      {/* RANK PREDICTOR WIDGET (Rendered only if Admin table is configured) */}
      {predictor?.has_predictor && predictor.has_attempts && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border border-purple-500/40 space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Official {predictor.exam_type} Rank Predictor
              </span>
              <h3 className="text-lg font-extrabold text-white">
                Forecasted All India Rank:{' '}
                <span className="text-purple-400 font-mono">
                  {predictor.predicted_rank_min?.toLocaleString()} – {predictor.predicted_rank_max?.toLocaleString()}
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Calibrated based on your latest mock test score of{' '}
                <strong className="text-white">{predictor.latest_score} marks</strong> (Average: {predictor.average_score} marks).
              </p>
            </div>

            {predictor.percentile_min && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900 text-center shrink-0">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Estimated Percentile</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {predictor.percentile_min}% – {predictor.percentile_max}%
                </span>
              </div>
            )}
          </div>
          {predictor.notes && (
            <p className="text-[11px] text-slate-400 border-t border-purple-950 pt-2">
              Advisor note: {predictor.notes}
            </p>
          )}
        </div>
      )}

      {/* TEST CHRONOLOGICAL PROGRESSION */}
      {overview.trends.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Mock Test Progression
              </h3>
              <p className="text-xs text-slate-400">Score & accuracy trajectory across completed papers</p>
            </div>
          </div>

          <div className="space-y-2">
            {overview.trends.map((t) => (
              <div
                key={t.attempt_id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-200 block">{t.test_title}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{t.date}</span>
                </div>

                <div className="flex items-center gap-6 font-mono text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Score</span>
                    <strong className="text-blue-400 font-bold">{t.score} / {t.max_marks}</strong> ({t.percentage}%)
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Accuracy</span>
                    <strong className="text-amber-400 font-bold">{t.accuracy}%</strong>
                  </div>
                  {t.rank && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Rank</span>
                      <strong className="text-purple-400 font-bold">#{t.rank}</strong>
                    </div>
                  )}
                  <Link
                    href={`/tests/${t.attempt_id}/result`}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-800 text-[11px] font-semibold transition-colors"
                  >
                    Analysis →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DIFFICULTY ACCURACY & ERROR REASONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Difficulty Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Accuracy by Question Difficulty
          </h3>
          <div className="space-y-3">
            {['EASY', 'MEDIUM', 'HARD'].map((diff) => {
              const dData = overview.difficulty_accuracy[diff] || { total: 0, correct: 0, accuracy: 0.0 };
              const barColor = diff === 'EASY' ? 'bg-emerald-500' : diff === 'MEDIUM' ? 'bg-amber-500' : 'bg-rose-500';

              return (
                <div key={diff} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-300">{diff}</span>
                    <span className="text-slate-200">{dData.accuracy}% ({dData.correct}/{dData.total})</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div style={{ width: `${dData.accuracy}%` }} className={`h-full ${barColor} rounded-full`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Reasons Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            Error Reasons (From Your Question Tags)
          </h3>
          {Object.keys(overview.error_reasons).length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Tag your incorrect questions on test result pages to visualize your primary mistake patterns.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(overview.error_reasons).map(([reason, cnt]) => (
                <div key={reason} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{reason.replace('_', ' ')}</span>
                  <span className="font-bold text-rose-400 font-mono">{cnt} mistakes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* WEAK CHAPTERS ACTIONABLE LIST */}
      {chapters && chapters.weak_chapters.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Top Weak Chapters Needing Attention</h3>
              <p className="text-xs text-slate-400">Chapters where your accuracy is below 40%</p>
            </div>
            <Link href="/practice" className="text-xs font-semibold text-blue-400 hover:underline">
              Solve DPPs →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {chapters.weak_chapters.slice(0, 6).map((wc) => (
              <div key={wc.chapter_id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{wc.chapter_name}</h4>
                    <span className="text-[11px] text-blue-400">{wc.subject_name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-900">
                    {wc.accuracy}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>{wc.incorrect} missed questions</span>
                  <Link href="/learn" className="text-blue-400 hover:underline">Revise →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
