'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/auth/form-message';
import {
  Video as VideoIcon,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  ExternalLink,
  Cloud,
  PlaySquare,
  UploadCloud,
} from 'lucide-react';

interface VideoItem {
  id: string;
  lecture?: string;
  lecture_title?: string;
  topic?: string;
  topic_name?: string;
  title: string;
  description: string;
  duration_seconds: number;
  video_source_type: 'YOUTUBE' | 'CLOUD';
  youtube_video_id?: string;
  r2_object_key?: string;
  thumbnail_key?: string;
  is_free_preview: boolean;
  created_at?: string;
}

interface LectureOption {
  id: string;
  title: string;
  lecture_number: number;
  chapter_id: string;
  chapter_name: string;
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [lectures, setLectures] = useState<LectureOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<VideoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form open & edit state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formLecture, setFormLecture] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(45);
  const [formSourceType, setFormSourceType] = useState<'YOUTUBE' | 'CLOUD'>('YOUTUBE');
  const [formYoutubeInput, setFormYoutubeInput] = useState('');
  const [formR2Key, setFormR2Key] = useState('');
  const [formFreePreview, setFormFreePreview] = useState(false);

  // Presigned URL generation helper state
  const [presignedFilename, setPresignedFilename] = useState('');
  const [generatedUploadUrl, setGeneratedUploadUrl] = useState('');
  const [isGeneratingPresigned, setIsGeneratingPresigned] = useState(false);

  const fetchVideosAndOptions = async () => {
    setIsLoading(true);
    try {
      const [optRes, vidRes] = await Promise.all([
        apiClient.get<{ lectures: LectureOption[] }>('/admin-panel/options/'),
        apiClient.get<{ results?: VideoItem[] } | VideoItem[]>('/admin-panel/videos/'),
      ]);
      setLectures(optRes.lectures || []);
      setVideos(Array.isArray(vidRes) ? vidRes : vidRes.results || []);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error loading video catalog');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideosAndOptions();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormLecture(lectures.length > 0 ? lectures[0].id : '');
    setFormTitle('');
    setFormDescription('');
    setFormDurationMinutes(45);
    setFormSourceType('YOUTUBE');
    setFormYoutubeInput('');
    setFormR2Key('');
    setFormFreePreview(false);
    setFormError('');
    setFormSuccess('');
    setGeneratedUploadUrl('');
    setPresignedFilename('');
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (vid: VideoItem) => {
    setEditingId(vid.id);
    setFormLecture(vid.lecture || '');
    setFormTitle(vid.title);
    setFormDescription(vid.description || '');
    setFormDurationMinutes(Math.round((vid.duration_seconds || 0) / 60) || 45);
    setFormSourceType(vid.video_source_type);
    setFormYoutubeInput(vid.youtube_video_id || '');
    setFormR2Key(vid.r2_object_key || '');
    setFormFreePreview(vid.is_free_preview);
    setFormError('');
    setFormSuccess('');
    setGeneratedUploadUrl('');
    setPresignedFilename('');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGeneratePresignedUrl = async () => {
    if (!presignedFilename.trim()) {
      setFormError('Please enter a media filename (e.g. kinematics_lec1.mp4).');
      return;
    }
    setIsGeneratingPresigned(true);
    setFormError('');
    try {
      const res = await apiClient.post<{ upload_url: string; file_key: string }>('/content/upload-url/', {
        category: 'video',
        filename: presignedFilename.trim(),
      });
      setGeneratedUploadUrl(res.upload_url);
      setFormR2Key(res.file_key);
      setFormSuccess(`Presigned R2 Upload URL generated! File key set to ${res.file_key}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate upload URL.');
    } finally {
      setIsGeneratingPresigned(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formLecture) {
      setFormError('Please link this video to a Lecture.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Video title is required.');
      return;
    }

    if (formSourceType === 'YOUTUBE' && !formYoutubeInput.trim()) {
      setFormError('Please enter the YouTube URL or video ID.');
      return;
    }

    if (formSourceType === 'CLOUD' && !formR2Key.trim()) {
      setFormError('Please enter the Cloudflare R2 object key.');
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        lecture: formLecture,
        title: formTitle.trim(),
        description: formDescription.trim(),
        duration_seconds: Math.max(0, Number(formDurationMinutes) * 60),
        video_source_type: formSourceType,
        is_free_preview: formFreePreview,
      };

      if (formSourceType === 'YOUTUBE') {
        payload.youtube_video_id = formYoutubeInput.trim();
        payload.r2_object_key = null;
      } else {
        payload.r2_object_key = formR2Key.trim();
        payload.youtube_video_id = null;
      }

      if (editingId) {
        await apiClient.put(`/admin-panel/videos/${editingId}/`, payload);
        setFormSuccess('Video configuration updated successfully!');
      } else {
        await apiClient.post('/admin-panel/videos/', payload);
        setFormSuccess('Video added to lecture curriculum successfully!');
      }

      await fetchVideosAndOptions();
      setTimeout(() => {
        setIsFormOpen(false);
      }, 700);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save video entity.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin-panel/videos/${deleteTarget.id}/`);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete video.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <VideoIcon className="w-6 h-6 text-indigo-400" />
            <span>Teaching Videos & Media Storage</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Attach YouTube video streams or secure Cloudflare R2 cloud-hosted lectures to syllabus lessons.
          </p>
        </div>

        {!isFormOpen && (
          <Button
            variant="primary"
            onClick={openCreateForm}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teaching Video</span>
          </Button>
        )}
      </div>

      {/* Global Form Feedback Banners */}
      {(formError || formSuccess) && (
        <div>
          <FormMessage type="error" message={formError} />
          <FormMessage type="success" message={formSuccess} />
        </div>
      )}

      {/* Form Card */}
      {isFormOpen && (
        <Card className="p-5 sm:p-6 bg-slate-900 border-indigo-900/60 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                {editingId ? 'Edit Video Mapping' : 'Link Video to Lecture'}
              </h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Lecture <span className="text-red-400">*</span>
                </label>
                <select
                  value={formLecture}
                  onChange={(e) => setFormLecture(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Lecture...</option>
                  {lectures.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      [{lec.chapter_name}] Lec {lec.lecture_number}: {lec.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Video Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Complete Kinematics Masterclass (Derivations & Problem Solving)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Source Type Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-400">
                Storage & Streaming Source
              </label>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setFormSourceType('YOUTUBE')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    formSourceType === 'YOUTUBE'
                      ? 'bg-rose-950/40 border-rose-600 text-rose-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <PlaySquare className="w-4 h-4 text-rose-500" />
                  <span>YouTube Stream</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormSourceType('CLOUD')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    formSourceType === 'CLOUD'
                      ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span>Cloudflare R2 Bucket</span>
                </button>
              </div>

              {formSourceType === 'YOUTUBE' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    YouTube URL or Video ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formYoutubeInput}
                    onChange={(e) => setFormYoutubeInput(e.target.value)}
                    placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={formSourceType === 'YOUTUBE'}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Accepts standard watch URLs, youtu.be links, embed URLs, or bare 11-char IDs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Cloudflare R2 Object Key <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formR2Key}
                      onChange={(e) => setFormR2Key(e.target.value)}
                      placeholder="videos/kinematics_masterclass.mp4"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required={formSourceType === 'CLOUD'}
                    />
                  </div>

                  {/* R2 Presigned Upload URL generator helper */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Generate Direct R2 Presigned Upload URL</span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={presignedFilename}
                        onChange={(e) => setPresignedFilename(e.target.value)}
                        placeholder="lecture_video_final.mp4"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGeneratePresignedUrl}
                        disabled={isGeneratingPresigned}
                        className="border-slate-800 text-xs py-1"
                      >
                        {isGeneratingPresigned ? 'Generating...' : 'Get Upload URL'}
                      </Button>
                    </div>

                    {generatedUploadUrl && (
                      <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-emerald-400 break-all select-all">
                        Presigned PUT URL: {generatedUploadUrl}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Duration and Free Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Video Length (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formDurationMinutes}
                  onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formFreePreview}
                    onChange={(e) => setFormFreePreview(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    Mark as Free Demo Preview (Unregistered student preview)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description / Key Timestamps (Optional)
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="00:00 - Introduction, 12:45 - Derivation of equation..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
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
                <span>{editingId ? 'Update Video' : 'Save Video'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Video Cards Grid */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Loading video directory...</span>
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
          No teaching videos registered yet. Click &quot;Add Teaching Video&quot; to attach video media.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((vid) => (
            <Card
              key={vid.id}
              className="p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={vid.video_source_type === 'YOUTUBE' ? 'rose' : 'purple'}
                      className="text-[10px] font-mono"
                    >
                      {vid.video_source_type}
                    </Badge>

                    {vid.is_free_preview && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        FREE PREVIEW
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(vid)}
                      className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(vid)}
                      className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-red-400 hover:border-red-800/40"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white mt-2 leading-snug">
                  {vid.title}
                </h3>

                {vid.lecture_title && (
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Mapped to Lecture: <span className="text-slate-300">{vid.lecture_title}</span>
                  </p>
                )}
              </div>

              {/* Source Details preview */}
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-900 text-xs font-mono text-slate-300 flex items-center justify-between">
                {vid.video_source_type === 'YOUTUBE' ? (
                  <>
                    <span className="truncate">ID: {vid.youtube_video_id}</span>
                    <a
                      href={`https://www.youtube.com/watch?v=${vid.youtube_video_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Watch</span>
                    </a>
                  </>
                ) : (
                  <>
                    <span className="truncate">Key: {vid.r2_object_key}</span>
                    <span className="text-indigo-400 text-[11px]">R2 Secure</span>
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Duration: {Math.round((vid.duration_seconds || 0) / 60)} mins</span>
                <span>{new Date(vid.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog before Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-5 bg-slate-900 border-red-900/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Video</h3>
                <p className="text-xs text-slate-400">Permanently delete this video reference.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg font-mono">
              &quot;{deleteTarget.title}&quot;
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
