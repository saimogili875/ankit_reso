# Comprehensive Security, Stability & Architecture Audit Report

**Repository**: `saimogili875/ankit_reso`  
**Stack**: Django 5 + Django REST Framework (Backend on Render) | Next.js 15 App Router + TypeScript (Frontend on Vercel)  
**Authentication**: Session-cookie authentication with `SameSite=None; Secure=True` for cross-domain communication.  
**Audit Date**: November 2026  
**Status**: All P0 Security & Auth Loop issues and P1 Correctness issues RESOLVED & VERIFIED.

---

## 1. Executive Summary

This audit addresses critical production defects and security vulnerabilities identified in the ADEPT EDUVERSE / ANKIT JEE platform. Most prominently, an infinite redirect loop occurred in production due to a mismatch between DRF's default 403 Forbidden on unauthenticated session requests and the Next.js client middleware's cookie inspection. Concurrently, security issues involving hardcoded administrative credentials, pre-submission answer leakage in daily practice problems (DPP), unauthenticated endpoints, and IDOR vulnerabilities were remediated.

All fixes were engineered without breaking existing features, maintaining strict backward compatibility for API payloads and Next.js interfaces.

---

## 2. Audit Findings & Resolution Matrix

| ID | Category | Target Location | Severity | Description | Resolution Status |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **P0-AUTH** | Auth Loop | `backend/apps/accounts/` & `frontend/lib/api-client.ts`, `frontend/middleware.ts` | **Critical** | Anonymous requests to protected endpoints returned 403 (instead of 401). Frontend left stale `auth_session` cookies; middleware redirected `/login` -> `/dashboard`, creating an infinite ~200ms loop. | **FIXED** (Commit `abe70e6`). Custom `Session401Authentication`, `AllowAny` for `GET /api/auth/me/`, centralized `AuthProvider`, single cookie writer. |
| **S1** | Hardcoded Secrets | `backend/apps/accounts/migrations/0003_seed_admin_user.py`, `commands/ensure_admin.py`, `commands/seed_users.py`, `DEPLOY.md`, `CHANGES.md` | **High** | Plaintext admin credentials (`Ank@247shbm`) seeded on every migrate and exposed in git history. | **FIXED** (Commit `bd70839`). Neutralized migration 0003 to a no-op; seed commands strictly read `ADMIN_PASSWORD` / `SEED_USER_PASSWORD` from env; docs scrubbed. |
| **S2** | Insecure Settings | `backend/config/settings/prod.py` | **High** | Missing startup validation for `SECRET_KEY` and shared secret reuse for `VIDEO_STREAMING_SECRET`. | **FIXED** (Commit `bd70839`). Raises `ImproperlyConfigured` on weak/dev keys or if `VIDEO_STREAMING_SECRET == SECRET_KEY`. |
| **S3** | Missing Throttling | `backend/config/settings/base.py` | **Medium** | Global anon and user rate throttles missing from `DEFAULT_THROTTLE_CLASSES`. Chatbot lacked scope. | **FIXED** (Commit `bd70839`). Added `AnonRateThrottle`, `UserRateThrottle`, and `'chatbot': '10/minute'`. |
| **S4** | Chatbot Abuse | `backend/apps/content/views.py` | **Medium** | `ChatbotView` lacked input length bounds and history sanitization. | **FIXED** (Commit `bd70839`). Capped message to 500 chars, max 6 history turns (role in user/assistant), 3000 chars total. |
| **S5** | Answer Leakage | `backend/apps/questions/views.py`, `frontend/app/practice/page.tsx` | **High** | `DPPQuestionsView` returned `is_correct`, `correctAnswerId`, and `explanation` in GET requests before quiz submission. | **FIXED** (Commit `bd70839`). Stripped answers and explanations from GET; `DPPSubmitView` returns `solutions` map on POST. |
| **S6** | IDOR / Unauthed DPP | `backend/apps/questions/views.py` | **Medium** | Fragile `Q(id=pk) \| Q(title__icontains=pk)` lookup and implicit permissions. | **FIXED** (Commit `bd70839`). Added explicit `IsAuthenticated` and `get_object_or_404(DPP, id=pk)`. |
| **S7** | CSRF Exemptions | `backend/apps/core/views.py` | **Low** | Audited `@csrf_exempt` decorators. | **VERIFIED** (Commit `bd70839`). Exemptions restricted to stateless GET/HEAD health probes (`healthz`) and raw webhook receivers. |
| **S8** | Dev Settings in Prod | `backend/config/settings/dev.py` | **Medium** | Risk of deploying `dev.py` in production with `DEBUG=True` and open CORS. | **FIXED** (Commit `bd70839`). Added startup guard raising `ImproperlyConfigured` if `ENVIRONMENT=production` or `RENDER=true`. |
| **S9** | Notification IDOR | `backend/apps/content/schedule_views.py` | **High** | `NotificationMarkReadView` marked any notification read by `id=pk` without scoping to `request.user`. | **FIXED** (Commit `bd70839`). Scoped lookup to `Q(id=pk) & (Q(user=request.user) \| Q(user__isnull=True))`. |
| **C1** | Error Handling | `backend/apps/` across modules | **Medium** | Bare `except Exception:` and console `print` calls. | **FIXED** (Commit `f5fc2ab`). Replaced with specific exceptions (`ValidationError`, `ValueError`, `TypeError`), logged with `logger.exception`. |
| **C2** | Network Resilience | `frontend/lib/api-client.ts` | **Medium** | No request timeouts, duplicate in-flight requests, untyped errors. | **FIXED** (Commit `f5fc2ab`). Added 15s `AbortController` timeout, in-flight GET deduplication map, and typed `ApiError` class. |
| **C3** | Session Sync | `frontend/lib/api-client.ts`, `frontend/app/login/page.tsx` | **Medium** | Client cookie expiration misaligned with backend session expiration. | **FIXED** (Commit `f5fc2ab`). When `remember_me=False`, client cookie is a session cookie (`maxAge` omitted); when true, 14 days (`1209600s`). |
| **C4** | Exam Submission Race | `backend/apps/tests/views.py` | **High** | Potential race conditions and duplicate test grading on rapid submit clicks. Incomplete multi-select and numerical evaluations. | **FIXED** (Commit `f5fc2ab`). Wrapped in `transaction.atomic()` with `select_for_update()`, idempotency check, set equality for multi-select, and bound checks for numerical. |
| **C5** | Celery Timeouts | `backend/apps/accounts/tasks.py`, `backend/apps/tests/views.py` | **Medium** | Tasks could hang worker queues if external services delay. Stalled on missing Redis in dev/test. | **FIXED** (Commit `f5fc2ab`). Added `time_limit=60, soft_time_limit=45` to OTP tasks, added graceful sync fallback when Redis is absent. |
| **C6** | Dead Model Cleanup | Models and serializers | **Low** | Historical migrations referenced deleted `LiveClass` and `LiveAttendance`. | **VERIFIED** (Commit `f5fc2ab`). Confirmed dead models are removed from all active codebase references. |
| **C7** | Secure Redirect Exempt | `backend/config/settings/prod.py` | **Low** | Loose regexes (`r'^health'`) in `SECURE_REDIRECT_EXEMPT`. | **FIXED** (Commit `bd70839`). Replaced with exact anchors (`r'^healthz/?$'`, `r'^api/health/?$'`). |

---

## 3. Required Environment Variables Checklist

### Backend (Render Web Service & Workers)

Set these environment variables in your **Render Service Dashboard**:

| Variable Name | Required | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `DJANGO_SETTINGS_MODULE` | Yes | `config.settings.prod` | Ensures production settings with secure cookies and HTTPS enforcement. |
| `ENVIRONMENT` | Yes | `production` | Prevents loading dev settings and configures Sentry environment. |
| `SECRET_KEY` | Yes | `django-insecure-random-50-character-secret` | Cryptographic signing key (Render can auto-generate). |
| `VIDEO_STREAMING_SECRET` | Yes | `64-character-hex-secret-different-from-secret-key` | HMAC signing key for video streaming playback URLs. |
| `ALLOWED_HOSTS` | Yes | `ankit-reso.onrender.com,adepteduverse.com,www.adepteduverse.com` | Host header validation. |
| `FRONTEND_URL` | Yes | `https://adepteduverse.com` | Base frontend URL for CORS and CSRF origin matching. |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://adepteduverse.com,https://www.adepteduverse.com` | Cross-origin resource sharing whitelist. |
| `CSRF_TRUSTED_ORIGINS` | Yes | `https://adepteduverse.com,https://www.adepteduverse.com` | Trusted origins for CSRF POST/PATCH validation. |
| `DATABASE_URL` | Yes | `postgres://user:pass@ep-pooler.us-east-2.aws.neon.tech:6543/neondb?sslmode=require` | Pooled connection string to Neon / Supabase PgBouncer. |
| `REDIS_URL` | Yes | `rediss://default:pass@redis-host.render.com:6379` | Cache backend, session store, and Celery broker. |
| `ADMIN_EMAIL` | Yes | `admin@adepteduverse.com` | Email for automatic superuser provisioning on deploy via `ensure_admin`. |
| `ADMIN_PASSWORD` | Yes | `StrongP@ssw0rd!2026` | Secure password for administrative access. |
| `R2_ACCOUNT_ID` | Optional | `your_cloudflare_account_id` | Cloudflare R2 object storage for lecture videos and PDFs. |
| `R2_ACCESS_KEY_ID` | Optional | `your_r2_access_key_id` | Cloudflare R2 credentials. |
| `R2_SECRET_ACCESS_KEY` | Optional | `your_r2_secret_access_key` | Cloudflare R2 credentials. |
| `R2_BUCKET_NAME` | Optional | `adepteduverse-storage` | R2 bucket name. |
| `R2_ENDPOINT` | Optional | `https://<account_id>.r2.cloudflarestorage.com` | R2 S3 endpoint. |
| `TEXTBEE_API_KEY` | Optional | `your_textbee_api_key` | Gateway API key for SMS OTP delivery. |
| `TEXTBEE_DEVICE_ID` | Optional | `your_textbee_device_id` | Android device ID for SMS gateway. |
| `EMAIL_HOST_USER` | Optional | `no-reply@adepteduverse.com` | SMTP username for email verification codes. |
| `EMAIL_HOST_PASSWORD` | Optional | `your_app_specific_password` | SMTP password. |

### Frontend (Vercel / Render Static Site)

Set these environment variables in your **Vercel Project Settings**:

| Variable Name | Required | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `https://ankit-reso.onrender.com/api` | Base URL for backend DRF API (must end with `/api`). |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | `https://key@sentry.io/project` | Frontend error tracking. |

---

## 4. Manual QA Verification Checklist

Execute these 4 core test scenarios in staging/production to confirm end-to-end operation:

### Scenario 1: Stale Cookie / Session Revocation (P0 Auth Loop Fix)
1. Sign in to the student portal at `/login`.
2. Open Browser DevTools -> Application -> Cookies.
3. Observe `auth_session=1` and `user_role=STUDENT` on the frontend domain, and `sessionid` on the backend domain.
4. Delete the backend `sessionid` cookie (simulating backend session expiry or database flush).
5. Navigate to `/dashboard` or refresh the page.
6. **Expected Result**: The dashboard component calls `/api/auth/me/`, receives `200 {"authenticated": false, "user": null}`, `clearAuthCookies()` cleans up `auth_session` and `user_role`, and the user is redirected smoothly to `/login` with **zero loop, zero console spam, and zero infinite 403s**.

### Scenario 2: Administrator vs. Student Role Separation
1. Go to `/login?role=admin`.
2. Attempt to log in with a Student account credentials.
   - **Expected Result**: Denied with `"Invalid credentials. Please check your username and password."`
3. Switch tab to Student login (`/login`).
4. Attempt to log in with Administrator credentials.
   - **Expected Result**: Form displays guidance: `"Use Admin login"` and switches tab automatically.
5. Log in with Administrator credentials on the Admin tab.
   - **Expected Result**: Successfully signs in, redirects to `/admin`, and accesses all management controls. Student navigating directly to `/admin/*` is immediately kicked to `/`.

### Scenario 3: Multi-Tab Logout Synchronization
1. Open two separate tabs on `/dashboard`.
2. In Tab 1, click user avatar -> **Log Out**.
3. Tab 1 redirects to `/login`.
4. Switch to Tab 2 and click any navigation link (e.g., `/practice` or `/tests`).
5. **Expected Result**: Tab 2 detects unauthenticated state via `apiFetch`, clears any stale state, and redirects cleanly to `/login`.

### Scenario 4: Remember Me (Session vs. 14-Day Expiration)
1. Log in with **"Remember me (14 days)" unchecked**.
   - **Expected Result**: Inspect `auth_session` and `user_role` in Application -> Cookies. `Expires / Max-Age` is set to `Session`. Closing the browser window clears the cookies.
2. Log in with **"Remember me (14 days)" checked**.
   - **Expected Result**: Inspect cookies. `Expires / Max-Age` is set to exactly 14 days (`1209600` seconds) from now.

---

## 5. Automated Test Suite Verification

The automated test suite verifies all critical paths:

```bash
$ PYTHONPATH=backend DATABASE_URL="" python backend/manage.py test apps.accounts.tests apps.questions.tests apps.content.tests apps.tests.tests

Found 16 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
................
----------------------------------------------------------------------
Ran 16 tests in 5.862s

OK
Destroying test database for alias 'default'...
```

Frontend production verification:
```bash
$ cd frontend && npm run lint && npm run build

✓ Compiled successfully in 5.5s
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (42/42)
✓ Finalizing page optimization
```
All 42 static pages generated successfully with zero type or build errors.
