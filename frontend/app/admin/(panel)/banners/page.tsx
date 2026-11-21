'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  ZoomIn,
  Crop,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  ExternalLink,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { Button } from '@/components/ui/button';

interface BannerSlideAdmin {
  id: string;
  image: string;
  image_key?: string;
  title: string;
  caption: string;
  link_url: string;
  alt_text: string;
  duration_seconds: number;
  placement: 'home' | 'login' | 'both';
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type AspectPreset = '16:9' | '4:3' | '1:1' | 'free';

export default function AdminBannersPage() {
  const [slides, setSlides] = useState<BannerSlideAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<BannerSlideAdmin | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [placement, setPlacement] = useState<'home' | 'login' | 'both'>('home');
  const [isActive, setIsActive] = useState(true);

  // Image Upload & Pre-upload Cropper State
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('16:9');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Load Slides
  const fetchSlides = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiClient.get<BannerSlideAdmin[]>('/banners/manage/');
      const list = asList<BannerSlideAdmin>(data);
      setSlides(list.sort((a, b) => a.order - b.order));
    } catch (err: unknown) {
      console.error('[Admin Banners fetch error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load banner slides.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  // Canvas processing: render zoomed, rotated, cropped image to WebP blob
  const processImageToCanvas = useCallback(() => {
    const img = loadedImageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine target dimensions based on preset
    let targetWidth = 1200;
    let targetHeight = 675; // 16:9 default

    if (aspectPreset === '4:3') {
      targetWidth = 1200;
      targetHeight = 900;
    } else if (aspectPreset === '1:1') {
      targetWidth = 900;
      targetHeight = 900;
    } else if (aspectPreset === 'free') {
      targetWidth = Math.min(1600, img.naturalWidth || 1200);
      targetHeight = Math.min(1200, img.naturalHeight || 800);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.save();

    // Center and rotate
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Draw image centered
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = targetWidth / targetHeight;

    let drawW = targetWidth;
    let drawH = targetHeight;

    if (imgAspect > canvasAspect) {
      drawW = targetHeight * imgAspect;
      drawH = targetHeight;
    } else {
      drawW = targetWidth;
      drawH = targetWidth / imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Export to WebP blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setProcessedBlob(blob);
          const newPreview = URL.createObjectURL(blob);
          setPreviewUrl(newPreview);
        }
      },
      'image/webp',
      0.85
    );
  }, [aspectPreset, zoom, rotation]);

  useEffect(() => {
    if (rawImageSrc) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = rawImageSrc;
      img.onload = () => {
        loadedImageRef.current = img;
        processImageToCanvas();
      };
    }
  }, [rawImageSrc, processImageToCanvas]);

  const handleFileSelect = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setErrorMessage('Please select a valid JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file size must be 5 MB or less.');
      return;
    }

    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawImageSrc(e.target?.result as string);
      setRotation(0);
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const openAddModal = () => {
    setEditingSlide(null);
    setTitle('');
    setCaption('');
    setLinkUrl('');
    setAltText('Adept Eduverse Banner');
    setDurationSeconds(5);
    setPlacement('home');
    setIsActive(true);
    setRawImageSrc(null);
    setProcessedBlob(null);
    setPreviewUrl(null);
    setAspectPreset('16:9');
    setZoom(1);
    setRotation(0);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (slide: BannerSlideAdmin) => {
    setEditingSlide(slide);
    setTitle(slide.title);
    setCaption(slide.caption);
    setLinkUrl(slide.link_url);
    setAltText(slide.alt_text);
    setDurationSeconds(slide.duration_seconds);
    setPlacement(slide.placement);
    setIsActive(slide.is_active);
    setRawImageSrc(null);
    setProcessedBlob(null);
    setPreviewUrl(slide.image);
    setAspectPreset('16:9');
    setZoom(1);
    setRotation(0);
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!editingSlide && !processedBlob) {
      setErrorMessage('Please upload and crop an image for this banner.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('caption', caption);
      formData.append('link_url', linkUrl);
      formData.append('alt_text', altText || title || 'Adept Eduverse Banner');
      formData.append('duration_seconds', durationSeconds.toString());
      formData.append('placement', placement);
      formData.append('is_active', isActive ? 'true' : 'false');

      if (processedBlob) {
        formData.append('image_file', processedBlob, 'banner.webp');
      }

      if (editingSlide) {
        await apiClient.patch(`/banners/manage/${editingSlide.id}/`, formData);
        setSuccessMessage(`Updated slide "${title || 'Banner'}" successfully.`);
      } else {
        await apiClient.post('/banners/manage/', formData);
        setSuccessMessage(`Created slide "${title || 'Banner'}" successfully.`);
      }

      setIsModalOpen(false);
      fetchSlides();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save banner slide.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Active Toggle
  const handleToggleActive = async (slide: BannerSlideAdmin) => {
    try {
      await apiClient.patch(`/banners/manage/${slide.id}/`, {
        is_active: !slide.is_active,
      });
      setSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? { ...s, is_active: !s.is_active } : s))
      );
      setSuccessMessage(`Slide "${slide.title || 'Banner'}" is now ${!slide.is_active ? 'active' : 'inactive'}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle slide status.';
      setErrorMessage(msg);
    }
  };

  // Delete Slide
  const handleDeleteSlide = async (id: string) => {
    try {
      await apiClient.delete(`/banners/manage/${id}/`);
      setSlides((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
      setSuccessMessage('Slide deleted from system and Cloudflare R2.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete slide.';
      setErrorMessage(msg);
    }
  };

  // Reorder Up/Down
  const handleMoveSlide = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setSlides(reordered);

    try {
      const ids = reordered.map((s) => s.id);
      await apiClient.post('/banners/manage/reorder/', { ids });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save new slide order.';
      setErrorMessage(msg);
      fetchSlides(); // Revert on error
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Banner Sliders</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage image carousels for Homepage hero and Login portal with per-slide display durations and R2 cloud storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSlides}
            isLoading={isLoading}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Slide
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Slide Count Quotas Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Homepage Active</span>
            <span className="text-xl font-bold text-white mt-0.5 block">
              {slides.filter((s) => s.is_active && (s.placement === 'home' || s.placement === 'both')).length} / 10
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Home
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Login Page Active</span>
            <span className="text-xl font-bold text-white mt-0.5 block">
              {slides.filter((s) => s.is_active && (s.placement === 'login' || s.placement === 'both')).length} / 10
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Login
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Slides In System</span>
            <span className="text-xl font-bold text-white mt-0.5 block">{slides.length}</span>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Cloud R2
          </div>
        </div>
      </div>

      {/* Slides Cards List */}
      {slides.length === 0 && !isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No banner slides created yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            Create your first promotional or announcement banner slide for the homepage hero or login screen.
          </p>
          <Button variant="primary" size="sm" onClick={openAddModal} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Slide
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden bg-slate-900/60 backdrop-blur-md ${
                slide.is_active ? 'border-slate-800 shadow-lg hover:border-slate-700' : 'border-slate-800/50 opacity-60'
              }`}
            >
              {/* Thumbnail with overlay tags */}
              <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden">
                <Image
                  src={slide.image}
                  alt={slide.alt_text || slide.title || 'Slide thumbnail'}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
                  className="object-cover"
                />

                {/* Placement Tag */}
                <div className="absolute top-3 left-3 z-10">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-md backdrop-blur-md border ${
                      slide.placement === 'home'
                        ? 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                        : slide.placement === 'login'
                        ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    }`}
                  >
                    {slide.placement === 'both' ? 'Home & Login' : slide.placement}
                  </span>
                </div>

                {/* Duration Badge */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-950/80 text-amber-300 border border-slate-700/80 shadow-md backdrop-blur-md">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{slide.duration_seconds}s</span>
                </div>

                {/* Reorder Buttons Overlay */}
                <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(index, 'up')}
                    disabled={index === 0}
                    title="Move slide earlier"
                    className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-slate-800"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-400 px-1">#{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(index, 'down')}
                    disabled={index === slides.length - 1}
                    title="Move slide later"
                    className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-slate-800"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-1">
                    {slide.title || <span className="text-slate-500 italic">Untitled Slide</span>}
                  </h3>
                  {slide.caption ? (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{slide.caption}</p>
                  ) : (
                    <p className="text-xs text-slate-600 italic mt-1">No caption provided</p>
                  )}
                  {slide.link_url && (
                    <a
                      href={slide.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 hover:text-amber-300 mt-2 line-clamp-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{slide.link_url}</span>
                    </a>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(slide)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      slide.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    {slide.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{slide.is_active ? 'Active' : 'Inactive'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(slide)}
                      className="p-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60"
                      title="Edit slide"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(slide.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border border-rose-500/20"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Banner Slide?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This will permanently delete the slide record and remove the associated file from Cloudflare R2 storage.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteSlide(deleteConfirmId)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Slide Modal with Image Cropping Tools */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  {editingSlide ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h2 className="text-lg font-bold text-white">
                  {editingSlide ? 'Edit Banner Slide' : 'Add New Banner Slide'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="space-y-5">
              {/* Image Upload & Edit Canvas Area */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Slide Image <span className="text-amber-400">*</span>
                </label>

                {!rawImageSrc && !previewUrl ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40"
                  >
                    <Upload className="w-10 h-10 text-amber-400/80 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">
                      Drag &amp; drop banner image, or click to browse
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      JPG, PNG, or WebP up to 5 MB. Automatically resized to max 1600px width.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    {/* Live Preview Display */}
                    <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Banner Preview"
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-500">
                          Rendering preview...
                        </div>
                      )}
                    </div>

                    {/* Pre-Upload Cropper Toolbar */}
                    {rawImageSrc && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                        {/* Aspect Ratio Presets */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                            <Crop className="w-3.5 h-3.5" /> Preset:
                          </span>
                          {(['16:9', '4:3', '1:1', 'free'] as AspectPreset[]).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setAspectPreset(preset)}
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                aspectPreset === preset
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {/* Zoom & Rotation Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.1"
                              value={zoom}
                              onChange={(e) => setZoom(parseFloat(e.target.value))}
                              className="w-20 accent-amber-400"
                              title="Zoom"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setRotation((prev) => (prev + 90) % 360)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                            title="Rotate 90 degrees"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>90°</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Compressed to WebP (85% quality)
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        Replace Image
                      </button>
                    </div>
                  </div>
                )}

                {/* Hidden File Input & Off-screen Canvas */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Placement & Duration Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Placement Target <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value as 'home' | 'login' | 'both')}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="home">Homepage Hero Slider</option>
                    <option value="login">Login Page Panel</option>
                    <option value="both">Both Homepage &amp; Login Page</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Display Duration (seconds)</span>
                    <span className="text-amber-400 font-bold">{durationSeconds}s</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Math.max(2, Math.min(30, parseInt(e.target.value, 10) || 5)))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This image will appear for {durationSeconds} seconds before advancing.
                  </p>
                </div>
              </div>

              {/* Text Fields: Title & Caption */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Headline Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Admissions Open 2025–26"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Alt Text (Accessibility &amp; SEO)
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="e.g. Master JEE Advanced Math with Ankit Kumar"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Caption / Subtitle (Optional)
                </label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Class 11 &amp; 12 Live Online Batches + 2,700+ Concept Lectures"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Destination Link URL (Optional)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="e.g. https://wa.me/919382557693 or /courses"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs font-bold text-slate-200">Active (Visible in public slider)</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingSlide ? 'Save Changes' : 'Create Slide'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
