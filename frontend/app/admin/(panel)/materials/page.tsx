'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Search,
  ExternalLink,
} from 'lucide-react';

interface MaterialItem {
  id: string;
  title: string;
  description: string;
  material_type: 'PDF' | 'NOTE' | 'FORMULA_SHEET' | 'MIND_MAP';
  subject: number;
  subject_name?: string;
  chapter?: string | null;
  chapter_name?: string | null;
  r2_object_key: string;
  file_size_bytes: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface SubjectOption {
  id: number;
  name: string;
}

interface ChapterOption {
  id: string;
  name: string;
  subject_id?: number;
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    material_type: 'PDF' as 'PDF' | 'NOTE' | 'FORMULA_SHEET' | 'MIND_MAP',
    subject: '' as string | number,
    chapter: '' as string,
    r2_object_key: '',
    file_size_bytes: 1048576,
    is_published: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [matRes, optRes, chapRes] = await Promise.all([
        apiClient.get<MaterialItem[]>('/admin-panel/materials/'),
        apiClient.get<{ subjects: SubjectOption[] }>('/admin-panel/options/'),
        apiClient.get<{ results: ChapterOption[] } | ChapterOption[]>('/admin-panel/chapters/'),
      ]);
      setMaterials(matRes || []);
      setSubjects(optRes?.subjects || []);
      const chaps = Array.isArray(chapRes) ? chapRes : chapRes?.results || [];
      setChapters(chaps);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load study materials data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      material_type: 'PDF',
      subject: subjects.length > 0 ? subjects[0].id : '',
      chapter: '',
      r2_object_key: '',
      file_size_bytes: 1048576,
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: MaterialItem) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      description: item.description || '',
      material_type: item.material_type,
      subject: item.subject,
      chapter: item.chapter || '',
      r2_object_key: item.r2_object_key,
      file_size_bytes: item.file_size_bytes || 1048576,
      is_published: item.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFeedback({ type: 'error', message: 'Title is required' });
      return;
    }
    if (!formData.subject) {
      setFeedback({ type: 'error', message: 'Subject is required' });
      return;
    }
    if (!formData.r2_object_key.trim()) {
      setFeedback({ type: 'error', message: 'File key or download URL is required' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        material_type: formData.material_type,
        subject: Number(formData.subject),
        chapter: formData.chapter || null,
        r2_object_key: formData.r2_object_key.trim(),
        file_size_bytes: Number(formData.file_size_bytes) || 0,
        is_published: formData.is_published,
      };

      if (editingId) {
        await apiClient.patch(`/admin-panel/materials/${editingId}/`, payload);
        setFeedback({ type: 'success', message: 'Study material updated successfully.' });
      } else {
        await apiClient.post('/admin-panel/materials/', payload);
        setFeedback({ type: 'success', message: 'Study material created successfully.' });
      }
      setIsModalOpen(false);
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save study material.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this study material?')) return;
    try {
      await apiClient.delete(`/admin-panel/materials/${id}/`);
      setFeedback({ type: 'success', message: 'Material deleted successfully.' });
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete material.' });
    }
  };

  const handleTogglePublish = async (item: MaterialItem) => {
    try {
      await apiClient.patch(`/admin-panel/materials/${item.id}/`, {
        is_published: !item.is_published,
      });
      fetchData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to toggle status.' });
    }
  };

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.subject_name && m.subject_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = subjectFilter === 'ALL' || String(m.subject) === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-400" />
            Study Materials & PDFs
          </h1>
          <p className="text-sm text-slate-400">
            Upload notes, formula sheets, mind maps, and chapter PDFs for student download.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Study Material
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 bg-slate-900/40 border-slate-800 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search materials by title or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="w-full md:w-56">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table / List */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm">Loading study materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-base font-medium text-slate-300">No study materials found</p>
            <p className="text-sm text-slate-500 mt-1">
              Add downloadable PDFs, formula sheets, or revision notes to assist your students.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Title & Info</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Subject & Chapter</th>
                  <th className="px-5 py-3.5">Size</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredMaterials.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-100 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-brand-400 shrink-0" />
                        {m.title}
                      </div>
                      {m.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.description}</p>
                      )}
                      <div className="text-[11px] text-slate-500 mt-1 font-mono break-all flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {m.r2_object_key}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="text-xs border-slate-700 bg-slate-800/50">
                        {m.material_type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-slate-200 font-medium">{m.subject_name || 'General'}</div>
                      {m.chapter_name && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{m.chapter_name}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                      {formatFileSize(m.file_size_bytes)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleTogglePublish(m)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          m.is_published
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            m.is_published ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        {m.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(m)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(m.id)}
                          className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-400" />
                {editingId ? 'Edit Study Material' : 'Add Study Material'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Rotational Dynamics Complete Formula Sheet"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of what this document covers..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Material Type *
                  </label>
                  <select
                    value={formData.material_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        material_type: e.target.value as MaterialItem['material_type'],
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="NOTE">Lecture Note</option>
                    <option value="FORMULA_SHEET">Formula Sheet</option>
                    <option value="MIND_MAP">Mind Map</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Subject *
                  </label>
                  <select
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Chapter (Optional)
                  </label>
                  <select
                    value={formData.chapter}
                    onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">None / General Subject</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    File Size (Bytes)
                  </label>
                  <input
                    type="number"
                    value={formData.file_size_bytes}
                    onChange={(e) =>
                      setFormData({ ...formData, file_size_bytes: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  File Object Key or URL *
                </label>
                <input
                  type="text"
                  required
                  value={formData.r2_object_key}
                  onChange={(e) => setFormData({ ...formData, r2_object_key: e.target.value })}
                  placeholder="e.g. materials/physics/rotational-dynamics.pdf or https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Can be an S3/R2 storage key or an external direct link to the study document.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_published_mat"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-brand-500 focus:ring-brand-500 w-4 h-4"
                />
                <label htmlFor="is_published_mat" className="text-sm text-slate-300 select-none cursor-pointer">
                  Publish immediately (visible to students)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-800 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingId ? 'Update Material' : 'Create Material'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
