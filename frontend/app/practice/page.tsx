'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useEnrollment } from '@/hooks/use-enrollment';
import { MAIN_COURSE, DEMO_SUBJECTS, Subject, Chapter, DPP } from '@/lib/demo-data';
import {
  Edit3,
  CheckCircle2,
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ClassChoice = 'class11' | 'class12';

export default function PracticePage() {
  const { isEnrolled } = useEnrollment();
  const enrolled = isEnrolled(MAIN_COURSE.id);

  // Flow Step States
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<ClassChoice | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [activeDPP, setActiveDPP] = useState<DPP | null>(null);

  // Active DPP Quiz Execution States
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const getSubjectIcon = (id: string) => {
    switch (id) {
      case 'physics':
        return Atom;
      case 'chemistry':
        return FlaskConical;
      default:
        return Calculator;
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const calculateResult = () => {
    if (!activeDPP) return { total: 0, correct: 0, incorrect: 0, unattempted: 0, accuracy: 0, score: 0 };
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
    const score = correct * 4 - incorrect * 1; // Standard JEE Marking +4 / -1

    return { total: activeDPP.questions.length, correct, incorrect, unattempted, accuracy, score };
  };

  const result = calculateResult();

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
                <span className="truncate max-w-[140px]">{selectedChapter.title}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Practice & Daily Practice Problems (DPP)</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h1>
        </div>

        {selectedCourse && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeDPP) {
                setActiveDPP(null);
                setUserAnswers({});
                setIsSubmitted(false);
                setCurrentQuestionIdx(0);
              } else if (selectedChapter) setSelectedChapter(null);
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

      {/* VIEW 1: NOT ENROLLED IN COURSE */}
      {!enrolled ? (
        <Card className="p-8 sm:p-12 text-center space-y-5 max-w-2xl mx-auto border-emerald-900/40 bg-slate-900/90 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <Badge variant="emerald">Single Course Access</Badge>
            <h2 className="text-2xl font-extrabold text-white">No Enrolled Practice Courses</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Enroll in the <strong>JEE Main + Advanced Complete Preparation Course</strong> on the Home page for Free to unlock all Daily Practice Problems (DPP).
            </p>
          </div>
          <div className="pt-2">
            <Link href="/">
              <Button variant="primary" className="gap-2 px-6 py-3 font-bold bg-emerald-600 hover:bg-emerald-500 border-none shadow-lg shadow-emerald-600/30">
                <Edit3 className="w-4 h-4" />
                <span>Explore & Enroll Free on Home</span>
              </Button>
            </Link>
          </div>
        </Card>
      ) : activeDPP && isSubmitted ? (
        /* VIEW 6: DPP COMPLETED RESULT & SOLUTION ANALYSIS */
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card className="p-6 sm:p-8 space-y-6 bg-slate-900 border-slate-800 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <Badge variant="emerald">DPP Completed ✓</Badge>
              <h2 className="text-2xl font-extrabold text-white">{activeDPP.title}</h2>
              <p className="text-xs text-slate-400">JEE Marking Standard (+4 Correct, -1 Incorrect)</p>
            </div>

            {/* Score Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Score</span>
                <span className="text-xl font-extrabold text-white">{result.score}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Correct</span>
                <span className="text-xl font-extrabold text-emerald-400">{result.correct} / {result.total}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Incorrect</span>
                <span className="text-xl font-extrabold text-rose-400">{result.incorrect}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 uppercase font-bold block">Accuracy</span>
                <span className="text-xl font-extrabold text-blue-400">{result.accuracy}%</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUserAnswers({});
                  setIsSubmitted(false);
                  setCurrentQuestionIdx(0);
                }}
                className="gap-2 border-slate-800 text-slate-200"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake DPP</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveDPP(null);
                  setUserAnswers({});
                  setIsSubmitted(false);
                  setCurrentQuestionIdx(0);
                }}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 border-none"
              >
                <span>Back to DPP List</span>
              </Button>
            </div>
          </Card>

          {/* Solutions & Explanations Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Step-by-Step Solutions</h3>
            {activeDPP.questions.map((q, idx) => {
              const userAns = userAnswers[q.id];
              const isCorrect = userAns === q.correctAnswerId;

              return (
                <Card key={q.id} className="p-5 space-y-3 bg-slate-900 border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Question 0{idx + 1}</span>
                    {userAns ? (
                      isCorrect ? (
                        <Badge variant="emerald">Correct (+4)</Badge>
                      ) : (
                        <Badge variant="rose">Incorrect (-1)</Badge>
                      )
                    ) : (
                      <Badge variant="slate">Unattempted (0)</Badge>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-100">{q.questionText}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          opt.id === q.correctAnswerId
                            ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 font-bold'
                            : opt.id === userAns
                            ? 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span>({opt.id}) {opt.text}</span>
                        {opt.id === q.correctAnswerId && <span>✓ Correct</span>}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-blue-400 block">Explanation:</span>
                    <p>{q.explanation}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : activeDPP ? (
        /* VIEW 5: INTERACTIVE DPP QUESTION RUNNER */
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Quiz Header & Progress */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-emerald-400">{activeDPP.title}</span>
              <h2 className="text-sm font-bold text-white">
                Question {currentQuestionIdx + 1} of {activeDPP.questions.length}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeDPP.durationMinutes}:00 Mins</span>
            </div>
          </div>

          {/* Question Card */}
          {(() => {
            const currentQ = activeDPP.questions[currentQuestionIdx];

            return (
              <Card className="p-6 sm:p-8 space-y-6 bg-slate-900 border-slate-800 shadow-xl">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Question 0{currentQuestionIdx + 1}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-relaxed">
                    {currentQ.questionText}
                  </h3>
                </div>

                {/* Clickable Options */}
                <div className="space-y-3">
                  {currentQ.options.map((opt) => {
                    const isSelected = userAnswers[currentQ.id] === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt.id)}
                        className={`w-full p-4 rounded-xl border text-left text-sm font-medium transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold ring-2 ring-emerald-500/20 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold ${
                            isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {opt.id}
                          </span>
                          <span>{opt.text}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Controls & Nav */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                    disabled={currentQuestionIdx === 0}
                    className="text-xs border-slate-800 text-slate-300"
                  >
                    Previous
                  </Button>

                  {currentQuestionIdx < activeDPP.questions.length - 1 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border-none"
                    >
                      Next Question →
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsSubmitted(true)}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border-none px-5"
                    >
                      Submit DPP ✓
                    </Button>
                  )}
                </div>
              </Card>
            );
          })()}
        </div>
      ) : selectedChapter ? (
        /* VIEW 4: DPP LIST IN CHAPTER */
        <div className="space-y-6">
          <div>
            <Badge variant="emerald">{selectedSubject?.name}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">
              Chapter {selectedChapter.chapterNumber}: {selectedChapter.title} DPPs
            </h2>
            <p className="text-xs text-slate-400">Select a Daily Practice Problem set to test your concepts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedChapter.dpps.map((dpp) => (
              <Card
                key={dpp.id}
                hoverEffect
                onClick={() => {
                  setActiveDPP(dpp);
                  setUserAnswers({});
                  setIsSubmitted(false);
                  setCurrentQuestionIdx(0);
                }}
                className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <Badge variant="emerald">{dpp.durationMinutes} Mins</Badge>
                </div>

                <div>
                  <h4 className="font-extrabold text-base text-slate-100">{dpp.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{dpp.questionCount} Multiple Choice Questions</p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>Start DPP</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : selectedSubject && selectedClass ? (
        /* VIEW 3: CHAPTERS LIST IN SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="emerald" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">{selectedSubject.name} Practice Chapters</h2>
            <p className="text-xs text-slate-400">Select a chapter to practice Daily Practice Problems</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedSubject.chapters[selectedClass].map((chap) => (
              <Card
                key={chap.id}
                hoverEffect
                onClick={() => setSelectedChapter(chap)}
                className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-emerald-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-900">
                    Chapter 0{chap.chapterNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{chap.dpps.length} DPP Sets</span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-100">{chap.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{chap.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>View DPPs</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : selectedClass ? (
        /* VIEW 2: SELECT SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="emerald" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">Select Practice Subject</h2>
            <p className="text-xs text-slate-400">Choose Physics, Chemistry, or Mathematics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_SUBJECTS.map((subj) => {
              const Icon = getSubjectIcon(subj.id);

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
                    <p className="text-xs text-slate-400 mt-1">
                      {subj.chapters[selectedClass].length} Chapters Available
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
        </div>
      ) : selectedCourse ? (
        /* VIEW 2: SELECT CLASS */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">Select Class</h2>
            <p className="text-xs text-slate-400">Choose Class 11 or Class 12 practice sets</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            <Card
              hoverEffect
              onClick={() => setSelectedClass('class11')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Edit3 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 11</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics DPPs</p>
              </div>
              <Button variant="primary" className="w-full font-bold bg-emerald-600 hover:bg-emerald-500 border-none">
                <span>Start Practice →</span>
              </Button>
            </Card>

            <Card
              hoverEffect
              onClick={() => setSelectedClass('class12')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-emerald-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Edit3 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 12</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics DPPs</p>
              </div>
              <Button variant="primary" className="w-full font-bold bg-emerald-600 hover:bg-emerald-500 border-none">
                <span>Start Practice →</span>
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        /* VIEW 1: MY PRACTICE COURSES LIST */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">My Practice Courses</h2>
            <p className="text-xs text-slate-400">Daily Practice Problems unlocked via your single registration</p>
          </div>

          <div className="max-w-2xl">
            <Card className="p-6 space-y-5 bg-slate-900 border-slate-800 hover:border-emerald-500/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Badge variant="emerald">JEE Main & Advanced DPP</Badge>
                  <h3 className="font-extrabold text-lg text-slate-100">{MAIN_COURSE.title}</h3>
                  <p className="text-xs text-slate-400">Daily Practice Problems • Class 11 + 12 • Physics, Chemistry & Mathematics</p>
                </div>
                <Badge variant="emerald" className="px-3 py-1 shrink-0">✓ Enrolled</Badge>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setSelectedCourse(true)}
                  className="gap-2 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 border-none shadow-lg shadow-emerald-600/20"
                >
                  <span>Open Practice</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
