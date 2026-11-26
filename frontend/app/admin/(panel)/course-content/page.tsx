'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Edit2,
  Video,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

interface CourseOption {
  id: string;
  title: string;
  slug?: string;
}

interface TestOption {
  id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
}

type SectionType = 'MODULES' | 'PRACTICE' | 'SHORT_NOTES' | 'TEST_SERIES' | 'ADVANCED_TEST_SERIES';

interface ContentItem {
  id: string;
  section: string;
  title: string;
  description: string;
  order: number;
  is_published: boolean;
  is_free_preview: boolean;
  subject?: number | null;
  chapter?: number | null;
  year?: number | null;
  group_label: string;
  pdf: string;
  solution_pdf: string;
  video?: string | null;
  video_title?: string;
  video_source_type?: string;
  youtube_video_id?: string;
  exam?: string | null;
  exam_title?: string;
  is_exam: boolean;
  release_at?: string | null;
  solution_release_at?: string | null;
  created_at?: string;
}

interface CourseSection {
  id: string;
  course: string;
  section_type: SectionType;
  title: string;
  order: number;
  is_published: boolean;
  items_count?: number;
  items: ContentItem[];
}

const SECTION_TYPE_LABELS: Record<SectionType, { label: string; desc: string; badge: string }> = {
  MODULES: { label: 'Modules & Practice Books', desc: 'Chapter-wise view-only PDF theory and graded problems', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PRACTICE: { label: 'Practice & PYQ Archive', desc: 'JEE Mains & Advanced (2007-2026), Olympiad tests with video solutions', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  SHORT_NOTES: { label: 'Short Notes & Handouts', desc: 'Handwritten revision maps and rapid formulas', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  TEST_SERIES: { label: 'Test Series (Weekly / Monthly)', desc: 'Timed CBT online exams with timed solution release', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  ADVANCED_TEST_SERIES: { label: 'Advanced Test Series', desc: 'High-difficulty Olympiad & JEE Advanced mocks', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

export default function CourseContentAdminPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [availableTests, setAvailableTests] = useState<TestOption[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Section Modal
  const [isSectionModalOpen, setIsSectionModalOpen] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<Partial<CourseSection> | null>(null);

  // Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Partial<ContentItem> & { video_input?: string } | null>(null);

  // Expanded section state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // 1. Fetch courses and tests on mount
  useEffect(() => {
    async function initData() {
      setIsLoading(true);
      try {
        const [cRes, tRes] = await Promise.all([
          apiClient.get<CourseOption[]>('/courses/'),
          apiClient.get<TestOption[]>('/admin-panel/tests/'),
        ]);
        const courseList = asList<CourseOption>(cRes);
        setCourses(courseList);
        setAvailableTests(asList<TestOption>(tRes));

        if (courseList.length > 0) {
          setSelectedCourseId(courseList[0].id);
        }
      } catch (err: unknown) {
        console.error('[CourseContent] init error:', err);
        setFeedback({
          type: 'error',
          message: err instanceof ApiError ? err.message : 'Failed to load initial data',
        });
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, []);

  // 2. Fetch sections whenever selected course changes
  const fetchSections = async (courseId: string) => {
    if (!courseId) return;
    try {
      const res = await apiClient.get<CourseSection[]>(`/course-content/admin/sections/?course=${courseId}`);
      const list = asList<CourseSection>(res);
      setSections(list);
      // Auto-expand all sections by default
      const initialExpanded: Record<string, boolean> = {};
      list.forEach((s) => {
        initialExpanded[s.id] = true;
      });
      setExpandedSections(initialExpanded);
    } catch (err: unknown) {
      console.error('[CourseContent] fetchSections error:', err);
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to fetch course sections',
      });
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchSections(selectedCourseId);
    }
  }, [selectedCourseId]);

  const toggleSectionExpand = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 3. Section CRUD
  const handleOpenCreateSection = () => {
    setEditingSection({
      course: selectedCourseId,
      section_type: 'MODULES',
      title: '',
      order: (sections.length + 1) * 10,
      is_published: true,
    });
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (s: CourseSection) => {
    setEditingSection(s);
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection || !selectedCourseId) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      if (editingSection.id) {
        await apiClient.patch(`/course-content/admin/sections/${editingSection.id}/`, editingSection);
        setFeedback({ type: 'success', message: 'Section updated successfully.' });
      } else {
        await apiClient.post('/course-content/admin/sections/', {
          ...editingSection,
          course: selectedCourseId,
        });
        setFeedback({ type: 'success', message: 'Section created successfully.' });
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      await fetchSections(selectedCourseId);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to save section.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async (s: CourseSection) => {
    if (!confirm(`Are you sure you want to delete section "${s.title}" and all its content items?`)) return;
    try {
      await apiClient.delete(`/course-content/admin/sections/${s.id}/`);
      setFeedback({ type: 'success', message: 'Section deleted.' });
      await fetchSections(selectedCourseId);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to delete section.',
      });
    }
  };

  // 4. Content Item CRUD
  const handleOpenCreateItem = (sectionId: string) => {
    const parentSection = sections.find((s) => s.id === sectionId);
    const existingCount = parentSection?.items?.length || 0;
    const isTestType = parentSection?.section_type === 'TEST_SERIES' || parentSection?.section_type === 'ADVANCED_TEST_SERIES';

    setEditingItem({
      section: sectionId,
      title: '',
      description: '',
      order: (existingCount + 1) * 10,
      is_published: true,
      is_free_preview: false,
      group_label: '',
      year: null,
      pdf: '',
      solution_pdf: '',
      video_input: '',
      exam: null,
      is_exam: isTestType,
      release_at: null,
      solution_release_at: null,
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: ContentItem) => {
    setEditingItem({
      ...item,
      video_input: item.youtube_video_id
        ? `https://www.youtube.com/watch?v=${item.youtube_video_id}`
        : item.video || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.section) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: Record<string, unknown> = {
        section: editingItem.section,
        title: editingItem.title,
        description: editingItem.description || '',
        order: Number(editingItem.order) || 10,
        is_published: !!editingItem.is_published,
        is_free_preview: !!editingItem.is_free_preview,
        group_label: editingItem.group_label || '',
        year: editingItem.year ? Number(editingItem.year) : null,
        pdf: editingItem.pdf || '',
        solution_pdf: editingItem.solution_pdf || '',
        video_input: editingItem.video_input || '',
        exam: editingItem.exam || null,
        is_exam: !!editingItem.is_exam,
        release_at: editingItem.release_at || null,
        solution_release_at: editingItem.solution_release_at || null,
      };

      if (editingItem.id) {
        await apiClient.patch(`/course-content/admin/items/${editingItem.id}/`, payload);
        setFeedback({ type: 'success', message: 'Item updated successfully.' });
      } else {
        await apiClient.post('/course-content/admin/items/', payload);
        setFeedback({ type: 'success', message: 'Item created successfully.' });
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
      await fetchSections(selectedCourseId);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to save content item.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: ContentItem) => {
    if (!confirm(`Delete item "${item.title}"?`)) return;
    try {
      await apiClient.delete(`/course-content/admin/items/${item.id}/`);
      setFeedback({ type: 'success', message: 'Content item deleted.' });
      await fetchSections(selectedCourseId);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to delete item.',
      });
    }
  };

  const filteredSections = useMemo(() => {
    if (activeTab === 'ALL') return sections;
    return sections.filter((s) => s.section_type === activeTab);
  }, [sections, activeTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-400" />
            Course Content &amp; Curriculum Sections
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage course sections, chapter practice modules, PYQs, handwritten short notes, and weekly CBT test series.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/tests?create=true">
            <Button variant="outline" size="sm" className="border-purple-500/30 text-purple-300 hover:bg-purple-950/30">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Exam (CBT)
            </Button>
          </Link>
          <Button
            onClick={handleOpenCreateSection}
            size="sm"
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium"
            disabled={!selectedCourseId}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Section
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Course Selector Card */}
      <Card className="p-4 bg-slate-900/60 border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-300 whitespace-nowrap">
              Active Course:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Section Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
            {['ALL', 'MODULES', 'PRACTICE', 'SHORT_NOTES', 'TEST_SERIES', 'ADVANCED_TEST_SERIES'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Sections List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-amber-400" />
          Loading course content...
        </div>
      ) : filteredSections.length === 0 ? (
        <Card className="p-10 text-center bg-slate-900/30 border-slate-800/60">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No sections found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Get started by creating your first section (e.g. Chapter Modules, JEE Advanced PYQs, or Weekly CBT Test Series).
          </p>
          <Button
            onClick={handleOpenCreateSection}
            size="sm"
            className="mt-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create First Section
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSections.map((section) => {
            const meta = SECTION_TYPE_LABELS[section.section_type] || {
              label: section.section_type,
              desc: '',
              badge: 'bg-slate-800 text-slate-300 border-slate-700',
            };
            const isExpanded = !!expandedSections[section.id];
            const items = section.items || [];

            return (
              <Card
                key={section.id}
                className="bg-slate-900/70 border-slate-800 overflow-hidden shadow-sm"
              >
                {/* Section Header */}
                <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleSectionExpand(section.id)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-base">
                          {section.title}
                        </span>
                        <Badge variant="outline" className={`text-xs px-2 py-0.5 ${meta.badge}`}>
                          {meta.label}
                        </Badge>
                        {!section.is_published && (
                          <Badge variant="outline" className="text-xs bg-slate-800/80 text-slate-400 border-slate-700">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {meta.desc} &bull; Order: {section.order} &bull; {items.length} item{items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateItem(section.id)}
                      className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-950/30"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Item
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditSection(section)}
                      className="text-slate-400 hover:text-slate-200 text-xs px-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSection(section)}
                      className="text-rose-400 hover:text-rose-300 text-xs px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Items in Section */}
                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {items.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800/80 rounded-lg">
                        No content items yet. Click &quot;Add Item&quot; to attach videos, view-only PDFs, or online exams.
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-200 text-sm">
                                {item.title}
                              </span>
                              {item.group_label && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {item.group_label}
                                </span>
                              )}
                              {item.year && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                  {item.year}
                                </span>
                              )}
                              {item.is_free_preview && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Free Preview
                                </span>
                              )}
                              {!item.is_published && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Draft
                                </span>
                              )}
                            </div>

                            {/* Badges for attachments */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              {item.youtube_video_id ? (
                                <span className="flex items-center gap-1 text-red-400">
                                  <Video className="w-3.5 h-3.5" />
                                  YouTube ({item.youtube_video_id})
                                </span>
                              ) : item.video ? (
                                <span className="flex items-center gap-1 text-sky-400">
                                  <Video className="w-3.5 h-3.5" />
                                  R2 Video
                                </span>
                              ) : null}

                              {item.pdf && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <FileText className="w-3.5 h-3.5" />
                                  View-Only PDF
                                </span>
                              )}

                              {item.solution_pdf && (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <FileText className="w-3.5 h-3.5" />
                                  Solution PDF
                                </span>
                              )}

                              {item.is_exam && (
                                <span className="flex items-center gap-1 text-purple-400 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  {item.exam_title ? `Exam: ${item.exam_title}` : 'Online Exam'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditItem(item)}
                              className="text-slate-400 hover:text-slate-200 text-xs px-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              className="text-rose-400 hover:text-rose-300 text-xs px-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          SECTION MODAL (Create / Edit)
         ========================================================================= */}
      {isSectionModalOpen && editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 text-lg">
                {editingSection.id ? 'Edit Section' : 'Add Course Section'}
              </h3>
              <button
                onClick={() => setIsSectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Section Type *
                </label>
                <select
                  value={editingSection.section_type || 'MODULES'}
                  onChange={(e) =>
                    setEditingSection({
                      ...editingSection,
                      section_type: e.target.value as SectionType,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="MODULES">MODULES (Practice books, view-only PDF theory &amp; problems)</option>
                  <option value="PRACTICE">PRACTICE (JEE Mains, Advanced 2007-2026, Olympiad)</option>
                  <option value="SHORT_NOTES">SHORT_NOTES (Handwritten notes &amp; formula maps)</option>
                  <option value="TEST_SERIES">TEST_SERIES (Week-wise / month-wise CBT exams)</option>
                  <option value="ADVANCED_TEST_SERIES">ADVANCED_TEST_SERIES (Advanced level mock tests)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Section Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter Modules, JEE Advanced PYQs, or Week 1 Tests"
                  value={editingSection.title || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingSection.order ?? 10}
                    onChange={(e) => setEditingSection({ ...editingSection, order: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!editingSection.is_published}
                      onChange={(e) => setEditingSection({ ...editingSection, is_published: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500/20"
                    />
                    Published
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Save Section
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTENT ITEM MODAL (Create / Edit)
         ========================================================================= */}
      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 text-lg">
                {editingItem.id ? 'Edit Content Item' : 'Add Content Item'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Title & Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 1: Quadratic Equations Theory & Problems"
                  value={editingItem.title || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short summary of topics or instructions"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Group Label, Year, Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Group Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JEE Mains, Olympiad, Week 1"
                    value={editingItem.group_label || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, group_label: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Year (for PYQ)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2024"
                    value={editingItem.year ?? ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingItem.order ?? 10}
                    onChange={(e) => setEditingItem({ ...editingItem, order: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* VIDEO FIELD: Single input for YouTube URL or R2 key */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-400" />
                    Lecture / Solution Video Input
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Single input: YouTube URL or R2 key
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Paste YouTube URL (e.g. https://youtu.be/... or watch?v=...) or R2 Video ID"
                  value={editingItem.video_input || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, video_input: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400">
                  YouTube Unlisted videos are automatically parsed and embedded for normal lectures. R2 video keys are streamed via signed HLS for premium solutions.
                </p>
              </div>

              {/* View-Only PDF & Solution PDF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    View-Only PDF (R2 Key)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. materials/maths/ch1-theory.pdf"
                    value={editingItem.pdf || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, pdf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Solution PDF (R2 Key)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. materials/maths/ch1-solutions.pdf"
                    value={editingItem.solution_pdf || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, solution_pdf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* CBT Online Exam Link */}
              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-300">
                    <input
                      type="checkbox"
                      checked={!!editingItem.is_exam}
                      onChange={(e) => setEditingItem({ ...editingItem, is_exam: e.target.checked })}
                      className="rounded bg-slate-950 border-purple-500/40 text-purple-600 focus:ring-purple-500/20"
                    />
                    Attach CBT Online Exam (Timed Mock Test)
                  </label>
                  <Link
                    href="/admin/tests?create=true"
                    target="_blank"
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    + Create New Exam in CBT Engine <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {editingItem.is_exam && (
                  <div>
                    <select
                      value={editingItem.exam || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          exam: e.target.value || null,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Select an Exam --</option>
                      {availableTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.duration_minutes}m, {t.total_marks} marks)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Release Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Exam / Content Opens At
                  </label>
                  <input
                    type="datetime-local"
                    value={editingItem.release_at ? editingItem.release_at.substring(0, 16) : ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        release_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Solution Release At
                  </label>
                  <input
                    type="datetime-local"
                    value={editingItem.solution_release_at ? editingItem.solution_release_at.substring(0, 16) : ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        solution_release_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Students can view solution video &amp; PDF once this window opens.
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!editingItem.is_published}
                    onChange={(e) => setEditingItem({ ...editingItem, is_published: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500/20"
                  />
                  Published
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!editingItem.is_free_preview}
                    onChange={(e) => setEditingItem({ ...editingItem, is_free_preview: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500/20"
                  />
                  Free Preview (unlocked for non-enrolled students)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsItemModalOpen(false)}
                  className="text-slate-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-medium"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Save Content Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
