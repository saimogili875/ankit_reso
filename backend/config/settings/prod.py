from .base import *

DEBUG = False

# Production MUST provide a secure SECRET_KEY in environment variables
SECRET_KEY = config('SECRET_KEY', default='prod-secret-key-must-be-set-in-environment-variables')

ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='ankit-reso.onrender.com,.onrender.com').split(',') if h.strip()]

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

cors_origins = [
    origin.strip() for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='https://adepteduverse.com,https://app.adepteduverse.com'
    ).split(',') if origin.strip()
]
if FRONTEND_URL and FRONTEND_URL not in cors_origins:
    cors_origins.append(FRONTEND_URL)

CORS_ALLOWED_ORIGINS = cors_origins
CORS_ALLOW_CREDENTIALS = True

csrf_origins = [
    origin.strip() for origin in config(
        'CSRF_TRUSTED_ORIGINS',
        default='https://adepteduverse.com,https://app.adepteduverse.com'
    ).split(',') if origin.strip()
]
if FRONTEND_URL and FRONTEND_URL not in csrf_origins:
    csrf_origins.append(FRONTEND_URL)

CSRF_TRUSTED_ORIGINS = csrf_origins

# Domain Separation & Cross-Site Cookie Configuration:
# When Next.js frontend (e.g. https://app.adepteduverse.com or Vercel) and Django API (Render)
# run on different subdomains or origins, cookies must be configured with:
# 1. SameSite='None' to permit cross-origin authenticated fetch requests with credentials.
# 2. Secure=True to ensure cookies are only transmitted over HTTPS.
# 3. CSRF_COOKIE_HTTPONLY=False so frontend JavaScript can read the CSRF cookie or token via header.
SESSION_COOKIE_SAMESITE = config('SESSION_COOKIE_SAMESITE', default='None')
CSRF_COOKIE_SAMESITE = config('CSRF_COOKIE_SAMESITE', default='None')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
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
