'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  announcement_type: 'INFO' | 'IMPORTANT' | 'ALERT';
  link_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    announcement_type: 'INFO' as 'INFO' | 'IMPORTANT' | 'ALERT',
    link_url: '',
    is_active: true,
  });

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<AnnouncementItem[]>('/admin-panel/announcements/');
      setAnnouncements(asList<AnnouncementItem>(data));
    } catch (err: unknown) {
      console.error('[Admin Announcements fetch error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load announcements.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      message: '',
      announcement_type: 'INFO',
      link_url: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      message: item.message,
      announcement_type: item.announcement_type,
      link_url: item.link_url || '',
      is_active: item.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFeedback({ type: 'error', message: 'Title is required' });
      return;
    }
    if (!formData.message.trim()) {
      setFeedback({ type: 'error', message: 'Message is required' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        announcement_type: formData.announcement_type,
        link_url: formData.link_url.trim() || '',
        is_active: formData.is_active,
      };

      if (editingId) {
        await apiClient.patch(`/admin-panel/announcements/${editingId}/`, payload);
        setFeedback({ type: 'success', message: 'Announcement updated successfully.' });
      } else {
        await apiClient.post('/admin-panel/announcements/', payload);
        setFeedback({ type: 'success', message: 'Announcement broadcasted successfully.' });
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save announcement.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await apiClient.delete(`/admin-panel/announcements/${id}/`);
      setFeedback({ type: 'success', message: 'Announcement deleted successfully.' });
      fetchAnnouncements();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete announcement.' });
    }
  };

  const handleToggleActive = async (item: AnnouncementItem) => {
    try {
      await apiClient.patch(`/admin-panel/announcements/${item.id}/`, {
        is_active: !item.is_active,
      });
      fetchAnnouncements();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update status.' });
    }
  };

  const getTypeBadge = (type: AnnouncementItem['announcement_type']) => {
    switch (type) {
      case 'ALERT':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Alert
          </Badge>
        );
      case 'IMPORTANT':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Important
          </Badge>
        );
      default:
        return (
          <Badge className="bg-brand-500/10 text-brand-400 border-brand-500/20 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Info
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-400" />
            Broadcast Announcements & Alerts
          </h1>
          <p className="text-sm text-slate-400">
            Publish notices, schedule changes, test alerts, and updates to all student dashboards.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
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

      {/* List */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-base font-medium text-slate-300">No active announcements</p>
            <p className="text-sm text-slate-500 mt-1">
              Broadcast exam notifications or revision schedules to your students.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getTypeBadge(a.announcement_type)}
                    <button
                      onClick={() => handleToggleActive(a)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        a.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          a.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      {a.is_active ? 'Broadcasting Live' : 'Archived'}
                    </button>
                    <span className="text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100">{a.title}</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{a.message}</p>

                  {a.link_url && (
                    <a
                      href={a.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 underline pt-1 font-mono"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {a.link_url}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(a)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(a.id)}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-400" />
                {editingId ? 'Edit Announcement' : 'Post Announcement'}
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
                  placeholder="e.g. All-India JEE Advanced Mock Test 3 is Live"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Announcement Type *
                </label>
                <select
                  value={formData.announcement_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      announcement_type: e.target.value as AnnouncementItem['announcement_type'],
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="INFO">General Info</option>
                  <option value="IMPORTANT">Important Notice</option>
                  <option value="ALERT">Critical Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Message Content *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Detailed announcement message visible to students..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Link / Action URL (Optional)
                </label>
                <input
                  type="text"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="e.g. /tests or https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active_ann"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-brand-500 focus:ring-brand-500 w-4 h-4"
                />
                <label htmlFor="is_active_ann" className="text-sm text-slate-300 select-none cursor-pointer">
                  Broadcast live on student notification bell
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
                  {editingId ? 'Update Notice' : 'Broadcast Now'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
