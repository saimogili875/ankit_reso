'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

type PaletteState = 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED_REVIEW' | 'ANSWERED_AND_MARKED';

interface TestOption {
  id: string;
  text: string;
}

interface CBTQuestion {
  id: string;
  test_question_id: string;
  section_id: string;
  order: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  positive_marks: number;
  negative_marks: number;
  options: TestOption[];
}

interface CBTSection {
  id: string;
  name: string;
  subject_id: string;
  subject_name: string;
  order: number;
  instructions?: string;
}

interface StartResponse {
  attempt_id: string;
  test_id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
  instructions?: string;
  time_elapsed_seconds: number;
  time_remaining_seconds: number;
  sections: CBTSection[];
  questions: CBTQuestion[];
  saved_answers: { [qId: string]: string };
  question_states: { [qId: string]: PaletteState };
  already_submitted?: boolean;
}

export default function CBTAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Test data
  const [attemptId, setAttemptId] = useState<string>('');
  const [testTitle, setTestTitle] = useState<string>('');
  const [sections, setSections] = useState<CBTSection[]>([]);
  const [questions, setQuestions] = useState<CBTQuestion[]>([]);

  // Navigation & Answers State
  const [currentSectionId, setCurrentSectionId] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [questionStates, setQuestionStates] = useState<{ [qId: string]: PaletteState }>({});

  // Timer
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const questionTimeCounter = useRef<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // 1. Initialize Test Attempt
  const initTest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<StartResponse>(`/tests/${testId}/start/`);
      if (!res) throw new Error('No data received from test server.');

      if (res.already_submitted) {
        router.replace(`/tests/${res.attempt_id}/result`);
        return;
      }

      setAttemptId(res.attempt_id);
      setTestTitle(res.title);
      setSections(res.sections || []);
      setQuestions(res.questions || []);

      // Recover any unsaved answers from local browser storage in case of connection drop
      let initialAnswers = res.saved_answers || {};
      if (typeof window !== 'undefined') {
        try {
          const localCached = localStorage.getItem(`cbt_answers_${res.attempt_id}`);
          if (localCached) {
            const parsed = JSON.parse(localCached);
            initialAnswers = { ...initialAnswers, ...parsed };
          }
        } catch {}
      }

      setAnswers(initialAnswers);
      setQuestionStates(res.question_states || {});
      setTimeLeft(res.time_remaining_seconds || res.duration_minutes * 60);

      if (res.sections && res.sections.length > 0) {
        setCurrentSectionId(res.sections[0].id);
      }

      // Mark the first question as NOT_ANSWERED if it was NOT_VISITED
      if (res.questions && res.questions.length > 0) {
        const firstQ = res.questions[0];
        const existingState = res.question_states?.[firstQ.id];
        if (!existingState || existingState === 'NOT_VISITED') {
          setQuestionStates((prev) => ({ ...prev, [firstQ.id]: 'NOT_ANSWERED' }));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch CBT exam runner.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [testId, router]);

  useEffect(() => {
    initTest();
  }, [initTest]);

  // Questions belonging to the active section
  const sectionQuestions = useMemo(() => {
    if (!currentSectionId) return questions;
    return questions.filter((q) => q.section_id === currentSectionId);
  }, [questions, currentSectionId]);

  const currentQuestion = sectionQuestions[currentQuestionIndex] || questions[0];

  // 2. Countdown Timer & Per-Question Time Tracker
  useEffect(() => {
    if (isLoading || isSubmitting || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto submit
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
      questionTimeCounter.current += 1;
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, isSubmitting, timeLeft]);

  // 3. Log real-time interaction event to backend
  const logEvent = useCallback(
    async (
      questionId: string,
      eventType: 'visit' | 'answer' | 'clear' | 'mark_review',
      selectedAnswer?: string,
      newState?: PaletteState
    ) => {
      if (!attemptId) return;
      const timeSpentDelta = questionTimeCounter.current;
      questionTimeCounter.current = 0; // reset counter for next slice

      try {
        await apiClient.post(`/tests/attempts/${attemptId}/event/`, {
          question_id: questionId,
          event_type: eventType,
          selected_answer: selectedAnswer || '',
          time_spent_delta: timeSpentDelta,
          new_state: newState,
        });
      } catch {
        // Ignored in background
      }
    },
    [attemptId]
  );

  // 4. Save & Next Handler
  const handleSaveAndNext = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const currentAns = answers[qId];

    const newState: PaletteState = currentAns ? 'ANSWERED' : 'NOT_ANSWERED';
    setQuestionStates((prev) => ({ ...prev, [qId]: newState }));

    logEvent(qId, currentAns ? 'answer' : 'visit', currentAns, newState);

    // Advance to next question in this section
    if (currentQuestionIndex < sectionQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    } else {
      // Find next section
      const currSecIdx = sections.findIndex((s) => s.id === currentSectionId);
      if (currSecIdx !== -1 && currSecIdx < sections.length - 1) {
        const nextSec = sections[currSecIdx + 1];
        setCurrentSectionId(nextSec.id);
        setCurrentQuestionIndex(0);
      }
    }
  };

  // 5. Mark for Review & Next Handler
  const handleMarkForReview = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    const currentAns = answers[qId];

    const newState: PaletteState = currentAns ? 'ANSWERED_AND_MARKED' : 'MARKED_REVIEW';
    setQuestionStates((prev) => ({ ...prev, [qId]: newState }));

    logEvent(qId, 'mark_review', currentAns, newState);

    if (currentQuestionIndex < sectionQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  // 6. Clear Response
  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;

    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[qId];
      if (attemptId && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`cbt_answers_${attemptId}`, JSON.stringify(copy));
        } catch {}
      }
      return copy;
    });

    const newState: PaletteState = 'NOT_ANSWERED';
    setQuestionStates((prev) => ({ ...prev, [qId]: newState }));

    logEvent(qId, 'clear', '', newState);
  };

  // 7. Jump directly to Question
  const goToQuestion = (targetIndex: number) => {
    if (!sectionQuestions[targetIndex]) return;
    const nextQ = sectionQuestions[targetIndex];

    // Mark next question as NOT_ANSWERED if it was never visited before
    const currState = questionStates[nextQ.id];
    if (!currState || currState === 'NOT_VISITED') {
      setQuestionStates((prev) => ({ ...prev, [nextQ.id]: 'NOT_ANSWERED' }));
      logEvent(nextQ.id, 'visit', undefined, 'NOT_ANSWERED');
    }

    setCurrentQuestionIndex(targetIndex);
  };

  // 8. Select Option (persists to local storage instantly)
  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    setAnswers((prev) => {
      const updated = { ...prev, [qId]: optionId };
      if (attemptId && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`cbt_answers_${attemptId}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  // 9. Final Submit Handler
  const handleFinalSubmit = async (isAuto = false) => {
    if (!attemptId || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    try {
      const totalTimeSpent = questions.length * 60 - timeLeft; // approximate
      const res = await apiClient.post<{ attempt_id: string }>(
        `/tests/attempts/${attemptId}/submit/`,
        {
          answers,
          time_taken_seconds: Math.max(1, totalTimeSpent),
          is_auto: isAuto,
        }
      );

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`cbt_answers_${attemptId}`);
        } catch {}
      }

      const targetId = res?.attempt_id || attemptId;
      router.push(`/tests/${targetId}/result`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      alert(msg);
      setIsSubmitting(false);
    }
  };

  // Palette Counts Summary
  const paletteCounts = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let markedReview = 0;
    let answeredAndMarked = 0;

    for (const q of questions) {
      const st = questionStates[q.id] || 'NOT_VISITED';
      if (st === 'ANSWERED') answered++;
      else if (st === 'NOT_ANSWERED') notAnswered++;
      else if (st === 'MARKED_REVIEW') markedReview++;
      else if (st === 'ANSWERED_AND_MARKED') answeredAndMarked++;
      else notVisited++;
    }

    return { answered, notAnswered, notVisited, markedReview, answeredAndMarked };
  }, [questions, questionStates]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4">
        <LoadingState message="Setting up NTA CBT Examination Environment..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4">
        <ErrorState title="Unable to open CBT exam" message={error} onRetry={initTest} />
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-100">No questions found in this test paper.</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. CBT TOP BAR */}
      <header className="h-14 sm:h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
            NTA
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate max-w-xs sm:max-w-md">
              {testTitle}
            </h1>
            <span className="text-[10px] text-slate-400 block">JEE Computer Based Test</span>
          </div>
        </div>

        {/* Timer & Submit */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-extrabold ${
              timeLeft < 300
                ? 'bg-rose-950/60 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-slate-950 border-slate-700 text-emerald-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting}
            className="px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit</span>
          </button>
        </div>
      </header>

      {/* 2. SECTION TABS */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0 mr-1">
          Sections:
        </span>
        {sections.map((sec) => {
          const isActive = sec.id === currentSectionId;
          const qCount = questions.filter((q) => q.section_id === sec.id).length;

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                setCurrentSectionId(sec.id);
                setCurrentQuestionIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{sec.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {qCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Question & Answers Canvas */}
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="space-y-6 max-w-4xl">
            {/* Question Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold text-blue-400">
                  Question {currentQuestion.order || currentQuestionIndex + 1}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({currentQuestion.question_type})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-bold">
                  +{currentQuestion.positive_marks}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-rose-950/60 border border-rose-800 text-rose-400 text-xs font-bold">
                  -{currentQuestion.negative_marks}
                </span>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800">
              {currentQuestion.question_text}
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((opt, oIdx) => {
                const isSelected = answers[currentQuestion.id] === str(opt.id);
                const letter = String.fromCharCode(65 + oIdx);

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(String(opt.id))}
                    className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-900/30 border-blue-500 text-white shadow-md shadow-blue-950/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {letter}
                    </div>
                    <span className="text-sm font-medium leading-relaxed">{opt.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Bottom Controls */}
          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearResponse}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                Clear Response
              </button>

              <button
                type="button"
                onClick={handleMarkForReview}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800 transition-colors flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Mark for Review & Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
              >
                Save & Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Question Palette Sidebar */}
        <aside className="w-full lg:w-80 bg-slate-900/70 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 sm:p-5 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Question Palette
            </h3>

            {/* 5-State Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-300 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {paletteCounts.answered}
                </span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {paletteCounts.notAnswered}
                </span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {paletteCounts.markedReview}
                </span>
                <span>Marked Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-purple-600 text-white relative flex items-center justify-center text-[10px] font-bold">
                  {paletteCounts.answeredAndMarked}
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                </span>
                <span>Ans & Marked</span>
              </div>
              <div className="flex items-center gap-2 col-span-2 pt-1 border-t border-slate-800">
                <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold border border-slate-700">
                  {paletteCounts.notVisited}
                </span>
                <span>Not Visited</span>
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">
                {sections.find((s) => s.id === currentSectionId)?.name || 'Questions'}
              </div>
              <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
                {sectionQuestions.map((q, idx) => {
                  const isCurrent = idx === currentQuestionIndex;
                  const st = questionStates[q.id] || 'NOT_VISITED';

                  let bgClass = 'bg-slate-800 border-slate-700 text-slate-400';
                  let hasDot = false;

                  if (st === 'ANSWERED') {
                    bgClass = 'bg-emerald-600 border-emerald-500 text-white';
                  } else if (st === 'NOT_ANSWERED') {
                    bgClass = 'bg-rose-600 border-rose-500 text-white';
                  } else if (st === 'MARKED_REVIEW') {
                    bgClass = 'bg-purple-600 border-purple-500 text-white';
                  } else if (st === 'ANSWERED_AND_MARKED') {
                    bgClass = 'bg-purple-600 border-purple-500 text-white';
                    hasDot = true;
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goToQuestion(idx)}
                      className={`h-9 rounded-lg font-bold text-xs relative flex items-center justify-center border transition-all ${bgClass} ${
                        isCurrent ? 'ring-2 ring-white scale-105 z-10' : 'hover:opacity-90'
                      }`}
                    >
                      {q.order || idx + 1}
                      {hasDot && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Final Submit Test
            </button>
          </div>
        </aside>
      </div>

      {/* 4. SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Submit Test Examination</h3>
                <p className="text-xs text-slate-400">Are you sure you want to end your test?</p>
              </div>
            </div>

            {/* Test Stats Snapshot */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Questions:</span>
                <span className="font-bold text-slate-200">{questions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Answered Questions:</span>
                <span className="font-bold text-emerald-400">{paletteCounts.answered + paletteCounts.answeredAndMarked}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Marked for Review:</span>
                <span className="font-bold text-purple-400">{paletteCounts.markedReview}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unanswered / Skipped:</span>
                <span className="font-bold text-rose-400">{paletteCounts.notAnswered + paletteCounts.notVisited}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Time Remaining:</span>
                <span className="font-bold font-mono text-slate-200">{formatTimer(timeLeft)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Back to Test
              </button>
              <button
                type="button"
                onClick={() => handleFinalSubmit(false)}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Yes, Submit Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function str(val: unknown): string {
  return String(val ?? '');
}
