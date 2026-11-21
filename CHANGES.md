# AdeptEduverse / ANKIT JEE — Full-Stack Platform Update

## 1. Overview
This update completes end-to-end security hardening, role-based backend authorization, dual-portal authentication, idempotent user seeding, Next.js Edge route protection, full Admin Panel CMS control over all platform content, and complete elimination of mock/demo data in favor of live Django REST Framework database APIs.

---

## 2. Completed Milestones

### PART 1: LOGIN REQUIRED EVERYWHERE & RBAC
- **Next.js Edge Middleware (`frontend/middleware.ts`)**:
  - Automatically redirects all unauthenticated requests to `/login`.
  - Whitelists only public authentication pages (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`) and static/`_next` bundles.
  - Automatically redirects `/admin/login` alias to `/login?role=admin`.
  - Enforces `ADMIN` role on `/admin/*`: Students attempting to access any `/admin/*` route are immediately redirected to `/`.
  - Authenticated users attempting to visit `/login` or `/register` are routed to their appropriate home page (`/admin` for Admins, `/` for Students).
- **Backend Permissions (`backend/config/settings/base.py`)**:
  - Configured `DEFAULT_PERMISSION_CLASSES` to `rest_framework.permissions.IsAuthenticated`.
  - Only `/api/auth/csrf/`, `/api/auth/login/`, `/api/auth/register/`, `/api/auth/logout/`, and `/api/health/` remain `AllowAny`.
  - `apps.adminpanel` endpoints are strictly guarded by `IsAdminRole` (`401` for anonymous, `403` for students).
- **Session Management & API Client (`frontend/lib/api-client.ts`)**:
  - Intercepts `401 Unauthorized`: clears session cookies and redirects client to `/login`.
  - Intercepts `403 Forbidden` on `/admin`: redirects students back to `/`.
  - Exposes dedicated `apiClient.logout()` which flushes the backend session and deletes client cookies (`auth_session`, `user_role`, `sessionid`).
- **User Seeding (`python manage.py seed_users`)**:
  - Idempotent Django management command reading credentials securely from `.env`:
    - **Student**: `SEED_STUDENT_EMAIL` / `SEED_STUDENT_PASSWORD` (`role=STUDENT`, `is_verified=True`, with attached `StudentProfile`).
    - **Admin**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`role=ADMIN`, `is_staff=True`, `is_superuser=True`, `is_verified=True`).
  - Strict portal validation: Admin cannot sign in on Student tab (`"Use Admin login"`), and Student cannot sign in on Admin tab (`"Invalid credentials. Please check your username and password."`).

---

### PART 2: REMOVE ALL FAKE / DEMO DATA
- **Deleted `frontend/lib/demo-data.ts`** and all mock data objects (`DEMO_SUBJECTS`, `MAIN_COURSE`, sample video URLs).
- **Learn (`frontend/app/learn/page.tsx`)**:
  - Fetches real subjects from `/api/academics/subjects/`.
  - Fetches real chapters from `/api/academics/subjects/<id>/chapters/?class=<class>`.
  - Fetches real lectures from `/api/academics/chapters/<id>/lectures/`.
  - Streams real video URLs from `/api/content/lectures/<id>/video/`.
  - Displays authentic empty states (`"No lectures added yet"`, `"No chapters added yet"`) when tables are empty.
- **Practice (`frontend/app/practice/page.tsx`)**:
  - Fetches real DPP sets from `/api/questions/dpps/?chapter=<id>`.
  - Fetches interactive questions from `/api/questions/dpps/<id>/questions/`.
  - Submits student attempts to `/api/questions/dpps/<id>/submit/` and persists real `DPPAttempt` records.
- **Home Components**:
  - `HeroCarousel`: Fetches live slides from `/api/content/hero-slides/`; zero hardcoded slides.
  - `QuickAccess`: Fetches active portals from `/api/content/quick-access/`.
  - `JEESubjects`: Fetches real subjects from `/api/academics/subjects/`.
  - `ContinueLearning`: Fetches real activity from `/api/progress/recent/`.
  - `Header`: Displays real user name, role, target exam, and live announcements bell.

---

### PART 3: ADMIN CONTROLS EVERYTHING (`/api/admin-panel/`)
Full CRUD admin panel pages and DRF ViewSets controlling every piece of student-facing content:
1. **Home Hero Slides (`/admin/home`)**:
   - Manage title, highlight, subtitle, badge, features list, prices, discount badge, CTA text/href, image, order, and active toggle.
2. **Quick Access & Subjects (`/admin/home`)**:
   - Manage Quick Access cards (title, description, icon, URL, badge, order, visibility).
   - Manage Subjects (name, description, topics chips, order, visibility).
3. **Curriculum & Modules (`/admin/modules`)**:
   - Manage Chapters, Lectures, and DPPs with cascading validation.
4. **Question Bank (`/admin/questions`)**:
   - Manage Single Choice, Multiple Choice, and Numerical questions with options, positive/negative marks, and LaTeX solutions.
5. **Videos & Media (`/admin/videos`)**:
   - Attach YouTube video IDs or Cloud R2 keys to curriculum lectures.
6. **CBT Mock Tests (`/admin/tests`)**:
   - Create Full-Length, Chapter-wise, and Subject-wise CBT papers.
   - Interactive question picker, positive/negative marks configuration, duration, and publish toggle.
7. **Study Materials (`/admin/materials`)**:
   - Upload PDF lecture notes, formula sheets, and revision handouts to R2 with subject and chapter tagging.
8. **Doubt Solver Support Desk (`/admin/doubts`)**:
   - Filter Open vs. Resolved student doubts.
   - Detail modal with problem text, student identity, and attached screenshot.
   - Direct faculty reply form (`POST /api/admin-panel/doubts/<id>/reply/`) marking doubts as resolved.
9. **Broadcast Announcements (`/admin/announcements`)**:
   - Post info, important, and alert notices with action links visible on student notification bells.
10. **Students Directory (`/admin/students`)**:
    - Complete student table with real activity metrics (test attempts, DPP attempts, completed videos, overall accuracy).
    - Toggle account status (activate/disable).
    - Reset student password modal.
    - Course enrollment management (enroll and unenroll).
    - Student analytics modal showing all past mock test scores, DPP scores, and video watch history.
11. **Admin Overview (`/admin`)**:
    - Live database counters for Students, Chapters, Lectures, Videos, Questions, DPPs, Tests, Materials, Open Doubts, and Announcements.

---

### PART 4: REAL STUDENT DATA (SAVED PER STUDENT IN DB ONLY)
- **Header & Profile**:
  - Displays authenticated user's name, email, role, and target exam.
  - Interactive profile edit form in `frontend/app/profile/page.tsx` saving `first_name`, `last_name`, `phone_number`, `target_exam`, `target_year`, and `bio` via `PATCH /api/auth/me/`.
- **Course Enrollment**:
  - Pure database persistence via `/api/academics/enrollment/my-courses/` and `/api/academics/enrollment/enroll/`; `localStorage` fallback eliminated.
- **Learn Watch Progress**:
  - Automatically records video progress and lecture completion to the database via `POST /api/progress/video/`.
- **CBT Test Runner & Review (`frontend/app/tests/page.tsx`)**:
  - Full-screen CBT examination modal with live countdown timer and interactive question palette.
  - Submits answers to `/api/tests/<id>/submit/` and computes score, accuracy, rank, and total participants.
  - Interactive Answer Review modal loading `/api/tests/attempts/<id>/` showing question-by-question breakdown with faculty solutions.
- **Doubt Solver (`frontend/app/doubt-solver/page.tsx`)**:
  - Students submit questions with subject tags and image links via `POST /api/doubts/`.
  - Student views history of submitted queries and faculty solutions from `GET /api/doubts/my/`.
- **Progress & Analytics (`frontend/app/progress/page.tsx`)**:
  - Live calculation of daily streak, overall accuracy, syllabus covered, and subject-wise accuracy from database attempt tables.

---

### PART 5: COURSE DETAILS & ENROLLMENT ARCHITECTURE
- **Backend Models (`backend/apps/academics/models.py`)**:
  - Enhanced `Course` model with `thumbnail_url`, `exam_type` (`JEE_MAIN` | `JEE_ADVANCED` | `BOTH`), `features` (JSON list), `price`, `original_price`, `discount_badge`, `start_date`, `end_date`, `status` (`DRAFT` | `PUBLISHED`), `is_published`, and `allow_self_enrollment` (boolean).
  - Enforced `allow_self_enrollment` in `EnrollView`: If a course is restricted to admin-only enrollment, student self-enrollment attempts return `403 Forbidden` (`"Self-enrollment is not permitted for this course. Please contact administration."`).
- **Student Course Catalog (`frontend/app/courses/page.tsx`)**:
  - Displays published courses from `GET /api/courses/` with thumbnail, exam badges, feature checklist, live pricing, and dates.
  - One-click enrollment modal (`components/home/enrollment-modal.tsx`) with instant DB persistence and dynamic status badges (`"Enrolled ✓"`, `"Enroll in Course"`, `"Admin Only"`).
- **Admin Course & Batch Management (`frontend/app/admin/(panel)/courses/page.tsx`)**:
  - Full CRUD for courses with exam type, features list builder, prices, start/end dates, draft/published status toggle, and self-enrollment toggle.
  - Enrolled Students Modal: Lists enrolled students per course with direct Enroll Student and Unenroll Student actions (`/api/admin-panel/courses/<id>/enroll_student/`, `/unenroll_student/`).

---

### PART 6: SCHEDULE & TIMETABLE ARCHITECTURE
- **Backend Models (`backend/apps/content/models.py`)**:
  - `ScheduleEvent`: course, event_type (`EXAM` | `PRACTICE_DEADLINE` | `RECORDED_CLASS` | `OTHER`), title, description, subject, chapter, start_time, end_time, link, auto-linking to test/dpp/lecture, is_published.
  - `Notification`: user (null for broadcast), title, message, notification_type, link_url, is_read, created_at.
- **Strict Course-Enrolled Isolation**:
  - `GET /api/schedule/` automatically checks the student's active enrollments in the database.
  - Unenrolled students receive `enrolled_courses_count: 0` and empty schedule lists, rendering an authentic call-to-action to browse courses without mock data.
  - Enrolled students receive only events belonging to their enrolled courses grouped into Today, Upcoming (next 30 days), and Past sessions.
- **Student Schedule Page (`frontend/app/schedule/page.tsx`)**:
  - "Schedule" added to student left sidebar and mobile bottom navigation.
  - **Today Tab**: Real-time list of today's lectures, tests, and DPP submissions.
  - **Upcoming Tab**: Next 30 days grouped by date with a full Month Calendar view switcher.
  - **Past Tab**: Completed sessions with attendance/completion history (`Attended ✓` / `Completed` / `Finished`) and links to watch recordings or take tests.
- **Home Integration**:
  - `TodayScheduleWidget` (`frontend/components/home/today-schedule-widget.tsx`):
    - "Today's Schedule" section: Lists today's upcoming lectures and deadlines with direct navigation to test, DPP, or lecture portals.
- **Admin Schedule Management (`frontend/app/admin/(panel)/schedule/page.tsx`)**:
  - Timetable events management for course batches.
  - Schedule Event Creator: Auto-links exams to `/tests`, DPPs to `/practice`, and recorded lectures to `/learn`.

---

### PART 7: NOTIFICATIONS & HEADER BELL INTEGRATION
- **Backend Endpoints**:
  - `GET /api/notifications/`: Fetches student notifications and live unread counter.
  - `POST /api/notifications/mark-all-read/`: Marks all notifications as read in the database.
  - `POST /api/notifications/<id>/read/`: Marks an individual notification as read.
- **Frontend Header Bell (`frontend/components/layout/header.tsx`)**:
  - Dynamic unread count badge on the bell icon (`unread_count > 0`).
  - Dropdown tabs for "Notifications" and "Announcements / Notices".
  - One-click "Mark all read" action.
  - Clicking any notification marks it as read in the database and routes to the relevant session or announcement link.

---

## 3. API Endpoints Reference

| Method | Path | Permissions | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/csrf/` | `AllowAny` | Returns CSRF token |
| `POST` | `/api/auth/login/` | `AllowAny` (Throttled) | Dual-portal sign-in (`portal="student"` / `"admin"`) via email/phone |
| `POST` | `/api/auth/register/` | `AllowAny` (Throttled) | User sign-up enforcing 8+ char Django passwords |
| `POST` | `/api/auth/logout/` | `AllowAny` | Flushes session and clears auth cookies |
| `GET` / `PATCH` | `/api/auth/me/` | `IsAuthenticated` | Retrieve or update user profile and target exam |
| `GET` | `/api/courses/` | `IsAuthenticated` | List published courses with dynamic `is_enrolled` status |
| `GET` | `/api/courses/<id>/` | `IsAuthenticated` | Course detail view |
| `POST` | `/api/enrollment/enroll/` | `IsAuthenticated` | Enroll student (enforcing `allow_self_enrollment`) |
| `GET` | `/api/schedule/` | `IsAuthenticated` | Enrolled student schedule (Today, Upcoming, Past) |
| `GET` | `/api/schedule/today/` | `IsAuthenticated` | Today's schedule events |
| `GET` | `/api/notifications/` | `IsAuthenticated` | Student notifications with unread count |
| `POST` | `/api/notifications/mark-all-read/` | `IsAuthenticated` | Mark all student notifications as read |
| `POST` | `/api/notifications/<id>/read/` | `IsAuthenticated` | Mark single notification as read |
| `GET` | `/api/content/hero-slides/` | `IsAuthenticated` | Active homepage hero carousel slides |
| `GET` | `/api/content/quick-access/` | `IsAuthenticated` | Visible quick access cards |
| `GET` | `/api/announcements/` | `IsAuthenticated` | Live platform broadcast announcements |
| `GET` / `POST` | `/api/doubts/` | `IsAuthenticated` | List / Submit academic doubts |
| `GET` | `/api/doubts/my/` | `IsAuthenticated` | Current student's doubt queries and faculty replies |
| `GET` | `/api/academics/subjects/` | `IsAuthenticated` | List academic subjects |
| `GET` | `/api/academics/subjects/<id>/chapters/` | `IsAuthenticated` | Subject chapters, filterable by `?class=` |
| `GET` | `/api/academics/chapters/<id>/lectures/` | `IsAuthenticated` | Published video lectures |
| `GET` | `/api/content/lectures/<id>/video/` | `IsAuthenticated` | Resolves video playback stream |
| `POST` | `/api/progress/video/` | `IsAuthenticated` | Update video watch progress & lecture completion |
| `GET` | `/api/questions/dpps/` | `IsAuthenticated` | List practice DPP sets |
| `GET` | `/api/questions/dpps/<id>/questions/` | `IsAuthenticated` | Retrieve DPP questions |
| `POST` | `/api/questions/dpps/<id>/submit/` | `IsAuthenticated` | Submit DPP practice attempt |
| `GET` | `/api/tests/` | `IsAuthenticated` | List CBT mock tests (Upcoming, Available, Attempted) |
| `POST` | `/api/tests/<id>/start/` | `IsAuthenticated` | Start/Resume CBT exam runner (sanitized, zero answer leakage) |
| `POST` | `/api/tests/attempts/<id>/event/` | `IsAuthenticated` | Real-time question interaction logging (view, select, clear, mark) |
| `POST` | `/api/tests/attempts/<id>/submit/` | `IsAuthenticated` | Submit attempt, compute score, generate snapshot, recompute test ranks |
| `GET` | `/api/tests/attempts/<id>/result/` | `IsAuthenticated` | 9-Tab comprehensive analysis snapshot (results lock enforced if active window) |
| `GET` | `/api/tests/attempts/<id>/questions/` | `IsAuthenticated` | Post-exam question review with solutions & class statistics |
| `POST` | `/api/tests/attempts/<id>/tag-question/` | `IsAuthenticated` | Tag question error reason (`CONCEPT_GAP`, `SILLY`, etc.) & bookmark |
| `GET` | `/api/analytics/overview/` | `IsAuthenticated` | Platform-wide analytics summary & accuracy |
| `GET` | `/api/analytics/trends/` | `IsAuthenticated` | Longitudinal score & accuracy progression across tests |
| `GET` | `/api/analytics/chapters/` | `IsAuthenticated` | Chapter strength map (Strong, Average, Weak) across tests & DPPs |
| `GET` | `/api/analytics/notebook/` | `IsAuthenticated` | Wrong-Answer Notebook & bookmarks with filtering |
| `POST` | `/api/analytics/notebook/<id>/revise/` | `IsAuthenticated` | Toggle revision status (`is_revised`) for notebook questions |
| `GET` | `/api/analytics/rank-predictor/` | `IsAuthenticated` | Marks-to-rank/percentile forecast based on calibration table |
| `GET` | `/api/materials/` | `IsAuthenticated` | Study notes and formula PDFs |
| `GET` | `/api/progress/` | `IsAuthenticated` | Computed user analytics (streak, accuracy, syllabus) |
| `GET` | `/api/progress/recent/` | `IsAuthenticated` | Recent study activity for the user |
| **Admin Panel** | `/api/admin-panel/...` | `IsAdminRole` | Complete CRUD for courses, live classes, schedule, test analytics, rank predictor calibration, slides, quick access, subjects, classes, chapters, lectures, videos, questions, DPPs, tests, materials, announcements, doubts, and student directory |

---

### PART 5: COMPLETE TEST ANALYSIS ADD-ON (NTA CBT ENGINE + 9-TAB RESULT DASHBOARD + WRONG-ANSWER NOTEBOOK)

#### 1. Data Models & Analytics Engine
- **`TestSection`**: Real NTA section splitting (Physics, Chemistry, Mathematics) with instructions and subject ordering.
- **`TestQuestion`**: Per-question positive/negative marking scheme and section assignment.
- **`QuestionAttemptLog`**: One row per question per attempt capturing:
  - `status`: `CORRECT`, `WRONG`, `SKIPPED`, `NOT_VISITED`, `MARKED_REVIEW`, `ANSWERED_AND_MARKED`.
  - Timing metrics: `time_spent_seconds`, `first_answer_time`, `final_answer_time`, `visit_count`, `answer_change_count`.
  - Student error diagnostic tag: `CONCEPT_GAP`, `CALCULATION`, `SILLY`, `GUESS`, `TIME_PRESSURE`, `DIDNT_KNOW`.
  - State flags: `is_bookmarked`, `is_revised`.
- **`TestAttemptAnalysis`**: Pre-computed JSON snapshot generated upon submission for sub-second result rendering with 8 detailed dimensions.
- **`RankPredictor`**: Admin calibration table mapping marks ranges to predicted JEE Main ranks and percentiles.
- **Dynamic Rank & Percentile Engine**:
  - Rank: Strictly among students who submitted that test.
  - Percentile: `(strictly lower scores / total attempts) * 100`.
  - Displays `"Too few attempts yet"` if total participants $< 2$. Zero fake ranks or arbitrary assumptions.

#### 2. Student NTA CBT Examination Runner (`/tests/[id]/attempt`)
- Countdown timer synchronized with duration and auto-submits on timeout.
- 5-State question palette with standard NTA color legend:
  - Grey: Not Visited
  - Red: Not Answered
  - Green: Answered
  - Purple: Marked for Review
  - Purple with Green Dot: Answered & Marked for Review
- Section switching with separate question counters per subject.
- Real-time interaction event logging (`POST /api/tests/attempts/<id>/event/`) preserving question states across reloads.
- **Zero Answer Leakage**: `CBTQuestionOptionSerializer` strips `is_correct` and `solution_text` during active examination.

#### 3. 9-Tab Comprehensive Result Dashboard (`/tests/[id]/result`)
- **Overview**: Score card, Rank, Percentile, Accuracy, Correct/Wrong/Skipped counters, Negative marks lost, Time taken, Cutoff status, and Topper/Average comparison.
- **Sections**: Per-section breakdown (Physics, Chemistry, Math) with score, accuracy, attempt rate, and time spent.
- **Chapters & Topics**: Weakest-first chapter breakdown tagged `Weak`, `Average`, or `Strong`.
- **Questions**: Full post-exam answer review with correct keys, student choices, LaTeX solution explanations, class accuracy percentage, and interactive "Why I got it wrong" error-reason tag selector and bookmark button.
- **Time Management**: Total time spent vs duration, average time per question, time on correct/wrong/skipped, questions exceeding $2\times$ ideal time, and pacing assessment.
- **Attempt Strategy**: Guess count ($< 10$s answered), unattempted easy questions, questions marked for review, and total answer changes.
- **Marks Analysis**: Actual score vs potential score if no negatives and if easy questions were solved; test efficiency ratio.
- **Compare**: Side-by-side performance comparison against Batch Topper and Batch Average.
- **Recommendations**: Targeted study recommendations mapping weak chapters directly to platform lectures, DPPs, and revision materials.

#### 4. Platform Analytics (`/analysis`) & Wrong-Answer Notebook (`/analysis/notebook`)
- Overall platform analytics synthesizing tests and DPPs.
- Longitudinal score progression graph with test-by-test accuracy and percentile trends.
- Error cause breakdown donut chart visualizing root causes of lost marks.
- Chapter strength matrix sorted by weakness.
- Rank Predictor forecast based on student average score calibrated against admin percentiles.
- **Wrong-Answer Notebook**: Dedicated review workspace filtering unrevised mistakes, revised questions, and bookmarks. Interactive re-attempt mode, solution reveal, and "Mark as Revised" toggle.

#### 5. Admin Test Analytics (`/admin/test-analytics`)
- High-level test analytics directory with attempts count, highest/lowest/avg score, and cutoff pass rates.
- Detailed test inspector with question distractor analysis (percentage of students picking each option A/B/C/D).
- Anomaly detection flagging questions where top-quartile students failed.
- Batch weak chapters aggregator.
- Student roster with score, rank, percentile, and time.
- One-click CSV export (`/api/admin-panel/test-analytics/<id>/export/`).
- Rank Predictor calibration table management modal.

---

## 4. Verification Results
1. `python manage.py check`: Passed with 0 issues.
2. `python manage.py migrate`: All migrations (`tests.0003`, `analytics.0001`) applied cleanly.
3. `python manage.py seed_users`: Idempotently seeds student, admin, full mock test with 3 sections & 8 authentic questions, and 7 rank predictor calibration bands.
4. `npm --prefix frontend run build`: All 38 routes compiled and statically rendered successfully with Edge middleware.
5. **Automated End-to-End Verification (`verify_test_analysis`) — 18/18 Checks Passed**:
   - ✓ Student 1 login via API.
   - ✓ Available tests list fetch.
   - ✓ CBT test start with section mapping.
   - ✓ Answer security verified: Zero leakage of `is_correct` or `solution_text` during active exam.
   - ✓ Real-time interaction event logging (`VIEW_QUESTION`, `SELECT_ANSWER`).
   - ✓ Submission and scoring with negative markings.
   - ✓ Fast snapshot generation (`TestAttemptAnalysis`) with all 8 tabs pre-computed.
   - ✓ Student result view with percentile = `None` when participants $< 2$.
   - ✓ Post-exam questions review with solutions unlocked.
   - ✓ Tagging error reason (`CONCEPT_GAP`) & bookmarking.
   - ✓ Wrong-answer notebook querying with filters.
   - ✓ Toggle revised status (`is_revised`).
   - ✓ Student 2 registers and takes the test with different score.
   - ✓ Dynamic rank & percentile recomputation verified across multiple student attempts: Student 1 = Rank 1 (50.0th percentile), Student 2 = Rank 2 (0.0th percentile).
   - ✓ Overview, trends, and chapters platform-wide analytics working.
   - ✓ Admin test analytics list verified with attempts count and average score.
   - ✓ Admin distractor analysis and anomaly detection verified.
   - ✓ Admin CSV export verified (`Content-Type: text/csv`).
   - ✓ Authorization boundary: `403 Forbidden` when student attempts to access another student's test results.

---

## 4. Verification Results
1. `python manage.py check`: Passed with 0 issues.
2. `python manage.py migrate`: All migrations (`academics.0004`, `content.0004`) applied cleanly.
3. `python manage.py seed_users`: Idempotently seeds student, admin, published courses, and live classes.
4. `npm --prefix frontend run lint`: 0 errors.
5. `npm --prefix frontend run build`: All 36 routes compiled and statically rendered successfully with Edge middleware.
6. **Automated Verification**:
   - Unenrolled student access to `/api/schedule/` → Returns `enrolled_courses_count: 0` with clean empty state prompt.
   - Enrolled student access to `/api/schedule/` → Returns today's active sessions, DPP deadlines, and exams.
   - Student notifications: Bell displays unread badge; `POST /api/notifications/mark-all-read/` resets unread count.
