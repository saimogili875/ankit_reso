'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  BarChart2,
  RotateCcw,
  Play,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

interface UserAttemptSummary {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED';
  is_completed: boolean;
  score: number;
  total_marks: number;
  rank?: number | null;
  percentile?: number | null;
  accuracy: number;
  time_taken_seconds: number;
  submitted_at?: string;
}

interface TestItem {
  id: string;
  title: string;
  description: string;
  test_type: 'MOCK' | 'PYQ' | 'CHAPTER' | 'SECTIONAL';
  duration_minutes: number;
  total_marks: number;
  cutoff_score: number;
  start_time?: string | null;
  end_time?: string | null;
  publish_results_immediately: boolean;
  is_published: boolean;
  exam_name?: string;
  course_title?: string;
  question_count: number;
  user_attempt?: UserAttemptSummary | null;
  created_at: string;
}

export default function TestsPage() {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'upcoming' | 'attempted'>('available');

  const fetchTests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<TestItem[]>(`/tests/?status=${activeTab}`);
      setTests(asList<TestItem>(data));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tests.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const renderTypeBadge = (type: TestItem['test_type']) => {
    switch (type) {
      case 'MOCK':
        return <Badge variant="purple">Full Mock</Badge>;
      case 'PYQ':
        return <Badge variant="blue">PYQ Paper</Badge>;
      case 'CHAPTER':
        return <Badge variant="emerald">Chapter Wise</Badge>;
      case 'SECTIONAL':
        return <Badge variant="amber">Sectional</Badge>;
      default:
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-950/60 border border-purple-900/60 text-purple-400">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Test Series & NTA CBT Papers
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real NTA CBT simulation with instant AI analytics, rank, percentile, and solution keys.
          </p>
        </div>

        <Link
          href="/analysis"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors shrink-0"
        >
          <BarChart2 className="w-4 h-4 text-blue-400" />
          <span>Overall Analytics</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'available'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
        >
          Available Tests
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attempted')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'attempted'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
        >
          Attempted Papers
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'upcoming'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
        >
          Upcoming Tests
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading test papers from database..." />
      ) : error ? (
        <ErrorState title="Unable to load tests" message={error} onRetry={fetchTests} />
      ) : tests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <FileText className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">
            {activeTab === 'attempted'
              ? 'No tests attempted yet'
              : activeTab === 'upcoming'
                ? 'No upcoming scheduled tests'
                : 'No available tests found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {activeTab === 'attempted'
              ? 'Attempt an available mock test to view detailed accuracy, time management, and weak chapter analytics.'
              : 'New full-length mock tests and chapter quizzes are scheduled weekly by faculty.'}
          </p>
          {activeTab !== 'available' && (
            <button
              type="button"
              onClick={() => setActiveTab('available')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Browse Available Tests
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tests.map((test) => {
            const attempt = test.user_attempt;
            const isCompleted = attempt && (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED');
            const isInProgress = attempt && attempt.status === 'IN_PROGRESS';

            return (
              <div
                key={test.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {renderTypeBadge(test.test_type)}
                      {test.course_title && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                          {test.course_title}
                        </span>
                      )}
                    </div>
                    {isCompleted ? (
                      <Badge variant="emerald" className="gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </Badge>
                    ) : isInProgress ? (
                      <Badge variant="amber" className="gap-1 text-[10px]">
                        <RotateCcw className="w-3 h-3" />
                        In Progress
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-100 line-clamp-2">
                      {test.title}
                    </h3>
                    {test.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {test.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Questions</span>
                      <span className="text-xs font-bold text-slate-200">{test.question_count}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Duration</span>
                      <span className="text-xs font-bold text-slate-200">{test.duration_minutes}m</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Marks</span>
                      <span className="text-xs font-bold text-slate-200">{test.total_marks}</span>
                    </div>
                  </div>

                  {/* If completed, display score & rank summary */}
                  {isCompleted && attempt && (
                    <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-900/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Your Score:</span>
                        <span className="font-extrabold text-blue-300">
                          {attempt.score} / {test.total_marks}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Accuracy / Rank:</span>
                        <span className="font-semibold text-slate-200">
                          {attempt.accuracy}% • Rank {attempt.rank ? `#${attempt.rank}` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {isCompleted && attempt ? (
                    <Link
                      href={`/tests/${attempt.id}/result`}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-600/20"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      View Complete Analysis
                    </Link>
                  ) : isInProgress && attempt ? (
                    <Link
                      href={`/tests/${test.id}/attempt?attempt_id=${attempt.id}`}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Resume Test
                    </Link>
                  ) : (
                    <Link
                      href={`/tests/${test.id}/attempt`}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-purple-600/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Start Test
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
