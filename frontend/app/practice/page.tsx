'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useEnrollment } from '@/hooks/use-enrollment';
import { useActiveCourse } from '@/hooks/use-active-course';
import { CourseSwitcher } from '@/components/courses/CourseSwitcher';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import {
  Edit3,
  ChevronRight,
  ArrowLeft,
  Atom,
  FlaskConical,
  Calculator,
  Sparkles,
  Lock,
  Clock,
  Award,
  RotateCcw,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ClassChoice = 'class11' | 'class12';

interface ApiSubject {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface ApiChapter {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
}

interface ApiDPP {
  id: string;
  title: string;
  dpp_number: number;
  duration_minutes: number;
  question_count?: number;
}

interface ApiQuestionOption {
  id: string;
  text: string;
  is_correct?: boolean;
}

interface ApiQuestion {
  id: string;
  questionText: string;
  options: ApiQuestionOption[];
  correctAnswerId?: string;
  explanation?: string;
  positive_marks: number;
  negative_marks: number;
}

interface ApiDPPDetail {
  id: string;
  title: string;
  duration_minutes: number;
  questions: ApiQuestion[];
}

interface SubmitResult {
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  solutions?: Record<string, { correctAnswerId: string; correctOptions: string[]; explanation: string }>;
}

export default function PracticePage() {
  const { isEnrolled } = useEnrollment();
  const {
    enrolledCourses,
    allCourses,
    activeCourse,
    setActiveCourse,
    isEnrolledInAny,
    enrolledCount,
  } = useActiveCourse();

  const enrolled = isEnrolledInAny || isEnrolled();

  // Navigation step states
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);

  // Auto-enter course if enrolled in 1+ courses
  useEffect(() => {
    if (activeCourse && enrolledCount > 0) {
      setSelectedCourse(true);
    }
  }, [activeCourse, enrolledCount]);
  const [selectedClass, setSelectedClass] = useState<ClassChoice | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<ApiSubject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<ApiChapter | null>(null);
  const [activeDPP, setActiveDPP] = useState<ApiDPPDetail | null>(null);

  // Data states
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [dpps, setDpps] = useState<ApiDPP[]>([]);

  // Loading states
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingDpps, setIsLoadingDpps] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Active DPP Quiz Execution States
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // 1. Fetch Subjects on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSubjects(true);
    apiClient.get<ApiSubject[] | { results?: ApiSubject[] }>('/academics/subjects/')
      .then((data) => {
        if (!isMounted) return;
        setSubjects(asList<ApiSubject>(data));
      })
      .catch((err) => {
        console.warn('Failed to load subjects:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Chapters when subject & class selected
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }

    let isMounted = true;
    setIsLoadingChapters(true);
    const query = selectedClass ? `?class=${selectedClass}` : '';
    apiClient.get<ApiChapter[]>(`/academics/subjects/${selectedSubject.id}/chapters/${query}`)
      .then((data) => {
        if (!isMounted) return;
        setChapters(asList<ApiChapter>(data));
      })
      .catch((err) => {
        console.warn('Failed to load chapters:', err);
        if (isMounted) setChapters([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingChapters(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSubject, selectedClass]);

  // 3. Fetch DPPs when chapter selected
  useEffect(() => {
    if (!selectedChapter) {
      setDpps([]);
      return;
    }

    let isMounted = true;
    setIsLoadingDpps(true);
    apiClient.get<ApiDPP[]>(`/questions/dpps/?chapter=${selectedChapter.id}`)
      .then((data) => {
        if (!isMounted) return;
        setDpps(asList<ApiDPP>(data));
      })
      .catch((err) => {
        console.warn('Failed to load DPPs:', err);
        if (isMounted) setDpps([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDpps(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedChapter]);

  // 4. Select and Load DPP questions
  const handleSelectDPP = (dppItem: ApiDPP) => {
    setIsLoadingQuestions(true);
    apiClient.get<ApiDPPDetail>(`/questions/dpps/${dppItem.id}/questions/`)
      .then((detail) => {
        setActiveDPP(detail);
        setCurrentQuestionIdx(0);
        setUserAnswers({});
        setIsSubmitted(false);
        setSubmitResult(null);
      })
      .catch((err) => {
        console.warn('Failed to load DPP questions:', err);
      })
      .finally(() => {
        setIsLoadingQuestions(false);
      });
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeDPP) return;
    setIsSubmittingQuiz(true);

    try {
      const res = await apiClient.post<SubmitResult>(`/questions/dpps/${activeDPP.id}/submit/`, {
        answers: userAnswers,
      });
      setSubmitResult(res);
      if (res.solutions) {
        setActiveDPP((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            questions: prev.questions.map((q) => {
              const sol = res.solutions?.[q.id];
              if (!sol) return q;
              return {
                ...q,
                correctAnswerId: sol.correctAnswerId,
                explanation: sol.explanation,
                options: q.options.map((opt) => ({
                  ...opt,
                  is_correct: sol.correctOptions?.includes(opt.id) || opt.id === sol.correctAnswerId,
                })),
              };
            }),
          };
        });
      }
      setIsSubmitted(true);
    } catch {
      // Local calculation fallback
      let correct = 0;
      let incorrect = 0;
      activeDPP.questions.forEach((q) => {
        const ans = userAnswers[q.id];
        if (ans === q.correctAnswerId) {
          correct += 1;
        } else if (ans) {
          incorrect += 1;
        }
      });
      const unattempted = activeDPP.questions.length - (correct + incorrect);
      const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;
      const score = correct * 4 - incorrect * 1;
      setSubmitResult({
        total: activeDPP.questions.length,
        correct,
        incorrect,
        unattempted,
        accuracy,
        score,
      });
      setIsSubmitted(true);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const getSubjectIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phys')) return Atom;
    if (lower.includes('chem')) return FlaskConical;
    return Calculator;
  };

  const currentQ = activeDPP && activeDPP.questions ? activeDPP.questions[currentQuestionIdx] : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-medium">
            <Link href="/" className="hover:text-blue-400 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-200 font-semibold">Practice</span>
            {selectedClass && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</span>
              </>
            )}
            {selectedSubject && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span>{selectedSubject.name}</span>
              </>
            )}
            {selectedChapter && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="truncate max-w-[140px]">{selectedChapter.name}</span>
              </>
            )}
            {activeDPP && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="truncate max-w-[140px]">{activeDPP.title}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Daily Practice Problems (DPP)</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h1>
        </div>

        {selectedCourse && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeDPP) setActiveDPP(null);
              else if (selectedChapter) setSelectedChapter(null);
              else if (selectedSubject) setSelectedSubject(null);
              else if (selectedClass) setSelectedClass(null);
              else setSelectedCourse(false);
            }}
            className="gap-1.5 text-xs border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Button>
        )}
      </div>

      {/* Course Switcher */}
      <CourseSwitcher
        activeCourse={activeCourse}
        courses={enrolledCount > 0 ? enrolledCourses : allCourses}
        onSelectCourse={(c) => {
          setActiveCourse(c);
          setSelectedCourse(true);
          setSelectedClass(null);
          setSelectedSubject(null);
          setSelectedChapter(null);
          setActiveDPP(null);
        }}
        isEnrolledInAny={isEnrolledInAny}
        enrolledCount={enrolledCount}
      />

      {/* VIEW 1: NOT ENROLLED */}
      {!enrolled ? (
        <div className="space-y-6">
          <Card className="p-8 text-center space-y-4 max-w-2xl mx-auto border-purple-900/40 bg-slate-900/90 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <Badge variant="blue">Practice Catalog</Badge>
              <h2 className="text-2xl font-extrabold text-white">Select a Course to Unlock Practice Sets</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                You are previewing courses. Enroll in a course to unlock DPPs, CBT chapter practice sets, and solutions.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {allCourses.map((c) => (
              <Card key={c.id} className="p-5 space-y-4 bg-slate-900/90 border-slate-800 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="blue">{c.exam_type || 'JEE'}</Badge>
                    <span className="font-bold text-amber-400 text-sm">
                      {c.is_free ? 'Free' : `₹${c.price}`}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-100">{c.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{c.description || 'Structured JEE practice drills and tests'}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCourse(c);
                      setSelectedCourse(true);
                    }}
                    className="text-xs border-slate-700 text-slate-300 hover:text-white"
                  >
                    View Previews
                  </Button>
                  <Link href={`/courses`}>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs">
                      Enroll / Buy
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : isLoadingQuestions ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : activeDPP && activeDPP.questions && activeDPP.questions.length > 0 && currentQ ? (
        /* VIEW 6: ACTIVE DPP QUIZ INTERFACE */
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="purple">DPP Quiz</Badge>
                <h3 className="font-extrabold text-base text-white">{activeDPP.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Question {currentQuestionIdx + 1} of {activeDPP.questions.length} • Marking (+{currentQ.positive_marks} / -{currentQ.negative_marks})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {activeDPP.duration_minutes || 30} Mins
              </span>
              {!isSubmitted ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitQuiz}
                  isLoading={isSubmittingQuiz}
                  className="font-bold text-xs"
                >
                  Submit DPP
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserAnswers({});
                    setIsSubmitted(false);
                    setSubmitResult(null);
                    setCurrentQuestionIdx(0);
                  }}
                  className="gap-1.5 text-xs text-emerald-400 border-emerald-900"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-attempt</span>
                </Button>
              )}
            </div>
          </div>

          {/* Submission Result Score Card */}
          {isSubmitted && submitResult && (
            <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-base text-white">DPP Attempt Summary</h4>
                </div>
                <Badge variant="emerald">{submitResult.accuracy}% Accuracy</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Score</div>
                  <div className="text-lg font-black text-emerald-400">{submitResult.score}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Correct</div>
                  <div className="text-lg font-black text-blue-400">{submitResult.correct}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Incorrect</div>
                  <div className="text-lg font-black text-rose-400">{submitResult.incorrect}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Unattempted</div>
                  <div className="text-lg font-black text-slate-400">{submitResult.unattempted}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Question Display Card */}
          <Card className="p-6 sm:p-8 space-y-6 bg-slate-900 border-slate-800">
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-md border border-blue-900">
                Question {currentQuestionIdx + 1}
              </span>
              <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
                {currentQ.questionText}
              </p>
            </div>

            {/* Dynamic Options List */}
            <div className="space-y-3">
              {currentQ.options.map((opt, oIdx) => {
                const optLetter = String.fromCharCode(65 + oIdx);
                const isSelected = userAnswers[currentQ.id] === opt.id || userAnswers[currentQ.id] === optLetter;
                const isCorrect = isSubmitted && (opt.is_correct || opt.id === currentQ.correctAnswerId);
                const isWrongSelection = isSubmitted && isSelected && !isCorrect;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => handleSelectOption(currentQ.id, opt.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-semibold'
                        : isWrongSelection
                        ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                        : isSelected
                        ? 'border-blue-500 bg-blue-950/30 text-white'
                        : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-500 text-slate-950'
                          : isWrongSelection
                          ? 'bg-rose-500 text-white'
                          : isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {optLetter}
                    </span>
                    <span className="text-sm pt-0.5">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation on Submission */}
            {isSubmitted && currentQ.explanation && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider block">Solution Breakdown</span>
                <p className="text-slate-300 leading-relaxed">{currentQ.explanation}</p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                disabled={currentQuestionIdx === 0}
                className="text-xs border-slate-800 text-slate-300"
              >
                ← Previous
              </Button>

              <div className="flex items-center gap-1.5">
                {activeDPP.questions.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      idx === currentQuestionIdx
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : userAnswers[activeDPP.questions[idx].id]
                        ? 'bg-slate-800 text-blue-400 border border-blue-900/60'
                        : 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentQuestionIdx((p) => Math.min(activeDPP.questions.length - 1, p + 1))}
                disabled={currentQuestionIdx === activeDPP.questions.length - 1}
                className="text-xs border-slate-800 text-slate-300"
              >
                Next →
              </Button>
            </div>
          </Card>
        </div>
      ) : activeDPP && (!activeDPP.questions || activeDPP.questions.length === 0) ? (
        <Card className="p-8 text-center space-y-3 bg-slate-900 border-slate-800 max-w-xl mx-auto">
          <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Questions Added to this DPP Yet</h3>
          <p className="text-xs text-slate-400">Questions linked to this set in the Admin Panel will appear here.</p>
          <Button variant="outline" size="sm" onClick={() => setActiveDPP(null)} className="mt-2">
            Back to DPP Sets
          </Button>
        </Card>
      ) : selectedChapter ? (
        /* VIEW 5: DPPS LIST IN CHAPTER */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Badge variant="blue">{selectedSubject?.name}</Badge>
              <h2 className="text-xl font-extrabold text-white mt-1">
                {selectedChapter.name} Practice Sets
              </h2>
              <p className="text-xs text-slate-400">Select a DPP set to begin timed solving</p>
            </div>
          </div>

          {isLoadingDpps ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : dpps.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No practice sets (DPPs) added yet</h3>
              <p className="text-xs text-slate-400">DPPs for this chapter will appear here once added in the Admin Panel.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dpps.map((dpp) => (
                <Card
                  key={dpp.id}
                  hoverEffect
                  onClick={() => handleSelectDPP(dpp)}
                  className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-emerald-500/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {dpp.duration_minutes || 30} Mins
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-slate-100">{dpp.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {dpp.question_count ? `${dpp.question_count} Questions` : 'Timed JEE Practice Set'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>Start Practice Test</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : selectedSubject && selectedClass ? (
        /* VIEW 4: CHAPTERS LIST IN SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">{selectedSubject.name} Chapters</h2>
            <p className="text-xs text-slate-400">Select a chapter to access Daily Practice Problems</p>
          </div>

          {isLoadingChapters ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : chapters.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No chapters added yet</h3>
              <p className="text-xs text-slate-400">Chapters for {selectedSubject.name} will appear here once added in the Admin Panel.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapters.map((chap, idx) => (
                <Card
                  key={chap.id}
                  hoverEffect
                  onClick={() => setSelectedChapter(chap)}
                  className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-emerald-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-900">
                      Chapter {idx + 1}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-slate-100">{chap.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{chap.description || 'Targeted problem sets'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>View DPPs</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : selectedClass ? (
        /* VIEW 3: SELECT SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">Select Subject</h2>
            <p className="text-xs text-slate-400">Choose Physics, Chemistry, or Mathematics</p>
          </div>

          {isLoadingSubjects ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : subjects.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No subjects added yet</h3>
              <p className="text-xs text-slate-400">Please create subjects in the Admin Panel.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subjects.map((subj) => {
                const Icon = getSubjectIcon(subj.name);

                return (
                  <Card
                    key={subj.id}
                    hoverEffect
                    onClick={() => setSelectedSubject(subj)}
                    className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-100">{subj.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {subj.description || `JEE Practice Problems for ${subj.name}`}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>Select Subject</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedCourse ? (
        /* VIEW 2: SELECT CLASS */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">Select Class</h2>
            <p className="text-xs text-slate-400">Choose Class 11 or Class 12 syllabus</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            <Card
              hoverEffect
              onClick={() => setSelectedClass('class11')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 11</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics</p>
              </div>
              <Button variant="primary" className="w-full font-bold bg-emerald-600 hover:bg-emerald-500">
                <span>Start Practice →</span>
              </Button>
            </Card>

            <Card
              hoverEffect
              onClick={() => setSelectedClass('class12')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 12</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics</p>
              </div>
              <Button variant="primary" className="w-full font-bold bg-purple-600 hover:bg-purple-500">
                <span>Start Practice →</span>
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        /* VIEW 1: MY ENROLLED COURSES LIST */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">My Enrolled Courses</h2>
            <p className="text-xs text-slate-400">Courses unlocked via your registration</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {enrolledCourses.map((c) => (
              <Card key={c.id} className="p-6 space-y-5 bg-slate-900 border-slate-800 hover:border-emerald-500/40 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Badge variant="blue">{c.exam_type || 'JEE'}</Badge>
                    <h3 className="font-extrabold text-lg text-slate-100">{c.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.description || 'Structured JEE practice drills and tests'}</p>
                  </div>
                  <Badge variant="emerald" className="px-3 py-1 shrink-0">✓ Enrolled</Badge>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveCourse(c);
                      setSelectedCourse(true);
                    }}
                    className="gap-2 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                  >
                    <span>Open Practice Sets</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
