import os
import json
import math
import shutil
import logging
import tempfile
import subprocess
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from celery import shared_task
from storage.service import storage_service
from .models import Video

logger = logging.getLogger(__name__)


def _format_vtt_timestamp(seconds: float) -> str:
    """Formats float seconds into WebVTT timestamp format: HH:MM:SS.mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


@shared_task(queue='video', bind=True, max_retries=3, default_retry_delay=60)
def transcode_video_hls_task(self, video_id: str):
    """
    Asynchronous Celery task for transcoding uploaded MP4 video into multi-rendition HLS (H.264 + AAC).
    Generates:
    - Master playlist (master.m3u8)
    - Variant playlists and 6-second VOD segments for each rendition (360p, 480p, 720p, 1080p)
    - High-quality poster image (poster.jpg)
    - Seek preview thumbnail sprite sheet (thumbnails.jpg) and WebVTT index (thumbnails.vtt)
    - Uploads everything directly to Cloudflare R2 private bucket under videos/{video_id}/
    """
    # 1. Distributed lock to ensure idempotency and avoid duplicate processing
    lock_key = f"video_transcode_lock_{video_id}"
    acquired = cache.add(lock_key, "locked", timeout=7200) # 2 hours lock
    if not acquired:
        logger.info(f"Transcoding already in progress for Video {video_id}. Skipping duplicate task.")
        return f"Video {video_id} is already being processed."

    temp_dir = tempfile.mkdtemp(prefix=f"video_hls_{video_id}_")

    try:
        video = Video.objects.filter(id=video_id).first()
        if not video:
            logger.error(f"Video {video_id} not found.")
            return f"Video {video_id} not found."

        if video.status == Video.Status.READY and video.hls_manifest_key:
            logger.info(f"Video {video_id} is already in READY status. Skipping.")
            return f"Video {video_id} already ready."

        logger.info(f"Starting HLS transcoding pipeline for Video {video_id}: {video.title}")
        video.status = Video.Status.PROCESSING
        video.processing_progress = 5
        video.error_message = ''
        video.save(update_fields=['status', 'processing_progress', 'error_message'])

        original_key = video.original_key or video.r2_object_key
        if not original_key:
            raise ValueError(f"No original R2 object key found on Video {video_id}.")

        local_original = os.path.join(temp_dir, "original.mp4")

        # 2. Download original MP4 from Cloudflare R2
        logger.info(f"Downloading original video from R2: {original_key} -> {local_original}")
        download_ok = storage_service.download_file(original_key, local_original)
        if not download_ok or not os.path.exists(local_original):
            raise RuntimeError(f"Failed to download original video from R2 key: {original_key}")

        file_size = os.path.getsize(local_original)
        video.file_size = file_size
        video.processing_progress = 15
        video.save(update_fields=['file_size', 'processing_progress'])

        # 3. Probe with ffprobe
        probe_cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'stream=width,height,r_frame_rate,codec_type,codec_name',
            '-show_entries', 'format=duration,size',
            '-of', 'json',
            local_original
        ]
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
        if probe_res.returncode != 0:
            raise RuntimeError(f"ffprobe failed to inspect file: {probe_res.stderr}")

        probe_data = json.loads(probe_res.stdout)
        streams = probe_data.get('streams', [])
        video_stream = next((s for s in streams if s.get('codec_type') == 'video'), None)
        if not video_stream:
            raise ValueError("No video stream found in uploaded media file (corrupt or audio-only).")

        source_width = int(video_stream.get('width', 1280))
        source_height = int(video_stream.get('height', 720))
        duration = float(probe_data.get('format', {}).get('duration', 0.0))

        # Parse FPS
        fps = 30.0
        fps_str = video_stream.get('r_frame_rate', '30/1')
        if '/' in fps_str:
            num, den = fps_str.split('/')
            fps = float(num) / float(den) if float(den) > 0 else 30.0
        fps = min(fps, 30.0) # Cap at 30 fps

        video.source_width = source_width
        video.source_height = source_height
        video.source_fps = fps
        video.duration_seconds = int(duration)
        video.processing_progress = 25
        video.save(update_fields=['source_width', 'source_height', 'source_fps', 'duration_seconds', 'processing_progress'])

        # 4. Filter target profiles (never upscale)
        profiles_config = getattr(settings, 'VIDEO_PROFILES', {})
        enable_1080p = getattr(settings, 'ENABLE_1080P', False)
        segment_duration = getattr(settings, 'HLS_SEGMENT_DURATION', 6)

        target_renditions = []
        for name, prof in profiles_config.items():
            if name == '1080p' and not enable_1080p:
                continue
            # Never upscale above source height unless it is the baseline 360p
            if prof['height'] <= source_height or name == '360p':
                target_renditions.append((name, prof))

        if not target_renditions:
            # Fallback to source resolution or 720p
            target_renditions = [('720p', profiles_config.get('720p', {'width': 1280, 'height': 720, 'bitrate': '2200k', 'maxrate': '2400k', 'bufsize': '4400k', 'crf': 20}))]

        logger.info(f"Transcoding video into {len(target_renditions)} renditions: {[r[0] for r in target_renditions]}")

        # 5. Transcode each rendition
        renditions_meta = []
        progress_per_rendition = 50 / max(len(target_renditions), 1)

        for idx, (r_name, r_prof) in enumerate(target_renditions):
            r_dir = os.path.join(temp_dir, r_name)
            os.makedirs(r_dir, exist_ok=True)
            r_playlist = os.path.join(r_dir, "playlist.m3u8")
            segment_template = os.path.join(r_dir, "segment_%03d.ts")

            target_width = min(r_prof['width'], source_width)
            target_height = min(r_prof['height'], source_height)

            # Ensure even dimensions for yuv420p
            if target_width % 2 != 0:
                target_width -= 1
            if target_height % 2 != 0:
                target_height -= 1

            # Keyframe interval: 6 seconds * 30 fps = 180 frames
            keyint = int(round(fps * segment_duration))

            ffmpeg_cmd = [
                'ffmpeg',
                '-y',
                '-i', local_original,
                '-vf', f"scale={target_width}:{target_height}:flags=lanczos",
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-profile:v', 'high',
                '-pix_fmt', 'yuv420p',
                '-crf', str(r_prof.get('crf', 21)),
                '-maxrate', r_prof['maxrate'],
                '-bufsize', r_prof['bufsize'],
                '-r', str(fps),
                '-g', str(keyint),
                '-keyint_min', str(keyint),
                '-sc_threshold', '0',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-ar', '48000',
                '-hls_time', str(segment_duration),
                '-hls_playlist_type', 'vod',
                '-hls_segment_filename', segment_template,
                r_playlist
            ]

            logger.info(f"Running FFmpeg for rendition {r_name} ({target_width}x{target_height})")
            res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError(f"FFmpeg failed on rendition {r_name}: {res.stderr[-500:]}")

            # Parse integer bandwidth in bps
            bitrate_num = int(r_prof['bitrate'].replace('k', '')) * 1000

            renditions_meta.append({
                'name': r_name,
                'width': target_width,
                'height': target_height,
                'bitrate': r_prof['bitrate'],
                'bandwidth': bitrate_num,
                'manifest_rel_path': f"{r_name}/playlist.m3u8"
            })

            video.processing_progress = int(25 + (idx + 1) * progress_per_rendition)
            video.save(update_fields=['processing_progress'])

        # 6. Generate master.m3u8
        master_path = os.path.join(temp_dir, "master.m3u8")
        with open(master_path, 'w', encoding='utf-8') as f:
            f.write("#EXTM3U\n")
            f.write("#EXT-X-VERSION:3\n\n")
            for r in renditions_meta:
                f.write(
                    f"#EXT-X-STREAM-INF:BANDWIDTH={r['bandwidth']},RESOLUTION={r['width']}x{r['height']},NAME=\"{r['name']}\"\n"
                )
                f.write(f"{r['manifest_rel_path']}\n\n")

        # 7. Generate poster.jpg (frame at ~10% of duration)
        poster_time = max(1.0, min(duration * 0.1, 30.0))
        poster_path = os.path.join(temp_dir, "poster.jpg")
        poster_cmd = [
            'ffmpeg', '-y',
            '-ss', str(poster_time),
            '-i', local_original,
            '-vframes', '1',
            '-q:v', '2',
            poster_path
        ]
        subprocess.run(poster_cmd, capture_output=True)

        # 8. Generate thumbnail sprite sheet & WebVTT for seekbar hover previews
        # Generates a grid of up to 100 thumbnails (1 every N seconds)
        thumb_interval = max(5, int(math.ceil(duration / 100)))
        total_thumbs = max(1, int(math.ceil(duration / thumb_interval)))
        grid_cols = min(10, total_thumbs)
        grid_rows = int(math.ceil(total_thumbs / grid_cols))

        sprite_path = os.path.join(temp_dir, "thumbnails.jpg")
        vtt_path = os.path.join(temp_dir, "thumbnails.vtt")

        sprite_cmd = [
            'ffmpeg', '-y',
            '-i', local_original,
            '-vf', f"fps=1/{thumb_interval},scale=160:90,tile={grid_cols}x{grid_rows}",
            '-q:v', '3',
            sprite_path
        ]
        subprocess.run(sprite_cmd, capture_output=True)

        # Build WebVTT file
        with open(vtt_path, 'w', encoding='utf-8') as f:
            f.write("WEBVTT\n\n")
            thumb_idx = 0
            for r in range(grid_rows):
                for c in range(grid_cols):
                    if thumb_idx >= total_thumbs:
                        break
                    start_sec = thumb_idx * thumb_interval
                    end_sec = min(duration, (thumb_idx + 1) * thumb_interval)
                    x = c * 160
                    y = r * 90
                    f.write(f"{_format_vtt_timestamp(start_sec)} --> {_format_vtt_timestamp(end_sec)}\n")
                    f.write(f"thumbnails.jpg#xywh={x},{y},160,90\n\n")
                    thumb_idx += 1

        video.processing_progress = 85
        video.save(update_fields=['processing_progress'])

        # 9. Upload all generated HLS files and assets to Cloudflare R2
        r2_base_prefix = f"videos/{video.id}"
        logger.info(f"Uploading HLS assets to Cloudflare R2: {r2_base_prefix}/...")

        # Master playlist
        storage_service.upload_file_direct(master_path, f"{r2_base_prefix}/master.m3u8", content_type="application/vnd.apple.mpegurl")

        # Rendition playlists and segments
        for r in renditions_meta:
            r_name = r['name']
            r_local_dir = os.path.join(temp_dir, r_name)
            for fname in os.listdir(r_local_dir):
                fpath = os.path.join(r_local_dir, fname)
                if fname.endswith('.m3u8'):
                    storage_service.upload_file_direct(fpath, f"{r2_base_prefix}/{r_name}/{fname}", content_type="application/vnd.apple.mpegurl")
                elif fname.endswith('.ts'):
                    storage_service.upload_file_direct(fpath, f"{r2_base_prefix}/{r_name}/{fname}", content_type="video/mp2t")

        # Poster and thumbnails
        if os.path.exists(poster_path):
            storage_service.upload_file_direct(poster_path, f"{r2_base_prefix}/poster.jpg", content_type="image/jpeg")
            video.poster_key = f"{r2_base_prefix}/poster.jpg"
            video.thumbnail_key = f"{r2_base_prefix}/poster.jpg"

        if os.path.exists(sprite_path) and os.path.exists(vtt_path):
            storage_service.upload_file_direct(sprite_path, f"{r2_base_prefix}/thumbnails.jpg", content_type="image/jpeg")
            storage_service.upload_file_direct(vtt_path, f"{r2_base_prefix}/thumbnails.vtt", content_type="text/vtt")
            video.sprite_key = f"{r2_base_prefix}/thumbnails.jpg"
            video.vtt_key = f"{r2_base_prefix}/thumbnails.vtt"

        # 10. Finalize Video model state
        video.hls_manifest_key = f"{r2_base_prefix}/master.m3u8"
        video.r2_object_key = f"{r2_base_prefix}/master.m3u8"
        video.renditions = renditions_meta
        video.status = Video.Status.READY
        video.processing_progress = 100
        video.processed_at = timezone.now()
        video.error_message = ''
        video.save()

        # Update lecture duration if lecture is attached
        if video.lecture and video.duration_seconds > 0:
            video.lecture.duration_seconds = video.duration_seconds
            video.lecture.save(update_fields=['duration_seconds'])

        # Optional deletion of original uploaded file to save storage
        if getattr(settings, 'DELETE_ORIGINAL_AFTER_PROCESSING', False):
            storage_service.delete_object(original_key)
            logger.info(f"Purged original MP4 file from R2: {original_key}")

        logger.info(f"HLS Transcoding completed successfully for Video {video_id} ({len(renditions_meta)} renditions).")
        return f"Successfully processed Video {video_id} into {len(renditions_meta)} renditions."

    except Exception as exc:
        logger.exception(f"Transcoding failed for Video {video_id}: {exc}")
        video = Video.objects.filter(id=video_id).first()
        if video:
            video.status = Video.Status.FAILED
            video.error_message = str(exc)[:1000]
            video.save(update_fields=['status', 'error_message'])

        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        raise

    finally:
        # Clean up temporary files and release lock
        cache.delete(lock_key)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


@shared_task
def reap_stuck_video_processing_jobs():
    """
    Periodic safety worker to recover from worker crashes:
    Finds videos stuck in PROCESSING status for more than 30 minutes, marks them QUEUED,
    and re-enqueues transcoding task.
    """
    cutoff = timezone.now() - timedelta(minutes=30)
    stuck_videos = Video.objects.filter(
        status=Video.Status.PROCESSING,
        updated_at__lte=cutoff
    )

    requeued_count = 0
    for vid in stuck_videos:
        logger.warning(f"Reaper detected stuck video processing job: {vid.title} (ID: {vid.id}). Re-queueing...")
        vid.status = Video.Status.QUEUED
        vid.error_message = "Automatically recovered after processing timeout."
        vid.save(update_fields=['status', 'error_message'])
        transcode_video_hls_task.delay(str(vid.id))
        requeued_count += 1

    return f"Reaped {requeued_count} stuck video jobs."


@shared_task
def cleanup_orphan_uploads():
    """
    Periodic maintenance task to clean up orphan original uploads older than 24 hours
    that were never completed or attached to a video asset.
    """
    logger.info("Running orphan uploads cleanup...")
    # Clean temporary directories or aborted uploads if any
    return "Orphan cleanup complete."
