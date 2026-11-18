'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/auth/form-message';
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  Radio,
  CheckSquare,
  Hash,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';

interface QuestionOptionData {
  id?: string;
  option_text: string;
  is_correct: boolean;
}

interface PYQMetaData {
  id?: string;
  exam?: string;
  exam_name?: string;
  year?: number;
  shift_or_paper?: string;
}

interface QuestionItem {
  id: string;
  subject?: number;
  subject_name?: string;
  chapter?: string;
  chapter_name?: string;
  question_text: string;
  solution_text?: string;
  solution_video_url?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  question_type: 'SINGLE' | 'MULTIPLE' | 'NUMERICAL';
  options: QuestionOptionData[];
  pyq_meta?: PYQMetaData;
  created_at?: string;
}

interface OptionsLookup {
  subjects: { id: number; name: string; slug: string }[];
  chapters: { id: string; name: string; subject_id: number; subject_name: string }[];
  exams: { id: string; name: string; slug: string }[];
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [optionsLookup, setOptionsLookup] = useState<OptionsLookup>({
    subjects: [],
    chapters: [],
    exams: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterChapter, setFilterChapter] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [formSubject, setFormSubject] = useState<string>('');
  const [formChapter, setFormChapter] = useState<string>('');
  const [formQuestionType, setFormQuestionType] = useState<'SINGLE' | 'MULTIPLE' | 'NUMERICAL'>('SINGLE');
  const [formDifficulty, setFormDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formSolutionText, setFormSolutionText] = useState('');
  const [formSolutionVideoUrl, setFormSolutionVideoUrl] = useState('');

  // Options State
  const [formOptions, setFormOptions] = useState<QuestionOptionData[]>([
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ]);

  // Numerical single option
  const [formNumericalAnswer, setFormNumericalAnswer] = useState('');

  // PYQ State
  const [hasPYQ, setHasPYQ] = useState(false);
  const [pyqExam, setPyqExam] = useState('');
  const [pyqYear, setPyqYear] = useState<number>(new Date().getFullYear());
  const [pyqShiftOrPaper, setPyqShiftOrPaper] = useState('');

  // Load options lookup and questions
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [optRes, qRes] = await Promise.all([
        apiClient.get<OptionsLookup>('/admin-panel/options/'),
        apiClient.get<{ results?: QuestionItem[] } | QuestionItem[]>('/admin-panel/questions/'),
      ]);
      setOptionsLookup(optRes);
      const qList = Array.isArray(qRes) ? qRes : qRes.results || [];
      setQuestions(qList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load question bank data.';
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormSubject('');
    setFormChapter('');
    setFormQuestionType('SINGLE');
    setFormDifficulty('MEDIUM');
    setFormQuestionText('');
    setFormSolutionText('');
    setFormSolutionVideoUrl('');
    setFormOptions([
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
    ]);
    setFormNumericalAnswer('');
    setHasPYQ(false);
    setPyqExam('');
    setPyqYear(new Date().getFullYear());
    setPyqShiftOrPaper('');
    setFormError('');
    setFormSuccess('');
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleStartEdit = (q: QuestionItem) => {
    setEditingId(q.id);
    setFormSubject(q.subject ? String(q.subject) : '');
    setFormChapter(q.chapter ? String(q.chapter) : '');
    setFormQuestionType(q.question_type);
    setFormDifficulty(q.difficulty);
    setFormQuestionText(q.question_text || '');
    setFormSolutionText(q.solution_text || '');
    setFormSolutionVideoUrl(q.solution_video_url || '');

    if (q.question_type === 'NUMERICAL') {
      const firstOpt = q.options && q.options.length > 0 ? q.options[0].option_text : '';
      setFormNumericalAnswer(firstOpt);
    } else {
      if (q.options && q.options.length > 0) {
        setFormOptions(q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })));
      } else {
        setFormOptions([
          { option_text: '', is_correct: true },
          { option_text: '', is_correct: false },
        ]);
      }
    }

    if (q.pyq_meta) {
      setHasPYQ(true);
      setPyqExam(q.pyq_meta.exam ? String(q.pyq_meta.exam) : '');
      setPyqYear(q.pyq_meta.year || new Date().getFullYear());
      setPyqShiftOrPaper(q.pyq_meta.shift_or_paper || '');
    } else {
      setHasPYQ(false);
      setPyqExam('');
      setPyqYear(new Date().getFullYear());
      setPyqShiftOrPaper('');
    }

    setFormError('');
    setFormSuccess('');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOptionChange = (idx: number, text: string) => {
    const updated = [...formOptions];
    updated[idx].option_text = text;
    setFormOptions(updated);
  };

  const handleSingleCorrectSelect = (selectedIdx: number) => {
    const updated = formOptions.map((opt, idx) => ({
      ...opt,
      is_correct: idx === selectedIdx,
    }));
    setFormOptions(updated);
  };

  const handleMultipleCorrectToggle = (toggleIdx: number) => {
    const updated = formOptions.map((opt, idx) =>
      idx === toggleIdx ? { ...opt, is_correct: !opt.is_correct } : opt
    );
    setFormOptions(updated);
  };

  const handleAddOption = () => {
    setFormOptions([...formOptions, { option_text: '', is_correct: false }]);
  };

  const handleRemoveOption = (removeIdx: number) => {
    if (formOptions.length <= 2) {
      setFormError('MCQ questions require at least 2 options.');
      return;
    }
    const updated = formOptions.filter((_, idx) => idx !== removeIdx);
    // If the removed option was the only correct one in SINGLE, default first to true
    if (formQuestionType === 'SINGLE' && !updated.some((o) => o.is_correct)) {
      if (updated.length > 0) updated[0].is_correct = true;
    }
    setFormOptions(updated);
  };

  const validateClientSide = (): string | null => {
    if (!formQuestionText.trim()) {
      return 'Question text cannot be empty.';
    }

    if (formQuestionType === 'NUMERICAL') {
      if (!formNumericalAnswer.trim()) {
        return 'Please provide the numerical answer value.';
      }
    } else {
      if (formOptions.length < 2) {
        return 'Questions must have at least 2 options.';
      }
      for (let i = 0; i < formOptions.length; i++) {
        if (!formOptions[i].option_text.trim()) {
          return `Option ${i + 1} text cannot be empty.`;
        }
      }
      const correctCount = formOptions.filter((o) => o.is_correct).length;
      if (formQuestionType === 'SINGLE') {
        if (correctCount !== 1) {
          return 'Single Choice questions must have exactly 1 correct answer.';
        }
      } else if (formQuestionType === 'MULTIPLE') {
        if (correctCount < 1) {
          return 'Multiple Choice questions must have at least 1 correct answer.';
        }
      }
    }

    if (hasPYQ && !pyqExam) {
      return 'Please select the target Exam for this PYQ entry.';
    }

    return null;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const validationError = validateClientSide();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        question_text: formQuestionText.trim(),
        question_type: formQuestionType,
        difficulty: formDifficulty,
        solution_text: formSolutionText.trim(),
        solution_video_url: formSolutionVideoUrl.trim() || null,
      };

      if (formSubject) payload.subject = Number(formSubject);
      if (formChapter) payload.chapter = formChapter;

      if (formQuestionType === 'NUMERICAL') {
        payload.options = [
          {
            option_text: formNumericalAnswer.trim(),
            is_correct: true,
          },
        ];
      } else {
        payload.options = formOptions.map((opt) => ({
          option_text: opt.option_text.trim(),
          is_correct: opt.is_correct,
        }));
      }

      if (hasPYQ && pyqExam) {
        payload.pyq_exam = pyqExam;
        payload.pyq_year = Number(pyqYear);
        payload.pyq_shift_or_paper = pyqShiftOrPaper.trim();
      } else {
        payload.pyq_exam = null;
        payload.pyq_year = null;
        payload.pyq_shift_or_paper = '';
      }

      if (editingId) {
        await apiClient.put(`/admin-panel/questions/${editingId}/`, payload);
        setFormSuccess('Question updated successfully!');
      } else {
        await apiClient.post('/admin-panel/questions/', payload);
        setFormSuccess('Question created and cataloged successfully!');
      }

      await fetchData();
      setTimeout(() => {
        resetForm();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving question.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin-panel/questions/${deleteTarget.id}/`);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete question.';
      alert(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterSubject && String(q.subject) !== filterSubject) return false;
      if (filterChapter && String(q.chapter) !== filterChapter) return false;
      if (filterType && q.question_type !== filterType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const textMatch = q.question_text.toLowerCase().includes(query);
        const chapterMatch = q.chapter_name?.toLowerCase().includes(query);
        const subjectMatch = q.subject_name?.toLowerCase().includes(query);
        if (!textMatch && !chapterMatch && !subjectMatch) return false;
      }
      return true;
    });
  }, [questions, filterSubject, filterChapter, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-400" />
            <span>Question Repository</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Create, categorize, and validate Single, Multiple, and Numerical JEE questions.
          </p>
        </div>

        {!isFormOpen && (
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Question</span>
          </Button>
        )}
      </div>

      {/* Dynamic Creation / Edit Modal or Card */}
      {isFormOpen && (
        <Card className="p-5 sm:p-6 bg-slate-900 border-indigo-900/60 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">
                {editingId ? 'Edit Question' : 'Create New JEE Question'}
              </h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4">
            <FormMessage type="error" message={formError} />
            <FormMessage type="success" message={formSuccess} />
          </div>

          <form onSubmit={handleFormSubmit} className="mt-4 space-y-5">
            {/* Subject, Chapter, Type, Difficulty Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subject
                </label>
                <select
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Auto-derive from Chapter</option>
                  {optionsLookup.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chapter
                </label>
                <select
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Chapter...</option>
                  {optionsLookup.chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.subject_name ? `[${ch.subject_name}] ` : ''}{ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Question Type
                </label>
                <select
                  value={formQuestionType}
                  onChange={(e) => setFormQuestionType(e.target.value as 'SINGLE' | 'MULTIPLE' | 'NUMERICAL')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SINGLE">Single Choice (1 Correct)</option>
                  <option value="MULTIPLE">Multiple Choice (&ge;1 Correct)</option>
                  <option value="NUMERICAL">Numerical / Integer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Difficulty Level
                </label>
                <select
                  value={formDifficulty}
                  onChange={(e) => setFormDifficulty(e.target.value as 'EASY' | 'MEDIUM' | 'HARD')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Question Statement <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={formQuestionText}
                onChange={(e) => setFormQuestionText(e.target.value)}
                placeholder="Enter complete question statement, formulas, or scenario..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                required
              />
            </div>

            {/* Options Management by Question Type */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Answer & Options Specification
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formQuestionType === 'SINGLE' && '(Single correct: click radio for the verified answer)'}
                    {formQuestionType === 'MULTIPLE' && '(Multi correct: check all valid answers)'}
                    {formQuestionType === 'NUMERICAL' && '(Numerical: exact value / integer)'}
                  </span>
                </div>

                {formQuestionType !== 'NUMERICAL' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    className="border-slate-800 text-[11px] py-1 h-7 gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Option</span>
                  </Button>
                )}
              </div>

              {formQuestionType === 'NUMERICAL' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Correct Value / Integer Answer
                  </label>
                  <div className="flex items-center gap-2 max-w-sm">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={formNumericalAnswer}
                      onChange={(e) => setFormNumericalAnswer(e.target.value)}
                      placeholder="e.g. 42 or 3.14"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {formOptions.map((opt, idx) => {
                    const optionLetter = String.fromCharCode(65 + idx);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                          opt.is_correct
                            ? 'bg-emerald-950/20 border-emerald-800/60'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        {/* Toggle button */}
                        {formQuestionType === 'SINGLE' ? (
                          <button
                            type="button"
                            onClick={() => handleSingleCorrectSelect(idx)}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                              opt.is_correct
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                            title="Set as correct answer"
                          >
                            <Radio className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMultipleCorrectToggle(idx)}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                              opt.is_correct
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                            title="Toggle correct answer"
                          >
                            <CheckSquare className="w-4 h-4" />
                          </button>
                        )}

                        <span className="text-xs font-bold text-slate-400 w-4">{optionLetter}.</span>

                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${optionLetter} text`}
                          className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-0"
                          required
                        />

                        {opt.is_correct && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            CORRECT
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          title="Remove option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Solution & Video URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Detailed Solution Text (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formSolutionText}
                  onChange={(e) => setFormSolutionText(e.target.value)}
                  placeholder="Step-by-step derivation or reasoning..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Solution Video URL (Optional)
                </label>
                <input
                  type="url"
                  value={formSolutionVideoUrl}
                  onChange={(e) => setFormSolutionVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* PYQ Toggle & Fields */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasPYQ}
                  onChange={(e) => setHasPYQ(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
                />
                <span className="text-xs font-bold text-slate-300">
                  Tag as Previous Year Question (PYQ)
                </span>
              </label>

              {hasPYQ && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Exam <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={pyqExam}
                      onChange={(e) => setPyqExam(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required={hasPYQ}
                    >
                      <option value="">Select Exam...</option>
                      {optionsLookup.exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Year <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={pyqYear}
                      onChange={(e) => setPyqYear(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required={hasPYQ}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Shift / Paper
                    </label>
                    <input
                      type="text"
                      value={pyqShiftOrPaper}
                      onChange={(e) => setPyqShiftOrPaper(e.target.value)}
                      placeholder="e.g. Shift 1 or Paper 2"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                disabled={isSaving}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{editingId ? 'Update Question' : 'Save Question'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/60 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text or chapter..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Subjects</option>
              {optionsLookup.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterChapter}
              onChange={(e) => setFilterChapter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Chapters</option>
              {optionsLookup.chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Question Types</option>
              <option value="SINGLE">Single Choice</option>
              <option value="MULTIPLE">Multiple Choice</option>
              <option value="NUMERICAL">Numerical</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing {filteredQuestions.length} questions</span>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span>Loading question catalog...</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
            No questions match your selected criteria.
          </Card>
        ) : (
          filteredQuestions.map((q) => (
            <Card
              key={q.id}
              className="p-4 sm:p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="purple" className="border-indigo-800 text-indigo-300 font-mono text-[10px]">
                    {q.question_type}
                  </Badge>

                  <Badge
                    variant={
                      q.difficulty === 'EASY'
                        ? 'emerald'
                        : q.difficulty === 'MEDIUM'
                        ? 'amber'
                        : 'rose'
                    }
                    className="text-[10px]"
                  >
                    {q.difficulty}
                  </Badge>

                  {q.subject_name && (
                    <span className="text-xs font-semibold text-slate-300">
                      {q.subject_name}
                    </span>
                  )}
                  {q.chapter_name && (
                    <span className="text-xs text-slate-500">
                      &bull; {q.chapter_name}
                    </span>
                  )}

                  {q.pyq_meta && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      PYQ {q.pyq_meta.exam_name} {q.pyq_meta.year} {q.pyq_meta.shift_or_paper}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartEdit(q)}
                    className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(q)}
                    className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-red-400 hover:border-red-800/40"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-xs sm:text-sm text-slate-200 font-mono leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                {q.question_text}
              </div>

              {/* Options display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {q.options &&
                  q.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${
                        opt.is_correct
                          ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300 font-bold'
                          : 'bg-slate-950/50 border-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="w-4 text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                      <span className="truncate flex-1">{opt.option_text}</span>
                      {opt.is_correct && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                  ))}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Confirmation Dialog before Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-5 bg-slate-900 border-red-900/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Question</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg font-mono line-clamp-3">
              &quot;{deleteTarget.question_text}&quot;
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white border-none text-xs gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
