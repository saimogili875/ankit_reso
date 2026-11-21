# Production Deployment & Infrastructure Guide

This document provides a comprehensive, production-grade guide to deploying **AdeptEduverse (`ankit_reso`)** using:
- **Render**: Django REST API Web Service, Celery Worker, Celery Beat, and Managed Redis.
- **Neon / Supabase**: Managed PostgreSQL with PgBouncer connection pooling.
- **Cloudflare R2**: High-throughput, zero-egress-fee object storage for class recordings and media.
- **Vercel**: Next.js 15 App Router frontend.
- **Sentry**: Application performance monitoring and real-time error tracking.

---

## 1. Cloudflare R2 Object Storage Setup

Cloudflare R2 provides S3-compatible cloud storage with **zero egress bandwidth fees**, making it optimal for storing course lecture video replays and media.

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

## 2. Database Setup (Neon / Supabase)

### 2.1 Connection String & PgBouncer Mode
1. In Neon or Supabase, locate your **Pooled Connection String** (PgBouncer mode, typically on port `6543`).
   > [!IMPORTANT]
   > **Supabase IPv6 vs IPv4 on Render**:
   > Direct Supabase connections (port `5432` on `db.<project>.supabase.co`) are IPv6-only on many instances and will fail to resolve or connect on Render.
   > **Always use the Supabase Session Pooler** or Transaction Pooler URI (resolves to IPv4) with `?sslmode=require`.
   > The backend reads `DATABASE_URL` first. Prefer `DATABASE_URL` over individual `POSTGRES_*` environment variables.
2. Copy the URI:
   ```
   postgres://<username>:<password>@<ep-pooler-domain>:6543/<dbname>?sslmode=require
   ```
3. Set this as `DATABASE_URL` in Render.
4. **PgBouncer Optimizations configured in `prod.py` & `base.py`:**
   - `CONN_MAX_AGE = 600` (Recycles persistent backend connections).
   - `DISABLE_SERVER_SIDE_CURSORS = True` (Prevents transaction-pooling cursor exceptions).
   - SSL mode enforced (`ssl_require=True` / `sslmode=require`).

### 2.2 Point-in-Time Recovery & Backup Plan
- **Neon**: Automatically retains Point-in-Time Recovery (PITR) branches for up to 30 days. In disaster recovery, create an instant branch from any second in time using Neon Console or CLI:
  ```bash
  neonctl branches create --parent-branch main --timestamp 2026-11-19T00:00:00Z
  ```
- **Supabase**: Daily automated backups + continuous WAL archiving for PITR in the Pro tier.

---

## 3. Render Backend Deployment (Blueprint)

The repository includes a production-ready `render.yaml` Blueprint file defining all backend services:
1. `ankit-reso`: Django 4.2 Gunicorn REST API Web Service (`https://ankit-reso.onrender.com`).
2. `ankit-reso-celery-worker`: Celery worker for async test scoring, analytics, and background tasks.
3. `ankit-reso-celery-video-worker`: Dedicated worker with FFmpeg for HLS transcoding.
4. `ankit-reso-celery-beat`: Celery beat scheduler for periodic maintenance.
5. `ankit-reso-redis`: Managed Redis instance for caching and task brokering (required for Celery).

### 3.1 Deploying via Render Blueprint
1. Push this repository to your GitHub account.
2. Go to [Render Dashboard](https://dashboard.render.com/) → **Blueprints** → **New Blueprint Instance**.
3. Connect your repository (`ankit_reso`).
4. Render automatically parses `render.yaml`.
5. Enter the required secret environment values:
   - `SECRET_KEY`: A secure, random secret key for Django cryptographic signing. **Note**: Docker-based or manual Render services must set `SECRET_KEY` and `VIDEO_STREAMING_SECRET` manually in the dashboard, since `render.yaml` `generateValue` only applies to Blueprint deploys.
   - `DATABASE_URL`: Your pooled Postgres URI.
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://ankit-reso.vercel.app`).
   - `CORS_ALLOWED_ORIGINS`: `https://ankit-reso.vercel.app`
   - `CSRF_TRUSTED_ORIGINS`: `https://ankit-reso.vercel.app`
   - `VIDEO_STREAMING_SECRET`: A secure, random 64-character secret used for HMAC signing of video streaming URLs. Must be set manually in the dashboard for Docker-based services.
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`.
   - `SENTRY_DSN`: (Optional) Your backend Sentry DSN.
6. Click **Apply**.
7. Render provisions Redis, runs DB migrations, collects static assets, and boots the API, Celery worker, and beat scheduler.

### 3.2 Required Environment Variables

The table below outlines all production environment variables, which services require them, and instructions on generating them.

> [!IMPORTANT]
> In `config/settings/prod.py`, `SECRET_KEY`, `VIDEO_STREAMING_SECRET`, and `REDIS_URL` are strictly validated at import time. If any of these are missing, or if `VIDEO_STREAMING_SECRET == SECRET_KEY`, the service raises `ImproperlyConfigured` and halts boot.

| Variable | Which Services Need It | How to Generate / Configure | Description |
|---|---|---|---|
| `SECRET_KEY` | `ankit-reso` (web), `celery-worker`, `video-worker`, `celery-beat` | Generate via shell: `python -c "import secrets; print(secrets.token_urlsafe(50))"` (or generated automatically via `generateValue: true` on Blueprint). | Cryptographic signing key for Django sessions and security tokens. Must never equal `VIDEO_STREAMING_SECRET`. |
| `VIDEO_STREAMING_SECRET` | `ankit-reso` (web), `celery-worker`, `video-worker`, `celery-beat` | Generate via shell: `python -c "import secrets; print(secrets.token_hex(32))"` (or generated automatically via `generateValue: true` on Blueprint). | 64-char hex secret used for HMAC-SHA256 signing of HLS streaming URLs. Must be distinct from `SECRET_KEY`. |
| `REDIS_URL` | `ankit-reso` (web), `celery-worker`, `video-worker`, `celery-beat` | Automatically populated via `fromService: ankit-reso-redis` (or external URI: `rediss://default:<password>@<host>:<port>`). | Redis connection string used for caching, Celery task broker, rate limiting, and session storage. |
| `DATABASE_URL` | `ankit-reso` (web), `celery-worker`, `video-worker`, `celery-beat` | Copy from Neon or Supabase pooled connection string (`port 6543`, `sslmode=require`). | PostgreSQL URI with PgBouncer session/transaction pooler. |
| `ALLOWED_HOSTS` | `ankit-reso` (web) | Comma-separated list: `ankit-reso.onrender.com,api.adepteduverse.com`. | Whitelist of HTTP Host headers allowed by Django. |
| `FRONTEND_URL` | `ankit-reso` (web) | URL of your frontend app: `https://ankit-reso.vercel.app`. | Base URL of frontend application for email links and CORS/CSRF inclusion. |
| `CORS_ALLOWED_ORIGINS` | `ankit-reso` (web) | Comma-separated list: `https://ankit-reso.vercel.app,http://localhost:3000`. | Origins allowed to make credentialed cross-origin AJAX requests. |
| `CSRF_TRUSTED_ORIGINS` | `ankit-reso` (web) | Comma-separated list: `https://ankit-reso.vercel.app`. | Origins allowed to submit unsafe HTTP requests (POST, PUT, DELETE). |
| `R2_ACCOUNT_ID` | `ankit-reso` (web), `celery-worker`, `video-worker` | Cloudflare Dashboard → R2 → Account ID. | Cloudflare R2 Account Identifier. |
| `R2_ACCESS_KEY_ID` | `ankit-reso` (web), `celery-worker`, `video-worker` | Cloudflare Dashboard → R2 → Manage API Tokens. | R2 S3-compatible Access Key ID. |
| `R2_SECRET_ACCESS_KEY` | `ankit-reso` (web), `celery-worker`, `video-worker` | Cloudflare Dashboard → R2 → Manage API Tokens. | R2 S3-compatible Secret Access Key. |
| `R2_BUCKET_NAME` | `ankit-reso` (web), `celery-worker`, `video-worker` | Bucket name created in R2 (e.g., `adepteduverse-storage`). | Storage bucket for videos, PDFs, banners, and DPP solutions. |
| `R2_ENDPOINT` | `ankit-reso` (web), `celery-worker`, `video-worker` | `https://<account_id>.r2.cloudflarestorage.com`. | S3 API endpoint for Cloudflare R2. |
| `VIDEO_STREAMING_DOMAIN` | `ankit-reso` (web), `video-worker` | Optional custom CDN domain (e.g. `video.adepteduverse.com`). | CDN prefix for serving signed HLS m3u8 playlists and TS segments. |
| `ENABLE_1080P` | `ankit-reso` (web), `video-worker` | Set to `"true"` or `"false"` (default `"false"`). | Toggles 1080p encoding during Celery video transcoding. |
| `ADMIN_EMAIL` | `ankit-reso` (web) | System admin email (e.g. `admin@adepteduverse.com`). | Seed admin email provisioned by `ensure_admin`. |
| `ADMIN_PASSWORD` | `ankit-reso` (web) | Secure password for initial admin user. | Initial password provisioned by `ensure_admin`. |
| `ADMIN_RESET_PASSWORD` | `ankit-reso` (web) | (Optional) Set to `"true"` only when an intentional admin password reset is needed. | Prevents overwriting changed admin passwords on deploys. |
| `SENTRY_DSN` | All services (optional) | From Sentry Project Settings → Client Keys (DSN). | Error reporting and performance monitoring. |

---

## 4. Vercel Frontend Deployment

### 4.1 Project Setup
1. In [Vercel Dashboard](https://vercel.com/), click **Add New** → **Project**.
2. Select your repository (`ankit_reso`).
3. Set **Root Directory** to `frontend`.
4. Framework Preset: **Next.js**.

### 4.2 Environment Variables on Vercel
Add the following under **Settings** → **Environment Variables**:

| Variable Name | Example Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` (or `https://ankit-reso.onrender.com/api`) | Backend API base URL. **Required in production**; build throws if unset. |
| `BACKEND_ORIGIN` | `https://ankit-reso.onrender.com` | Backend origin used by `next.config.ts` rewrites to proxy `/api/:path*`. |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://xxxx@sentry.io/xxxx` | Frontend Sentry error reporting (optional). |

5. Click **Deploy**.

---

## 5. Pre-Flight Production Checklist

Run through these checks before releasing to students:

- [ ] **Health Check OK**: Visit `https://ankit-reso.onrender.com/api/health/`. Ensure JSON response is `{"status": "ok", "db": true, ...}`. Note: Redis is required for Celery tasks and caching; if Redis is not configured, health check returns 200 based on database status.
- [ ] **Recorded Video Delivery**: Verify student can stream HLS and YouTube course lectures in Learn tab.
- [ ] **CBT Test Engine**: Start and submit an exam attempt. Verify immediate score and analytics generation via Celery.
- [ ] **Student Timetable**: Verify student schedule renders exams, DPP deadlines, and recorded releases.
- [ ] **Admin Panel**: Login as Admin (`ankit@adepteduverse.com`), navigate to `/admin`, manage questions, tests, courses, and timetable.

---

## 6. Exam-Day High-Concurrency Architecture (500-1000 Students)

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

---

## 7. AI Chatbot "Swecha" & Landing Banners Setup

### 8.1 Swecha AI Chatbot Configuration
The platform includes "Swecha", an academic admissions and student assistant.
- **`ANTHROPIC_API_KEY`** *(Optional)*: API key from Anthropic Console (`sk-ant-...`). When set, Swecha uses Claude 3.5 Sonnet to provide natural, contextual assistance.
- **`CHATBOT_MODEL`** *(Optional)*: Model name (defaults to `claude-3-5-sonnet-20241022`).
- **Built-in FAQ Fallback**: If `ANTHROPIC_API_KEY` is not provided or the Anthropic API is unreachable, Swecha automatically falls back to the deterministic keyword engine built from institutional FAQs (batch schedules, admissions WhatsApp contact, forgot password, recording access, demo classes).

### 8.2 Landing Banners Media Configuration
- In local development (`DEBUG=True`), uploaded banner images are automatically served from `/media/landing/`.
- In production, media files can be served via standard storage backends (e.g. S3/Cloudflare R2 or persistent volumes).

