import os
import socket
from django.core.exceptions import ImproperlyConfigured
from .base import *

env = config('ENVIRONMENT', default='development').lower()
if env == 'production' or config('RENDER', default=False, cast=bool) or os.environ.get('RENDER'):
    raise ImproperlyConfigured("CRITICAL: Development settings (config.settings.dev) cannot be used in a production environment or on Render.")

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Development Database: fallback to SQLite only if DATABASE_URL is not set and local PostgreSQL is offline
if not DATABASE_URL:
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect((POSTGRES_HOST, int(POSTGRES_PORT)))
        s.close()
    except (socket.error, Exception):
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }

# Development Cache: fallback to LocMemCache if Redis is not running locally
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    s.connect((REDIS_HOST, int(REDIS_PORT)))
    s.close()
except (socket.error, Exception):
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'dev-locmem-cache',
        }
    }

# In local dev, use cache backend for sessions to avoid slow remote DB roundtrips to Supabase
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
