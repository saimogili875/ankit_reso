from .base import *

DEBUG = False

# Production MUST provide a secure SECRET_KEY in environment variables
SECRET_KEY = config('SECRET_KEY')

ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='adepteduverse.com,api.adepteduverse.com').split(',') if h.strip()]

CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='https://adepteduverse.com,https://app.adepteduverse.com'
    ).split(',') if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

# CSRF trusted origins for production cross-site requests
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in config(
        'CSRF_TRUSTED_ORIGINS',
        default='https://adepteduverse.com,https://app.adepteduverse.com'
    ).split(',') if origin.strip()
]

# Domain Separation & Cross-Site Cookie Configuration:
# When Next.js frontend (e.g. https://app.adepteduverse.com) and Django API (e.g. https://api.adepteduverse.com)
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
