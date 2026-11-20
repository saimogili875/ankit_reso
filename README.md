# AdeptEduverse — EdTech Platform

A production-ready EdTech platform for **JEE Main** and **JEE Advanced** preparation. Provides video lectures, previous-year question (PYQ) banks, computer-based mock tests (CBT), detailed performance analytics, and study material downloads.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router) & React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS & shadcn/ui design aesthetic
- **Icons**: Lucide React
- **API Client**: Axios HTTP Wrapper

### Backend
- **Framework**: Python 3.11 / Django 4.2 & Django REST Framework (DRF)
- **Architecture**: Modular Monolith (`apps/accounts`, `apps/academics`, `apps/content`, `apps/questions`, `apps/tests`, `apps/progress`, `apps/materials`, `apps/analytics`, `apps/core`)
- **API Documentation**: OpenAPI 3.0 / Swagger UI (`drf-spectacular`)

### Database & Storage
- **Database**: PostgreSQL 16
- **Cache / Message Broker**: Redis 7
- **Background Jobs**: Celery 5
- **File / Video Storage**: Cloudflare R2 (S3-compatible bucket)

### Containerization & Tooling
- **Containers**: Docker & Docker Compose

---

## 📁 Repository Structure

```
adepteduverse/
├── frontend/                 # Next.js 15 TypeScript application
│   ├── app/                  # App Router pages (learn, tests, progress, materials, profile)
│   ├── components/           # UI components (ui, layout, dashboard)
│   ├── lib/                  # Utility functions & API client wrapper
│   ├── hooks/                # Custom React hooks
│   ├── types/                # TypeScript interface definitions
│   ├── public/               # Static assets
│   ├── Dockerfile            # Container configuration for frontend
│   └── package.json
│
├── backend/                  # Django REST Framework modular monolith
│   ├── config/               # Project settings (base.py, dev.py, prod.py, urls.py, celery.py)
│   ├── apps/                 # Modular domain applications
│   │   ├── accounts/         # Custom User model & StudentProfile
│   │   ├── academics/        # Exam, Subject, Category, Chapter, Topic
│   │   ├── content/          # Video model (YouTube & Cloud R2 integration)
│   │   ├── questions/        # Question, QuestionOption, PYQ
│   │   ├── tests/            # Test, TestQuestion, TestAttempt
│   │   ├── progress/         # VideoProgress, QuestionAttempt, StudentProgress
│   │   ├── materials/        # StudyMaterial (PDFs, Revision Notes)
│   │   ├── analytics/        # Analytics summaries
│   │   └── core/             # Base models, health checks, openapi schema
│   ├── storage/              # Cloudflare R2 client abstraction (r2.py, service.py)
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container configuration for backend
│   └── manage.py
│
├── docs/
│   └── ARCHITECTURE.md       # Detailed system architecture document
│
├── docker-compose.yml        # Multi-container orchestration (postgres, redis, backend, celery, frontend)
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions
└── README.md
```

---

## 🚀 Quick Start with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone https://github.com/adepteduverse/adepteduverse.git
   cd adepteduverse
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Start all services with Docker Compose**:
   ```bash
   docker compose up --build
   ```

4. **Access services**:
   - **Frontend Application**: [http://localhost:3000](http://localhost:3000)
   - **Backend REST API**: [http://localhost:8000/api/](http://localhost:8000/api/)
   - **Swagger API Docs**: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
   - **Django Admin Console**: [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## 💻 Local Development Setup (Without Docker)

### Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set environment variables (or copy `.env.example` to `.env`):
   ```bash
   export DJANGO_SETTINGS_MODULE=config.settings.dev
   ```
4. Run Django system check & migrations:
   ```bash
   python manage.py check
   python manage.py migrate
   ```
5. Start development server:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start Next.js dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

---

## ☁️ Cloud Storage Setup (Cloudflare R2)

Large video lectures and PDF study materials are stored externally on **Cloudflare R2**.

To configure R2 storage, update the following keys in `.env`:
```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=adepteduverse-storage
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
```

The backend abstraction module inside `backend/storage/service.py` provides clean methods for generating secure, temporary presigned URLs for video streaming and PDF downloads without exposing Cloudflare credentials to the frontend.

---

## 🔐 OTP Authentication, Email SMTP & TextBee SMS Setup

ANKIT JEE features dual-channel OTP verification for user registrations, password resets, and contact updates.

### 1. Email Verification (SMTP)
Emails are dispatched via Celery using Django's SMTP backend. To configure with **Gmail App Password** or any SMTP provider (Brevo, Resend):
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_16_character_app_password
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=ANKIT JEE <no-reply@adepteduverse.com>
```
*In `DEBUG=True` mode, if `EMAIL_HOST_USER` is empty, emails automatically log to the terminal console without sending real emails.*

### 2. SMS Gateway Setup (TextBee)
Mobile SMS OTPs are routed through the **TextBee Gateway API** via an Android device gateway.
1. Sign up on [TextBee](https://textbee.dev/) and install the TextBee Android app on your gateway phone.
2. Grant SMS permissions and note your **API Key** and **Device ID**.
3. Add credentials to `.env`:
```env
TEXTBEE_API_KEY=your_textbee_api_key_here
TEXTBEE_DEVICE_ID=your_textbee_device_id_here
```
*In `DEBUG=True` mode, if `TEXTBEE_API_KEY` is empty, SMS OTPs automatically mock-print to terminal stdout for zero-cost local development and testing.*

### 3. Testing the Auth Flow Locally
Run the backend test suite:
```bash
python manage.py test apps.accounts.tests
```


---

## 🌐 API Architecture

- `/api/health/`: System and database health status
- `/api/docs/`: Interactive Swagger API documentation
- `/api/auth/`: User authentication and student profile management
- `/api/academics/`: Subjects, chapters, and topics hierarchy
- `/api/content/`: Video lecture metadata (YouTube & Cloud R2)
- `/api/questions/`: Practice questions & PYQs
- `/api/tests/`: Mock tests & test attempt management
- `/api/progress/`: Student progress metrics
- `/api/materials/`: Study material & PDF notes metadata
- `/api/banners/`: Admin-managed promotional banners & public slider feed
- `/api/analytics/`: Detailed performance analytics

---

## 🎨 Admin-Managed Banner Slider System

The platform includes dynamic promotional image carousels for the Homepage hero and Login portal.

### Features
- **Admin Studio** at `/admin/banners` with canvas-based cropping (16:9, 4:3, 1:1, free presets), 90° rotation, zoom, and client-side WebP compression.
- **Pillow Image Processing**: Auto-resizes to max 1600px width, strips EXIF metadata, and converts to high-efficiency WebP format.
- **Cloudflare R2 Storage**: Uploads securely to R2 bucket with automated fallback to local media for local dev.
- **Individual Slide Timing**: Each slide can be assigned its own display duration (2 to 30 seconds).
- **Placement & Quota**: Targeted placement (`home`, `login`, or `both`) with strict validation limiting active slides to 10 per placement.
- **Smooth Frontend Slider**: Responsive auto-advance with touch gestures/swipe, hover pause, and `prefers-reduced-motion` compliance.

### Cloudflare R2 Environment Variables
Ensure the following variables are configured in production (e.g., Render / backend `.env`):
```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev # or custom CDN domain
```

---

## 📜 Development Conventions
- **Clean Architecture**: Business logic is decoupled into services and Django models, keeping views light.
- **TypeScript Strictness**: Interfaces defined in `types/index.ts`. No `any` types.
- **Mobile First**: All layouts tested on 360px–412px viewports before desktop scaling.
