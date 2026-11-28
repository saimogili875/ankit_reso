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

# Razorpay Webhook Secret: Enforce in production
RAZORPAY_WEBHOOK_SECRET = config('RAZORPAY_WEBHOOK_SECRET', default='').strip()
if not RAZORPAY_WEBHOOK_SECRET:
    raise ImproperlyConfigured("RAZORPAY_WEBHOOK_SECRET must be configured in production to secure payment webhooks.")

# Redis Configuration for Production:
# Enforce REDIS_URL to avoid silent LocMemCache fallback which leads to split-brain
# cache state across multi-process Gunicorn workers and Celery services.
# Supports both redis:// and rediss:// (TLS) URLs from Render Managed Redis.
REDIS_URL = config('REDIS_URL', default=REDIS_URL).strip()
if not REDIS_URL:
    raise ImproperlyConfigured("REDIS_URL must be configured in production to prevent in-memory cache split-brain across workers.")

# Host Configuration: Read from ALLOWED_HOSTS env var
DEFAULT_PROD_ALLOWED_HOSTS = 'adepteduverse.com,www.adepteduverse.com,ankit-reso.onrender.com,.onrender.com,testserver'
ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default=DEFAULT_PROD_ALLOWED_HOSTS).split(',') if h.strip()]
for _h in ['adepteduverse.com', 'www.adepteduverse.com', 'ankit-reso.onrender.com', '.onrender.com', 'testserver']:
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
PREVIEW_ORIGINS_ENABLED = config('PREVIEW_ORIGINS_ENABLED', default=False, cast=bool)

if FRONTEND_URL and 'vercel.app' in FRONTEND_URL.lower():
    import warnings
    import logging
    _warn_msg = (
        f"FRONTEND_URL '{FRONTEND_URL}' contains 'vercel.app' in production. "
        "Customer emails and download links should use the canonical domain (e.g. https://adepteduverse.com)."
    )
    warnings.warn(_warn_msg, UserWarning, stacklevel=2)
    logging.getLogger('config.settings.prod').warning("STARTUP WARNING: %s", _warn_msg)

def _normalize_origin(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not (url.startswith('http://') or url.startswith('https://')):
        return f"https://{url}"
    return url.rstrip('/')

DEFAULT_PROD_CORS_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com,https://ankit-reso.onrender.com'
raw_cors = config('CORS_ALLOWED_ORIGINS', default=DEFAULT_PROD_CORS_ORIGINS)
cors_origins = [_normalize_origin(o) for o in raw_cors.split(',') if _normalize_origin(o)]

# Strictly exclude localhost/127.0.0.1 from production CORS
cors_origins = [o for o in cors_origins if not ('localhost' in o or '127.0.0.1' in o)]

if FRONTEND_URL:
    norm_frontend = _normalize_origin(FRONTEND_URL)
    if norm_frontend and not ('localhost' in norm_frontend or '127.0.0.1' in norm_frontend) and norm_frontend not in cors_origins:
        cors_origins.append(norm_frontend)

for _origin in [
    'https://adepteduverse.com',
    'https://www.adepteduverse.com',
    'https://app.adepteduverse.com',
    'https://ankit-reso.onrender.com',
]:
    if _origin not in cors_origins:
        cors_origins.append(_origin)

CORS_ALLOWED_ORIGINS = cors_origins
CORS_ALLOW_CREDENTIALS = True

DEFAULT_PROD_CSRF_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com,https://ankit-reso.onrender.com'
raw_csrf = config('CSRF_TRUSTED_ORIGINS', default=DEFAULT_PROD_CSRF_ORIGINS)
csrf_origins = [_normalize_origin(o) for o in raw_csrf.split(',') if _normalize_origin(o)]

# Strictly exclude localhost/127.0.0.1 from production CSRF
csrf_origins = [o for o in csrf_origins if not ('localhost' in o or '127.0.0.1' in o)]

if FRONTEND_URL:
    norm_frontend = _normalize_origin(FRONTEND_URL)
    if norm_frontend and not ('localhost' in norm_frontend or '127.0.0.1' in norm_frontend) and norm_frontend not in csrf_origins:
        csrf_origins.append(norm_frontend)

for _origin in [
    'https://adepteduverse.com',
    'https://www.adepteduverse.com',
    'https://app.adepteduverse.com',
    'https://ankit-reso.onrender.com',
]:
    if _origin not in csrf_origins:
        csrf_origins.append(_origin)

# Regex origins for apex domain, subdomains, and onrender.com
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://([a-zA-Z0-9-]+\.)*adepteduverse\.com$",
    r"^https://([a-zA-Z0-9-]+\.)*onrender\.com$",
]

# Dynamic Vercel preview environments support (toggled via PREVIEW_ORIGINS_ENABLED=true)
if PREVIEW_ORIGINS_ENABLED:
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://[a-zA-Z0-9-]+\.vercel\.app$")
    if 'https://*.vercel.app' not in csrf_origins:
        csrf_origins.append('https://*.vercel.app')

CSRF_TRUSTED_ORIGINS = csrf_origins

# Domain Separation & Cross-Site Cookie Configuration:
# When Next.js frontend proxies /api to Django API via rewrites (or when both share
# a root domain), SameSite='Lax' is supported and avoids third-party cookie blocking
# in Safari ITP, Brave Shields, and Chrome.
SESSION_COOKIE_SAMESITE = config('SESSION_COOKIE_SAMESITE', default='Lax')
CSRF_COOKIE_SAMESITE = config('CSRF_COOKIE_SAMESITE', default='Lax')
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
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

# HSTS & Referrer Policy Security Headers
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True, cast=bool)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=True, cast=bool)
SECURE_REFERRER_POLICY = config('SECURE_REFERRER_POLICY', default='strict-origin-when-cross-origin')

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
