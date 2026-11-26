'use client';

import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Lock,
  Loader2,
  FileText,
} from 'lucide-react';

interface PageItem {
  page_number: number;
  url: string;
}

interface ViewerMetaResponse {
  item_id: string;
  title: string;
  viewer_mode: 'STRONG' | 'BASIC';
  is_solution: boolean;
  total_pages: number;
  pages: PageItem[];
  watermark_user?: string;
}

interface SecureDocumentViewerProps {
  itemId: string;
  isSolution?: boolean;
  onClose?: () => void;
}

export const SecureDocumentViewer: React.FC<SecureDocumentViewerProps> = ({
  itemId,
  isSolution = false,
  onClose,
}) => {
  const [meta, setMeta] = useState<ViewerMetaResponse | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPages() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiClient.get<ViewerMetaResponse>(
          `/course-content/items/${itemId}/pages/?solution=${isSolution ? '1' : '0'}`
        );
        setMeta(res);
        setCurrentPage(1);
      } catch (err: unknown) {
        console.error('[SecureDocumentViewer] failed to load pages:', err);
        const msg = err instanceof ApiError ? err.message : 'Failed to load protected document.';
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadPages();
  }, [itemId, isSolution]);

  const totalPages = meta?.total_pages || meta?.pages?.length || 1;
  const currentPageItem = meta?.pages?.find((p) => p.page_number === currentPage) || meta?.pages?.[0];

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((z) => Math.max(60, Math.min(200, z + delta)));
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl select-none secure-viewer-container ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative w-full max-w-4xl mx-auto my-4 min-h-[600px]'
      }`}
    >
      {/* Viewer Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border-b border-slate-800 text-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs sm:text-sm text-slate-100 truncate max-w-[220px] sm:max-w-sm">
                {meta?.title || 'Protected Material'}
              </h3>
              {isSolution ? (
                <Badge variant="outline" className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                  Solutions
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Anti-Leak Watermarking Active • No Downloads</span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <button
              onClick={() => handleZoom(-15)}
              className="p-1 text-slate-400 hover:text-slate-100"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 w-10 text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => handleZoom(15)}
              className="p-1 text-slate-400 hover:text-slate-100"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-slate-300 px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-100"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Viewer Body / Page Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-950/95 relative min-h-[500px]">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs">Preparing secure watermarked document...</span>
          </div>
        ) : errorMsg ? (
          <div className="text-center p-8 max-w-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-200 text-base">Protected Content</h4>
            <p className="text-xs text-slate-400">{errorMsg}</p>
          </div>
        ) : currentPageItem ? (
          <div
            style={{ width: `${zoomLevel}%` }}
            className="transition-all duration-150 max-w-full flex justify-center shadow-2xl relative"
          >
            {/* The secure page image rendered server-side */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPageItem.url}
              alt={`Page ${currentPage}`}
              onDragStart={(e) => e.preventDefault()}
              className="rounded-lg border border-slate-800 shadow-2xl w-full h-auto object-contain pointer-events-none select-none"
            />
          </div>
        ) : null}
      </div>

      {/* Print protection stylesheet */}
      <style jsx global>{`
        @media print {
          .secure-viewer-container {
            display: none !important;
          }
          body {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
