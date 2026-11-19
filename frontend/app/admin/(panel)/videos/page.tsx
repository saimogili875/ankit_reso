'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/auth/form-message';
import { HlsVideoPlayer } from '@/components/video/hls-player';
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
  RefreshCw,
  Play,
  Clock,
  Film,
  FileVideo,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

interface RenditionInfo {
  name: string;
  width: number;
  height: number;
  bitrate_kbps: number;
}

interface VideoItem {
  id: string;
  lecture?: string;
  lecture_title?: string;
  chapter_name?: string;
  topic?: string;
  topic_name?: string;
  title: string;
  description: string;
  duration_seconds: number;
  video_source_type: 'YOUTUBE' | 'CLOUD';
  status: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  processing_progress: number;
  error_message?: string;
  youtube_video_id?: string;
  r2_object_key?: string;
  original_key?: string;
  hls_manifest_key?: string;
  poster_key?: string;
  sprite_key?: string;
  vtt_key?: string;
  source_width?: number;
  source_height?: number;
  source_fps?: number;
  file_size?: number;
  renditions?: RenditionInfo[];
  thumbnail_key?: string;
  is_free_preview: boolean;
  is_published?: boolean;
  processed_at?: string;
  created_at?: string;
}

interface LectureOption {
  id: string;
  title: string;
  lecture_number: number;
  chapter_id: string;
  chapter_name: string;
}

interface UploadProgressState {
  isUploading: boolean;
  file: File | null;
  progressPercent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentPart: number;
  totalParts: number;
  statusText: string;
  error: string | null;
  uploadId?: string;
  key?: string;
  videoId?: string;
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
  const [formSourceType, setFormSourceType] = useState<'YOUTUBE' | 'CLOUD'>('CLOUD');
  const [formYoutubeInput, setFormYoutubeInput] = useState('');
  const [formR2Key, setFormR2Key] = useState('');
  const [formFreePreview, setFormFreePreview] = useState(false);

  // Direct Multipart Upload State
  const [uploadState, setUploadState] = useState<UploadProgressState>({
    isUploading: false,
    file: null,
    progressPercent: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    currentPart: 0,
    totalParts: 0,
    statusText: '',
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reprocessing state tracking per video id
  const [reprocessingIds, setReprocessingIds] = useState<Record<string, boolean>>({});

  // Preview Modal State
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);
  const [previewPlaybackData, setPreviewPlaybackData] = useState<{
    manifest_url?: string;
    vtt_url?: string;
    poster_url?: string;
    token?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Fetch videos and lecture options
  const fetchVideosAndOptions = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    try {
      const [optRes, vidRes] = await Promise.all([
        apiClient.get<{ lectures: LectureOption[] }>('/admin-panel/options/'),
        apiClient.get<{ results?: VideoItem[] } | VideoItem[]>('/admin-panel/videos/'),
      ]);
      setLectures(optRes.lectures || []);
      const loadedVideos = Array.isArray(vidRes) ? vidRes : vidRes.results || [];
      setVideos(loadedVideos);
    } catch (err: unknown) {
      if (showLoadingSpinner) {
        setFormError(err instanceof Error ? err.message : 'Error loading video catalog');
      }
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideosAndOptions(true);
  }, [fetchVideosAndOptions]);

  // Polling effect: if any video is QUEUED or PROCESSING, poll every 5 seconds
  useEffect(() => {
    const hasActiveJobs = videos.some(
      (v) => v.status === 'QUEUED' || v.status === 'PROCESSING'
    );
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchVideosAndOptions(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [videos, fetchVideosAndOptions]);

  const resetForm = () => {
    setEditingId(null);
    setFormLecture(lectures.length > 0 ? lectures[0].id : '');
    setFormTitle('');
    setFormDescription('');
    setFormDurationMinutes(45);
    setFormSourceType('CLOUD');
    setFormYoutubeInput('');
    setFormR2Key('');
    setFormFreePreview(false);
    setFormError('');
    setFormSuccess('');
    setUploadState({
      isUploading: false,
      file: null,
      progressPercent: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      currentPart: 0,
      totalParts: 0,
      statusText: '',
      error: null,
    });
    abortControllerRef.current = null;
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
    setFormR2Key(vid.r2_object_key || vid.original_key || '');
    setFormFreePreview(vid.is_free_preview);
    setFormError('');
    setFormSuccess('');
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ================= Direct Multipart Upload to R2 =================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Default title from filename if empty
    if (!formTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setFormTitle(cleanName);
    }

    setUploadState((prev) => ({
      ...prev,
      file,
      totalBytes: file.size,
      error: null,
      progressPercent: 0,
      statusText: `Ready to upload: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    }));
  };

  const handleStartMultipartUpload = async () => {
    const file = uploadState.file;
    if (!file) {
      setFormError('Please select a video file to upload.');
      return;
    }
    if (!formLecture) {
      setFormError('Please select the Target Lecture for this video.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Please provide a Video Title.');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setUploadState((prev) => ({
      ...prev,
      isUploading: true,
      error: null,
      progressPercent: 0,
      statusText: 'Initiating multipart upload with Cloudflare R2...',
    }));
    setFormError('');
    setFormSuccess('');

    let uploadId = '';
    let uniqueKey = '';
    let videoId = '';

    try {
      // Step 1: Initiate Multipart Upload on Django backend
      const initRes = await apiClient.post<{
        upload_id: string;
        key: string;
        video_id: string;
        part_size: number;
        estimated_parts: number;
      }>('/content/videos/upload/initiate/', {
        filename: file.name,
        file_size: file.size,
        content_type: file.type || 'video/mp4',
        title: formTitle.trim(),
        lecture_id: formLecture,
      });

      uploadId = initRes.upload_id;
      uniqueKey = initRes.key;
      videoId = initRes.video_id;
      const partSize = initRes.part_size || 10 * 1024 * 1024;
      const totalParts = initRes.estimated_parts || Math.ceil(file.size / partSize);

      setUploadState((prev) => ({
        ...prev,
        uploadId,
        key: uniqueKey,
        videoId,
        totalParts,
        statusText: `Uploading 0 of ${totalParts} chunks...`,
      }));

      // Step 2: Upload each part sequentially with presigned PUT URLs
      const completedParts: Array<{ PartNumber: number; ETag: string }> = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload aborted by user.');
        }

        const start = (partNumber - 1) * partSize;
        const end = Math.min(file.size, partNumber * partSize);
        const chunk = file.slice(start, end);

        // Fetch presigned part upload URL
        const partUrlRes = await apiClient.post<{
          upload_url: string;
          part_number: number;
        }>('/content/videos/upload/part-url/', {
          key: uniqueKey,
          upload_id: uploadId,
          part_number: partNumber,
        });

        // Direct PUT to R2 with retry
        let partEtag = '';
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const putRes = await fetch(partUrlRes.upload_url, {
              method: 'PUT',
              body: chunk,
              signal: abortController.signal,
            });

            if (!putRes.ok) {
              throw new Error(`R2 HTTP ${putRes.status}: ${putRes.statusText}`);
            }

            const rawEtag = putRes.headers.get('ETag') || putRes.headers.get('etag') || '';
            partEtag = rawEtag.replace(/"/g, '').trim();
            if (!partEtag) {
              partEtag = `part-${partNumber}`;
            }
            break;
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error('Chunk PUT failed');
            if (attempt === 3) throw lastError;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }

        completedParts.push({ PartNumber: partNumber, ETag: partEtag });

        const pct = Math.round((partNumber / totalParts) * 100);
        setUploadState((prev) => ({
          ...prev,
          currentPart: partNumber,
          uploadedBytes: end,
          progressPercent: pct,
          statusText: `Uploaded chunk ${partNumber} / ${totalParts} (${pct}%)`,
        }));
      }

      // Step 3: Complete Multipart Upload
      setUploadState((prev) => ({
        ...prev,
        statusText: 'Assembling chunks and queueing HLS transcode in Celery...',
      }));

      await apiClient.post('/content/videos/upload/complete/', {
        video_id: videoId,
        key: uniqueKey,
        upload_id: uploadId,
        parts: completedParts,
      });

      setFormSuccess('Video successfully uploaded! Transcoding pipeline has been queued.');
      setUploadState({
        isUploading: false,
        file: null,
        progressPercent: 100,
        uploadedBytes: file.size,
        totalBytes: file.size,
        currentPart: totalParts,
        totalParts,
        statusText: 'Completed & Queued for Transcoding!',
        error: null,
      });

      await fetchVideosAndOptions(false);
      setTimeout(() => {
        setIsFormOpen(false);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Multipart upload failed';
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: msg,
        statusText: 'Upload failed.',
      }));
      setFormError(`Upload failed: ${msg}`);

      // Abort multipart on backend if initiated
      if (uniqueKey && uploadId) {
        apiClient.post('/content/videos/upload/abort/', {
          key: uniqueKey,
          upload_id: uploadId,
          video_id: videoId || undefined,
        }).catch(() => {});
      }
    }
  };

  const handleAbortUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (uploadState.key && uploadState.uploadId) {
      apiClient.post('/content/videos/upload/abort/', {
        key: uploadState.key,
        upload_id: uploadState.uploadId,
        video_id: uploadState.videoId,
      }).catch(() => {});
    }
    setUploadState((prev) => ({
      ...prev,
      isUploading: false,
      error: 'Upload cancelled by user.',
      statusText: 'Upload cancelled.',
    }));
  };

  // Standard Form Submit (for YouTube or updating existing Video)
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

    if (formSourceType === 'CLOUD' && !formR2Key.trim() && !uploadState.file) {
      setFormError('Please either select a video file to upload or enter the Cloudflare R2 object key.');
      return;
    }

    // If uploading a new Cloud file, trigger the multipart upload flow instead
    if (formSourceType === 'CLOUD' && uploadState.file && !editingId) {
      handleStartMultipartUpload();
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
        setFormSuccess('Video details updated successfully!');
      } else {
        await apiClient.post('/admin-panel/videos/', payload);
        setFormSuccess('Video entity added successfully!');
      }

      await fetchVideosAndOptions(false);
      setTimeout(() => {
        setIsFormOpen(false);
      }, 700);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save video entity.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reprocess Action
  const handleReprocess = async (video: VideoItem) => {
    setReprocessingIds((prev) => ({ ...prev, [video.id]: true }));
    try {
      await apiClient.post(`/content/videos/${video.id}/reprocess/`, {});
      setFormSuccess(`Reprocessing started for "${video.title}".`);
      await fetchVideosAndOptions(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to trigger reprocessing.');
    } finally {
      setReprocessingIds((prev) => ({ ...prev, [video.id]: false }));
    }
  };

  // Open Preview Modal
  const handleOpenPreview = async (video: VideoItem) => {
    setPreviewVideo(video);
    setPreviewPlaybackData(null);

    if (video.video_source_type === 'YOUTUBE') {
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Backend LecturePlaybackView supports lecture_id OR video_id
      const data = await apiClient.get<{
        manifest_url?: string;
        vtt_url?: string;
        poster_url?: string;
        token?: string;
      }>(`/content/lectures/${video.id}/playback/`);
      setPreviewPlaybackData(data);
    } catch (err: unknown) {
      console.warn('Preview playback load warning:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Publish/Hide toggle action
  const handleTogglePublish = async (video: VideoItem) => {
    const newStatus = !(video.is_published ?? true);
    try {
      await apiClient.patch(`/admin-panel/videos/${video.id}/`, {
        is_published: newStatus,
      });
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, is_published: newStatus } : v))
      );
      setFormSuccess(`Video "${video.title}" ${newStatus ? 'published' : 'hidden'} successfully.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update video publish status.');
    }
  };

  // Delete Action (removes DB record and purges all R2 objects)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/content/videos/${deleteTarget.id}/delete/`);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      setFormSuccess(`Video "${deleteTarget.title}" and cloud assets deleted successfully.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete video.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (video: VideoItem) => {
    if (video.video_source_type === 'YOUTUBE') {
      return (
        <Badge variant="rose" className="text-[10px] font-mono gap-1">
          <PlaySquare className="w-3 h-3" />
          <span>YOUTUBE</span>
        </Badge>
      );
    }

    switch (video.status) {
      case 'READY':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <Check className="w-3 h-3" />
            <span>READY (HLS)</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>TRANSCODING {video.processing_progress}%</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>QUEUED</span>
          </span>
        );
      case 'FAILED':
        return (
          <span
            title={video.error_message || 'Transcode failed'}
            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1 cursor-help"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      case 'UPLOADED':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <UploadCloud className="w-3 h-3" />
            <span>UPLOADED</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <VideoIcon className="w-6 h-6 text-indigo-400" />
            <span>Recorded Lectures & Video Pipeline</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Upload MP4 originals to Cloudflare R2 with automatic Celery HLS multi-rendition transcoding and signed playback tokens.
          </p>
        </div>

        {!isFormOpen && (
          <Button
            variant="primary"
            onClick={openCreateForm}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Upload or Add Video</span>
          </Button>
        )}
      </div>

      {/* Global Feedback Banners */}
      {(formError || formSuccess) && (
        <div className="space-y-2">
          <FormMessage type="error" message={formError} />
          <FormMessage type="success" message={formSuccess} />
        </div>
      )}

      {/* Upload & Configuration Form Card */}
      {isFormOpen && (
        <Card className="p-5 sm:p-6 bg-slate-900 border-indigo-900/60 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                {editingId ? 'Edit Video Asset' : 'Upload Recorded Class / Link Video'}
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
                  <option value="">Select Target Lecture...</option>
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
                  placeholder="e.g. Kinematics Derivation Masterclass (Part 1)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Source Type Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-400">
                Streaming & Storage Provider
              </label>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setFormSourceType('CLOUD')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    formSourceType === 'CLOUD'
                      ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300 font-bold shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span>Cloudflare R2 (HLS Pipeline)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormSourceType('YOUTUBE')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    formSourceType === 'YOUTUBE'
                      ? 'bg-rose-950/50 border-rose-600 text-rose-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <PlaySquare className="w-4 h-4 text-rose-500" />
                  <span>YouTube Stream</span>
                </button>
              </div>

              {formSourceType === 'CLOUD' ? (
                <div className="space-y-4">
                  {/* Direct Multipart Uploader (for new uploads) */}
                  {!editingId && (
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-900/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-indigo-400" />
                          <span>Direct-to-R2 Multipart Video Upload (Up to 5 GB)</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Auto-transcoded to 360p / 480p / 720p HLS
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <input
                          type="file"
                          accept="video/mp4,video/x-m4v,video/*,.mkv,.mov"
                          onChange={handleFileSelect}
                          disabled={uploadState.isUploading}
                          className="flex-1 text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer bg-slate-950 rounded-lg border border-slate-800 p-1"
                        />

                        {uploadState.file && !uploadState.isUploading && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleStartMultipartUpload}
                            className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5 whitespace-nowrap"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Start Upload</span>
                          </Button>
                        )}

                        {uploadState.isUploading && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAbortUpload}
                            className="border-red-800/60 text-red-400 hover:bg-red-950/40 text-xs gap-1 whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel Upload</span>
                          </Button>
                        )}
                      </div>

                      {/* Progress Bar & Status Display */}
                      {(uploadState.isUploading || uploadState.progressPercent > 0) && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium flex items-center gap-1.5">
                              {uploadState.isUploading && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              )}
                              <span>{uploadState.statusText}</span>
                            </span>
                            <span className="font-mono font-bold text-indigo-400">
                              {uploadState.progressPercent}%
                            </span>
                          </div>

                          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 transition-all duration-300 rounded-full"
                              style={{ width: `${uploadState.progressPercent}%` }}
                            />
                          </div>

                          {uploadState.totalParts > 0 && (
                            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                              <span>
                                Chunk {uploadState.currentPart} of {uploadState.totalParts} (10 MB chunks)
                              </span>
                              <span>
                                {(uploadState.uploadedBytes / (1024 * 1024)).toFixed(1)} /{' '}
                                {(uploadState.totalBytes / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual R2 Key input (for editing or pre-uploaded files) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Cloudflare R2 Object Key {editingId && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formR2Key}
                      onChange={(e) => setFormR2Key(e.target.value)}
                      placeholder="originals/kinematics_masterclass.mp4"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {editingId
                        ? 'Reference key of the video source file.'
                        : 'Or paste an existing R2 key directly if you already uploaded it.'}
                    </p>
                  </div>
                </div>
              ) : (
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
                Description / Syllabus Chapters (Optional)
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="00:00 - Introduction, 12:45 - Derivation of projectile motion..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                disabled={uploadState.isUploading}
                className="border-slate-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving || uploadState.isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Update Video' : 'Save Video Asset'}</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Video Cards Grid */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Loading video catalog & transcoding statuses...</span>
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 text-xs">
          No teaching videos registered yet. Click &quot;Upload or Add Video&quot; to attach video media.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((vid) => {
            const isReprocessing = !!reprocessingIds[vid.id];
            const isProcessing = vid.status === 'PROCESSING';

            return (
              <Card
                key={vid.id}
                className="p-5 bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {renderStatusBadge(vid)}

                      {vid.is_published === false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          HIDDEN
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          PUBLISHED
                        </span>
                      )}

                      {vid.is_free_preview && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          FREE PREVIEW
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Publish / Hide Toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePublish(vid)}
                        className={`border-slate-800 text-xs py-1 h-7 px-2 gap-1 ${
                          vid.is_published === false ? 'hover:text-emerald-400' : 'hover:text-amber-400'
                        }`}
                        title={vid.is_published === false ? 'Publish to students' : 'Hide from students'}
                      >
                        {vid.is_published === false ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-amber-400" />}
                        <span>{vid.is_published === false ? 'Publish' : 'Hide'}</span>
                      </Button>

                      {/* Preview Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPreview(vid)}
                        className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-emerald-400 hover:border-emerald-800/40"
                        title="Preview video playback"
                      >
                        <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                        <span>Preview</span>
                      </Button>

                      {/* Reprocess Button (for Cloud videos) */}
                      {vid.video_source_type === 'CLOUD' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReprocess(vid)}
                          disabled={isReprocessing || vid.status === 'PROCESSING'}
                          className="border-slate-800 text-xs py-1 h-7 px-2.5 gap-1 hover:text-indigo-400"
                          title="Re-run HLS transcode pipeline"
                        >
                          <RefreshCw className={`w-3 h-3 ${isReprocessing ? 'animate-spin' : ''}`} />
                          <span>Reprocess</span>
                        </Button>
                      )}

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

                  <h3 className="text-sm font-bold text-white mt-2.5 leading-snug">
                    {vid.title}
                  </h3>

                  {vid.lecture_title && (
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Lecture: <span className="text-slate-300">{vid.lecture_title}</span>
                    </p>
                  )}

                  {/* Processing Progress Bar */}
                  {isProcessing && (
                    <div className="mt-3 p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/40 space-y-1.5">
                      <div className="flex justify-between text-[11px] text-indigo-300">
                        <span className="flex items-center gap-1 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Transcoding HLS Renditions...</span>
                        </span>
                        <span className="font-mono font-bold">{vid.processing_progress}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 transition-all duration-500 rounded-full"
                          style={{ width: `${vid.processing_progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Transcode Failure Banner */}
                  {vid.status === 'FAILED' && vid.error_message && (
                    <div className="mt-2.5 p-2 rounded-lg bg-red-950/40 border border-red-900/50 text-[11px] text-red-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="font-mono break-all">{vid.error_message}</span>
                    </div>
                  )}
                </div>

                {/* Source & Renditions Details */}
                <div className="space-y-2">
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
                        <span className="truncate text-slate-400">
                          {vid.hls_manifest_key || vid.original_key || vid.r2_object_key || 'Pending transcode'}
                        </span>
                        <span className="text-indigo-400 text-[11px] shrink-0 ml-2">R2 HLS</span>
                      </>
                    )}
                  </div>

                  {/* Active Renditions Pills */}
                  {vid.renditions && vid.renditions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Renditions:
                      </span>
                      {vid.renditions.map((r) => (
                        <span
                          key={r.name}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-indigo-300 border border-slate-700"
                        >
                          {r.name} ({r.bitrate_kbps} kbps)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    Duration: {Math.round((vid.duration_seconds || 0) / 60)} mins
                    {vid.file_size ? ` • ${(vid.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}
                  </span>
                  <span>{new Date(vid.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full p-5 bg-slate-950 border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white truncate max-w-xl">
                  Preview: {previewVideo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewVideo(null);
                  setPreviewPlaybackData(null);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewVideo.video_source_type === 'YOUTUBE' ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                <iframe
                  src={`https://www.youtube.com/embed/${previewVideo.youtube_video_id}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : previewVideo.status !== 'READY' ? (
              <div className="p-8 text-center space-y-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <FileVideo className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">
                  Video is currently in status: <span className="text-indigo-400 uppercase font-mono">{previewVideo.status}</span>
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {previewVideo.status === 'PROCESSING'
                    ? `Transcoding in progress (${previewVideo.processing_progress}%). HLS multi-rendition stream will be available once ready.`
                    : previewVideo.status === 'QUEUED'
                    ? 'Video is queued in Celery. Transcoding will start shortly.'
                    : previewVideo.status === 'FAILED'
                    ? `Transcoding failed: ${previewVideo.error_message || 'Unknown error'}. Click "Reprocess" to retry.`
                    : 'Upload complete. Processing has not yet finalized.'}
                </p>
              </div>
            ) : isLoadingPreview ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <span>Issuing signed HMAC playback token...</span>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800">
                <HlsVideoPlayer
                  videoId={previewVideo.id}
                  title={previewVideo.title}
                  manifestUrl={previewPlaybackData?.manifest_url}
                  vttUrl={previewPlaybackData?.vtt_url}
                  posterUrl={previewPlaybackData?.poster_url}
                  durationSeconds={previewVideo.duration_seconds}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="font-mono text-[11px]">
                Source: {previewVideo.video_source_type} • ID: {previewVideo.id}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewVideo(null);
                  setPreviewPlaybackData(null);
                }}
                className="border-slate-800 text-xs"
              >
                Close Preview
              </Button>
            </div>
          </Card>
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
                <h3 className="text-sm font-bold text-white">Delete Video Asset</h3>
                <p className="text-xs text-slate-400">
                  Permanently deletes the database entity AND purges all R2 cloud objects.
                </p>
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
                    <span>Purging R2 & DB...</span>
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
