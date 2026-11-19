import os
from pathlib import Path
from urllib.parse import urlparse, unquote
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-adepteduverse-dev-secret-key-change-in-prod-!@#$%')

DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',') if h.strip()]

CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in config('CSRF_TRUSTED_ORIGINS', default='http://localhost:3000,http://127.0.0.1:3000').split(',') if origin.strip()]

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
    'apps.live',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
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
CONN_MAX_AGE = config('CONN_MAX_AGE', default=600, cast=int)
DISABLE_SERVER_SIDE_CURSORS = config('DISABLE_SERVER_SIDE_CURSORS', default=True, cast=bool)

if DATABASE_URL:
    try:
        import dj_database_url
        DATABASES = {
            'default': dj_database_url.parse(
                DATABASE_URL,
                conn_max_age=CONN_MAX_AGE,
                conn_health_checks=True,
            )
        }
        if DISABLE_SERVER_SIDE_CURSORS:
            DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
    except ImportError:
        parsed_db = urlparse(DATABASE_URL)
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': parsed_db.path.lstrip('/'),
                'USER': unquote(parsed_db.username) if parsed_db.username else '',
                'PASSWORD': unquote(parsed_db.password) if parsed_db.password else '',
                'HOST': parsed_db.hostname or '',
                'PORT': str(parsed_db.port) if parsed_db.port else '5432',
                'CONN_MAX_AGE': CONN_MAX_AGE,
                'DISABLE_SERVER_SIDE_CURSORS': DISABLE_SERVER_SIDE_CURSORS,
            }
        }
else:
    POSTGRES_DB = config('POSTGRES_DB', default='adepteduverse')
    POSTGRES_USER = config('POSTGRES_USER', default='postgres')
    POSTGRES_PASSWORD = config('POSTGRES_PASSWORD', default='postgres')
    POSTGRES_HOST = config('POSTGRES_HOST', default='postgres')
    POSTGRES_PORT = config('POSTGRES_PORT', default='5432')

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': POSTGRES_DB,
            'USER': POSTGRES_USER,
            'PASSWORD': POSTGRES_PASSWORD,
            'HOST': POSTGRES_HOST,
            'PORT': POSTGRES_PORT,
            'CONN_MAX_AGE': CONN_MAX_AGE,
            'DISABLE_SERVER_SIDE_CURSORS': DISABLE_SERVER_SIDE_CURSORS,
        }
    }

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
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '120/minute',
        'login': '10/minute',
        'register': '10/minute',
        'live_token': '30/minute',
        'test_submit': '15/minute',
    },
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

# Redis & Celery
REDIS_URL = config('REDIS_URL', default=None)
REDIS_HOST = config('REDIS_HOST', default='redis')
REDIS_PORT = config('REDIS_PORT', default='6379')

if not REDIS_URL:
    REDIS_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/0'

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=REDIS_URL)
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=REDIS_URL)
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
DELETE_ORIGINAL_AFTER_PROCESSING = config('DELETE_ORIGINAL_AFTER_PROCESSING', default=False, cast=bool)

# Redis Cache Backend
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
        'TIMEOUT': 300,
    }
}

# Cloudflare R2 Credentials & Storage Configuration
R2_ACCOUNT_ID = config('R2_ACCOUNT_ID', default='')
R2_ACCESS_KEY_ID = config('R2_ACCESS_KEY_ID', default='')
R2_SECRET_ACCESS_KEY = config('R2_SECRET_ACCESS_KEY', default='')
R2_BUCKET_NAME = config('R2_BUCKET_NAME', default='adepteduverse-storage')
R2_ENDPOINT = config('R2_ENDPOINT', default='')

# LiveKit Configuration
LIVEKIT_URL = config('LIVEKIT_URL', default='wss://livekit.local.demo')
LIVEKIT_API_KEY = config('LIVEKIT_API_KEY', default='devkey')
LIVEKIT_API_SECRET = config('LIVEKIT_API_SECRET', default='secret_32_characters_minimum_length_key_for_security!')

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
    },
}
