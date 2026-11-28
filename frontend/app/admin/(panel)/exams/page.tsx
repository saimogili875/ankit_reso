'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import {
  Layers,
  GraduationCap,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ExamItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  is_active: boolean;
  classes_count: number;
  courses_count: number;
  created_at: string;
}

interface AcademicClassItem {
  id: number;
  exam: string;
  exam_name?: string;
  name: string;
  slug: string;
  code: string;
  order: number;
  subjects_count: number;
  created_at: string;
}

interface SubjectItem {
  id: number;
  academic_class: number;
  class_name?: string;
  exam_name?: string;
  subject_label?: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  is_active: boolean;
  chapters_count: number;
}

interface CascadeInfoData {
  id: string | number;
  name?: string;
  classes_count?: number;
  courses_count?: number;
  subjects_count?: number;
  chapters_count?: number;
  materials_count?: number;
  questions_count?: number;
  events_count?: number;
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const [classes, setClasses] = useState<AcademicClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Exam Modal
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examEditId, setExamEditId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    name: '',
    slug: '',
    description: '',
    order: 0,
    is_active: true,
  });

  // Class Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classEditId, setClassEditId] = useState<number | null>(null);
  const [classForm, setClassForm] = useState({
    exam: '',
    name: '',
    slug: '',
    code: '',
    order: 0,
  });

  // Subject Modal
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectEditId, setSubjectEditId] = useState<number | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    academic_class: 0,
    name: '',
    slug: '',
    description: '',
    order: 0,
    is_active: true,
  });

  // Cascade Deletion Warning Dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'exam' | 'class' | 'subject';
    id: string | number;
    name: string;
  } | null>(null);
  const [cascadeInfo, setCascadeInfo] = useState<CascadeInfoData | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch Exams
  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<ExamItem[] | { results: ExamItem[] }>('/admin-panel/exams/');
      const items = asList<ExamItem>(res);
      setExams(items);
      if (items.length > 0 && !selectedExamId) {
        setSelectedExamId(items[0].id);
      }
    } catch (err: unknown) {
      console.error('[AdminExams] fetchExams error:', err);
      setErrorMsg('Failed to load exams list.');
    } finally {
      setLoading(false);
    }
  }, [selectedExamId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // 2. Fetch Classes for selected Exam
  const fetchClasses = useCallback(async (examId: string) => {
    try {
      setLoadingClasses(true);
      const res = await apiClient.get<AcademicClassItem[] | { results: AcademicClassItem[] }>(
        `/admin-panel/classes/?exam=${examId}`
      );
      const items = asList<AcademicClassItem>(res);
      setClasses(items);
      if (items.length > 0) {
        setSelectedClassId(items[0].id);
      } else {
        setSelectedClassId(null);
        setSubjects([]);
      }
    } catch (err: unknown) {
      console.error('[AdminExams] fetchClasses error:', err);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchClasses(selectedExamId);
    } else {
      setClasses([]);
      setSelectedClassId(null);
    }
  }, [selectedExamId, fetchClasses]);

  // 3. Fetch Subjects for selected Class
  const fetchSubjects = useCallback(async (classId: number) => {
    try {
      setLoadingSubjects(true);
      const res = await apiClient.get<SubjectItem[] | { results: SubjectItem[] }>(
        `/admin-panel/subjects/?class=${classId}`
      );
      const items = asList<SubjectItem>(res);
      setSubjects(items);
    } catch (err: unknown) {
      console.error('[AdminExams] fetchSubjects error:', err);
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchSubjects(selectedClassId);
    } else {
      setSubjects([]);
    }
  }, [selectedClassId, fetchSubjects]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg, errorMsg]);

  // Exam Form Actions
  const openCreateExam = () => {
    setExamEditId(null);
    setExamForm({
      name: '',
      slug: '',
      description: '',
      order: exams.length,
      is_active: true,
    });
    setIsExamModalOpen(true);
  };

  const openEditExam = (exam: ExamItem) => {
    setExamEditId(exam.id);
    setExamForm({
      name: exam.name,
      slug: exam.slug,
      description: exam.description || '',
      order: exam.order || 0,
      is_active: exam.is_active,
    });
    setIsExamModalOpen(true);
  };

  const saveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.name.trim()) {
      setErrorMsg('Exam name is required.');
      return;
    }
    setIsSaving(true);
    try {
      if (examEditId) {
        await apiClient.put(`/admin-panel/exams/${examEditId}/`, examForm);
        setSuccessMsg(`Exam "${examForm.name}" updated successfully.`);
      } else {
        const created = await apiClient.post<ExamItem>('/admin-panel/exams/', examForm);
        setSuccessMsg(`Exam "${examForm.name}" created.`);
        if (created?.id) setSelectedExamId(created.id);
      }
      setIsExamModalOpen(false);
      fetchExams();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save exam.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Class Form Actions
  const openCreateClass = () => {
    if (!selectedExamId) {
      setErrorMsg('Please select or create an Exam first.');
      return;
    }
    setClassEditId(null);
    setClassForm({
      exam: selectedExamId,
      name: '',
      slug: '',
      code: '',
      order: classes.length,
    });
    setIsClassModalOpen(true);
  };

  const openEditClass = (cls: AcademicClassItem) => {
    setClassEditId(cls.id);
    setClassForm({
      exam: cls.exam,
      name: cls.name,
      slug: cls.slug,
      code: cls.code,
      order: cls.order || 0,
    });
    setIsClassModalOpen(true);
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim() || !classForm.code.trim()) {
      setErrorMsg('Class name and code are required.');
      return;
    }
    setIsSaving(true);
    try {
      if (classEditId) {
        await apiClient.put(`/admin-panel/classes/${classEditId}/`, classForm);
        setSuccessMsg(`Class "${classForm.name}" updated.`);
      } else {
        const created = await apiClient.post<AcademicClassItem>('/admin-panel/classes/', classForm);
        setSuccessMsg(`Class "${classForm.name}" created under exam.`);
        if (created?.id) setSelectedClassId(created.id);
      }
      setIsClassModalOpen(false);
      if (selectedExamId) fetchClasses(selectedExamId);
      fetchExams();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save academic class.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Subject Form Actions
  const openCreateSubject = () => {
    if (!selectedClassId) {
      setErrorMsg('Please select or create an Academic Class first.');
      return;
    }
    setSubjectEditId(null);
    setSubjectForm({
      academic_class: selectedClassId,
      name: '',
      slug: '',
      description: '',
      order: subjects.length,
      is_active: true,
    });
    setIsSubjectModalOpen(true);
  };

  const openEditSubject = (sub: SubjectItem) => {
    setSubjectEditId(sub.id);
    setSubjectForm({
      academic_class: sub.academic_class,
      name: sub.name,
      slug: sub.slug,
      description: sub.description || '',
      order: sub.order || 0,
      is_active: sub.is_active,
    });
    setIsSubjectModalOpen(true);
  };

  const saveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) {
      setErrorMsg('Subject name is required.');
      return;
    }
    setIsSaving(true);
    try {
      if (subjectEditId) {
        await apiClient.put(`/admin-panel/subjects/${subjectEditId}/`, subjectForm);
        setSuccessMsg(`Subject "${subjectForm.name}" updated.`);
      } else {
        await apiClient.post('/admin-panel/subjects/', subjectForm);
        setSuccessMsg(`Subject "${subjectForm.name}" created.`);
      }
      setIsSubjectModalOpen(false);
      if (selectedClassId) fetchSubjects(selectedClassId);
      if (selectedExamId) fetchClasses(selectedExamId);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save subject.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Cascade Delete Initiation
  const startDelete = async (type: 'exam' | 'class' | 'subject', id: string | number, name: string) => {
    setDeleteTarget({ type, id, name });
    setConfirmInput('');
    setCascadeInfo(null);
    try {
      const endpoint =
        type === 'exam'
          ? `/admin-panel/exams/${id}/cascade_info/`
          : type === 'class'
          ? `/admin-panel/classes/${id}/cascade_info/`
          : `/admin-panel/subjects/${id}/cascade_info/`;
      const info = await apiClient.get<CascadeInfoData>(endpoint);
      setCascadeInfo(info);
    } catch (err) {
      console.warn('Could not fetch cascade info:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === 'exam'
          ? `/admin-panel/exams/${deleteTarget.id}/?confirm=true`
          : deleteTarget.type === 'class'
          ? `/admin-panel/classes/${deleteTarget.id}/?confirm=true`
          : `/admin-panel/subjects/${deleteTarget.id}/?confirm=true`;
      await apiClient.delete(endpoint);
      setSuccessMsg(`Deleted ${deleteTarget.type} "${deleteTarget.name}".`);

      if (deleteTarget.type === 'exam') {
        if (selectedExamId === deleteTarget.id) setSelectedExamId(null);
        fetchExams();
      } else if (deleteTarget.type === 'class') {
        if (selectedClassId === deleteTarget.id) setSelectedClassId(null);
        if (selectedExamId) fetchClasses(selectedExamId);
      } else {
        if (selectedClassId) fetchSubjects(selectedClassId);
      }
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete entity.';
      setErrorMsg(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <Layers className="w-6 h-6 text-amber-400" />
            Exams & Academic Hierarchy
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic, admin-driven academic structure: <span className="text-amber-300 font-medium">Exam</span> →{' '}
            <span className="text-cyan-300 font-medium">Class</span> →{' '}
            <span className="text-emerald-300 font-medium">Subject</span> →{' '}
            <span className="text-purple-300 font-medium">Chapter</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openCreateExam}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Exam
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-sm text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 3-Column Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. Exams Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" /> 1. Exams ({exams.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateExam}
              className="h-7 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Plus className="w-3 h-3 mr-1" /> New Exam
            </Button>
          </div>

          {loading ? (
            <Card className="p-8 flex items-center justify-center bg-slate-900/60 border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </Card>
          ) : exams.length === 0 ? (
            <Card className="p-6 text-center bg-slate-900/40 border-dashed border-slate-800 text-slate-400 text-sm">
              No exams found. Click &quot;Add Exam&quot; to create your first exam (e.g. JEE Main, NEET).
            </Card>
          ) : (
            <div className="space-y-2">
              {exams.map((exam) => {
                const isSelected = exam.id === selectedExamId;
                return (
                  <div
                    key={exam.id}
                    onClick={() => setSelectedExamId(exam.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{exam.name}</span>
                        {!exam.is_active && (
                          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500 py-0">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>slug: {exam.slug}</span>
                        <span>•</span>
                        <span className="text-amber-300/90 font-medium">
                          {exam.classes_count} {exam.classes_count === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title="Edit Exam"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditExam(exam);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Exam"
                        onClick={(e) => {
                          e.stopPropagation();
                          startDelete('exam', exam.id, exam.name);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 ml-1 transition-transform ${
                          isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Classes Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> 2. Classes {selectedExam && `in ${selectedExam.name}`} ({classes.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedExamId}
              onClick={openCreateClass}
              className="h-7 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            >
              <Plus className="w-3 h-3 mr-1" /> New Class
            </Button>
          </div>

          {loadingClasses ? (
            <Card className="p-8 flex items-center justify-center bg-slate-900/60 border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </Card>
          ) : !selectedExamId ? (
            <Card className="p-6 text-center bg-slate-900/40 border-dashed border-slate-800 text-slate-500 text-sm">
              Select an exam on the left to view and manage its academic classes.
            </Card>
          ) : classes.length === 0 ? (
            <Card className="p-6 text-center bg-slate-900/40 border-dashed border-slate-800 text-slate-400 text-sm">
              No classes under <span className="text-white font-medium">{selectedExam?.name}</span>. Click &quot;New Class&quot; to add one (e.g. Class 11, Class 12, Dropper).
            </Card>
          ) : (
            <div className="space-y-2">
              {classes.map((cls) => {
                const isSelected = cls.id === selectedClassId;
                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{cls.name}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px] py-0 border-slate-700">
                          {cls.code}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="text-cyan-300/90 font-medium">
                          {cls.subjects_count} {cls.subjects_count === 1 ? 'subject' : 'subjects'}
                        </span>
                        <span>•</span>
                        <span>order: {cls.order}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title="Edit Class"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditClass(cls);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Class"
                        onClick={(e) => {
                          e.stopPropagation();
                          startDelete('class', cls.id, cls.name);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 ml-1 transition-transform ${
                          isSelected ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Subjects Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> 3. Subjects {selectedClass && `in ${selectedClass.name}`} ({subjects.length})
            </h2>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedClassId}
              onClick={openCreateSubject}
              className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
            >
              <Plus className="w-3 h-3 mr-1" /> New Subject
            </Button>
          </div>

          {loadingSubjects ? (
            <Card className="p-8 flex items-center justify-center bg-slate-900/60 border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </Card>
          ) : !selectedClassId ? (
            <Card className="p-6 text-center bg-slate-900/40 border-dashed border-slate-800 text-slate-500 text-sm">
              Select an academic class above to view its isolated subjects.
            </Card>
          ) : subjects.length === 0 ? (
            <Card className="p-6 text-center bg-slate-900/40 border-dashed border-slate-800 text-slate-400 text-sm">
              No subjects under <span className="text-white font-medium">{selectedClass?.name}</span>. Click &quot;New Subject&quot; to add Physics, Chemistry, etc.
            </Card>
          ) : (
            <div className="space-y-2">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-xl border bg-slate-900/70 border-slate-800/80 hover:border-slate-700 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm truncate">{sub.name}</span>
                      {!sub.is_active && (
                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500 py-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="text-emerald-300/90 font-medium">
                        {sub.chapters_count} {sub.chapters_count === 1 ? 'chapter' : 'chapters'}
                      </span>
                      <span>•</span>
                      <span>slug: {sub.slug}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      title="Edit Subject"
                      onClick={() => openEditSubject(sub)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete Subject"
                      onClick={() => startDelete('subject', sub.id, sub.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Exam Form */}
      {isExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-slate-950 border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                {examEditId ? 'Edit Exam' : 'Create New Exam'}
              </h3>
              <button
                onClick={() => setIsExamModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Exam Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JEE Main, NEET UG, CBSE Board"
                  value={examForm.name}
                  onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  URL Slug (Optional, auto-generated from name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. jee-main"
                  value={examForm.slug}
                  onChange={(e) => setExamForm({ ...examForm, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short description of the competitive or board exam"
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Order</label>
                  <input
                    type="number"
                    value={examForm.order}
                    onChange={(e) => setExamForm({ ...examForm, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={examForm.is_active}
                      onChange={(e) => setExamForm({ ...examForm, is_active: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-900"
                    />
                    <span className="text-xs text-slate-300 font-medium">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExamModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {examEditId ? 'Update Exam' : 'Create Exam'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Class Form */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-slate-950 border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                {classEditId ? 'Edit Academic Class' : 'Create Academic Class'}
              </h3>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Parent Exam</label>
                <select
                  value={classForm.exam}
                  onChange={(e) => setClassForm({ ...classForm, exam: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Class Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 11, Class 12, Dropper"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Class Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11, 12, DROPPER"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Order</label>
                  <input
                    type="number"
                    value={classForm.order}
                    onChange={(e) => setClassForm({ ...classForm, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  URL Slug (Optional, auto-generated from name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. class-11"
                  value={classForm.slug}
                  onChange={(e) => setClassForm({ ...classForm, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsClassModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {classEditId ? 'Update Class' : 'Create Class'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Subject Form */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-slate-950 border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                {subjectEditId ? 'Edit Subject' : 'Create Subject'}
              </h3>
              <button
                onClick={() => setIsSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Parent Academic Class</label>
                <select
                  value={subjectForm.academic_class}
                  onChange={(e) => setSubjectForm({ ...subjectForm, academic_class: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Subject Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics, Mathematics, Chemistry"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  URL Slug (Optional, auto-generated from name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. physics"
                  value={subjectForm.slug}
                  onChange={(e) => setSubjectForm({ ...subjectForm, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Subject syllabus description"
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Order</label>
                  <input
                    type="number"
                    value={subjectForm.order}
                    onChange={(e) => setSubjectForm({ ...subjectForm, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={subjectForm.is_active}
                      onChange={(e) => setSubjectForm({ ...subjectForm, is_active: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 bg-slate-900"
                    />
                    <span className="text-xs text-slate-300 font-medium">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {subjectEditId ? 'Update Subject' : 'Create Subject'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CASCADE DELETE DIALOG */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg bg-slate-950 border-rose-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-slate-800">
              <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  Confirm Deletion of {deleteTarget.type.toUpperCase()}: &quot;{deleteTarget.name}&quot;
                </h3>
                <p className="text-xs text-rose-300">
                  Data-integrity safeguard prevents accidental loss of academic data.
                </p>
              </div>
            </div>

            {cascadeInfo && (
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-300">Cascading Deletion Impact Summary:</div>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  {cascadeInfo.classes_count !== undefined && (
                    <div>Classes: <span className="font-bold text-white">{cascadeInfo.classes_count}</span></div>
                  )}
                  {cascadeInfo.courses_count !== undefined && (
                    <div>Courses: <span className="font-bold text-white">{cascadeInfo.courses_count}</span></div>
                  )}
                  {cascadeInfo.subjects_count !== undefined && (
                    <div>Subjects: <span className="font-bold text-white">{cascadeInfo.subjects_count}</span></div>
                  )}
                  {cascadeInfo.chapters_count !== undefined && (
                    <div>Chapters: <span className="font-bold text-white">{cascadeInfo.chapters_count}</span></div>
                  )}
                  {cascadeInfo.questions_count !== undefined && (
                    <div>Questions: <span className="font-bold text-white">{cascadeInfo.questions_count}</span></div>
                  )}
                  {cascadeInfo.materials_count !== undefined && (
                    <div>Study Materials: <span className="font-bold text-white">{cascadeInfo.materials_count}</span></div>
                  )}
                </div>
                <p className="text-[11px] text-amber-300 pt-1">
                  ⚠️ Deleting this entity will permanently delete or orphan all child academic content listed above.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Type <span className="font-bold text-white select-all">DELETE</span> to confirm permanent deletion:
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={confirmInput.trim().toUpperCase() !== 'DELETE' || isDeleting}
                onClick={confirmDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-40"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Permanently Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
