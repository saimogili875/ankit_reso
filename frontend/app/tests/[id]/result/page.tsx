'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Bookmark,
  PlayCircle,
  FileText,
  Target,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

interface ReviewQuestion {
  log_id: string;
  question_id: string;
  order: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  subject_name: string;
  chapter_name: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  status: string;
  time_spent_seconds: number;
  class_avg_time_seconds: number;
  class_accuracy_percentage: number;
  visit_count: number;
  answer_change_count: number;
  marks_awarded: number;
  student_reason_tag: string;
  is_bookmarked: boolean;
  is_revised: boolean;
  solution_text: string;
  options: Array<{ id: string; option_text: string; is_correct: boolean }>;
}

interface ResultData {
  results_locked?: boolean;
  message?: string;
  attempt_id: string;
  test_id: string;
  test_title: string;
  test_type?: string;
  score?: number;
  total_marks?: number;
  overview: {
    score: number;
    total_marks: number;
    percentage: number;
    rank?: number | null;
    total_participants: number;
    percentile?: number | null;
    has_enough_attempts: boolean;
    accuracy: number;
    attempted_count: number;
    correct_count: number;
    incorrect_count: number;
    skipped_count: number;
    negative_marks_lost: number;
    time_taken_seconds: number;
    total_duration_seconds: number;
    cutoff_score: number;
    is_cleared_cutoff: boolean;
    topper_score: number;
    average_score: number;
  };
  sections: Array<{
    id: string;
    name: string;
    subject_name: string;
    total_questions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    skipped: number;
    score: number;
    max_marks: number;
    accuracy: number;
    attempt_rate: number;
    time_spent: number;
  }>;
  chapters: Array<{
    id: string;
    name: string;
    subject_name: string;
    total_questions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    avg_time_seconds: number;
    tag: 'Strong' | 'Average' | 'Weak';
  }>;
  time_analysis: {
    total_time_spent: number;
    total_duration: number;
    ideal_time_per_question: number;
    average_time_per_question: number;
    time_on_correct: number;
    time_on_wrong: number;
    time_on_skipped: number;
    time_wasted_total: number;
    questions_over_2x_ideal: Array<{
      id: string;
      question_text: string;
      time_spent: number;
      ideal_time: number;
      is_correct: boolean;
    }>;
    pacing_assessment: string;
  };
  attempt_strategy: {
    guess_count: number;
    unattempted_easy_count: number;
    marked_for_review_count: number;
    total_answer_changes: number;
  };
  marks_analysis: {
    actual_score: number;
    negative_marks_lost: number;
    marks_lost_easy: number;
    potential_no_negatives: number;
    potential_easy_solved: number;
    efficiency_ratio: number;
  };
  comparison: {
    student: { score: number; accuracy: number; time_taken: number };
    topper: { score: number; accuracy: number; time_taken: number };
    average: { score: number; accuracy: number; time_taken: number };
    sections_comparison: Array<{
      name: string;
      student_score: number;
      max_marks: number;
      student_accuracy: number;
    }>;
  };
  recommendations: Array<{
    chapter_id: string;
    chapter_name: string;
    subject_name: string;
    accuracy: number;
    lectures: Array<{ id: string; title: string; order: number }>;
    dpps: Array<{ id: string; title: string; dpp_number: number }>;
    materials: Array<{ id: string; title: string; material_type: string }>;
  }>;
  score_distribution: Array<{
    range: string;
    count: number;
    is_student_bucket: boolean;
  }>;
}

type TabType =
  | 'overview'
  | 'sections'
  | 'chapters'
  | 'questions'
  | 'time'
  | 'strategy'
  | 'marks'
  | 'compare'
  | 'recommendations';

export default function TestResultPage() {
  const params = useParams();
  const attemptId = params.id as string;

  const [result, setResult] = useState<ResultData | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Question Filter
  const [questionFilter, setQuestionFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped' | 'bookmarked'>('all');

  const loadResult = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resData, qData] = await Promise.all([
        apiClient.get<ResultData>(`/tests/attempts/${attemptId}/result/`),
        apiClient.get<{ questions: ReviewQuestion[] }>(`/tests/attempts/${attemptId}/questions/`).catch(() => ({ questions: [] })),
      ]);

      if (resData) {
        setResult(resData);
      }
      if (qData && qData.questions) {
        setQuestions(qData.questions);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load test analysis.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  // Tag question or bookmark
  const handleUpdateQuestionTag = async (qId: string, reasonTag: string) => {
    try {
      await apiClient.post(`/tests/attempts/${attemptId}/tag-question/`, {
        question_id: qId,
        student_reason_tag: reasonTag,
      });

      setQuestions((prev) =>
        prev.map((q) => (q.question_id === qId ? { ...q, student_reason_tag: reasonTag } : q))
      );
    } catch {
      alert('Failed to save reason tag.');
    }
  };

  const handleToggleBookmark = async (qId: string, currentVal: boolean) => {
    try {
      await apiClient.post(`/tests/attempts/${attemptId}/tag-question/`, {
        question_id: qId,
        is_bookmarked: !currentVal,
      });

      setQuestions((prev) =>
        prev.map((q) => (q.question_id === qId ? { ...q, is_bookmarked: !currentVal } : q))
      );
    } catch {
      alert('Failed to update bookmark.');
    }
  };

  // Filtered review questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (questionFilter === 'correct') return q.is_correct;
      if (questionFilter === 'incorrect') return !q.is_correct && Boolean(q.selected_answer);
      if (questionFilter === 'skipped') return !q.selected_answer;
      if (questionFilter === 'bookmarked') return q.is_bookmarked;
      return true;
    });
  }, [questions, questionFilter]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-4">
        <LoadingState message="Computing and loading multi-dimensional test analytics..." />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-4">
        <ErrorState title="Unable to load analysis" message={error || 'Result not found.'} onRetry={loadResult} />
      </div>
    );
  }

  // Gated results window
  if (result.results_locked) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-900/60 text-amber-400 mx-auto flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-100">{result.test_title}</h1>
        <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">{result.message}</p>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 max-w-sm mx-auto text-xs space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Your Submitted Score:</span>
            <span className="font-bold text-blue-400">{result.overview?.score ?? result.score ?? 0} / {result.overview?.total_marks ?? result.total_marks ?? 0}</span>
          </div>
          <span className="text-[11px] text-slate-500 block">Solutions will unlock automatically at window close.</span>
        </div>
        <Link href="/tests" className="inline-flex px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white">
          Back to Tests
        </Link>
      </div>
    );
  }

  const { overview } = result;

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 uppercase tracking-wider">
              {result.test_type || 'MOCK'} Analysis
            </span>
            {overview.is_cleared_cutoff ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                Cleared Cutoff ({overview.cutoff_score})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                Below Cutoff ({overview.cutoff_score})
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            {result.test_title}
          </h1>
          <p className="text-xs text-slate-400">
            Performance snapshot based on {overview.total_participants} authenticated test attempts.
          </p>
        </div>

        {/* Score & Rank Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Score</span>
            <span className="text-lg font-extrabold text-blue-400">
              {overview.score}
              <span className="text-xs text-slate-500 font-normal">/{overview.total_marks}</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Rank</span>
            <span className="text-lg font-extrabold text-purple-400">
              {overview.rank ? `#${overview.rank}` : '—'}
            </span>
            <span className="text-[10px] text-slate-500 block">of {overview.total_participants}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Percentile</span>
            {overview.has_enough_attempts && overview.percentile !== null ? (
              <span className="text-lg font-extrabold text-emerald-400">{overview.percentile}%</span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 block pt-1">Too few attempts</span>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Accuracy</span>
            <span className="text-lg font-extrabold text-amber-400">{overview.accuracy}%</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (9 Dimensions) */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'sections', label: 'Sections' },
          { key: 'chapters', label: 'Chapters & Topics' },
          { key: 'questions', label: 'Questions Review' },
          { key: 'time', label: 'Time Management' },
          { key: 'strategy', label: 'Attempt Strategy' },
          { key: 'marks', label: 'Marks Analysis' },
          { key: 'compare', label: 'Compare' },
          { key: 'recommendations', label: 'Recommendations' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Question Breakdown Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Total Attempted</span>
              <span className="text-xl font-extrabold text-slate-100">{overview.attempted_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-emerald-400 block">Correct Answers</span>
              <span className="text-xl font-extrabold text-emerald-400">+{overview.correct_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-rose-400 block">Incorrect Answers</span>
              <span className="text-xl font-extrabold text-rose-400">-{overview.incorrect_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Skipped Questions</span>
              <span className="text-xl font-extrabold text-slate-400">{overview.skipped_count}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-rose-400 block">Negative Lost</span>
              <span className="text-xl font-extrabold text-rose-400">-{overview.negative_marks_lost}</span>
            </div>
          </div>

          {/* Score Distribution Histogram */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Score Distribution vs Test Takers</h3>
                <p className="text-xs text-slate-400">Where you stand across the participant curve</p>
              </div>
              <span className="text-xs font-mono text-blue-400 font-semibold">
                Class Avg: {overview.average_score} • Topper: {overview.topper_score}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2 pt-4 items-end h-44">
              {result.score_distribution.map((b, idx) => {
                const maxCount = Math.max(1, ...result.score_distribution.map((x) => x.count));
                const heightPct = Math.max(15, (b.count / maxCount) * 100);

                return (
                  <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[11px] font-bold text-slate-300">{b.count}</span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        b.is_student_bucket
                          ? 'bg-blue-600 shadow-lg shadow-blue-600/30 ring-2 ring-white'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-mono truncate ${
                        b.is_student_bucket ? 'text-blue-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {b.range}
                    </span>
                    {b.is_student_bucket && (
                      <span className="text-[9px] font-extrabold uppercase text-blue-400 -mt-1">
                        You
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECTIONS */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4 font-semibold">Section / Subject</th>
                  <th className="p-4 font-semibold text-center">Score / Max</th>
                  <th className="p-4 font-semibold text-center">Accuracy</th>
                  <th className="p-4 font-semibold text-center">Attempt Rate</th>
                  <th className="p-4 font-semibold text-center">Correct / Wrong / Skip</th>
                  <th className="p-4 font-semibold text-right">Time Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {result.sections.map((sec) => (
                  <tr key={sec.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-bold text-slate-100">
                      <div>{sec.name}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{sec.subject_name}</span>
                    </td>
                    <td className="p-4 text-center font-extrabold text-blue-400">
                      {sec.score} / {sec.max_marks}
                    </td>
                    <td className="p-4 text-center font-bold text-amber-400">
                      {sec.accuracy}%
                    </td>
                    <td className="p-4 text-center font-bold text-slate-300">
                      {sec.attempt_rate}%
                    </td>
                    <td className="p-4 text-center font-mono">
                      <span className="text-emerald-400 font-bold">{sec.correct}</span> /{' '}
                      <span className="text-rose-400 font-bold">{sec.incorrect}</span> /{' '}
                      <span className="text-slate-400">{sec.skipped}</span>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-400">
                      {Math.floor(sec.time_spent / 60)}m {sec.time_spent % 60}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHAPTERS / TOPICS */}
      {activeTab === 'chapters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Chapter-wise Strength (Weakest First)</h3>
            <span className="text-xs text-slate-400">Prioritize weak chapters for targeted revision</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.chapters.map((c) => {
              const badgeVariant = c.tag === 'Strong' ? 'emerald' : c.tag === 'Average' ? 'amber' : 'rose';

              return (
                <div key={c.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{c.name}</h4>
                      <span className="text-xs text-blue-400 font-medium">{c.subject_name}</span>
                    </div>
                    <Badge variant={badgeVariant}>{c.tag}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Accuracy</span>
                      <span className="font-extrabold text-slate-200">{c.accuracy}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Correct / Total</span>
                      <span className="font-extrabold text-slate-200">{c.correct} / {c.total_questions}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Avg Time</span>
                      <span className="font-extrabold text-slate-200">{c.avg_time_seconds}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: QUESTIONS (REVIEW) */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Question Review Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: `All (${questions.length})` },
              { key: 'correct', label: `Correct (${overview.correct_count})` },
              { key: 'incorrect', label: `Incorrect (${overview.incorrect_count})` },
              { key: 'skipped', label: `Skipped (${overview.skipped_count})` },
              { key: 'bookmarked', label: `Bookmarked (${questions.filter((q) => q.is_bookmarked).length})` },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setQuestionFilter(f.key as 'all' | 'correct' | 'incorrect' | 'skipped' | 'bookmarked')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  questionFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {filteredQuestions.map((q, qIdx) => {
              const isCorrect = q.is_correct;
              const isSkipped = !q.selected_answer;

              return (
                <div
                  key={q.question_id}
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isCorrect
                      ? 'bg-slate-900 border-emerald-900/40'
                      : isSkipped
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-900 border-rose-900/40'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        Q{q.order || qIdx + 1}
                      </span>
                      <span className="text-xs text-blue-400 font-medium">
                        {[q.subject_name, q.chapter_name].filter(Boolean).join(' • ')}
                      </span>
                      <Badge variant="slate" className="text-[10px]">{q.difficulty}</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Correct (+{q.marks_awarded})
                        </span>
                      ) : isSkipped ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Skipped (0)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          Wrong ({q.marks_awarded})
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(q.question_id, q.is_bookmarked)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          q.is_bookmarked
                            ? 'bg-amber-950/60 border-amber-600 text-amber-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Bookmark for Notebook revision"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                    {q.question_text}
                  </p>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const isUserPick = q.selected_answer === str(opt.id) || q.selected_answer === opt.option_text;
                      const isCorrectOpt = opt.is_correct;

                      let optClass = 'bg-slate-950 border-slate-800 text-slate-300';
                      if (isCorrectOpt) {
                        optClass = 'bg-emerald-950/40 border-emerald-600 text-emerald-200 font-semibold';
                      } else if (isUserPick && !isCorrect) {
                        optClass = 'bg-rose-950/40 border-rose-600 text-rose-200 font-semibold';
                      }

                      return (
                        <div key={opt.id} className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${optClass}`}>
                          <span className="w-5 h-5 rounded flex items-center justify-center font-bold bg-white/10 shrink-0">
                            {letter}
                          </span>
                          <span className="flex-1">{opt.option_text}</span>
                          {isCorrectOpt && <span className="text-[10px] text-emerald-400 font-extrabold uppercase">Correct</span>}
                          {isUserPick && !isCorrectOpt && <span className="text-[10px] text-rose-400 font-extrabold uppercase">Your Pick</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution & Class Stats */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <span>Time Spent: <strong className="text-slate-200">{q.time_spent_seconds}s</strong></span>
                        <span>Class Avg: <strong className="text-slate-200">{q.class_avg_time_seconds}s</strong></span>
                        <span>Class Accuracy: <strong className="text-slate-200">{q.class_accuracy_percentage}%</strong></span>
                      </div>

                      {/* Why I Got It Wrong Selector */}
                      {!isCorrect && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-amber-400 font-semibold">Error Reason:</span>
                          <select
                            value={q.student_reason_tag}
                            onChange={(e) => handleUpdateQuestionTag(q.question_id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-200 py-1 px-2 focus:outline-none focus:border-blue-500"
                          >
                            <option value="NONE">Tag Error Reason...</option>
                            <option value="CONCEPT_GAP">Concept Gap</option>
                            <option value="CALCULATION">Calculation Error</option>
                            <option value="SILLY">Silly Mistake</option>
                            <option value="GUESS">Blind Guess</option>
                            <option value="TIME_PRESSURE">Time Pressure</option>
                            <option value="DIDNT_KNOW">Did Not Know Formula</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {q.solution_text && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-xs font-bold text-emerald-400 block mb-1">Detailed Solution:</span>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                          {q.solution_text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: TIME MANAGEMENT */}
      {activeTab === 'time' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Total Time Spent</span>
              <span className="text-lg font-bold text-slate-100">
                {Math.floor(result.time_analysis.total_time_spent / 60)}m {result.time_analysis.total_time_spent % 60}s
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Avg Time per Question</span>
              <span className="text-lg font-bold text-blue-400">
                {result.time_analysis.average_time_per_question}s
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-rose-400 block">Time on Wrong Answers</span>
              <span className="text-lg font-bold text-rose-400">
                {Math.floor(result.time_analysis.time_on_wrong / 60)}m {result.time_analysis.time_on_wrong % 60}s
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <span className="text-xs text-amber-400 block">Time Wasted Total</span>
              <span className="text-lg font-bold text-amber-400">
                {Math.floor(result.time_analysis.time_wasted_total / 60)}m
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              Questions Taking &gt; 2x Ideal Time ({Math.round(result.time_analysis.ideal_time_per_question)}s ideal)
            </h3>
            {result.time_analysis.questions_over_2x_ideal.length === 0 ? (
              <p className="text-xs text-slate-400">No time traps encountered. Excellent pace control.</p>
            ) : (
              <div className="space-y-2">
                {result.time_analysis.questions_over_2x_ideal.map((q) => (
                  <div key={q.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300 truncate max-w-md">{q.question_text}</span>
                    <span className="font-mono text-rose-400 font-bold shrink-0">{q.time_spent}s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ATTEMPT STRATEGY */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 block">Fast Answers (&lt; 10s Blind Guesses)</span>
            <span className="text-2xl font-extrabold text-amber-400">{result.attempt_strategy.guess_count}</span>
            <p className="text-xs text-slate-500">Rapid answers often indicate instinctive guesses or memorized shortcuts.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 block">Unattempted Easy Questions</span>
            <span className="text-2xl font-extrabold text-rose-400">{result.attempt_strategy.unattempted_easy_count}</span>
            <p className="text-xs text-slate-500">Missed opportunities on standard formula-based questions.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 block">Marked for Review Count</span>
            <span className="text-2xl font-extrabold text-purple-400">{result.attempt_strategy.marked_for_review_count}</span>
            <p className="text-xs text-slate-500">Questions tagged to re-evaluate in the final pass.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 block">Total Answer Changes</span>
            <span className="text-2xl font-extrabold text-blue-400">{result.attempt_strategy.total_answer_changes}</span>
            <p className="text-xs text-slate-500">Frequency of revising initial choices before final submission.</p>
          </div>
        </div>
      )}

      {/* TAB 7: MARKS ANALYSIS */}
      {activeTab === 'marks' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Current Realized Score</span>
              <span className="text-2xl font-extrabold text-blue-400">{result.marks_analysis.actual_score}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Potential (Zero Negatives)</span>
              <span className="text-2xl font-extrabold text-emerald-400">{result.marks_analysis.potential_no_negatives}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block">Potential (+ Solved Easy Skipped)</span>
              <span className="text-2xl font-extrabold text-purple-400">{result.marks_analysis.potential_easy_solved}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            By eliminating negative marking alone, your score would increase by{' '}
            <strong className="text-rose-400">+{result.marks_analysis.negative_marks_lost} marks</strong>. Solving unattempted easy questions yields an additional{' '}
            <strong className="text-emerald-400">+{result.marks_analysis.marks_lost_easy} marks</strong>.
          </div>
        </div>
      )}

      {/* TAB 8: COMPARE */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-900/60">
              <span className="text-xs text-blue-300 block font-semibold">You</span>
              <span className="text-xl font-extrabold text-white">{result.comparison.student.score}</span>
              <span className="text-[11px] text-slate-400 block">{result.comparison.student.accuracy}% accuracy</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 block font-semibold">Test Average</span>
              <span className="text-xl font-extrabold text-slate-300">{result.comparison.average.score}</span>
              <span className="text-[11px] text-slate-400 block">{result.comparison.average.accuracy}% accuracy</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/60">
              <span className="text-xs text-emerald-300 block font-semibold">Test Topper</span>
              <span className="text-xl font-extrabold text-emerald-400">{result.comparison.topper.score}</span>
              <span className="text-[11px] text-slate-400 block">{result.comparison.topper.accuracy}% accuracy</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-100">Recommended Targeted Study Links</h3>
          {result.recommendations.length === 0 ? (
            <p className="text-xs text-slate-400">Outstanding performance across all tested chapters.</p>
          ) : (
            result.recommendations.map((rec) => (
              <div key={rec.chapter_id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{rec.chapter_name}</h4>
                    <span className="text-xs text-blue-400 font-medium">{rec.subject_name}</span>
                  </div>
                  <Badge variant="rose">Accuracy: {rec.accuracy}%</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/practice"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Solve Practice DPPs
                  </Link>

                  <Link
                    href="/learn"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800 flex items-center gap-1.5 transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Watch Lectures
                  </Link>

                  <Link
                    href="/materials"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Formula Sheets
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function str(val: unknown): string {
  return String(val ?? '');
}
