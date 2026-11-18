'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  title: string;
  title_highlight?: string;
  subtitle?: string;
  badge?: string;
  features: string[];
  original_price?: string;
  offer_price?: string;
  discount_badge?: string;
  cta_text?: string;
  cta_href?: string;
  image_url?: string;
  order: number;
  is_active: boolean;
}

interface QuickAccess {
  id: string;
  title: string;
  description?: string;
  icon_name?: string;
  href: string;
  badge_text?: string;
  order: number;
  is_visible: boolean;
}

interface SubjectItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  topics: string[];
  order: number;
  is_visible: boolean;
}

export default function AdminHomePage() {
  const [activeTab, setActiveTab] = useState<'slides' | 'quick' | 'subjects'>('slides');

  // Slides State
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

  // Quick Access State
  const [quickItems, setQuickItems] = useState<QuickAccess[]>([]);
  const [editingQuick, setEditingQuick] = useState<Partial<QuickAccess> | null>(null);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  // Subjects State
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [editingSubject, setEditingSubject] = useState<Partial<SubjectItem> | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [sRes, qRes, subjRes] = await Promise.all([
        apiClient.get<HeroSlide[]>('/admin-panel/hero-slides/'),
        apiClient.get<QuickAccess[]>('/admin-panel/quick-access/'),
        apiClient.get<SubjectItem[]>('/admin-panel/subjects/'),
      ]);
      setSlides(Array.isArray(sRes) ? sRes : []);
      setQuickItems(Array.isArray(qRes) ? qRes : []);
      setSubjects(Array.isArray(subjRes) ? subjRes : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch home configurations';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Slide Handlers ---
  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlide) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        ...editingSlide,
        features: Array.isArray(editingSlide.features)
          ? editingSlide.features
          : String(editingSlide.features || '').split(',').map((f) => f.trim()).filter(Boolean),
      };

      if (editingSlide.id) {
        await apiClient.put(`/admin-panel/hero-slides/${editingSlide.id}/`, payload);
        setFeedback({ type: 'success', message: 'Hero slide updated successfully!' });
      } else {
        await apiClient.post('/admin-panel/hero-slides/', payload);
        setFeedback({ type: 'success', message: 'New hero slide added successfully!' });
      }
      setIsSlideModalOpen(false);
      setEditingSlide(null);
      fetchData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional slide?')) return;
    try {
      await apiClient.delete(`/admin-panel/hero-slides/${id}/`);
      setFeedback({ type: 'success', message: 'Slide deleted' });
      fetchData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  // --- Quick Access Handlers ---
  const handleSaveQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuick) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      if (editingQuick.id) {
        await apiClient.put(`/admin-panel/quick-access/${editingQuick.id}/`, editingQuick);
        setFeedback({ type: 'success', message: 'Quick card updated!' });
      } else {
        await apiClient.post('/admin-panel/quick-access/', editingQuick);
        setFeedback({ type: 'success', message: 'Quick card added!' });
      }
      setIsQuickModalOpen(false);
      setEditingQuick(null);
      fetchData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Subject Handlers ---
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        ...editingSubject,
        topics: Array.isArray(editingSubject.topics)
          ? editingSubject.topics
          : String(editingSubject.topics || '').split(',').map((t) => t.trim()).filter(Boolean),
      };

      if (editingSubject.id) {
        await apiClient.put(`/admin-panel/subjects/${editingSubject.id}/`, payload);
        setFeedback({ type: 'success', message: 'Subject updated!' });
      } else {
        await apiClient.post('/admin-panel/subjects/', payload);
        setFeedback({ type: 'success', message: 'Subject created!' });
      }
      setIsSubjectModalOpen(false);
      setEditingSubject(null);
      fetchData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <span>Home Page & Highlights</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage promotional hero carousel slides, quick navigation cards, and curriculum subjects
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'slides' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingSlide({
                  title: '',
                  title_highlight: '',
                  subtitle: '',
                  badge: 'Complete Course',
                  features: ['Video Lectures', 'Chapter Notes', 'PYQ Practice', 'CBT Mock Tests'],
                  original_price: '₹7,999',
                  offer_price: '₹0',
                  discount_badge: '100% OFF (FREE)',
                  cta_text: 'Enroll Free',
                  cta_href: '/learn',
                  image_url: '/images/hero/slide-1.jpg',
                  order: slides.length + 1,
                  is_active: true,
                });
                setIsSlideModalOpen(true);
              }}
              className="gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Slide</span>
            </Button>
          )}

          {activeTab === 'quick' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingQuick({
                  title: '',
                  description: '',
                  icon_name: 'BookOpen',
                  href: '/learn',
                  badge_text: 'Active',
                  order: quickItems.length + 1,
                  is_visible: true,
                });
                setIsQuickModalOpen(true);
              }}
              className="gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500"
            >
              <Plus className="w-4 h-4" />
              <span>Add Quick Card</span>
            </Button>
          )}

          {activeTab === 'subjects' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingSubject({
                  name: '',
                  slug: '',
                  description: '',
                  topics: ['Mechanics', 'Calculus'],
                  order: subjects.length + 1,
                  is_visible: true,
                });
                setIsSubjectModalOpen(true);
              }}
              className="gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subject</span>
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('slides')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'slides'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Hero Slides ({slides.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'quick'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Quick Access Cards ({quickItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'subjects'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          JEE Subjects ({subjects.length})
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : activeTab === 'slides' ? (
        /* TAB 1: HERO SLIDES LIST */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slides.map((s) => (
            <Card key={s.id} className="p-5 bg-slate-900 border-slate-800 space-y-4 hover:border-slate-700">
              <div className="flex items-center justify-between">
                <Badge variant={s.is_active ? 'blue' : 'slate'}>
                  {s.is_active ? 'Active on Home' : 'Disabled'}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 font-mono">Order: {s.order}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSlide(s);
                      setIsSlideModalOpen(true);
                    }}
                    className="p-1.5 h-auto ml-2 border-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSlide(s.id)}
                    className="p-1.5 h-auto border-rose-950 text-rose-400 hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{s.badge}</span>
                <h3 className="font-extrabold text-base text-white">
                  {s.title} <span className="text-indigo-400">{s.title_highlight}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.subtitle}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400">Offer: <strong className="text-emerald-400">{s.offer_price}</strong></span>
                <span className="text-slate-500">CTA: <strong className="text-slate-300">{s.cta_text}</strong> ({s.cta_href})</span>
              </div>
            </Card>
          ))}
        </div>
      ) : activeTab === 'quick' ? (
        /* TAB 2: QUICK ACCESS CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickItems.map((qi) => (
            <Card key={qi.id} className="p-4 bg-slate-900 border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={qi.is_visible ? 'emerald' : 'slate'}>
                  {qi.is_visible ? 'Visible' : 'Hidden'}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-mono">#{qi.order}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingQuick(qi);
                      setIsQuickModalOpen(true);
                    }}
                    className="p-1.5 h-auto ml-1 border-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white">{qi.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{qi.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
                Href: {qi.href}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* TAB 3: JEE SUBJECTS CARDS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subjects.map((subj) => (
            <Card key={subj.id} className="p-5 bg-slate-900 border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={subj.is_visible ? 'blue' : 'slate'}>
                  {subj.is_visible ? 'Active Subject' : 'Hidden'}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-mono">Order: {subj.order}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSubject(subj);
                      setIsSubjectModalOpen(true);
                    }}
                    className="p-1.5 h-auto ml-1 border-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-base text-white">{subj.name}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{subj.description}</p>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Topics</span>
                <div className="flex flex-wrap gap-1">
                  {(subj.topics || []).map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL 1: EDIT SLIDE */}
      {isSlideModalOpen && editingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingSlide.id ? 'Edit Hero Slide' : 'Create New Promotional Slide'}
            </h3>

            <form onSubmit={handleSaveSlide} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Title</label>
                  <input
                    type="text"
                    required
                    value={editingSlide.title || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Title Highlight</label>
                  <input
                    type="text"
                    value={editingSlide.title_highlight || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, title_highlight: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Subtitle</label>
                <textarea
                  rows={2}
                  value={editingSlide.subtitle || ''}
                  onChange={(e) => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Badge Text</label>
                  <input
                    type="text"
                    value={editingSlide.badge || ''}
                    onChange={(e) => setEditingSlide({ ...editingSlide, badge: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Offer Price</label>
                  <input
                    type="text"
                    value={editingSlide.offer_price || '₹0'}
                    onChange={(e) => setEditingSlide({ ...editingSlide, offer_price: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Discount</label>
                  <input
                    type="text"
                    value={editingSlide.discount_badge || '100% OFF (FREE)'}
                    onChange={(e) => setEditingSlide({ ...editingSlide, discount_badge: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Features List (Comma-separated)</label>
                <input
                  type="text"
                  value={
                    Array.isArray(editingSlide.features)
                      ? editingSlide.features.join(', ')
                      : editingSlide.features || ''
                  }
                  onChange={(e) => setEditingSlide({ ...editingSlide, features: e.target.value as unknown as string[] })}
                  placeholder="Video Lectures, Chapter Notes, Mock Tests"
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">CTA Text</label>
                  <input
                    type="text"
                    value={editingSlide.cta_text || 'Enroll Free'}
                    onChange={(e) => setEditingSlide({ ...editingSlide, cta_text: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">CTA Link</label>
                  <input
                    type="text"
                    value={editingSlide.cta_href || '/learn'}
                    onChange={(e) => setEditingSlide({ ...editingSlide, cta_href: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Display Order</label>
                  <input
                    type="number"
                    value={editingSlide.order ?? 1}
                    onChange={(e) => setEditingSlide({ ...editingSlide, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(editingSlide.is_active)}
                      onChange={(e) => setEditingSlide({ ...editingSlide, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Active on Home Carousel</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSlideModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="bg-indigo-600">
                  Save Slide
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: EDIT QUICK ACCESS */}
      {isQuickModalOpen && editingQuick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingQuick.id ? 'Edit Quick Card' : 'Add Quick Navigation Card'}
            </h3>

            <form onSubmit={handleSaveQuick} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Title</label>
                <input
                  type="text"
                  required
                  value={editingQuick.title || ''}
                  onChange={(e) => setEditingQuick({ ...editingQuick, title: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <input
                  type="text"
                  value={editingQuick.description || ''}
                  onChange={(e) => setEditingQuick({ ...editingQuick, description: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Href</label>
                  <input
                    type="text"
                    required
                    value={editingQuick.href || ''}
                    onChange={(e) => setEditingQuick({ ...editingQuick, href: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Order</label>
                  <input
                    type="number"
                    value={editingQuick.order ?? 1}
                    onChange={(e) => setEditingQuick({ ...editingQuick, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(editingQuick.is_visible)}
                    onChange={(e) => setEditingQuick({ ...editingQuick, is_visible: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Visible to Students</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsQuickModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="bg-indigo-600">
                  Save Card
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: EDIT SUBJECT */}
      {isSubjectModalOpen && editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-slate-900 border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingSubject.id ? 'Edit JEE Subject' : 'Add JEE Subject'}
            </h3>

            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Subject Name</label>
                <input
                  type="text"
                  required
                  value={editingSubject.name || ''}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editingSubject.description || ''}
                  onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Topic Chips (Comma-separated)</label>
                <input
                  type="text"
                  value={
                    Array.isArray(editingSubject.topics)
                      ? editingSubject.topics.join(', ')
                      : editingSubject.topics || ''
                  }
                  onChange={(e) => setEditingSubject({ ...editingSubject, topics: e.target.value as unknown as string[] })}
                  placeholder="Mechanics, Electrodynamics, Modern Physics"
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Order</label>
                  <input
                    type="number"
                    value={editingSubject.order ?? 1}
                    onChange={(e) => setEditingSubject({ ...editingSubject, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(editingSubject.is_visible)}
                      onChange={(e) => setEditingSubject({ ...editingSubject, is_visible: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Visible on Portal</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSubjectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="bg-indigo-600">
                  Save Subject
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
