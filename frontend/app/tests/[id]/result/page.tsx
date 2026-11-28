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
  Download,
  HelpCircle,
  Save,
  Check,
  ChevronRight,
  Zap,
  Lock,
  Trophy,
  ShieldAlert,
} from 'lucide-react';
import { apiClient, API_BASE_URL, ApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

// Types
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
    subject_cards: Array<{
      subject_name: string;
      score: number;
      max_marks: number;
      percentage: number;
      attempted: number;
      correct: number;
      wrong: number;
      accuracy: number;
      time_spent: number;
    }>;
    rank?: number | null;
    total_participants: number;
    percentile?: number | null;
    qs_attempted: number;
    total_questions: number;
    accuracy: number;
    positive_score: number;
    negative_lost: number;
    time_taken_seconds: number;
    total_duration_seconds: number;
    cutoff_score: number;
    is_cleared_cutoff: boolean;
    topper_score: number;
    average_score: number;
    notes?: string[];
  };
  sections: {
    sections: Array<{
      id: string;
      name: string;
      subject_name: string;
      total_questions: number;
      attempted: number;
      correct: number;
      incorrect: number;
      not_attempted: number;
      not_visited: number;
      score: number;
      max_marks: number;
      accuracy: number;
      attempt_rate: number;
      time_spent: number;
    }>;
    test_breakdown: Array<{
      subject: string;
      total_score: number;
      attempted_correct: number;
      attempted_wrong: number;
      not_attempted: number;
      not_visited: number;
    }>;
  };
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
    painful_count: number;
    tag: 'Strong' | 'Average' | 'Weak';
  }>;
  time_analysis: {
    total_time_spent: number;
    total_duration: number;
    time_breakdown: Array<{
      subject: string;
      time_spent: number;
      attempted: number;
      total_questions: number;
      accuracy: number;
    }>;
    quality_of_time: {
      time_on_correct: number;
      time_on_incorrect: number;
      time_on_unattempted: number;
      total_time: number;
    };
    time_journey: Array<{
      slot: string;
      correct: number;
      incorrect: number;
      overall: number;
    }>;
  };
  attempt_strategy: {
    summary: {
      perfect: number;
      wasted: number;
      overtime: number;
      confused: number;
    };
    subject_table: Array<{
      subject: string;
      perfect: number;
      wasted: number;
      overtime: number;
      confused: number;
      total: number;
    }>;
  };
  marks_analysis: {
    actual: number;
    potential: number;
    gain: number;
    formula_tooltip: string;
    subject_potentials: Array<{
      subject: string;
      actual: number;
      potential: number;
      gain: number;
    }>;
  };
  comparison: {
    difficulty_analysis: {
      by_subject: Array<{
        difficulty: string;
        subject: string;
        correct: number;
        wrong: number;
        skipped: number;
        total: number;
      }>;
      overall: Array<{
        difficulty: string;
        correct: number;
        wrong: number;
        skipped: number;
        total: number;
      }>;
    };
    question_journey: Array<{
      q_no: number;
      question_id: string;
      subject: string;
      status: 'CORRECT' | 'WRONG' | 'SKIPPED';
      revisits: number;
      has_revisit: boolean;
      time_spent: number;
    }>;
    single_choice_grid: Array<{
      q_no: number;
      question_id: string;
      subject: string;
      status: string;
      is_correct: boolean;
    }>;
    numerical_grid: Array<{
      q_no: number;
      question_id: string;
      subject: string;
      status: string;
      is_correct: boolean;
    }>;
    painful_questions: Array<{
      q_no: number;
      question_id: string;
      subject: string;
      topic: string;
      difficulty: string;
      time_spent: number;
      ideal_time: number;
      status: string;
      issue: string;
    }>;
  };
  recommendations: Array<{
    chapter_id: string;
    chapter_name: string;
    subject_name: string;
    accuracy: number;
    painful_count: number;
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

interface CohortData {
  has_enough_cohort_data: boolean;
  total_participants?: number;
  min_required?: number;
  message?: string;
  rows?: Array<{
    label: string;
    score: number;
    accuracy: number;
    time_taken: number;
    attempted_qs: number;
    subjects: {
      [subject: string]: {
        score: number;
        accuracy: number;
        time: number;
      };
    };
    attempt_classification: {
      perfect: number;
      wasted: number;
      overtime: number;
      confused: number;
    };
  }>;
}

type MainTab = 'PERSONAL' | 'COMPARATIVE';

type PersonalSubNav =
  | 'overview'
  | 'performance'
  | 'potential'
  | 'attempt'
  | 'time'
  | 'difficulty'
  | 'journey'
  | 'questions'
  | 'recommendations';

type ComparativeSubNav = 'performance' | 'attempt' | 'time' | 'difficulty';

export default function TestResultPage() {
  const params = useParams();
  const attemptId = params.id as string;

  const [mainTab, setMainTab] = useState<MainTab>('PERSONAL');
  const [personalTab, setPersonalTab] = useState<PersonalSubNav>('overview');
  const [compTab, setCompTab] = useState<ComparativeSubNav>('performance');

  const [result, setResult] = useState<ResultData | null>(null);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState<string[]>(['', '', '']);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);

  // Question Filter & Modal State
  const [qSubjectFilter, setQSubjectFilter] = useState<string>('All');
  const [qTypeFilter, setQTypeFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped' | 'bookmarked'>('all');
  const [activeModalQuestion, setActiveModalQuestion] = useState<ReviewQuestion | null>(null);

  // Gated Rank Board State
  const [isRankBoardOpen, setIsRankBoardOpen] = useState(false);
  const [rankBoardLoading, setRankBoardLoading] = useState(false);
  const [rankBoardData, setRankBoardData] = useState<{
    test_id: string;
    test_title: string;
    total_marks: number;
    total_participants: number;
    own_rank: number | null;
    own_percentile: number | null;
    own_score: number;
    topper_score: number;
    average_score: number;
    leaderboard: Array<{
      rank: number;
      name: string;
      is_current_user: boolean;
      score: number;
      percentile: number | null;
      time_taken_seconds: number;
    }>;
  } | null>(null);
  const [rankBoardError, setRankBoardError] = useState<{ message: string; locked: boolean; reason?: string; publish_time?: string } | null>(null);

  const openRankBoard = async (testId: string) => {
    setIsRankBoardOpen(true);
    setRankBoardLoading(true);
    setRankBoardError(null);
    try {
      const data = await apiClient.get<any>(`/tests/${testId}/rank-board/`);
      setRankBoardData(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data && typeof err.data === 'object') {
        const errorData = err.data as Record<string, unknown>;
        setRankBoardError({
          message: String(errorData.error || err.message),
          locked: Boolean(errorData.locked),
          reason: errorData.reason as string | undefined,
          publish_time: errorData.publish_time as string | undefined,
        });
      } else {
        setRankBoardError({
          message: err instanceof Error ? err.message : 'Rank board is not available yet.',
          locked: true,
        });
      }
    } finally {
      setRankBoardLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [resData, qData, compData] = await Promise.all([
        apiClient.get<ResultData & { status?: string }>(`/tests/attempts/${attemptId}/result/`),
        apiClient.get<{ questions: ReviewQuestion[] }>(`/tests/attempts/${attemptId}/questions/`).catch(() => ({ questions: [] })),
        apiClient.get<CohortData>(`/tests/attempts/${attemptId}/analysis/comparative/`).catch(() => null),
      ]);

      if (resData?.status === 'PROCESSING' || (!resData?.overview && !resData?.results_locked)) {
        setIsProcessing(true);
        setIsLoading(false);
        setTimeout(() => {
          loadData();
        }, 2000);
        return;
      }

      setIsProcessing(false);
      setResult(resData);
      setQuestions(qData?.questions || []);
      setCohort(compData);

      // Populate notes
      const existingNotes = resData?.overview?.notes || [];
      setNotes([
        existingNotes[0] || '',
        existingNotes[1] || '',
        existingNotes[2] || '',
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load test analysis.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Note Save
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await apiClient.post(`/tests/attempts/${attemptId}/notes/`, { notes });
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 3000);
    } catch {
      alert('Failed to save notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (q: ReviewQuestion) => {
    try {
      const newStatus = !q.is_bookmarked;
      await apiClient.post(`/tests/attempts/${attemptId}/tag-question/`, {
        question_id: q.question_id,
        is_bookmarked: newStatus,
      });
      setQuestions((prev) =>
        prev.map((item) => (item.question_id === q.question_id ? { ...item, is_bookmarked: newStatus } : item))
      );
      if (activeModalQuestion?.question_id === q.question_id) {
        setActiveModalQuestion((prev) => (prev ? { ...prev, is_bookmarked: newStatus } : null));
      }
    } catch {
      alert('Failed to update bookmark.');
    }
  };

  // Update Error Reason Tag
  const handleUpdateReasonTag = async (q: ReviewQuestion, tag: string) => {
    try {
      await apiClient.post(`/tests/attempts/${attemptId}/tag-question/`, {
        question_id: q.question_id,
        student_reason_tag: tag,
      });
      setQuestions((prev) =>
        prev.map((item) => (item.question_id === q.question_id ? { ...item, student_reason_tag: tag } : item))
      );
      if (activeModalQuestion?.question_id === q.question_id) {
        setActiveModalQuestion((prev) => (prev ? { ...prev, student_reason_tag: tag } : null));
      }
    } catch {
      alert('Failed to save reason tag.');
    }
  };

  // Filtered review questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (qSubjectFilter !== 'All' && q.subject_name !== qSubjectFilter) return false;
      if (qTypeFilter === 'correct') return q.is_correct;
      if (qTypeFilter === 'wrong') return !q.is_correct && Boolean(q.selected_answer);
      if (qTypeFilter === 'skipped') return !q.selected_answer;
      if (qTypeFilter === 'bookmarked') return q.is_bookmarked;
      return true;
    });
  }, [questions, qSubjectFilter, qTypeFilter]);

  if (isLoading || isProcessing) {
    return (
      <LoadingState
        message={isProcessing ? "Computing deep performance analysis & cohort percentiles..." : "Generating deep performance snapshot & analysis..."}
      />
    );
  }

  if (error || !result) {
    return (
      <ErrorState
        title="Analysis Unavailable"
        message={error || 'Unable to load test results.'}
        onRetry={loadData}
      />
    );
  }

  // Locked window message
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

  const ov = result.overview;
  const sectionsList = result.sections?.sections || [];
  const testBreakdown = result.sections?.test_breakdown || [];

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-blue-800 bg-blue-950/50 text-blue-400 text-[10px] font-bold">
              {result.test_type || 'MOCK'} CBT ANALYSIS
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Test Analysis - {result.test_title}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Comprehensive diagnostic breakdown, time management, and cohort benchmarking.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href={`${API_BASE_URL}/tests/attempts/${attemptId}/report.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-blue-400" />
            Download Analysis (PDF)
          </a>
          <button
            type="button"
            onClick={() => {
              setMainTab('PERSONAL');
              setPersonalTab('questions');
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-600/30"
          >
            <FileText className="w-4 h-4" />
            View Solutions
          </button>
        </div>
      </div>

      {/* Main Mode Tabs: PERSONAL vs COMPARATIVE */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setMainTab('PERSONAL')}
          className={`pb-3 px-4 text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all ${
            mainTab === 'PERSONAL'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          PERSONAL ANALYSIS
        </button>
        <button
          type="button"
          onClick={() => setMainTab('COMPARATIVE')}
          className={`pb-3 px-4 text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all ${
            mainTab === 'COMPARATIVE'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          COMPARATIVE BENCHMARKING
        </button>
      </div>

      {/* =========================================================================
          TAB 1: PERSONAL ANALYSIS (With left sub-nav in exact order)
      ========================================================================== */}
      {mainTab === 'PERSONAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left Sub-Navigation */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-1">
            {[
              { key: 'overview', label: '1. Overview' },
              { key: 'performance', label: '2. Performance Analysis' },
              { key: 'potential', label: '3. Score Potential' },
              { key: 'attempt', label: '4. Attempt Analysis' },
              { key: 'time', label: '5. Time Analysis' },
              { key: 'difficulty', label: '6. Difficulty Analysis' },
              { key: 'journey', label: '7. Question Journey' },
              { key: 'questions', label: '8. Qs by Qs Analysis' },
              { key: 'recommendations', label: '9. Recommendations' },
            ].map((nav) => (
              <button
                key={nav.key}
                type="button"
                onClick={() => setPersonalTab(nav.key as PersonalSubNav)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  personalTab === nav.key
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{nav.label}</span>
                {personalTab === nav.key && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>

          {/* Right Content Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. OVERVIEW */}
            {personalTab === 'overview' && (
              <div className="space-y-6">
                {/* Score & Key Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Your Score</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">{ov.score}</span>
                      <span className="text-xs text-slate-500">/ {ov.total_marks}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">Accuracy: {ov.accuracy}%</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Leaderboard Rank</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-purple-400">#{ov.rank || 'N/A'}</span>
                        <span className="text-xs text-slate-500">of {ov.total_participants}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Percentile: {ov.percentile !== null && ov.percentile !== undefined ? `${ov.percentile}%` : 'Too few attempts'}
                      </span>
                    </div>
                    {result?.test_id && (
                      <button
                        type="button"
                        onClick={() => openRankBoard(result.test_id)}
                        className="mt-3 text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors self-start"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        Full Rank Board &rarr;
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Questions Attempted</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{ov.qs_attempted}</span>
                      <span className="text-xs text-slate-500">/ {ov.total_questions}</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 mt-1 block">+{ov.positive_score} pts / -{ov.negative_lost} pts</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Time Taken</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">{Math.round(ov.time_taken_seconds / 60)}</span>
                      <span className="text-xs text-slate-500">/ {Math.round(ov.total_duration_seconds / 60)} min</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Cutoff: {ov.is_cleared_cutoff ? 'Cleared ✓' : 'Below Cutoff ✗'} ({ov.cutoff_score})
                    </span>
                  </div>
                </div>

                {/* Per-Subject Score Cards */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subject Performance Cards</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(ov.subject_cards || []).map((sc) => (
                      <div key={sc.subject_name} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-sm text-slate-200">{sc.subject_name}</span>
                          <span className="text-xs font-bold text-blue-400">{sc.score} / {sc.max_marks}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, sc.percentage))}%` }} />
                        </div>
                        <div className="grid grid-cols-3 text-center pt-2 border-t border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-emerald-400 font-bold block">{sc.correct}</span>
                            <span className="text-slate-500">Correct</span>
                          </div>
                          <div>
                            <span className="text-rose-400 font-bold block">{sc.wrong}</span>
                            <span className="text-slate-500">Wrong</span>
                          </div>
                          <div>
                            <span className="text-slate-300 font-bold block">{sc.accuracy}%</span>
                            <span className="text-slate-500">Accuracy</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Note Down Your Learnings (3 editable notes) */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-200">Note Down Your Learnings</h3>
                      <p className="text-xs text-slate-400">Save up to 3 personal action items or mistakes identified in this attempt.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {notesSavedNotice ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                      {notesSavedNotice ? 'Saved!' : 'Save Notes'}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={notes[idx]}
                          onChange={(e) => {
                            const updated = [...notes];
                            updated[idx] = e.target.value;
                            setNotes(updated);
                          }}
                          placeholder={`Key takeaway or correction #${idx + 1}...`}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. PERFORMANCE ANALYSIS */}
            {personalTab === 'performance' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200">Test Breakdown Table</h3>
                  <p className="text-xs text-slate-400">Subject-wise distribution of correct, wrong, unattempted, and unvisited questions.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-bold">Subject</th>
                        <th className="py-2.5 px-3 font-bold">Total Score</th>
                        <th className="py-2.5 px-3 font-bold text-emerald-400">Attempted Correct</th>
                        <th className="py-2.5 px-3 font-bold text-rose-400">Attempted Wrong</th>
                        <th className="py-2.5 px-3 font-bold text-slate-400">Not Attempted</th>
                        <th className="py-2.5 px-3 font-bold text-slate-500">Not Visited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {testBreakdown.map((row, idx) => {
                        const isTotal = row.subject === 'Total';
                        return (
                          <tr key={idx} className={isTotal ? 'bg-slate-950 font-bold text-slate-100' : 'text-slate-300'}>
                            <td className="py-3 px-3">{row.subject}</td>
                            <td className="py-3 px-3 text-blue-400 font-extrabold">{row.total_score}</td>
                            <td className="py-3 px-3 text-emerald-400">{row.attempted_correct}</td>
                            <td className="py-3 px-3 text-rose-400">{row.attempted_wrong}</td>
                            <td className="py-3 px-3 text-slate-400">{row.not_attempted}</td>
                            <td className="py-3 px-3 text-slate-500">{row.not_visited}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. SCORE POTENTIAL */}
            {personalTab === 'potential' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-200">Score Potential Analysis</h3>
                    <p className="text-xs text-slate-400">Recoverable marks if error reduction and pacing discipline were applied.</p>
                  </div>
                  <div className="group relative flex items-center gap-1.5 text-xs text-slate-400 cursor-help bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span>Potential Formula</span>
                    <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl text-[11px] text-slate-300 z-30 leading-relaxed">
                      {result.marks_analysis.formula_tooltip}
                    </div>
                  </div>
                </div>

                {/* Overall Comparison Bar */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Overall Paper Score</span>
                    <span className="text-emerald-400 font-bold">+{result.marks_analysis.gain} Potential Points Gain</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Actual Score:</span>
                      <span className="font-extrabold text-blue-400">{result.marks_analysis.actual}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
                      <div
                        className="bg-blue-600 h-full"
                        style={{ width: `${Math.min(100, Math.max(0, (result.marks_analysis.actual / (ov.total_marks || 300)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Potential Score:</span>
                      <span className="font-extrabold text-emerald-400">{result.marks_analysis.potential}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${Math.min(100, Math.max(0, (result.marks_analysis.potential / (ov.total_marks || 300)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Subject-Wise Potential Bars */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Potential Gain by Subject</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(result.marks_analysis.subject_potentials || []).map((sp) => (
                      <div key={sp.subject} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-200">{sp.subject}</span>
                          <span className="text-emerald-400 font-bold">+{sp.gain} pts</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Actual: {sp.actual}</span>
                          <span className="text-slate-300 font-bold">Potential: {sp.potential}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. ATTEMPT ANALYSIS */}
            {personalTab === 'attempt' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200">Attempt Quality Classification</h3>
                  <p className="text-xs text-slate-400">Questions categorized by accuracy and solve time relative to ideal thresholds.</p>
                </div>

                {/* 4 Classification Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-900/40">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase block">Perfect Attempt</span>
                    <span className="text-2xl font-extrabold text-emerald-300 mt-1 block">
                      {result.attempt_strategy.summary.perfect}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Correct within ideal time</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/40">
                    <span className="text-[11px] font-bold text-rose-400 uppercase block">Wasted Attempt</span>
                    <span className="text-2xl font-extrabold text-rose-300 mt-1 block">
                      {result.attempt_strategy.summary.wasted}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Wrong in &lt;25% ideal time</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-900/40">
                    <span className="text-[11px] font-bold text-amber-400 uppercase block">Overtime Attempt</span>
                    <span className="text-2xl font-extrabold text-amber-300 mt-1 block">
                      {result.attempt_strategy.summary.overtime}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Spent &gt; ideal time</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-900/40">
                    <span className="text-[11px] font-bold text-purple-400 uppercase block">Confused Attempt</span>
                    <span className="text-2xl font-extrabold text-purple-300 mt-1 block">
                      {result.attempt_strategy.summary.confused}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Skipped after overtime</span>
                  </div>
                </div>

                {/* Subject Summary Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-bold">Subject</th>
                        <th className="py-2.5 px-3 font-bold text-emerald-400">Perfect</th>
                        <th className="py-2.5 px-3 font-bold text-rose-400">Wasted</th>
                        <th className="py-2.5 px-3 font-bold text-amber-400">Overtime</th>
                        <th className="py-2.5 px-3 font-bold text-purple-400">Confused</th>
                        <th className="py-2.5 px-3 font-bold text-slate-200">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {(result.attempt_strategy.subject_table || []).map((row) => (
                        <tr key={row.subject}>
                          <td className="py-2.5 px-3 font-bold text-slate-200">{row.subject}</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-bold">{row.perfect}</td>
                          <td className="py-2.5 px-3 text-rose-400 font-bold">{row.wasted}</td>
                          <td className="py-2.5 px-3 text-amber-400 font-bold">{row.overtime}</td>
                          <td className="py-2.5 px-3 text-purple-400 font-bold">{row.confused}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-100">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. TIME ANALYSIS */}
            {personalTab === 'time' && (
              <div className="space-y-6">
                {/* Time Breakdown per Subject */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-200">Time Breakdown per Subject</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(result.time_analysis.time_breakdown || []).map((tb) => (
                      <div key={tb.subject} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">{tb.subject}</span>
                          <span className="text-blue-400 font-bold">{Math.round(tb.time_spent / 60)} min</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Attempted: {tb.attempted}/{tb.total_questions}</span>
                          <span>Accuracy: {tb.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality of Time Spent */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-extrabold text-slate-200">Quality of Time Spent</h3>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/30">
                      <span className="text-emerald-400 font-extrabold text-lg block">
                        {Math.round(result.time_analysis.quality_of_time.time_on_correct / 60)}m
                      </span>
                      <span className="text-slate-400 text-[11px]">Time on Correct</span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/30">
                      <span className="text-rose-400 font-extrabold text-lg block">
                        {Math.round(result.time_analysis.quality_of_time.time_on_incorrect / 60)}m
                      </span>
                      <span className="text-slate-400 text-[11px]">Time on Incorrect</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-300 font-extrabold text-lg block">
                        {Math.round(result.time_analysis.quality_of_time.time_on_unattempted / 60)}m
                      </span>
                      <span className="text-slate-400 text-[11px]">Time on Unattempted</span>
                    </div>
                  </div>
                </div>

                {/* Time Journey Table by 30-min slot */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-200">Time Journey (30-Minute Windows)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-bold">Exam Slot</th>
                          <th className="py-2.5 px-3 font-bold text-emerald-400">Correct Solved</th>
                          <th className="py-2.5 px-3 font-bold text-rose-400">Incorrect Solved</th>
                          <th className="py-2.5 px-3 font-bold text-slate-200">Overall Attempted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {(result.time_analysis.time_journey || []).map((tj) => (
                          <tr key={tj.slot}>
                            <td className="py-2.5 px-3 font-bold text-slate-200">{tj.slot}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-bold">{tj.correct}</td>
                            <td className="py-2.5 px-3 text-rose-400 font-bold">{tj.incorrect}</td>
                            <td className="py-2.5 px-3 text-slate-100 font-extrabold">{tj.overall}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 6. DIFFICULTY ANALYSIS */}
            {personalTab === 'difficulty' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200">Difficulty Level Performance</h3>
                  <p className="text-xs text-slate-400">Accuracy and strike rate across Easy, Moderate, and Tough questions.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(result.comparison?.difficulty_analysis?.overall || []).map((diff) => (
                    <div key={diff.difficulty} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-200">{diff.difficulty}</span>
                        <span className="text-blue-400 font-bold">{diff.total} Questions</span>
                      </div>
                      <div className="grid grid-cols-3 text-center text-[11px] pt-1">
                        <div>
                          <span className="text-emerald-400 font-bold block">{diff.correct}</span>
                          <span className="text-slate-500">Correct</span>
                        </div>
                        <div>
                          <span className="text-rose-400 font-bold block">{diff.wrong}</span>
                          <span className="text-slate-500">Wrong</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block">{diff.skipped}</span>
                          <span className="text-slate-500">Skipped</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. QUESTION JOURNEY */}
            {personalTab === 'journey' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200">Chronological Question Journey</h3>
                  <p className="text-xs text-slate-400">Visual pathway of every question visited with revisit indicators.</p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {(result.comparison?.question_journey || []).map((box, idx) => {
                    const isCorrect = box.status === 'CORRECT';
                    const isWrong = box.status === 'WRONG';
                    return (
                      <div
                        key={idx}
                        className={`relative w-11 h-11 rounded-xl font-extrabold text-xs flex flex-col items-center justify-center border transition-all ${
                          isCorrect
                            ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                            : isWrong
                            ? 'bg-rose-950/80 border-rose-700/80 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                        title={`Q#${box.q_no} (${box.subject}) - ${box.status} | Time: ${box.time_spent}s | Visits: ${box.revisits}`}
                      >
                        <span>{box.q_no}</span>
                        {box.has_revisit && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-[9px] text-black font-extrabold flex items-center justify-center">
                            {box.revisits}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" />
                    <span>Correct</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-600 inline-block" />
                    <span>Wrong</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-800 border border-slate-700 inline-block" />
                    <span>Skipped</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-black font-extrabold text-[9px] flex items-center justify-center">2</span>
                    <span>Revisited (&gt;1 visits)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 8. QS BY QS ANALYSIS */}
            {personalTab === 'questions' && (
              <div className="space-y-6">
                {/* Painful Questions Table */}
                {(result.comparison?.painful_questions || []).length > 0 && (
                  <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <h3 className="text-sm font-extrabold text-rose-300">Painful Questions (Wasted, Overtime or Wrong)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-rose-900/40 text-slate-400">
                            <th className="py-2 px-3 font-bold">Q#</th>
                            <th className="py-2 px-3 font-bold">Subject</th>
                            <th className="py-2 px-3 font-bold">Topic</th>
                            <th className="py-2 px-3 font-bold">Difficulty</th>
                            <th className="py-2 px-3 font-bold">Time Spent</th>
                            <th className="py-2 px-3 font-bold text-rose-400">Issue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-900/20 text-slate-300">
                          {result.comparison.painful_questions.map((pq, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 font-bold text-slate-100">Q#{pq.q_no}</td>
                              <td className="py-2.5 px-3">{pq.subject}</td>
                              <td className="py-2.5 px-3">{pq.topic}</td>
                              <td className="py-2.5 px-3">{pq.difficulty}</td>
                              <td className="py-2.5 px-3 text-amber-400">{pq.time_spent}s (Ideal: {pq.ideal_time}s)</td>
                              <td className="py-2.5 px-3 font-bold text-rose-400">{pq.issue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Filter and Complete Breakdown Table */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-slate-200">Complete Question-by-Question Breakdown</h3>

                    {/* Filter controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={qSubjectFilter}
                        onChange={(e) => setQSubjectFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 py-1.5 px-2.5 focus:outline-none focus:border-blue-500"
                      >
                        <option value="All">All Subjects</option>
                        {sectionsList.map((s) => (
                          <option key={s.id} value={s.subject_name}>{s.subject_name}</option>
                        ))}
                      </select>

                      {[
                        { key: 'all', label: 'All' },
                        { key: 'correct', label: 'Correct' },
                        { key: 'wrong', label: 'Wrong' },
                        { key: 'skipped', label: 'Skipped' },
                        { key: 'bookmarked', label: 'Bookmarked' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setQTypeFilter(tab.key as 'all' | 'correct' | 'wrong' | 'skipped' | 'bookmarked')}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            qTypeFilter === tab.key
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-bold">Q#</th>
                          <th className="py-2.5 px-3 font-bold">Subject</th>
                          <th className="py-2.5 px-3 font-bold">Chapter / Topic</th>
                          <th className="py-2.5 px-3 font-bold">Difficulty</th>
                          <th className="py-2.5 px-3 font-bold">Time</th>
                          <th className="py-2.5 px-3 font-bold">Status</th>
                          <th className="py-2.5 px-3 font-bold">Marks</th>
                          <th className="py-2.5 px-3 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {filteredQuestions.map((q) => (
                          <tr key={q.question_id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-100">Q#{q.order}</td>
                            <td className="py-3 px-3">{q.subject_name}</td>
                            <td className="py-3 px-3">{q.chapter_name}</td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {q.difficulty}
                              </span>
                            </td>
                            <td className="py-3 px-3">{q.time_spent_seconds}s</td>
                            <td className="py-3 px-3">
                              {q.is_correct ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                </span>
                              ) : q.selected_answer ? (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> Wrong
                                </span>
                              ) : (
                                <span className="text-slate-500 font-medium">Skipped</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-bold">
                              {q.marks_awarded > 0 ? (
                                <span className="text-emerald-400">+{q.marks_awarded}</span>
                              ) : q.marks_awarded < 0 ? (
                                <span className="text-rose-400">{q.marks_awarded}</span>
                              ) : (
                                <span className="text-slate-500">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setActiveModalQuestion(q)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
                              >
                                View Solution
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 9. RECOMMENDATIONS */}
            {personalTab === 'recommendations' && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200">Targeted Study Recommendations</h3>
                  <p className="text-xs text-slate-400">Direct remedial lectures, DPPs, and formula sheets for identified weak chapters.</p>
                </div>

                <div className="space-y-4">
                  {(result.recommendations || []).map((rec) => (
                    <div key={rec.chapter_id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-100">{rec.chapter_name}</span>
                            <Badge variant="outline" className="text-rose-400 border-rose-900/60 bg-rose-950/40 text-[10px]">
                              {rec.accuracy}% Accuracy
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-400">{rec.subject_name}</span>
                        </div>

                        <Link
                          href={`/practice?chapter=${rec.chapter_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                        >
                          <Target className="w-3.5 h-3.5" />
                          Practice Weak Chapter
                        </Link>
                      </div>

                      {/* Attached curriculum resources */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold block mb-1">Lectures ({rec.lectures?.length || 0})</span>
                          <ul className="space-y-1 text-slate-300">
                            {(rec.lectures || []).map((lec) => (
                              <li key={lec.id} className="truncate">
                                <Link href="/learn" className="hover:text-blue-400 hover:underline flex items-center gap-1">
                                  <PlayCircle className="w-3 h-3 text-blue-400 shrink-0" />
                                  <span className="truncate">{lec.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-slate-400 font-bold block mb-1">Practice DPPs ({rec.dpps?.length || 0})</span>
                          <ul className="space-y-1 text-slate-300">
                            {(rec.dpps || []).map((dpp) => (
                              <li key={dpp.id} className="truncate">
                                <Link href="/practice" className="hover:text-blue-400 hover:underline flex items-center gap-1">
                                  <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate">{dpp.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-slate-400 font-bold block mb-1">Study Handouts ({rec.materials?.length || 0})</span>
                          <ul className="space-y-1 text-slate-300">
                            {(rec.materials || []).map((mat) => (
                              <li key={mat.id} className="truncate">
                                <Link href="/materials" className="hover:text-blue-400 hover:underline flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-purple-400 shrink-0" />
                                  <span className="truncate">{mat.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: COMPARATIVE BENCHMARKING (Student vs Cohort)
      ========================================================================== */}
      {mainTab === 'COMPARATIVE' && (
        <div className="space-y-6">
          {!cohort?.has_enough_cohort_data ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-900/60 text-amber-400 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-200">Not Enough Attempts Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {cohort?.message || 'A minimum of 10 submitted test attempts from students is required to compute reliable comparative cohort statistics.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              {/* Left Sub-Nav for Comparative */}
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-1">
                {[
                  { key: 'performance', label: 'Performance' },
                  { key: 'attempt', label: 'Attempt Quality' },
                  { key: 'time', label: 'Time & Pacing' },
                  { key: 'difficulty', label: 'Difficulty Breakdown' },
                ].map((nav) => (
                  <button
                    key={nav.key}
                    type="button"
                    onClick={() => setCompTab(nav.key as ComparativeSubNav)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                      compTab === nav.key
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{nav.label}</span>
                    {compTab === nav.key && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              {/* Right Content Panel for Comparative */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200 capitalize">
                    {compTab} Comparison (You vs. Top 10% vs. Top 25% vs. Average)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cohort statistics computed server-side across {cohort.total_participants} submitted student attempts.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-bold">Cohort Benchmark</th>
                        <th className="py-2.5 px-3 font-bold">Total Score</th>
                        <th className="py-2.5 px-3 font-bold">Accuracy %</th>
                        <th className="py-2.5 px-3 font-bold">Attempted Qs</th>
                        <th className="py-2.5 px-3 font-bold">Time Taken</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(cohort.rows || []).map((crow) => {
                        const isYou = crow.label === 'You';
                        return (
                          <tr key={crow.label} className={isYou ? 'bg-blue-950/40 text-blue-300 font-extrabold' : 'text-slate-300'}>
                            <td className="py-3 px-3 flex items-center gap-2">
                              {crow.label}
                              {isYou && <span className="px-1.5 py-0.5 rounded bg-blue-600 text-[10px] text-white">Your Attempt</span>}
                            </td>
                            <td className="py-3 px-3 font-bold">{crow.score}</td>
                            <td className="py-3 px-3">{crow.accuracy}%</td>
                            <td className="py-3 px-3">{crow.attempted_qs}</td>
                            <td className="py-3 px-3">{Math.round(crow.time_taken / 60)} min</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          QUESTION DETAIL & SOLUTION MODAL
      ========================================================================== */}
      {activeModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-100">
                  Question #{activeModalQuestion.order} ({activeModalQuestion.subject_name})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {activeModalQuestion.difficulty}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalQuestion(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Question Text */}
            <div className="text-sm text-slate-200 leading-relaxed font-medium bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              {activeModalQuestion.question_text}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Answer Options</span>
              {activeModalQuestion.options.map((opt) => {
                const isSelected = activeModalQuestion.selected_answer === opt.id || activeModalQuestion.selected_answer === opt.option_text;
                const isCorrect = opt.is_correct;
                return (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                      isCorrect
                        ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-300 font-bold'
                        : isSelected
                        ? 'bg-rose-950/40 border-rose-600/80 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{opt.option_text}</span>
                    {isCorrect && <span className="text-[10px] text-emerald-400">Correct Answer ✓</span>}
                    {isSelected && !isCorrect && <span className="text-[10px] text-rose-400">Your Pick ✗</span>}
                  </div>
                );
              })}
            </div>

            {/* Verified Faculty Solution */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Verified Solution</span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                {activeModalQuestion.solution_text || 'Detailed LaTeX solution verified by ANKIT JEE faculties.'}
              </div>
            </div>

            {/* Cohort Statistics */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              <div>
                <span className="text-slate-500 block">Class Accuracy Rate</span>
                <span className="font-extrabold text-blue-400 text-sm">{activeModalQuestion.class_accuracy_percentage}%</span>
              </div>
              <div>
                <span className="text-slate-500 block">Class Average Solve Time</span>
                <span className="font-extrabold text-amber-400 text-sm">{activeModalQuestion.class_avg_time_seconds}s</span>
              </div>
            </div>

            {/* Student Diagnostics: Error Tag & Bookmark */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold">Why I got it wrong:</span>
                <select
                  value={activeModalQuestion.student_reason_tag}
                  onChange={(e) => handleUpdateReasonTag(activeModalQuestion, e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 py-1.5 px-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="NONE">None / Not set</option>
                  <option value="CONCEPT_GAP">Concept Gap</option>
                  <option value="CALCULATION">Calculation Error</option>
                  <option value="SILLY">Silly Mistake</option>
                  <option value="GUESS">Fluke / Blind Guess</option>
                  <option value="TIME_PRESSURE">Time Pressure</option>
                  <option value="DIDNT_KNOW">Did Not Know Formula</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleToggleBookmark(activeModalQuestion)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeModalQuestion.is_bookmarked
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {activeModalQuestion.is_bookmarked ? 'Bookmarked in Notebook' : 'Add to Notebook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gated Rank Board Modal */}
      {isRankBoardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Rank Board & All-India Leaderboard
                </h3>
              </div>
              <button
                onClick={() => setIsRankBoardOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {rankBoardLoading ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <LoadingState message="Decrypting rank board standings..." />
                </div>
              ) : rankBoardError ? (
                <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">
                    {rankBoardError.reason === 'SCHEDULED' ? 'Rank Board Scheduled' : 'Rank Board Locked'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {rankBoardError.message}
                  </p>
                  {rankBoardError.publish_time && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                      Unlocks: {new Date(rankBoardError.publish_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </Badge>
                  )}
                </div>
              ) : rankBoardData ? (
                <div className="space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Rank</span>
                      <span className="text-xl font-extrabold text-purple-400 mt-0.5 block">
                        #{rankBoardData.own_rank || 'N/A'}
                      </span>
                      <span className="text-[10px] text-slate-400">of {rankBoardData.total_participants}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Percentile</span>
                      <span className="text-xl font-extrabold text-purple-400 mt-0.5 block">
                        {rankBoardData.own_percentile !== null ? `${rankBoardData.own_percentile}%` : 'N/A'}
                      </span>
                      <span className="text-[10px] text-slate-400">Score: {rankBoardData.own_score}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Topper Score</span>
                      <span className="text-xl font-extrabold text-emerald-400 mt-0.5 block">
                        {rankBoardData.topper_score}
                      </span>
                      <span className="text-[10px] text-slate-400">/ {rankBoardData.total_marks}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Score</span>
                      <span className="text-xl font-extrabold text-blue-400 mt-0.5 block">
                        {rankBoardData.average_score}
                      </span>
                      <span className="text-[10px] text-slate-400">Batch Average</span>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Standings ({rankBoardData.leaderboard.length})
                    </h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-12">Rank</th>
                            <th className="py-2.5 px-3">Student</th>
                            <th className="py-2.5 px-3 text-right">Score</th>
                            <th className="py-2.5 px-3 text-right">Percentile</th>
                            <th className="py-2.5 px-3 text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {rankBoardData.leaderboard.map((item) => (
                            <tr
                              key={item.rank}
                              className={`transition-colors ${
                                item.is_current_user
                                  ? 'bg-purple-500/10 font-bold text-purple-200'
                                  : 'hover:bg-slate-900/40 text-slate-300'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center font-extrabold">
                                {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                              </td>
                              <td className="py-2.5 px-3 flex items-center gap-1.5">
                                <span>{item.name}</span>
                                {item.is_current_user && (
                                  <Badge variant="outline" className="text-[9px] bg-purple-500/20 text-purple-300 border-purple-500/30 px-1 py-0">
                                    You
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                                {item.score}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                                {item.percentile !== null ? `${item.percentile}%` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400">
                                {Math.round(item.time_taken_seconds / 60)} min
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
