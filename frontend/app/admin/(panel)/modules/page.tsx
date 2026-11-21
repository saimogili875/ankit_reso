'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/auth/form-message';
import {
  FolderTree,
  BookOpen,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  FileQuestion,
} from 'lucide-react';

interface CategoryOption {
  id: number;
  name: string;
  subject_id: number;
  subject_name: string;
}

interface ClassOption {
  id: number;
  name: string;
  code: string;
}

interface ChapterItem {
  id: string;
  category: number;
  category_name?: string;
  subject_name?: string;
  academic_class?: number;
  academic_class_name?: string;
  name: string;
  slug: string;
  order: number;
  description: string;
  lectures_count: number;
  dpps_count: number;
  questions_count: number;
}

interface LectureItem {
  id: string;
  chapter: string;
  chapter_name?: string;
  subject_name?: string;
  lecture_number: number;
  title: string;
  slug: string;
  description: string;
  duration_seconds: number;
  is_published: boolean;
  order: number;
  video?: {
    id: string;
    title: string;
    video_source_type: string;
  } | null;
}

interface DPPItem {
  id: string;
  chapter: string;
  chapter_name?: string;
  subject_name?: string;
  dpp_number: number;
  title: string;
  description: string;
  duration_minutes: number;
  is_published: boolean;
  questions_count: number;
  dpp_questions?: {
    id: string;
    question: string;
    question_text: string;
    order: number;
  }[];
}

interface QuestionLookupItem {
  id: string;
  chapter?: string;
  question_text: string;
  question_type: string;
  difficulty: string;
}

interface CascadeInfo {
  chapter_id: string;
  name: string;
  lectures_count: number;
  dpps_count: number;
  questions_count: number;
}

interface DeleteItem {
  id: string;
  name?: string;
  title?: string;
}

type TabType = 'chapters' | 'lectures' | 'dpps';

export default function AdminModulesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('chapters');

  // Lookup data
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionLookupItem[]>([]);

  // Entities
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [dpps, setDpps] = useState<DPPItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: TabType; item: DeleteItem } | null>(null);
  const [cascadeInfo, setCascadeInfo] = useState<CascadeInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Forms open state
  const [isChapterFormOpen, setIsChapterFormOpen] = useState(false);
  const [isLectureFormOpen, setIsLectureFormOpen] = useState(false);
  const [isDPPFormOpen, setIsDPPFormOpen] = useState(false);

  // Chapter form state
  const [chapterEditId, setChapterEditId] = useState<string | null>(null);
  const [chapterCategory, setChapterCategory] = useState<string>('');
  const [chapterClass, setChapterClass] = useState<string>('');
  const [chapterName, setChapterName] = useState('');
  const [chapterOrder, setChapterOrder] = useState<number>(1);
  const [chapterDescription, setChapterDescription] = useState('');

  // Lecture form state
  const [lectureEditId, setLectureEditId] = useState<string | null>(null);
  const [lectureChapter, setLectureChapter] = useState<string>('');
  const [lectureNumber, setLectureNumber] = useState<number>(1);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDescription, setLectureDescription] = useState('');
  const [lectureDurationMins, setLectureDurationMins] = useState<number>(45);
  const [lecturePublished, setLecturePublished] = useState(true);
  const [lectureOrder, setLectureOrder] = useState<number>(1);

  // DPP form state
  const [dppEditId, setDppEditId] = useState<string | null>(null);
  const [dppChapter, setDppChapter] = useState<string>('');
  const [dppNumber, setDppNumber] = useState<number>(1);
  const [dppTitle, setDppTitle] = useState('');
  const [dppDescription, setDppDescription] = useState('');
  const [dppDurationMins, setDppDurationMins] = useState<number>(30);
  const [dppPublished, setDppPublished] = useState(true);
  const [dppSelectedQuestionIds, setDppSelectedQuestionIds] = useState<string[]>([]);
  const [dppQuestionSearch, setDppQuestionSearch] = useState('');

  // Fetch all modules data
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [optRes, chRes, lecRes, dppRes, qRes] = await Promise.all([
        apiClient.get<{ categories: CategoryOption[]; classes: ClassOption[] }>('/admin-panel/options/'),
        apiClient.get<{ results?: ChapterItem[] } | ChapterItem[]>('/admin-panel/chapters/'),
        apiClient.get<{ results?: LectureItem[] } | LectureItem[]>('/admin-panel/lectures/'),
        apiClient.get<{ results?: DPPItem[] } | DPPItem[]>('/admin-panel/dpps/'),
        apiClient.get<{ results?: QuestionLookupItem[] } | QuestionLookupItem[]>('/admin-panel/questions/'),
      ]);

      setCategories(optRes.categories || []);
      setClasses(optRes.classes || []);
      setChapters(asList<ChapterItem>(chRes));
      setLectures(asList<LectureItem>(lecRes));
      setDpps(asList<DPPItem>(dppRes));
      setAvailableQuestions(asList<QuestionLookupItem>(qRes));
    } catch (err: unknown) {
      console.error('[Admin Modules fetchAllData error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error fetching module data';
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Chapter Handlers
  const openNewChapter = () => {
    setChapterEditId(null);
    setChapterCategory(categories.length > 0 ? String(categories[0].id) : '');
    setChapterClass('');
    setChapterName('');
    setChapterOrder(chapters.length + 1);
    setChapterDescription('');
    setFormError('');
    setFormSuccess('');
    setIsChapterFormOpen(true);
  };

  const openEditChapter = (ch: ChapterItem) => {
    setChapterEditId(ch.id);
    setChapterCategory(String(ch.category));
    setChapterClass(ch.academic_class ? String(ch.academic_class) : '');
    setChapterName(ch.name);
    setChapterOrder(ch.order);
    setChapterDescription(ch.description || '');
    setFormError('');
    setFormSuccess('');
    setIsChapterFormOpen(true);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterName.trim() || !chapterCategory) {
      setFormError('Category and Chapter Name are required.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    setFormSuccess('');

    try {
      const payload: Record<string, unknown> = {
        category: Number(chapterCategory),
        academic_class: chapterClass ? Number(chapterClass) : null,
        name: chapterName.trim(),
        order: Number(chapterOrder),
        description: chapterDescription.trim(),
      };

      if (chapterEditId) {
        await apiClient.put(`/admin-panel/chapters/${chapterEditId}/`, payload);
        setFormSuccess('Chapter updated successfully!');
      } else {
        await apiClient.post('/admin-panel/chapters/', payload);
        setFormSuccess('Chapter created successfully!');
      }

      await fetchAllData();
      setTimeout(() => {
        setIsChapterFormOpen(false);
      }, 700);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save chapter.');
    } finally {
      setIsSaving(false);
    }
  };

  // Lecture Handlers
  const openNewLecture = () => {
    setLectureEditId(null);
    setLectureChapter(chapters.length > 0 ? chapters[0].id : '');
    setLectureNumber(lectures.length + 1);
    setLectureTitle('');
    setLectureDescription('');
    setLectureDurationMins(45);
    setLecturePublished(true);
    setLectureOrder(lectures.length + 1);
    setFormError('');
    setFormSuccess('');
    setIsLectureFormOpen(true);
  };

  const openEditLecture = (lec: LectureItem) => {
    setLectureEditId(lec.id);
    setLectureChapter(lec.chapter);
    setLectureNumber(lec.lecture_number);
    setLectureTitle(lec.title);
    setLectureDescription(lec.description || '');
    setLectureDurationMins(Math.round((lec.duration_seconds || 0) / 60) || 45);
    setLecturePublished(lec.is_published);
    setLectureOrder(lec.order);
    setFormError('');
    setFormSuccess('');
    setIsLectureFormOpen(true);
  };

  const handleSaveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim() || !lectureChapter) {
      setFormError('Chapter and Lecture Title are required.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    setFormSuccess('');

    try {
      const payload = {
        chapter: lectureChapter,
        lecture_number: Number(lectureNumber),
        title: lectureTitle.trim(),
        description: lectureDescription.trim(),
        duration_seconds: Math.max(0, Number(lectureDurationMins) * 60),
        is_published: lecturePublished,
        order: Number(lectureOrder),
      };

      if (lectureEditId) {
        await apiClient.put(`/admin-panel/lectures/${lectureEditId}/`, payload);
        setFormSuccess('Lecture updated successfully!');
      } else {
        await apiClient.post('/admin-panel/lectures/', payload);
        setFormSuccess('Lecture created successfully!');
      }

      await fetchAllData();
      setTimeout(() => {
        setIsLectureFormOpen(false);
      }, 700);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save lecture.');
    } finally {
      setIsSaving(false);
    }
  };

  // DPP Handlers
  const openNewDPP = () => {
    setDppEditId(null);
    setDppChapter(chapters.length > 0 ? chapters[0].id : '');
    setDppNumber(dpps.length + 1);
    setDppTitle('');
    setDppDescription('');
    setDppDurationMins(30);
    setDppPublished(true);
    setDppSelectedQuestionIds([]);
    setDppQuestionSearch('');
    setFormError('');
    setFormSuccess('');
    setIsDPPFormOpen(true);
  };

  const openEditDPP = (dpp: DPPItem) => {
    setDppEditId(dpp.id);
    setDppChapter(dpp.chapter);
    setDppNumber(dpp.dpp_number);
    setDppTitle(dpp.title);
    setDppDescription(dpp.description || '');
    setDppDurationMins(dpp.duration_minutes || 30);
    setDppPublished(dpp.is_published);
    const existingQIds = dpp.dpp_questions ? dpp.dpp_questions.map((q) => q.question) : [];
    setDppSelectedQuestionIds(existingQIds);
    setDppQuestionSearch('');
    setFormError('');
    setFormSuccess('');
    setIsDPPFormOpen(true);
  };

  const handleSaveDPP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dppTitle.trim() || !dppChapter) {
      setFormError('Chapter and DPP Title are required.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    setFormSuccess('');

    try {
      const payload = {
        chapter: dppChapter,
        dpp_number: Number(dppNumber),
        title: dppTitle.trim(),
        description: dppDescription.trim(),
        duration_minutes: Number(dppDurationMins),
        is_published: dppPublished,
        question_ids: dppSelectedQuestionIds,
      };

      if (dppEditId) {
        await apiClient.put(`/admin-panel/dpps/${dppEditId}/`, payload);
        setFormSuccess('DPP updated successfully!');
      } else {
        await apiClient.post('/admin-panel/dpps/', payload);
        setFormSuccess('DPP question module created successfully!');
      }

      await fetchAllData();
      setTimeout(() => {
        setIsDPPFormOpen(false);
      }, 700);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save DPP module.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDPPQuestion = (qId: string) => {
    if (dppSelectedQuestionIds.includes(qId)) {
      setDppSelectedQuestionIds(dppSelectedQuestionIds.filter((id) => id !== qId));
    } else {
      setDppSelectedQuestionIds([...dppSelectedQuestionIds, qId]);
    }
  };

  // Delete Handlers with Parent Cascade Confirmation
  const startDelete = async (type: TabType, item: DeleteItem) => {
    setDeleteTarget({ type, item });
    setCascadeInfo(null);

    if (type === 'chapters') {
      try {
        const info = await apiClient.get<CascadeInfo>(`/admin-panel/chapters/${item.id}/cascade_info/`);
        setCascadeInfo(info);
      } catch {
        // Fallback to item counts
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const endpoint =
        deleteTarget.type === 'chapters'
          ? `/admin-panel/chapters/${deleteTarget.item.id}/`
          : deleteTarget.type === 'lectures'
          ? `/admin-panel/lectures/${deleteTarget.item.id}/`
          : `/admin-panel/dpps/${deleteTarget.item.id}/`;

      await apiClient.delete(endpoint);
      await fetchAllData();
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-400" />
            <span>Curriculum Modules</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Manage Chapters, sequence video Lectures, and structure daily practice sets (DPPs).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'chapters' && !isChapterFormOpen && (
            <Button
              variant="primary"
              size="sm"
              onClick={openNewChapter}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Chapter</span>
            </Button>
          )}

          {activeTab === 'lectures' && !isLectureFormOpen && (
            <Button
              variant="primary"
              size="sm"
              onClick={openNewLecture}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lecture</span>
            </Button>
          )}

          {activeTab === 'dpps' && !isDPPFormOpen && (
            <Button
              variant="primary"
              size="sm"
              onClick={openNewDPP}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add DPP</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('chapters')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'chapters'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Chapters ({chapters.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lectures')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'lectures'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Lectures ({lectures.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dpps')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'dpps'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Question Sets / DPPs ({dpps.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {(formError || formSuccess) && (
        <div>
          <FormMessage type="error" message={formError} />
          <FormMessage type="success" message={formSuccess} />
        </div>
      )}

      {/* CHAPTER FORM */}
      {activeTab === 'chapters' && isChapterFormOpen && (
        <Card className="p-5 bg-slate-900 border-indigo-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{chapterEditId ? 'Edit Chapter Module' : 'Create New Chapter Module'}</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsChapterFormOpen(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveChapter} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={chapterCategory}
                  onChange={(e) => setChapterCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      [{cat.subject_name}] {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Academic Class
                </label>
                <select
                  value={chapterClass}
                  onChange={(e) => setChapterClass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">General / Both Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Order Index
                </label>
                <input
                  type="number"
                  value={chapterOrder}
                  onChange={(e) => setChapterOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Chapter Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="e.g. Kinematics in One Dimension"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                URL slug will be generated automatically.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description / Syllabus Overview
              </label>
              <textarea
                rows={2}
                value={chapterDescription}
                onChange={(e) => setChapterDescription(e.target.value)}
                placeholder="Outline syllabus concepts covered in this module..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsChapterFormOpen(false)}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{chapterEditId ? 'Update Chapter' : 'Save Chapter'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* LECTURE FORM */}
      {activeTab === 'lectures' && isLectureFormOpen && (
        <Card className="p-5 bg-slate-900 border-indigo-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{lectureEditId ? 'Edit Lecture' : 'Create New Video Lecture'}</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsLectureFormOpen(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveLecture} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Parent Chapter <span className="text-red-400">*</span>
                </label>
                <select
                  value={lectureChapter}
                  onChange={(e) => setLectureChapter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Chapter...</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lecture Number
                </label>
                <input
                  type="number"
                  value={lectureNumber}
                  onChange={(e) => setLectureNumber(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={lectureDurationMins}
                  onChange={(e) => setLectureDurationMins(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lecture Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                placeholder="e.g. Lecture 01: Reference Frames and Position Vectors"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lecture Notes / Summary
              </label>
              <textarea
                rows={2}
                value={lectureDescription}
                onChange={(e) => setLectureDescription(e.target.value)}
                placeholder="Summary of topics explained in this session..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="lecture-publish"
                checked={lecturePublished}
                onChange={(e) => setLecturePublished(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="lecture-publish" className="text-xs font-medium text-slate-300 cursor-pointer">
                Publish lecture immediately (visible to enrolled students)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLectureFormOpen(false)}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{lectureEditId ? 'Update Lecture' : 'Save Lecture'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* DPP FORM */}
      {activeTab === 'dpps' && isDPPFormOpen && (
        <Card className="p-5 bg-slate-900 border-indigo-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{dppEditId ? 'Edit DPP Question Module' : 'Create New DPP Question Module'}</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsDPPFormOpen(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveDPP} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Chapter <span className="text-red-400">*</span>
                </label>
                <select
                  value={dppChapter}
                  onChange={(e) => setDppChapter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Chapter...</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  DPP Number
                </label>
                <input
                  type="number"
                  value={dppNumber}
                  onChange={(e) => setDppNumber(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={dppDurationMins}
                  onChange={(e) => setDppDurationMins(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                DPP Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={dppTitle}
                onChange={(e) => setDppTitle(e.target.value)}
                placeholder="e.g. Kinematics Practice Sheet 01 (Calculus & Graph Analysis)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Question Picker Section */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <FileQuestion className="w-4 h-4" />
                    <span>Included Questions ({dppSelectedQuestionIds.length} Selected)</span>
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Questions are sequenced and scored with standard JEE markings (+4 correct, -1 negative).
                  </p>
                </div>

                <div className="relative max-w-xs w-full">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    value={dppQuestionSearch}
                    onChange={(e) => setDppQuestionSearch(e.target.value)}
                    placeholder="Search question pool..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Scrollable list of selectable questions */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {availableQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    No questions available in the repository. Create questions first.
                  </p>
                ) : (
                  availableQuestions
                    .filter((q) =>
                      dppQuestionSearch
                        ? q.question_text.toLowerCase().includes(dppQuestionSearch.toLowerCase())
                        : true
                    )
                    .map((q) => {
                      const isSelected = dppSelectedQuestionIds.includes(q.id);
                      const orderIndex = isSelected ? dppSelectedQuestionIds.indexOf(q.id) + 1 : null;

                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleDPPQuestion(q.id)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer select-none transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/30 border-indigo-700/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                          />

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {orderIndex}
                            </span>
                          )}

                          <Badge variant="slate" className="text-[10px] border-slate-800 shrink-0 font-mono">
                            {q.question_type}
                          </Badge>

                          <span className="text-xs font-mono truncate flex-1">
                            {q.question_text}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDPPFormOpen(false)}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{dppEditId ? 'Update DPP' : 'Save DPP'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* LIST CONTENT PER ACTIVE TAB */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Loading module directory...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: CHAPTERS LIST */}
          {activeTab === 'chapters' && (
            <div className="space-y-3">
              {chapters.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
                  No chapters defined. Click &quot;Add Chapter&quot; above to create your first curriculum module.
                </Card>
              ) : (
                chapters.map((ch) => (
                  <Card
                    key={ch.id}
                    className="p-4 sm:p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
                          {ch.order}
                        </span>
                        <h3 className="text-sm font-bold text-white">{ch.name}</h3>
                        {ch.subject_name && (
                          <Badge variant="blue" className="border-blue-900 text-blue-300 text-[10px]">
                            {ch.subject_name}
                          </Badge>
                        )}
                        {ch.academic_class_name && (
                          <Badge variant="slate" className="border-slate-800 text-slate-400 text-[10px]">
                            {ch.academic_class_name}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditChapter(ch)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startDelete('chapters', ch)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-red-400 hover:border-red-800/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    {ch.description && (
                      <p className="text-xs text-slate-400 font-sans">{ch.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Lectures: <b className="text-white">{ch.lectures_count || 0}</b></span>
                      <span>DPPs: <b className="text-white">{ch.dpps_count || 0}</b></span>
                      <span>Questions: <b className="text-white">{ch.questions_count || 0}</b></span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* TAB 2: LECTURES LIST */}
          {activeTab === 'lectures' && (
            <div className="space-y-3">
              {lectures.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
                  No lectures configured. Click &quot;Add Lecture&quot; to sequence syllabus lessons.
                </Card>
              ) : (
                lectures.map((lec) => (
                  <Card
                    key={lec.id}
                    className="p-4 sm:p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
                          #{lec.lecture_number}
                        </span>
                        <h3 className="text-sm font-bold text-white">{lec.title}</h3>
                        {lec.chapter_name && (
                          <span className="text-xs text-slate-500 font-medium">
                            &bull; {lec.chapter_name}
                          </span>
                        )}
                        <Badge
                          variant={lec.is_published ? 'emerald' : 'slate'}
                          className="text-[10px]"
                        >
                          {lec.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditLecture(lec)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startDelete('lectures', lec)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-red-400 hover:border-red-800/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                      <span>Duration: {Math.round(lec.duration_seconds / 60)} mins</span>
                      {lec.video ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Video Linked ({lec.video.video_source_type})
                        </span>
                      ) : (
                        <span className="text-amber-400">No video mapped yet</span>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* TAB 3: DPPS LIST */}
          {activeTab === 'dpps' && (
            <div className="space-y-3">
              {dpps.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
                  No DPPs defined. Click &quot;Add DPP&quot; to build practice problem modules.
                </Card>
              ) : (
                dpps.map((dpp) => (
                  <Card
                    key={dpp.id}
                    className="p-4 sm:p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded bg-indigo-950 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-800">
                          #{dpp.dpp_number}
                        </span>
                        <h3 className="text-sm font-bold text-white">{dpp.title}</h3>
                        {dpp.chapter_name && (
                          <span className="text-xs text-slate-500 font-medium">
                            &bull; {dpp.chapter_name}
                          </span>
                        )}
                        <Badge
                          variant={dpp.is_published ? 'emerald' : 'slate'}
                          className="text-[10px]"
                        >
                          {dpp.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDPP(dpp)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startDelete('dpps', dpp)}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-red-400 hover:border-red-800/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>Questions: <b className="text-white">{dpp.questions_count || 0}</b></span>
                      <span>Target Time: {dpp.duration_minutes} mins</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* CONFIRMATION MODAL WITH CASCADE CHECK */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-5 bg-slate-900 border-red-900/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Confirm Deletion ({deleteTarget.type.slice(0, -1)})
                </h3>
                <p className="text-xs text-slate-400">This action will permanently delete this record.</p>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-200 bg-slate-950 p-3 rounded-lg">
              {deleteTarget.item.name || deleteTarget.item.title}
            </p>

            {/* Cascade Information Warning */}
            {deleteTarget.type === 'chapters' && cascadeInfo && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/60 text-xs text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Cascade Impact Warning:</span>
                </p>
                <p>
                  Deleting this chapter will also permanently remove:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1">
                  <li><b>{cascadeInfo.lectures_count}</b> Lectures</li>
                  <li><b>{cascadeInfo.dpps_count}</b> Practice DPPs</li>
                  <li><b>{cascadeInfo.questions_count}</b> Question assignments</li>
                </ul>
              </div>
            )}

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
                onClick={handleConfirmDelete}
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
