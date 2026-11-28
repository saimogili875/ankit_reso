'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

export interface AcademicTreeExam {
  id: string;
  name: string;
  slug: string;
}

export interface AcademicTreeClass {
  id: number;
  name: string;
  code: string;
  exam_id?: string;
  exam_name?: string;
}

export interface AcademicTreeSubject {
  id: number;
  name: string;
  slug: string;
  academic_class_id?: number;
  class_name?: string;
  exam_id?: string;
  exam_name?: string;
  subject_label?: string;
}

export interface AcademicTreeChapter {
  id: string;
  name: string;
  slug: string;
  subject_id?: number;
  subject_name?: string;
  subject_label?: string;
}

export interface AcademicPickerOptions {
  exams: AcademicTreeExam[];
  classes: AcademicTreeClass[];
  subjects: AcademicTreeSubject[];
  chapters: AcademicTreeChapter[];
}

export interface AcademicPickerValues {
  examId?: string;
  classId?: number;
  subjectId?: number;
  chapterId?: string;
}

export interface AcademicPickerProps {
  examId?: string;
  classId?: number | string;
  subjectId?: number | string;
  chapterId?: string;
  onChange: (values: AcademicPickerValues) => void;
  levels?: ('exam' | 'class' | 'subject' | 'chapter')[];
  requiredLevels?: ('exam' | 'class' | 'subject' | 'chapter')[];
  layout?: 'grid' | 'inline' | 'stacked';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
}

export function AcademicPicker({
  examId,
  classId,
  subjectId,
  chapterId,
  onChange,
  levels = ['exam', 'class', 'subject', 'chapter'],
  requiredLevels = [],
  layout = 'grid',
  size = 'md',
  disabled = false,
  className = '',
  selectClassName = '',
  labelClassName = '',
}: AcademicPickerProps) {
  const [options, setOptions] = useState<AcademicPickerOptions>({
    exams: [],
    classes: [],
    subjects: [],
    chapters: [],
  });
  const [loading, setLoading] = useState(true);

  // Normalized internal string IDs for selects
  const currentExamId = examId ? String(examId) : '';
  const currentClassId = classId ? String(classId) : '';
  const currentSubjectId = subjectId ? String(subjectId) : '';
  const currentChapterId = chapterId ? String(chapterId) : '';

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        setLoading(true);
        const data = await apiClient.get<AcademicPickerOptions>('/admin-panel/options/');
        if (active && data) {
          setOptions({
            exams: data.exams || [],
            classes: data.classes || [],
            subjects: data.subjects || [],
            chapters: data.chapters || [],
          });
        }
      } catch (err) {
        console.error('[AcademicPicker] Failed to fetch options:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  // Filtered classes based on selected exam
  const filteredClasses = useMemo(() => {
    if (!currentExamId) return options.classes;
    return options.classes.filter((c) => String(c.exam_id) === currentExamId);
  }, [options.classes, currentExamId]);

  // Filtered subjects based on selected class or selected exam
  const filteredSubjects = useMemo(() => {
    if (currentClassId) {
      return options.subjects.filter((s) => String(s.academic_class_id) === currentClassId);
    }
    if (currentExamId) {
      return options.subjects.filter((s) => String(s.exam_id) === currentExamId);
    }
    return options.subjects;
  }, [options.subjects, currentClassId, currentExamId]);

  // Filtered chapters based on selected subject
  const filteredChapters = useMemo(() => {
    if (currentSubjectId) {
      return options.chapters.filter((ch) => String(ch.subject_id) === currentSubjectId);
    }
    return options.chapters;
  }, [options.chapters, currentSubjectId]);

  // Handle Exam change: cascading clear class, subject, chapter
  const handleExamChange = (newExamId: string) => {
    onChange({
      examId: newExamId || undefined,
      classId: undefined,
      subjectId: undefined,
      chapterId: undefined,
    });
  };

  // Handle Class change: cascading clear subject, chapter
  const handleClassChange = (newClassIdStr: string) => {
    const newClassId = newClassIdStr ? Number(newClassIdStr) : undefined;
    // Auto-detect exam if not set
    let inferredExamId = currentExamId;
    if (newClassId) {
      const cls = options.classes.find((c) => c.id === newClassId);
      if (cls?.exam_id && !inferredExamId) {
        inferredExamId = String(cls.exam_id);
      }
    }
    onChange({
      examId: inferredExamId || undefined,
      classId: newClassId,
      subjectId: undefined,
      chapterId: undefined,
    });
  };

  // Handle Subject change: cascading clear chapter
  const handleSubjectChange = (newSubjectIdStr: string) => {
    const newSubjectId = newSubjectIdStr ? Number(newSubjectIdStr) : undefined;
    let inferredClassId = currentClassId ? Number(currentClassId) : undefined;
    let inferredExamId = currentExamId;
    if (newSubjectId) {
      const sub = options.subjects.find((s) => s.id === newSubjectId);
      if (sub?.academic_class_id && !inferredClassId) {
        inferredClassId = sub.academic_class_id;
      }
      if (sub?.exam_id && !inferredExamId) {
        inferredExamId = String(sub.exam_id);
      }
    }
    onChange({
      examId: inferredExamId || undefined,
      classId: inferredClassId,
      subjectId: newSubjectId,
      chapterId: undefined,
    });
  };

  // Handle Chapter change
  const handleChapterChange = (newChapterId: string) => {
    let inferredSubId = currentSubjectId ? Number(currentSubjectId) : undefined;
    let inferredClassId = currentClassId ? Number(currentClassId) : undefined;
    let inferredExamId = currentExamId;

    if (newChapterId && !inferredSubId) {
      const chap = options.chapters.find((ch) => ch.id === newChapterId);
      if (chap?.subject_id) {
        inferredSubId = chap.subject_id;
        const sub = options.subjects.find((s) => s.id === inferredSubId);
        if (sub?.academic_class_id && !inferredClassId) inferredClassId = sub.academic_class_id;
        if (sub?.exam_id && !inferredExamId) inferredExamId = String(sub.exam_id);
      }
    }

    onChange({
      examId: inferredExamId || undefined,
      classId: inferredClassId,
      subjectId: inferredSubId,
      chapterId: newChapterId || undefined,
    });
  };

  const defaultSelectClass = size === 'sm'
    ? 'w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50'
    : 'w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50';

  const defaultLabelClass = 'block text-xs font-semibold text-slate-400 mb-1 tracking-wide uppercase';

  const layoutClass = layout === 'grid'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'
    : layout === 'inline'
    ? 'flex flex-wrap items-center gap-3'
    : 'space-y-3';

  if (loading && options.exams.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span>Loading academic structure...</span>
      </div>
    );
  }

  return (
    <div className={`${layoutClass} ${className}`}>
      {/* 1. Exam Level */}
      {levels.includes('exam') && (
        <div className="flex-1 min-w-[140px]">
          <label className={labelClassName || defaultLabelClass}>
            Exam {requiredLevels.includes('exam') && <span className="text-rose-400">*</span>}
          </label>
          <select
            value={currentExamId}
            onChange={(e) => handleExamChange(e.target.value)}
            disabled={disabled}
            className={selectClassName || defaultSelectClass}
          >
            <option value="">All Exams</option>
            {options.exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Academic Class Level */}
      {levels.includes('class') && (
        <div className="flex-1 min-w-[140px]">
          <label className={labelClassName || defaultLabelClass}>
            Class {requiredLevels.includes('class') && <span className="text-rose-400">*</span>}
          </label>
          <select
            value={currentClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            disabled={disabled}
            className={selectClassName || defaultSelectClass}
          >
            <option value="">All Classes</option>
            {filteredClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} {cls.exam_name ? `(${cls.exam_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Subject Level */}
      {levels.includes('subject') && (
        <div className="flex-1 min-w-[160px]">
          <label className={labelClassName || defaultLabelClass}>
            Subject {requiredLevels.includes('subject') && <span className="text-rose-400">*</span>}
          </label>
          <select
            value={currentSubjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            disabled={disabled}
            className={selectClassName || defaultSelectClass}
          >
            <option value="">All Subjects</option>
            {filteredSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.subject_label || (sub.class_name ? `${sub.class_name} · ${sub.name}` : sub.name)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Chapter Level */}
      {levels.includes('chapter') && (
        <div className="flex-1 min-w-[180px]">
          <label className={labelClassName || defaultLabelClass}>
            Chapter {requiredLevels.includes('chapter') && <span className="text-rose-400">*</span>}
          </label>
          <select
            value={currentChapterId}
            onChange={(e) => handleChapterChange(e.target.value)}
            disabled={disabled || (requiredLevels.includes('subject') && !currentSubjectId)}
            className={selectClassName || defaultSelectClass}
          >
            <option value="">All Chapters</option>
            {filteredChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
