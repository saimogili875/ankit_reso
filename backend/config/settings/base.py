import os
import sys
import logging
from pathlib import Path
from urllib.parse import urlparse, unquote
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-adepteduverse-dev-secret-key-change-in-prod-!@#$%')

DEBUG = config('DEBUG', default=False, cast=bool)

# Host & CSRF Configuration
DEFAULT_ALLOWED_HOSTS = 'adepteduverse.com,www.adepteduverse.com,ankit-reso.onrender.com,.onrender.com,localhost,127.0.0.1,testserver'
ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default=DEFAULT_ALLOWED_HOSTS).split(',') if h.strip()]
for _h in ['adepteduverse.com', 'www.adepteduverse.com', 'ankit-reso.onrender.com', '.onrender.com', 'localhost', '127.0.0.1', 'testserver']:
    if _h not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_h)

DEFAULT_CSRF_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://ankit-reso.onrender.com,http://localhost:3000,http://127.0.0.1:3000'
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in config('CSRF_TRUSTED_ORIGINS', default=DEFAULT_CSRF_ORIGINS).split(',') if origin.strip()]
for _origin in ['https://adepteduverse.com', 'https://www.adepteduverse.com', 'https://ankit-reso.onrender.com']:
    if _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_origin)

DEFAULT_CORS_ORIGINS = 'https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com,https://ankit-reso.onrender.com,http://localhost:3000,http://127.0.0.1:3000'
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in config('CORS_ALLOWED_ORIGINS', default=DEFAULT_CORS_ORIGINS).split(',') if origin.strip()]
for _origin in ['https://adepteduverse.com', 'https://www.adepteduverse.com', 'https://ankit-reso.onrender.com', 'http://localhost:3000', 'http://127.0.0.1:3000']:
    if _origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_origin)

CORS_ALLOW_CREDENTIALS = True

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'corsheaders',
    'drf_spectacular',

    # AdeptEduverse Apps
    'apps.core',
    'apps.accounts',
    'apps.academics',
    'apps.content',
    'apps.questions',
    'apps.tests',
    'apps.progress',
    'apps.materials',
    'apps.analytics',
    'apps.adminpanel',
    'apps.banners',
    'apps.payments',
    'apps.books',
    'apps.coursecontent',
]

MIDDLEWARE = [
    'apps.core.middleware.NormalizeSlashMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database Configuration
DATABASE_URL = config('DATABASE_URL', default=None)
MIGRATION_DATABASE_URL = config('MIGRATION_DATABASE_URL', default=None)
DATABASE_SSL_REQUIRE = config('DATABASE_SSL_REQUIRE', default=None)

POSTGRES_DB = config('POSTGRES_DB', default=None)
POSTGRES_USER = config('POSTGRES_USER', default=None)
POSTGRES_PASSWORD = config('POSTGRES_PASSWORD', default=None)
POSTGRES_HOST = config('POSTGRES_HOST', default=None)
POSTGRES_PORT = config('POSTGRES_PORT', default='5432')

# Direct migration connection routing (bypasses transaction poolers like PgBouncer)
is_migrating = any(cmd in sys.argv for cmd in ['migrate', 'makemigrations'])
active_db_url = DATABASE_URL
if is_migrating and MIGRATION_DATABASE_URL:
    active_db_url = MIGRATION_DATABASE_URL

# Detect if using Supabase or PgBouncer transaction pooler (port 6543 or 'pooler' in host)
is_pooler = False
if active_db_url:
    is_pooler = ':6543' in active_db_url or 'pooler' in active_db_url.lower()

# With a transaction pooler, CONN_MAX_AGE must be 0 to avoid pooler session starvation
default_conn_max_age = 0 if is_pooler else 60
CONN_MAX_AGE = config('CONN_MAX_AGE', default=default_conn_max_age, cast=int)
if is_pooler:
    CONN_MAX_AGE = 0

DISABLE_SERVER_SIDE_CURSORS = config('DISABLE_SERVER_SIDE_CURSORS', default=is_pooler, cast=bool)

if 'test' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    db_engine = 'django.db.backends.sqlite3'
    db_host = ':memory:'
elif active_db_url:
    url_lower = active_db_url.lower()
    is_postgres_url = url_lower.startswith('postgres://') or url_lower.startswith('postgresql://')
    is_sqlite_url = url_lower.startswith('sqlite://')

    # SSL is only valid for PostgreSQL. Allow disabling via DATABASE_SSL_REQUIRE=false.
    if DATABASE_SSL_REQUIRE is not None:
        ssl_enabled = config('DATABASE_SSL_REQUIRE', default=True, cast=bool)
    else:
        # Auto-detect: require SSL for remote postgres (not localhost / 127.0.0.1 / postgres host)
        is_local_host = any(h in url_lower for h in ['localhost', '127.0.0.1', '@postgres:', '@postgres/'])
        ssl_enabled = is_postgres_url and not is_local_host

    try:
        import dj_database_url
        parsed_db = dj_database_url.parse(
            active_db_url,
            conn_max_age=CONN_MAX_AGE,
            conn_health_checks=True,
            ssl_require=ssl_enabled if is_postgres_url else False,
        )
        if not is_postgres_url and 'OPTIONS' in parsed_db and 'sslmode' in parsed_db['OPTIONS']:
            del parsed_db['OPTIONS']['sslmode']
        if not ssl_enabled and 'OPTIONS' in parsed_db and 'sslmode' in parsed_db['OPTIONS']:
            del parsed_db['OPTIONS']['sslmode']
        if is_pooler or DISABLE_SERVER_SIDE_CURSORS:
            parsed_db['DISABLE_SERVER_SIDE_CURSORS'] = True
        DATABASES = {'default': parsed_db}
        db_engine = parsed_db.get('ENGINE', '')
        db_host = parsed_db.get('HOST', '')
    except ImportError:
        parsed_url = urlparse(active_db_url)
        db_engine = 'django.db.backends.postgresql' if is_postgres_url else 'django.db.backends.sqlite3'
        db_host = parsed_url.hostname or ''
        DATABASES = {
            'default': {
                'ENGINE': db_engine,
                'NAME': parsed_url.path.lstrip('/') if is_postgres_url else (BASE_DIR / 'db.sqlite3'),
                'USER': unquote(parsed_url.username) if parsed_url.username else '',
                'PASSWORD': unquote(parsed_url.password) if parsed_url.password else '',
                'HOST': db_host,
                'PORT': str(parsed_url.port) if parsed_url.port else '5432',
                'CONN_MAX_AGE': CONN_MAX_AGE,
                'DISABLE_SERVER_SIDE_CURSORS': DISABLE_SERVER_SIDE_CURSORS or is_pooler,
            }
        }
        if is_postgres_url and ssl_enabled:
            DATABASES['default']['OPTIONS'] = {'sslmode': 'require'}
elif POSTGRES_DB and (POSTGRES_USER or POSTGRES_HOST):
    # Branch 2: POSTGRES_* environment variables (e.g. Docker Compose)
    db_engine = 'django.db.backends.postgresql'
    db_host = POSTGRES_HOST or 'localhost'
    DATABASES = {
        'default': {
            'ENGINE': db_engine,
            'NAME': POSTGRES_DB,
            'USER': POSTGRES_USER or 'postgres',
            'PASSWORD': POSTGRES_PASSWORD or '',
            'HOST': db_host,
            'PORT': str(POSTGRES_PORT or '5432'),
            'CONN_MAX_AGE': CONN_MAX_AGE,
            'DISABLE_SERVER_SIDE_CURSORS': DISABLE_SERVER_SIDE_CURSORS,
        }
    }
else:
    # Branch 3: Safe local fallback to SQLite when neither DATABASE_URL nor POSTGRES_* is set
    db_engine = 'django.db.backends.sqlite3'
    db_host = 'local-file'
    DATABASES = {
        'default': {
            'ENGINE': db_engine,
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Startup database logging (safe: engine and host only, never password)
logger = logging.getLogger(__name__)
logger.info("Database configured: ENGINE=%s, HOST=%s", db_engine, db_host or 'localhost')

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom User Model (registered in accounts app)
AUTH_USER_MODEL = 'accounts.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.ClerkJWTAuthentication',
        'apps.accounts.authentication.Session401Authentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '120/minute',
        'chatbot': '10/minute',
        'login': '10/minute',
        'login_failed_identifier': '5/15min',
        'admin_login': '5/15min',
        'register': '10/minute',
        'signup': '10/minute',
        'otp_send': '5/minute',
        'otp_verify': '15/minute',
        'password_reset': '5/minute',
        'test_submit': '15/minute',
        'book_order_create_ip_min': '5/min',
        'book_order_create_ip_hour': '20/hour',
        'book_order_create_phone': '3/hour',
        'book_order_verify_ip': '20/min',
        'book_order_download_ip': '30/min',
    },
    'NUM_PROXIES': config('NUM_PROXIES', default=2, cast=int),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# Swagger Documentation (drf-spectacular)
SPECTACULAR_SETTINGS = {
    'TITLE': 'AdeptEduverse API',
    'DESCRIPTION': 'Modular REST API for AdeptEduverse EdTech Platform',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Redis & Cache Backend
REDIS_URL = config('REDIS_URL', default='').strip()
REDIS_HOST = config('REDIS_HOST', default='redis')
REDIS_PORT = config('REDIS_PORT', default='6379')
DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True
DJANGO_REDIS_LOGGER = 'django_redis'

redis_cache_options = {
    'CLIENT_CLASS': 'django_redis.client.DefaultClient',
    'IGNORE_EXCEPTIONS': True,
    'SOCKET_CONNECT_TIMEOUT': 2,
    'SOCKET_TIMEOUT': 2,
}
# Render / Upstash TLS support for Redis
if REDIS_URL and REDIS_URL.startswith('rediss://'):
    redis_cache_options['CONNECTION_POOL_KWARGS'] = {
        'ssl_cert_reqs': None,
    }

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 300,
            'OPTIONS': redis_cache_options,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }

SESSION_ENGINE = config('SESSION_ENGINE', default='django.contrib.sessions.backends.cached_db')
SESSION_CACHE_ALIAS = 'default'

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=REDIS_URL or 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=REDIS_URL or 'redis://localhost:6379/0')

# TLS Support for Celery Broker & Result Backend (e.g. Render Managed Redis rediss://)
if CELERY_BROKER_URL.startswith('rediss://'):
    import ssl
    CELERY_BROKER_USE_SSL = {
        'ssl_cert_reqs': ssl.CERT_NONE,
    }
if CELERY_RESULT_BACKEND.startswith('rediss://'):
    import ssl
    CELERY_REDIS_BACKEND_USE_SSL = {
        'ssl_cert_reqs': ssl.CERT_NONE,
    }

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ROUTES = {
    'apps.content.tasks.transcode_video_hls_task': {'queue': 'video'},
}

# Video Transcoding & HLS Streaming Profiles (FFmpeg Tuning)
# Optimized for text sharpness and small equation legibility in lecture videos
VIDEO_PROFILES = {
    '360p': {
        'width': 640,
        'height': 360,
        'bitrate': '700k',
        'maxrate': '750k',
        'bufsize': '1400k',
        'crf': 22,
    },
    '480p': {
        'width': 854,
        'height': 480,
        'bitrate': '1200k',
        'maxrate': '1300k',
        'bufsize': '2400k',
        'crf': 21,
    },
    '720p': {
        'width': 1280,
        'height': 720,
        'bitrate': '2200k',
        'maxrate': '2400k',
        'bufsize': '4400k',
        'crf': 20,
    },
    '1080p': {
        'width': 1920,
        'height': 1080,
        'bitrate': '4000k',
        'maxrate': '4400k',
        'bufsize': '8000k',
        'crf': 20,
    },
}

ENABLE_1080P = config('ENABLE_1080P', default=False, cast=bool)
HLS_SEGMENT_DURATION = config('HLS_SEGMENT_DURATION', default=6, cast=int)
VIDEO_STREAMING_DOMAIN = config('VIDEO_STREAMING_DOMAIN', default='') # e.g. video.adepteduverse.com
VIDEO_STREAMING_SECRET = config('VIDEO_STREAMING_SECRET', default=SECRET_KEY)
VIDEO_STREAMING_TOKEN_TTL_SECONDS = config('VIDEO_STREAMING_TOKEN_TTL_SECONDS', default=21600, cast=int) # 6-hour token expiry
DELETE_ORIGINAL_AFTER_PROCESSING = config('DELETE_ORIGINAL_AFTER_PROCESSING', default=True, cast=bool) # Purge MP4 original after HLS ready to save 44% R2 storage
VIDEO_PROGRESS_HEARTBEAT_SECONDS = config('VIDEO_PROGRESS_HEARTBEAT_SECONDS', default=30, cast=int) # 30s heartbeat cuts database write load by 50%
VIDEO_CELERY_TIME_LIMIT = config('VIDEO_CELERY_TIME_LIMIT', default=7200, cast=int) # 2-hour hard timeout

# Cloudflare R2 Credentials & Storage Configuration
R2_ACCOUNT_ID = config('R2_ACCOUNT_ID', default='')
R2_ACCESS_KEY_ID = config('R2_ACCESS_KEY_ID', default='')
R2_SECRET_ACCESS_KEY = config('R2_SECRET_ACCESS_KEY', default='')
R2_BUCKET_NAME = config('R2_BUCKET_NAME', default='adepteduverse-storage')
R2_ENDPOINT = config('R2_ENDPOINT', default='')

# Structured Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name}:{lineno} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': config('DJANGO_LOG_LEVEL', default='INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'django_redis': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# Email Backend & SMTP Configuration
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend' if (DEBUG or not config('EMAIL_HOST_USER', default='')) else 'django.core.mail.backends.smtp.EmailBackend'
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='ANKIT JEE <no-reply@adepteduverse.com>')

# TextBee SMS Gateway Configuration
TEXTBEE_API_KEY = config('TEXTBEE_API_KEY', default='')
TEXTBEE_DEVICE_ID = config('TEXTBEE_DEVICE_ID', default='')

# Razorpay Payment Gateway Configuration
RAZORPAY_KEY_ID = config('RAZORPAY_KEY_ID', default='')
RAZORPAY_KEY_SECRET = config('RAZORPAY_KEY_SECRET', default='')
RAZORPAY_WEBHOOK_SECRET = config('RAZORPAY_WEBHOOK_SECRET', default='')

# Clerk Authentication (Student Portal)
CLERK_SECRET_KEY = config('CLERK_SECRET_KEY', default='').strip()
CLERK_WEBHOOK_SECRET = config('CLERK_WEBHOOK_SECRET', default='').strip()
CLERK_JWKS_URL = config('CLERK_JWKS_URL', default='https://clerk.adepteduverse.com/.well-known/jwks.json').strip()
CLERK_ISSUER = config('CLERK_ISSUER', default='https://clerk.adepteduverse.com').strip()
CLERK_AUTHORIZED_PARTIES = [
    origin.strip() for origin in config('CLERK_AUTHORIZED_PARTIES', default='http://localhost:3000,http://127.0.0.1:3000,https://adepteduverse.com,https://www.adepteduverse.com,https://app.adepteduverse.com').split(',') if origin.strip()
]


