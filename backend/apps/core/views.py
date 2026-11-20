import os
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import connection

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def healthz(request):
    """
    Lightweight health probe that returns 200 OK immediately without
    touching PostgreSQL or Redis. Used by Render or Kubernetes for liveness checks.
    """
    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_deep(request):
    """
    Deep readiness check that verifies Database and Redis connectivity.
    Returns:
      - 200 OK: if DB and Redis are operational.
      - 503 Service Unavailable: if DB or Redis is down, with explicit error messages.
    """
    errors = {}
    details = {}

    # 1. Ping Database
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            db_ok = True
            details['database'] = 'connected'
    except Exception as e:
        err_msg = f"Database connection failed: {e}"
        logger.error(f"Deep health check: {err_msg}")
        errors['database'] = str(e)
        details['database'] = 'failed'
        db_ok = False

    # 2. Ping Redis
    redis_ok = False
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    try:
        import redis
        client = redis.from_url(redis_url, socket_timeout=1.0)
        client.ping()
        redis_ok = True
        details['redis'] = 'connected'
    except Exception as e:
        err_msg = f"Redis connection failed ({redis_url}): {e}"
        logger.error(f"Deep health check: {err_msg}")
        errors['redis'] = str(e)
        details['redis'] = 'failed'
        redis_ok = False

    # 3. Check Celery workers (non-blocking)
    celery_ok = False
    try:
        from config.celery import app as celery_app
        ping_res = celery_app.control.ping(timeout=0.2)
        celery_ok = bool(ping_res)
        details['celery'] = 'responsive' if celery_ok else 'idle_or_unreachable'
    except Exception:
        celery_ok = False
        details['celery'] = 'unavailable'

    # Both Database and Redis are verified
    is_healthy = db_ok and redis_ok
    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        'status': 'ok' if is_healthy else 'unhealthy',
        'database': db_ok,
        'redis': redis_ok,
        'redis_url': redis_url.split('@')[-1] if '@' in redis_url else redis_url,
        'celery': celery_ok,
        'details': details,
    }
    if errors:
        payload['errors'] = errors

    return Response(payload, status=http_status)


# Alias for backwards compatibility
health_check = health_deep
