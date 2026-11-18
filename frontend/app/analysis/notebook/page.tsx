'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

interface NotebookItem {
  log_id: string;
  attempt_id: string;
  test_title: string;
  question_id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  subject_id?: string;
  subject_name: string;
  chapter_id?: string;
  chapter_name: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  solution_text: string;
  student_reason_tag: string;
  is_bookmarked: boolean;
  is_revised: boolean;
  time_spent_seconds: number;
  options: Array<{ id: string; text: string; is_correct: boolean }>;
  attempted_at: string;
}

export default function NotebookPage() {
  const [items, setItems] = useState<NotebookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unrevised' | 'revised' | 'bookmarked'>('unrevised');
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  // Interactive re-attempt state
  const [selectedPicks, setSelectedPicks] = useState<{ [qId: string]: string }>({});
  const [revealedSolutions, setRevealedSolutions] = useState<{ [qId: string]: boolean }>({});

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (reasonFilter !== 'all') queryParams.append('reason_tag', reasonFilter);

      const res = await apiClient.get<{ total_items: number; items: NotebookItem[] }>(
        `/analytics/notebook/?${queryParams.toString()}`
      );
      setItems(res?.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load error notebook.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, reasonFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleToggleRevised = async (logId: string) => {
    try {
      const res = await apiClient.post<{ is_revised: boolean }>(`/analytics/notebook/${logId}/revise/`);
      setItems((prev) =>
        prev.map((item) => (item.log_id === logId ? { ...item, is_revised: res?.is_revised ?? !item.is_revised } : item))
      );
    } catch {
      alert('Failed to update revision status.');
    }
  };

  const handleUpdateTag = async (attemptId: string, questionId: string, logId: string, tag: string) => {
    try {
      await apiClient.post(`/tests/attempts/${attemptId}/tag-question/`, {
        question_id: questionId,
        student_reason_tag: tag,
      });
      setItems((prev) =>
        prev.map((item) => (item.log_id === logId ? { ...item, student_reason_tag: tag } : item))
      );
    } catch {
      alert('Failed to save reason tag.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-950/60 border border-purple-900/60 text-purple-400">
              <Bookmark className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Wrong-Answer Notebook & Bookmarks
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Re-attempt mistakes, review verified solutions, tag error causes, and track revision status.
          </p>
        </div>

        <Link
          href="/analysis"
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
        >
          ← Overall Analytics
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'unrevised', label: 'Needs Revision' },
            { key: 'revised', label: 'Revised ✓' },
            { key: 'bookmarked', label: 'Bookmarked' },
            { key: 'all', label: 'All Errors' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as 'all' | 'unrevised' | 'revised' | 'bookmarked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reason Tag Dropdown Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 py-1.5 px-2.5 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Error Causes</option>
            <option value="CONCEPT_GAP">Concept Gap</option>
            <option value="CALCULATION">Calculation Error</option>
            <option value="SILLY">Silly Mistake</option>
            <option value="GUESS">Blind Guess</option>
            <option value="TIME_PRESSURE">Time Pressure</option>
            <option value="DIDNT_KNOW">Did Not Know Formula</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading your personal mistake notebook..." />
      ) : error ? (
        <ErrorState title="Unable to load notebook" message={error} onRetry={loadItems} />
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">
            {statusFilter === 'unrevised'
              ? 'No unrevised errors remaining!'
              : 'No questions matching these filters'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {statusFilter === 'unrevised'
              ? 'Great work! All incorrect questions have been revised.'
              : 'Mistakes from your mock tests and bookmarked questions will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((item, idx) => {
            const isRevealed = revealedSolutions[item.question_id];
            const currentPick = selectedPicks[item.question_id];

            return (
              <div
                key={item.log_id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
              >
                {/* Item Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">#{idx + 1}</span>
                    <span className="text-xs text-blue-400 font-medium">
                      {[item.subject_name, item.chapter_name].filter(Boolean).join(' • ')}
                    </span>
                    <Badge variant="slate" className="text-[10px]">{item.difficulty}</Badge>
                    <span className="text-[10px] text-slate-500">From {item.test_title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRevised(item.log_id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        item.is_revised
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {item.is_revised ? 'Marked Revised' : 'Mark as Revised'}
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                  {item.question_text}
                </p>

                {/* Interactive Re-Attempt Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {item.options.map((opt, oIdx) => {
                    const letter = String.fromCharCode(65 + oIdx);
                    const isSelected = currentPick === opt.id || currentPick === opt.text;
                    const isCorrectAnswer = opt.is_correct;

                    let optClass = 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700';

                    if (isRevealed) {
                      if (isCorrectAnswer) {
                        optClass = 'bg-emerald-950/40 border-emerald-600 text-emerald-200 font-semibold';
                      } else if (isSelected && !isCorrectAnswer) {
                        optClass = 'bg-rose-950/40 border-rose-600 text-rose-200 font-semibold';
                      }
                    } else if (isSelected) {
                      optClass = 'bg-blue-900/40 border-blue-500 text-white';
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() =>
                          setSelectedPicks((prev) => ({ ...prev, [item.question_id]: opt.id }))
                        }
                        className={`p-3 rounded-xl border flex items-center gap-3 text-xs cursor-pointer transition-colors ${optClass}`}
                      >
                        <span className="w-5 h-5 rounded flex items-center justify-center font-bold bg-white/10 shrink-0">
                          {letter}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isRevealed && isCorrectAnswer && (
                          <span className="text-[10px] text-emerald-400 font-extrabold uppercase">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Bar (Show Solution & Error Reason) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedSolutions((prev) => ({
                          ...prev,
                          [item.question_id]: !prev[item.question_id],
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <span>{isRevealed ? 'Hide Solution' : 'Check Solution'}</span>
                      {isRevealed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Reason Tag Selector */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 text-[11px]">Mistake Cause:</span>
                    <select
                      value={item.student_reason_tag}
                      onChange={(e) =>
                        handleUpdateTag(item.attempt_id, item.question_id, item.log_id, e.target.value)
                      }
                      className="bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-slate-200 py-1 px-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="NONE">Select Reason...</option>
                      <option value="CONCEPT_GAP">Concept Gap</option>
                      <option value="CALCULATION">Calculation Error</option>
                      <option value="SILLY">Silly Mistake</option>
                      <option value="GUESS">Blind Guess</option>
                      <option value="TIME_PRESSURE">Time Pressure</option>
                      <option value="DIDNT_KNOW">Did Not Know Formula</option>
                    </select>
                  </div>
                </div>

                {/* Revealed Solution Drawer */}
                {isRevealed && item.solution_text && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-950 space-y-1.5 text-xs">
                    <span className="font-bold text-emerald-400 block">Verified Explanation:</span>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                      {item.solution_text}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
