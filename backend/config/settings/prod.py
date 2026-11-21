from django.core.exceptions import ImproperlyConfigured
from .base import *

DEBUG = config('DEBUG', default=False, cast=bool)

# Production SECRET_KEY: Read from environment
SECRET_KEY = config('SECRET_KEY', default=SECRET_KEY)
if not SECRET_KEY or 'dev-secret-key' in SECRET_KEY or 'django-insecure' in SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY must be set to a secure, random string in production.")

# Video Streaming Secret: Enforce separation from SECRET_KEY
VIDEO_STREAMING_SECRET = config('VIDEO_STREAMING_SECRET', default='')
if not VIDEO_STREAMING_SECRET:
    raise ImproperlyConfigured("VIDEO_STREAMING_SECRET must be explicitly set in production.")
if VIDEO_STREAMING_SECRET == SECRET_KEY:
    raise ImproperlyConfigured("VIDEO_STREAMING_SECRET must not be identical to SECRET_KEY to prevent key reuse.")

# Redis Configuration for Production:
# Enforce REDIS_URL to avoid silent LocMemCache fallback which leads to split-brain
# cache state across multi-process Gunicorn workers and Celery services.
# Supports both redis:// and rediss:// (TLS) URLs from Render Managed Redis.
REDIS_URL = config('REDIS_URL', default=REDIS_URL).strip()
if not REDIS_URL:
    raise ImproperlyConfigured("REDIS_URL must be configured in production to prevent in-memory cache split-brain across workers.")

# Host Configuration: Read from ALLOWED_HOSTS env var
DEFAULT_PROD_ALLOWED_HOSTS = 'adepteduverse.com,www.adepteduverse.com,ankit-reso.onrender.com,.onrender.com,localhost,127.0.0.1,testserver'
ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default=DEFAULT_PROD_ALLOWED_HOSTS).split(',') if h.strip()]
for _h in ['adepteduverse.com', 'www.adepteduverse.com', 'ankit-reso.onrender.com', '.onrender.com', 'localhost', '127.0.0.1', 'testserver']:
    if _h not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_h)

# WhiteNoise Static Files Storage for Production
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Frontend URL support for split deployment (e.g. Vercel)
FRONTEND_URL = config('FRONTEND_URL', default='').strip()

def _normalize_origin(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not (url.startswith('http://') or url.startswith('https://')):
        return f"https://{url}"
    return url.rstrip('/')

DEFAULT_PROD_CORS_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com,https://ankit-reso.onrender.com,http://localhost:3000,http://127.0.0.1:3000'
raw_cors = config('CORS_ALLOWED_ORIGINS', default=DEFAULT_PROD_CORS_ORIGINS)
cors_origins = [_normalize_origin(o) for o in raw_cors.split(',') if _normalize_origin(o)]

if FRONTEND_URL:
    norm_frontend = _normalize_origin(FRONTEND_URL)
    if norm_frontend and norm_frontend not in cors_origins:
        cors_origins.append(norm_frontend)

for _origin in [
    'https://adepteduverse.com',
    'https://www.adepteduverse.com',
    'https://app.adepteduverse.com',
    'https://ankit-reso.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]:
    if _origin not in cors_origins:
        cors_origins.append(_origin)

CORS_ALLOWED_ORIGINS = cors_origins
CORS_ALLOW_CREDENTIALS = True

DEFAULT_PROD_CSRF_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com,https://ankit-reso.onrender.com,http://localhost:3000,http://127.0.0.1:3000'
raw_csrf = config('CSRF_TRUSTED_ORIGINS', default=DEFAULT_PROD_CSRF_ORIGINS)
csrf_origins = [_normalize_origin(o) for o in raw_csrf.split(',') if _normalize_origin(o)]

if FRONTEND_URL:
    norm_frontend = _normalize_origin(FRONTEND_URL)
    if norm_frontend and norm_frontend not in csrf_origins:
        csrf_origins.append(norm_frontend)

for _origin in [
    'https://adepteduverse.com',
    'https://www.adepteduverse.com',
    'https://app.adepteduverse.com',
    'https://ankit-reso.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]:
    if _origin not in csrf_origins:
        csrf_origins.append(_origin)

CSRF_TRUSTED_ORIGINS = csrf_origins

# Domain Separation & Cross-Site Cookie Configuration:
# When Next.js frontend proxies /api to Django API via rewrites (or when both share
# a root domain), SameSite='Lax' is supported and avoids third-party cookie blocking
# in Safari ITP, Brave Shields, and Chrome.
SESSION_COOKIE_SAMESITE = config('SESSION_COOKIE_SAMESITE', default='Lax')
CSRF_COOKIE_SAMESITE = config('CSRF_COOKIE_SAMESITE', default='Lax')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SECURE_REDIRECT_EXEMPT = [
    r'^healthz/?$',
    r'^health/?$',
    r'^health/deep/?$',
    r'^api/health/?$',
    r'^api/health/deep/?$',
    r'^$',
]
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Sentry Production Monitoring
SENTRY_DSN = config('SENTRY_DSN', default=None)
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=config('SENTRY_TRACES_SAMPLE_RATE', default=0.2, cast=float),
            send_default_pii=False,
            environment=config('ENVIRONMENT', default='production'),
        )
    except ImportError:
        pass
