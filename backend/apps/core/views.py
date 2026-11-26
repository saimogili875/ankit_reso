import os
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import connection

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "HEAD"])
def healthz(request):
    """
    Lightweight health probe that returns {"status": "ok"} immediately without
    touching PostgreSQL or Redis. Used by Render or Kubernetes for liveness/health probes.
    Accepts both GET and HEAD requests.
    """
    return JsonResponse({'status': 'ok'}, status=200)


@api_view(['GET', 'HEAD'])
@permission_classes([AllowAny])
def health_deep(request):
    """
    Deep readiness check that verifies Database, Redis/Cache, Celery, and R2.
    Returns:
      - 200 OK: if core services (DB and Redis/Cache) are operational.
      - 503 Service Unavailable: if DB or Redis is down, with explicit diagnostic details.
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

    # 2. Ping Redis / Cache
    redis_ok = False
    from django.conf import settings
    redis_url = (getattr(settings, 'REDIS_URL', '') or os.environ.get('REDIS_URL', '')).strip()

    if redis_url:
        try:
            import redis
            ssl_kwargs = {}
            if redis_url.startswith('rediss://'):
                import ssl
                ssl_kwargs = {'ssl_cert_reqs': ssl.CERT_NONE}
            client = redis.from_url(redis_url, socket_timeout=1.5, **ssl_kwargs)
            client.ping()
            redis_ok = True
            details['redis'] = 'connected'
        except Exception as e:
            err_msg = f"Redis connection failed: {e}"
            logger.error(f"Deep health check: {err_msg}")
            errors['redis'] = str(e)
            details['redis'] = 'failed'
            redis_ok = False
    else:
        # In environments without REDIS_URL, verify Django cache backend (e.g. LocMemCache)
        from django.core.cache import cache
        try:
            cache.set('_health_test', 1, 10)
            val = cache.get('_health_test')
            redis_ok = (val == 1)
            details['cache'] = 'locmem_operational'
        except Exception as e:
            errors['cache'] = str(e)
            details['cache'] = 'failed'
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

    # 4. Check Cloudflare R2 / S3 (non-blocking)
    r2_ok = False
    try:
        from storage.r2 import R2StorageClient
        r2_client = R2StorageClient()
        r2_ok, r2_msg = r2_client.check_connection()
        details['r2_storage'] = r2_msg
    except Exception as e:
        details['r2_storage'] = f"not_available ({e})"
        r2_ok = False

    # Both Database and Redis/Cache must be healthy for 200 OK
    is_healthy = db_ok and redis_ok
    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        'status': 'ok' if is_healthy else 'unhealthy',
        'database': db_ok,
        'redis': redis_ok,
        'celery': celery_ok,
        'r2': r2_ok,
        'details': details,
    }
    if redis_url:
        payload['redis_url'] = redis_url.split('@')[-1] if '@' in redis_url else redis_url
    if errors:
        payload['errors'] = errors

    return Response(payload, status=http_status)


# Alias for backwards compatibility
health_check = healthz
