import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import connection
from django.core.cache import cache

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend, database, Redis cache, and Celery worker status.
    Returns 200 with JSON { status: 'ok', db: true, redis: true, celery: true, version: '1.0.0' }
    Returns 503 if DB or Redis is down.
    """
    # 1. Ping PostgreSQL
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            db_ok = True
    except Exception as e:
        logger.error(f"Health check DB ping failed: {e}")
        db_ok = False

    # 2. Ping Redis via Cache backend (if configured)
    import os
    redis_configured = bool(os.environ.get('REDIS_URL'))
    redis_ok = False
    try:
        test_key = '_health_ping_check'
        cache.set(test_key, 'ok', timeout=10)
        retrieved = cache.get(test_key)
        redis_ok = (retrieved == 'ok')
    except Exception as e:
        logger.error(f"Health check Redis cache ping failed: {e}")
        redis_ok = False

    # 3. Check Celery workers responsiveness (non-blocking)
    celery_ok = False
    try:
        from config.celery import app as celery_app
        ping_res = celery_app.control.ping(timeout=0.2)
        celery_ok = bool(ping_res)
    except Exception:
        celery_ok = False

    # Database is required; Redis only causes 503 if explicitly configured in environment
    is_healthy = db_ok and (redis_ok if redis_configured else True)
    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return Response({
        'status': 'ok' if is_healthy else 'degraded',
        'db': db_ok,
        'redis': redis_ok,
        'redis_configured': redis_configured,
        'celery': celery_ok,
        'version': '1.0.0',
    }, status=http_status)
