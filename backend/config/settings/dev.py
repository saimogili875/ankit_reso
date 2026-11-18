from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Development Database: fallback to SQLite if PostgreSQL is not running locally
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
