# Production Deployment & Infrastructure Guide

This document provides a comprehensive, production-grade guide to deploying **AdeptEduverse (`ankit_reso`)** using:
- **LiveKit Cloud**: Managed SFU, TURN, and automated Egress recording.
- **Render**: Django REST API Web Service, Celery Worker, Celery Beat, and Managed Redis.
- **Neon / Supabase**: Managed PostgreSQL with PgBouncer connection pooling.
- **Cloudflare R2**: High-throughput, zero-egress-fee object storage for class recordings and media.
- **Vercel**: Next.js 15 App Router frontend.
- **Sentry**: Application performance monitoring and real-time error tracking.

---

## 1. LiveKit Cloud Setup

LiveKit Cloud powers the real-time interactive classroom with low-latency WebRTC media, sub-second latency, and role-enforced publishing permissions.

### 1.1 Create Project & Generate API Keys
1. Navigate to [LiveKit Cloud Console](https://cloud.livekit.io/) and create an account or sign in.
2. Click **Create Project** (e.g., `ankit-reso-live`).
3. Note your **Server URL**: `wss://<project-name>.livekit.cloud`.
4. Go to **Settings** → **Keys** → **Generate API Key**:
   - Copy the **API Key** (e.g., `APIxxxxxxxxxxxx`).
   - Copy the **API Secret** (e.g., `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`).
   > [!IMPORTANT]
   > Keep these secret. They must only exist in your backend environment variables (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`), never in client-facing code.

### 1.2 Configure Webhook
LiveKit dispatches webhooks to keep class states, attendance timestamps, and recording URLs synchronized.
1. In LiveKit Cloud Console, go to **Settings** → **Webhooks**.
2. Click **Add Webhook**.
3. Set **Webhook URL** to your backend URL:
   ```
   https://<your-render-api-domain>/api/live/webhook/
   ```
   *(Example: `https://ankit-reso-api.onrender.com/api/live/webhook/`)*
4. Select Events:
   - `Room Started` (`room_started`)
   - `Room Finished` (`room_finished`)
   - `Participant Joined` (`participant_joined`)
   - `Participant Left` (`participant_left`)
   - `Egress Ended` (`egress_ended` / `egress_finished`)
5. Save Webhook. LiveKit signs all requests with your project secret, verified cryptographically by `verify_livekit_webhook` in Django.

---

## 2. Cloudflare R2 Object Storage Setup

Cloudflare R2 provides S3-compatible cloud storage with **zero egress bandwidth fees**, making it optimal for storing long live-class video replays.

### 2.1 Create Bucket
1. Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **R2 Object Storage**.
2. Click **Create bucket**. Name it (e.g., `adepteduverse-storage`).
3. Choose location (e.g., `Automatic` or your preferred region).
4. Under **Bucket Settings** → **CORS Policy**, add:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### 2.2 Generate API Tokens
1. In R2 overview, click **Manage R2 API Tokens** → **Create API token**.
2. Permissions: **Object Read & Write**.
3. Apply to bucket: `adepteduverse-storage`.
4. Copy:
   - **Account ID** (`R2_ACCOUNT_ID`)
   - **Access Key ID** (`R2_ACCESS_KEY_ID`)
   - **Secret Access Key** (`R2_SECRET_ACCESS_KEY`)
   - **Endpoint** (`R2_ENDPOINT`): `https://<account_id>.r2.cloudflarestorage.com`

---

## 3. Database Setup (Neon / Supabase)

### 3.1 Connection String & PgBouncer Mode
1. In Neon or Supabase, locate your **Pooled Connection String** (PgBouncer mode, typically on port `6543`).
2. Copy the URI:
   ```
   postgres://<username>:<password>@<ep-pooler-domain>:6543/<dbname>?sslmode=require
   ```
3. Set this as `DATABASE_URL` in Render.
4. **PgBouncer Optimizations configured in `prod.py` & `base.py`:**
   - `CONN_MAX_AGE = 600` (Recycles persistent backend connections).
   - `DISABLE_SERVER_SIDE_CURSORS = True` (Prevents transaction-pooling cursor exceptions).

### 3.2 Point-in-Time Recovery & Backup Plan
- **Neon**: Automatically retains Point-in-Time Recovery (PITR) branches for up to 30 days. In disaster recovery, create an instant branch from any second in time using Neon Console or CLI:
  ```bash
  neonctl branches create --parent-branch main --timestamp 2026-11-19T00:00:00Z
  ```
- **Supabase**: Daily automated backups + continuous WAL archiving for PITR in the Pro tier.

---

## 4. Render Backend Deployment (Blueprint)

The repository includes a production-ready `render.yaml` Blueprint file defining all 4 backend services:
1. `ankit-reso-api`: Django 4.2 Gunicorn REST API Web Service.
2. `ankit-reso-celery-worker`: Celery worker for async test scoring, analytics, and notification dispatches.
3. `ankit-reso-celery-beat`: Celery beat scheduler for 15-minute class reminders and abandoned room cleanup.
4. `ankit-reso-redis`: Managed Redis instance for caching and task brokering.

### 4.1 Deploying via Render Blueprint
1. Push this repository to your GitHub account.
2. Go to [Render Dashboard](https://dashboard.render.com/) → **Blueprints** → **New Blueprint Instance**.
3. Connect your repository (`ankit_reso`).
4. Render automatically parses `render.yaml`.
5. Enter the required secret environment values:
   - `DATABASE_URL`: Your pooled Postgres URI.
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://ankit-reso.vercel.app`).
   - `CORS_ALLOWED_ORIGINS`: `https://ankit-reso.vercel.app`
   - `CSRF_TRUSTED_ORIGINS`: `https://ankit-reso.vercel.app`
   - `LIVEKIT_URL`: `wss://your-project.livekit.cloud`
   - `LIVEKIT_API_KEY`: Your key.
   - `LIVEKIT_API_SECRET`: Your secret.
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.
   - `SENTRY_DSN`: (Optional) Your backend Sentry DSN.
6. Click **Apply**.
7. Render provisions Redis, runs DB migrations, collects static assets, and boots the API, Celery worker, and beat scheduler.

---

## 5. Vercel Frontend Deployment

### 5.1 Project Setup
1. In [Vercel Dashboard](https://vercel.com/), click **Add New** → **Project**.
2. Select your repository (`ankit_reso`).
3. Set **Root Directory** to `frontend`.
4. Framework Preset: **Next.js**.

### 5.2 Environment Variables on Vercel
Add the following under **Settings** → **Environment Variables**:

| Variable Name | Example Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://ankit-reso-api.onrender.com/api` | Backend API base URL |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://your-project.livekit.cloud` | Public LiveKit SFU endpoint |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://xxxx@sentry.io/xxxx` | Frontend Sentry error reporting |

5. Click **Deploy**.

---

## 6. Pre-Flight Checklist for the First Live Class

Run through these checks before holding your first live class:

- [ ] **Health Check OK**: Visit `https://<api-domain>/api/health/`. Ensure JSON response is `{"status": "ok", "db": true, "redis": true, "celery": true, "version": "1.0.0"}`.
- [ ] **LiveKit Webhook Verified**: In LiveKit Console → Webhooks, trigger a test event. Verify that Django logs show 200 OK without 401 signature errors.
- [ ] **Teacher Mic, Screen Share & Video**: Login as Admin (`25311a05z9@cse.sreenidhi.edu.in`), navigate to `/admin/live/<id>`, click **Start Class**. Verify camera, microphone, and screen share publish cleanly.
- [ ] **Student Permissions Enforced**: Open an incognito browser window, log in as Student (`mogilisaikumar875@gmail.com`), and open `/live/<id>`.
  - Student camera and screen share buttons **must not exist**.
  - Student mic is muted by default.
  - Student clicks **Raise Hand**. In teacher studio, click **Allow Mic**. Verify student mic unmutes and audio transmits.
  - Teacher clicks **Mute All**. Student mic is silenced immediately server-side.
- [ ] **Non-Enrolled 403 Rejection**: Attempt to request `/api/live/<id>/token/` with a student not enrolled in the class's course; verify HTTP 403 Forbidden is returned.
- [ ] **Egress to R2 Replay**: When teacher clicks **End Class**, verify room composite egress uploads the `.mp4` recording to Cloudflare R2 and sets `recording_status='READY'` with valid video URL.

---

## 7. Exam-Day High-Concurrency Architecture (500-1000 Students)

1. **Test Layout Redis Caching**:
   - The entire sanitized question and section hierarchy is cached in Redis key `cbt_test_layout_<id>` on first fetch.
   - 1,000 simultaneous students starting at 10:00 AM receive test papers from Redis in < 2ms without querying Postgres.
2. **Client Answer Persistence**:
   - All student responses are mirrored immediately into browser `localStorage` (`cbt_answers_<attemptId>`). Even with network jitter or page refreshes, answers are zero-loss preserved.
3. **Async Celery Scoring & Analytics**:
   - When submitting, scores are recorded and the 8-dimensional analytics computation is dispatched asynchronously to Celery via `compute_test_attempt_analysis_task.delay(attempt_id)`.
   - The student receives an instantaneous `201 Created` HTTP response without thread blocking, and the result screen smoothly polls until the cohort analysis snapshot is ready.
4. **k6 Load Testing**:
   Run the load simulation script:
   ```bash
   k6 run --env API_URL=https://<api-domain>/api --env TEST_ID=1 loadtest/cbt_exam_simulation.js
   ```
   Verifies:
   - 95th percentile latency < 500ms
   - 0% error rate on test paper delivery
   - Sustained throughput under 500+ active student sessions.
