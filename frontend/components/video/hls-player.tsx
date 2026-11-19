'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Settings,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface HlsPlayerProps {
  videoId?: string;
  lectureId?: string;
  title: string;
  manifestUrl?: string;
  youtubeVideoId?: string;
  posterUrl?: string;
  vttUrl?: string;
  initialPositionSeconds?: number;
  durationSeconds?: number;
  isFreePreview?: boolean;
  onEnded?: () => void;
  onProgressUpdate?: (watchedSeconds: number, lastPosition: number, percent: number) => void;
}

interface QualityLevel {
  index: number; // -1 for Auto
  label: string;
  height: number;
  bitrate: number;
}

interface CueThumbnail {
  start: number;
  end: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function HlsVideoPlayer({
  videoId,
  lectureId,
  title,
  manifestUrl,
  youtubeVideoId,
  posterUrl,
  vttUrl,
  initialPositionSeconds = 0,
  durationSeconds = 0,
  onEnded,
  onProgressUpdate,
}: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quality levels
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = Auto

  // UI menu popovers
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Thumbnail WebVTT cues for seek hover
  const [thumbnails, setThumbnails] = useState<CueThumbnail[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPositionPx, setHoverPositionPx] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // QoE telemetry tracking
  const loadStartTimeRef = useRef<number>(Date.now());
  const firstFrameReportedRef = useRef<boolean>(false);
  const rebufferCountRef = useRef<number>(0);
  const rebufferStartRef = useRef<number | null>(null);
  const totalRebufferMsRef = useRef<number>(0);
  const resumeInitializedRef = useRef<boolean>(false);

  // 1. Report QoE Stats to backend
  const reportQoEStat = useCallback(
    (timeToFirstFrameMs?: number) => {
      if (!videoId) return;
      try {
        apiClient.post(`/content/videos/${videoId}/stats/`, {
          time_to_first_frame_ms: timeToFirstFrameMs,
          rebuffer_count: rebufferCountRef.current,
          total_rebuffer_duration_ms: totalRebufferMsRef.current,
          selected_quality: selectedQuality === -1 ? 'Auto' : `${qualityLevels.find((q) => q.index === selectedQuality)?.height}p`,
          device_info: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
          },
        }).catch(() => {});
      } catch {}
    },
    [videoId, selectedQuality, qualityLevels]
  );

  // 2. Report Progress to backend
  const reportProgress = useCallback(
    (forceKeepalive = false) => {
      const vid = videoRef.current;
      if (!vid) return;

      const pos = Math.floor(vid.currentTime);
      const totalDur = Math.floor(vid.duration || duration || 1);
      const pct = Math.min(100, (pos / totalDur) * 100);

      onProgressUpdate?.(pos, pos, pct);

      const payload = {
        video_id: videoId,
        lecture_id: lectureId,
        last_position_seconds: pos,
        watched_seconds: pos,
        completion_percent: Math.round(pct * 10) / 10,
        completed: pct >= 90.0,
      };

      if (forceKeepalive && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/progress/video/', blob);
      } else {
        apiClient.post('/progress/video/', payload).catch(() => {});
      }
    },
    [videoId, lectureId, duration, onProgressUpdate]
  );

  // 3. Periodic Progress Saver (every 30s while playing - cuts DB write load by 50% while preserving accuracy via pause/seek/visibility handlers)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      reportProgress();
    }, 30000);
    return () => clearInterval(interval);
  }, [isPlaying, reportProgress]);

  // 4. Save on Tab Hide & Component Unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportProgress(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      reportProgress(true);
    };
  }, [reportProgress]);

  // 5. Load and Parse WebVTT seek previews
  useEffect(() => {
    if (!vttUrl) return;

    fetch(vttUrl)
      .then((res) => res.text())
      .then((text) => {
        const lines = text.split('\n');
        const cues: CueThumbnail[] = [];
        let currentStart = 0;
        let currentEnd = 0;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes('-->')) {
            const [s, e] = trimmed.split('-->').map((t) => {
              const parts = t.trim().split(':');
              if (parts.length === 3) {
                return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              }
              return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
            });
            currentStart = s || 0;
            currentEnd = e || 0;
          } else if (trimmed.includes('#xywh=')) {
            const [urlPart, xywh] = trimmed.split('#xywh=');
            if (xywh) {
              const [x, y, w, h] = xywh.split(',').map((n) => parseInt(n, 10));
              // Construct absolute image URL based on vttUrl
              const imgUrl = vttUrl.replace(/[^/]+$/, urlPart);
              cues.push({ start: currentStart, end: currentEnd, url: imgUrl, x, y, w, h });
            }
          }
        }
        setThumbnails(cues);
      })
      .catch(() => {});
  }, [vttUrl]);

  // 6. Initialize HLS.js or Native Video
  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !manifestUrl) return;

    setIsLoading(true);
    setErrorMsg(null);
    loadStartTimeRef.current = Date.now();
    firstFrameReportedRef.current = false;

    // Destroy existing instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true, // Auto-cap bitrate to container size
        maxBufferLength: 20,       // 20s target buffer
        maxMaxBufferLength: 40,
        startLevel: 0,             // Fast start at lowest level
        enableWorker: true,
        lowLatencyMode: false,
      });

      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        const levels: QualityLevel[] = [
          { index: -1, label: 'Auto (ABR)', height: 0, bitrate: 0 },
          ...data.levels.map((lvl, idx) => ({
            index: idx,
            label: `${lvl.height}p`,
            height: lvl.height,
            bitrate: lvl.bitrate,
          })),
        ];
        setQualityLevels(levels);

        // Resume from initial position
        if (!resumeInitializedRef.current && initialPositionSeconds > 0) {
          video.currentTime = initialPositionSeconds;
          resumeInitializedRef.current = true;
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        // Updated active level
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.response && data.response.code === 403) {
                setErrorMsg('Playback token expired. Please refresh the page to obtain a fresh token.');
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setErrorMsg('A fatal playback error occurred. Please try again.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari iOS HLS playback
      video.src = manifestUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (!resumeInitializedRef.current && initialPositionSeconds > 0) {
          video.currentTime = initialPositionSeconds;
          resumeInitializedRef.current = true;
        }
      });
    } else {
      setErrorMsg('Your browser does not support HLS video streaming.');
      setIsLoading(false);
    }
  }, [manifestUrl, initialPositionSeconds]);

  const handleRetry = useCallback(async () => {
    setErrorMsg(null);
    if (lectureId) {
      try {
        const data = await apiClient.get<{ manifest_url?: string }>(`/content/lectures/${lectureId}/playback/`);
        if (data.manifest_url && hlsRef.current) {
          hlsRef.current.loadSource(data.manifest_url);
          hlsRef.current.startLoad();
          return;
        }
      } catch {}
    }
    initPlayer();
  }, [lectureId, initPlayer]);

  useEffect(() => {
    initPlayer();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initPlayer]);

  // 7. Video DOM Event Listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (!firstFrameReportedRef.current && video.currentTime > 0) {
        firstFrameReportedRef.current = true;
        const ttff = Date.now() - loadStartTimeRef.current;
        reportQoEStat(ttff);
      }
    };

    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      reportProgress();
    };
    const onWaiting = () => {
      setIsBuffering(true);
      rebufferCountRef.current += 1;
      rebufferStartRef.current = Date.now();
    };
    const onPlaying = () => {
      setIsBuffering(false);
      if (rebufferStartRef.current) {
        totalRebufferMsRef.current += Date.now() - rebufferStartRef.current;
        rebufferStartRef.current = null;
      }
    };
    const onVideoEnded = () => {
      setIsPlaying(false);
      reportProgress();
      onEnded?.();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onVideoEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onVideoEnded);
    };
  }, [reportProgress, reportQoEStat, onEnded]);

  // 8. Player Controls Handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume || 0.8;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setIsSpeedMenuOpen(false);
  };

  const changeQuality = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setSelectedQuality(levelIndex);
    setIsQualityMenuOpen(false);
  };

  // 9. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'l':
          e.preventDefault();
          handleSkip(10);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSkip(-5);
          break;
        case 'arrowright':
          e.preventDefault();
          handleSkip(5);
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            const video = videoRef.current;
            if (video && video.duration) {
              const fraction = parseInt(e.key, 10) / 10;
              video.currentTime = video.duration * fraction;
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isMuted, isPlaying]);

  // 10. Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // 11. Seekbar Progress & Thumbnail Hover calculation
  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = pos * duration;
    setHoverTime(targetSec);
    setHoverPositionPx(e.clientX - rect.left);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    reportProgress();
  };

  // Find thumbnail tile corresponding to hoverTime
  const activeThumbnail = useMemo(() => {
    if (hoverTime === null || thumbnails.length === 0) return null;
    return thumbnails.find((t) => hoverTime >= t.start && hoverTime < t.end) || thumbnails[0];
  }, [hoverTime, thumbnails]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // YouTube Fallback
  if (youtubeVideoId) {
    const ytId = youtubeVideoId.replace(/.*(v=|youtu\.be\/)/, '').split('&')[0];
    return (
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&modestbranding=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl select-none group font-sans"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={posterUrl}
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/30 backdrop-blur-xs z-10">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center z-30 space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <h3 className="text-base font-bold text-white">Playback Interrupted</h3>
          <p className="text-xs text-slate-400 max-w-sm">{errorMsg}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Playback
          </button>
        </div>
      )}

      {/* Center Big Play Button (when paused) */}
      {!isPlaying && !isLoading && !errorMsg && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 group-hover:bg-black/30 transition-all z-10"
        >
          <div className="w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center pl-1 shadow-xl hover:scale-110 transition-all">
            <Play className="w-8 h-8 fill-current" />
          </div>
        </div>
      )}

      {/* Bottom Gradient Overlay for Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 pt-16 pb-3 px-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seekbar & Thumbnail Preview */}
        <div
          ref={progressBarRef}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          onClick={handleSeekClick}
          className="relative w-full h-2 hover:h-3 bg-slate-700/60 rounded-full cursor-pointer mb-3 transition-all"
        >
          {/* Buffered Progress */}
          <div
            style={{ width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
            className="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all"
          />

          {/* Hover Time & Thumbnail Preview Tooltip */}
          {hoverTime !== null && (
            <div
              style={{ left: `${hoverPositionPx}px` }}
              className="absolute bottom-4 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30"
            >
              {activeThumbnail && (
                <div
                  style={{
                    width: '160px',
                    height: '90px',
                    backgroundImage: `url(${activeThumbnail.url})`,
                    backgroundPosition: `-${activeThumbnail.x}px -${activeThumbnail.y}px`,
                    backgroundSize: 'auto',
                  }}
                  className="rounded-lg border border-slate-700 shadow-xl overflow-hidden mb-1 bg-black"
                />
              )}
              <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono font-bold text-white shadow-md">
                {formatTime(hoverTime)}
              </span>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-xs font-semibold">
          {/* Left: Play/Pause, Skips, Time */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 hover:text-blue-400 transition-colors"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(-10)}
              className="p-1.5 hover:text-blue-400 transition-colors text-slate-300"
              title="Skip back 10s (J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSkip(10)}
              className="p-1.5 hover:text-blue-400 transition-colors text-slate-300"
              title="Skip forward 10s (L)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button type="button" onClick={toggleMute} className="p-1 hover:text-blue-400">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded-lg accent-blue-500 cursor-pointer opacity-70 group-hover/vol:opacity-100 transition-opacity"
              />
            </div>

            {/* Timestamps */}
            <span className="font-mono text-[11px] text-slate-300 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Quality, Speed, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSpeedMenuOpen(!isSpeedMenuOpen);
                  setIsQualityMenuOpen(false);
                }}
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition-colors"
              >
                {playbackSpeed}x
              </button>

              {isSpeedMenuOpen && (
                <div className="absolute bottom-9 right-0 w-28 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-30 space-y-0.5">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => changeSpeed(sp)}
                      className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        playbackSpeed === sp ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{sp}x</span>
                      {playbackSpeed === sp && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector */}
            {qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsQualityMenuOpen(!isQualityMenuOpen);
                    setIsSpeedMenuOpen(false);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {selectedQuality === -1
                      ? 'Auto'
                      : qualityLevels.find((q) => q.index === selectedQuality)?.label || 'Quality'}
                  </span>
                </button>

                {isQualityMenuOpen && (
                  <div className="absolute bottom-9 right-0 w-32 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-30 space-y-0.5">
                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.index}
                        type="button"
                        onClick={() => changeQuality(lvl.index)}
                        className={`w-full flex items-center justify-between px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          selectedQuality === lvl.index ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{lvl.label}</span>
                        {selectedQuality === lvl.index && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 hover:text-blue-400 transition-colors text-slate-300"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
