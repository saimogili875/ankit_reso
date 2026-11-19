# Recorded-Class Video System & Cloudflare R2 Streaming Architecture

This document details the architecture, setup instructions, deployment steps, and QA checklist for the private recorded-class HLS video pipeline in **ankit_reso**.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   Admin Browser / UI        |
                      +--------------+--------------+
                                     |
             1. Initiate & Parts     | 2. Direct Multipart PUT (10MB chunks)
             (/api/content/videos/)  | (Bypasses Backend - up to 5GB)
                                     v
+------------------+         +-------------------------------+
|  Django Backend  |         |     Cloudflare R2 Bucket      |
|  (REST API)      |         |  (100% PRIVATE, Zero Egress)  |
+--------+---------+         +---------------+---------------+
         |                                   ^
         | 3. Celery Queue 'video'           | 4. Download original
         v                                   |    Upload HLS + VTT + Poster
+------------------------------------+       |
| Dedicated Celery Video Worker      |-------+
| (FFmpeg Lanczos Multi-Rendition)   |
| 360p, 480p, 720p (+ optional 1080p)|
+------------------------------------+

Playback Flow:
+--------------------+        1. Request Token        +--------------------+
|  Student Browser   | -----------------------------> |   Django Backend   |
|  (Next.js Hls.js)  | <----------------------------- | (Verify Enrollment |
+---------+----------+   HMAC-SHA256 Token + URLs     |  & Issue URL/VTT)  |
          |                                           +--------------------+
          | 2. GET /videos/<id>/master.m3u8?token=...
          v
+------------------------------------+
| Cloudflare Worker (video.<domain>) |
| - Validates HMAC signature & expiry|
| - Edge caches .ts segments (1 yr)  |
| - Streams directly from Private R2 |
+------------------------------------+
```

### Key Technical Decisions
1. **100% Private Storage**: The Cloudflare R2 bucket has **no public access**. All video media is protected behind short-lived signed tokens.
2. **Signed Token Streaming**: Django generates an HMAC-SHA256 signature containing `user_id`, `video_id`, `expires_at`, and signature `sig`. The Cloudflare Worker validates this cryptographic token on every single request before fetching from the R2 bucket.
3. **Optimized Edge Caching**: The Cloudflare Worker strips the student token from the edge cache key for `.ts` segments. When multiple students watch the same video, segments are served from Cloudflare's global edge cache (1-year immutable cache) after validating each student's valid token.
4. **Sharp Text Preserving Transcode**: Uses FFmpeg's `lanczos` scaling algorithm, fixed GOP (`-g 180 -keyint_min 180 -sc_threshold 0`), CRF 20–22, and no aggressive denoising to ensure chalkboards and whiteboard formulas remain crisp.
5. **Direct Resumable Upload**: Videos up to 5 GB are sliced into 10 MB chunks in the browser and uploaded directly to R2 using presigned URLs, avoiding proxy timeouts and memory bottlenecks on the web server.
6. **Timeline Scrubbing Previews**: A single sprite sheet (`thumbnails.jpg`, 10x10 grid) and lightweight WebVTT (`thumbnails.vtt`) are generated per video, providing hover thumbnails on the player seekbar without creating hundreds of R2 files.
7. **Telemetry & Progress**: Student watch progress is reported every 15 seconds, on pause, and on page unload (`navigator.sendBeacon`), with automatic lecture completion at 90% watched. Player Quality of Experience (QoE) metrics (time to first frame, startup time, rebuffering events) are tracked.

---

## 2. Step-by-Step Setup Guide

### Step 1: Cloudflare R2 Bucket Setup
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **R2**.
2. Click **Create bucket** and name it:
   ```
   adepteduverse-storage
   ```
3. Set the bucket to **Private** (do **NOT** enable Public Access).
4. Go to **Settings** -> **CORS Policy** and paste the following configuration:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://*.adepteduverse.com",
         "https://*.vercel.app",
         "http://localhost:3000",
         "http://127.0.0.1:3000"
       ],
       "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
5. In Cloudflare R2, navigate to **Manage R2 API Tokens** and create an API Token with **Object Read & Write** permissions for `adepteduverse-storage`.
6. Note down your `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.

---

### Step 2: Deploy the Cloudflare Worker
The worker code is located in `cloudflare-worker/worker.js` and configured in `cloudflare-worker/wrangler.toml`.

1. Install Wrangler CLI (if not already installed):
   ```bash
   npm install -g wrangler
   ```
2. Navigate to the worker directory:
   ```bash
   cd cloudflare-worker
   ```
3. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```
4. Configure your secret HMAC token (must match `VIDEO_STREAMING_SECRET` in Django backend):
   ```bash
   wrangler secret put VIDEO_STREAMING_SECRET
   # Enter your 64-character secret key when prompted
   ```
5. Deploy the worker:
   ```bash
   wrangler deploy
   ```

---

### Step 3: Configure Custom Domain for Video Streaming
1. In the Cloudflare Dashboard, go to **Workers & Pages** -> **adepteduverse-video-streamer** -> **Settings** -> **Triggers**.
2. Under **Custom Domains**, click **Add Custom Domain**.
3. Enter your streaming domain, e.g.:
   ```
   video.adepteduverse.com
   ```
4. Cloudflare will automatically provision an SSL certificate and route requests to your worker.

---

### Step 4: Configure Backend Environment Variables
Set the following environment variables in your `.env` file and in the Render web/worker services:

```env
# Cloudflare R2 Credentials
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=adepteduverse-storage
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# Cloudflare Video Streaming
VIDEO_STREAMING_DOMAIN=https://video.adepteduverse.com
VIDEO_STREAMING_SECRET=your_64_character_hmac_secret
ENABLE_1080P=false
```

---

### Step 5: Celery Video Worker Setup (Render)
Video transcoding requires a dedicated Celery worker with `ffmpeg` and `ffprobe` installed.

The `render.yaml` blueprint defines the `ankit-reso-celery-video-worker`:
- **Build Command**: `./scripts/install_ffmpeg.sh && cd backend && pip install -r requirements.txt`
- **Start Command**: `export PATH=$HOME/bin:$PATH && cd backend && celery -A config worker -Q video -l info --concurrency 2`
- **Instance Plan**: Standard (at least 2 CPU cores and 4 GB RAM recommended for multi-bitrate encoding).

For local development:
```bash
# Terminal 1: Django API
cd backend && python manage.py runserver 127.0.0.1:8000

# Terminal 2: Default Celery Worker
cd backend && celery -A config worker -Q celery,default -l info

# Terminal 3: Dedicated Video Celery Worker
cd backend && celery -A config worker -Q video -l info --concurrency 2

# Terminal 4: Next.js Frontend
cd frontend && npm run dev
```

---

## 3. Verification & QA Checklist

### A. Multipart Upload to R2
1. Log in as Admin (`25311a05z9@cse.sreenidhi.edu.in`) and visit `/admin/videos`.
2. Click **Upload or Add Video**.
3. Select an MP4 file, choose a Target Lecture, and click **Start Upload**.
4. Verify:
   - Chunk progress updates in real time (e.g. `Chunk 1 of 5 (20%)`).
   - If user clicks **Cancel Upload**, multipart upload is aborted and cleaned up on R2.
   - On completion, video appears in catalog with status badge `QUEUED`.

### B. Transcoding Pipeline & Renditions
1. The Celery worker (`-Q video`) picks up the task.
2. In the Admin Videos catalog:
   - Status updates to `TRANSCODING X%` with an animated progress bar.
   - When complete, status transitions to `READY (HLS)`.
   - Rendition badges appear: `360p`, `480p`, `720p` (and `1080p` if enabled).
   - R2 bucket contains `videos/<id>/master.m3u8`, rendition folders (`360p/`, `480p/`, `720p/`), `poster.jpg`, `thumbnails.jpg`, and `thumbnails.vtt`.

### C. Admin Preview & Reprocess
1. In `/admin/videos`, click **Preview** on a READY video.
2. Verify:
   - The modal player initializes smoothly.
   - Master playlist loads, and the quality gear menu displays `Auto`, `720p`, `480p`, `360p`.
   - Hovering over the seekbar displays video thumbnails from the WebVTT sprite sheet.
3. Click **Reprocess** on any video:
   - Video re-enters `QUEUED` state, re-encodes, and updates back to `READY`.

### D. Security & Access Control
1. Try fetching a raw segment without a token:
   ```bash
   curl -i https://video.adepteduverse.com/videos/<video_id>/master.m3u8
   # Expected: HTTP 403 Forbidden ("Missing or invalid streaming token")
   ```
2. Try tampering with the token signature:
   ```bash
   curl -i "https://video.adepteduverse.com/videos/<video_id>/master.m3u8?token=tampered_token"
   # Expected: HTTP 403 Forbidden ("Invalid token signature")
   ```
3. Test an unenrolled student:
   - An unenrolled student accessing `/api/content/lectures/<pk>/playback/` receives `HTTP 403 Forbidden` unless the lecture has `is_free_preview = true`.

### E. Student Learning & Progress
1. Log in as a student (`mogilisaikumar875@gmail.com`).
2. Navigate to `/learn`, select an enrolled course lecture.
3. Verify:
   - Video resumes from `last_position_seconds` saved in the database.
   - Watching past 90% of duration automatically marks the lecture as `completed`.
   - Seeking, playback speed changes (0.5x to 2x), and keyboard shortcuts (Space, F, M, Arrow keys) function correctly.
   - Quality of Experience (QoE) metrics are recorded in `VideoPlaybackStat`.

---

## 4. Maintenance & Periodic Tasks

The Celery Beat scheduler automatically runs two maintenance tasks:
1. **`reap-stuck-video-jobs-every-15-mins`**: Detects and fails video jobs stuck in `PROCESSING` status for over 4 hours.
2. **`clean-orphan-video-uploads-daily`**: Cleans up abandoned `UPLOADED` records and uncompleted multipart uploads older than 24 hours.
