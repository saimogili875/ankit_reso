#!/usr/bin/env python3
"""
Diagnostic utility to test all infrastructure and connection hops:
Hop 1: PostgreSQL / Database
Hop 2: Redis / Cache (handles TLS rediss://)
Hop 3: Celery Worker Ping
Hop 4: Cloudflare R2 Storage Bucket
Hop 5: Backend /healthz & /api/health
Hop 6: Frontend Next.js /api/health rewrite proxy
Hop 7: Session & CSRF Cookie Roundtrip
Hop 8: Authenticated / CSRF POST validation

Usage:
    python scripts/check_connections.py
    python scripts/check_connections.py --backend http://127.0.0.1:8000 --frontend http://127.0.0.1:3000
"""
import os
import sys
import time
import argparse
import urllib.request
import urllib.error
import http.cookiejar
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

# Ensure Django environment is configured
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

results = []

def record(hop_name: str, status: str, latency_ms: float, details: str):
    results.append({
        'hop': hop_name,
        'status': status,
        'latency': f"{latency_ms:.1f}ms" if latency_ms >= 0 else "-",
        'details': details,
    })

def check_database():
    start = time.time()
    try:
        import django
        django.setup()
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        latency = (time.time() - start) * 1000
        engine = connection.settings_dict.get('ENGINE', '').split('.')[-1]
        host = connection.settings_dict.get('HOST', 'localhost')
        record("1. Database (PostgreSQL/DB)", "PASS", latency, f"Connected via {engine} on {host}")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("1. Database (PostgreSQL/DB)", "FAIL", latency, str(e))

def check_redis():
    start = time.time()
    try:
        from django.conf import settings
        redis_url = getattr(settings, 'REDIS_URL', '') or os.environ.get('REDIS_URL', '')
        if redis_url:
            import redis
            ssl_kwargs = {}
            if redis_url.startswith('rediss://'):
                import ssl
                ssl_kwargs = {'ssl_cert_reqs': ssl.CERT_NONE}
            client = redis.from_url(redis_url, socket_timeout=2.0, **ssl_kwargs)
            client.ping()
            latency = (time.time() - start) * 1000
            scheme = "rediss (TLS)" if redis_url.startswith('rediss://') else "redis"
            record("2. Redis Cache & Broker", "PASS", latency, f"Ping successful ({scheme})")
        else:
            from django.core.cache import cache
            cache.set('_check_conn', 'ok', 5)
            val = cache.get('_check_conn')
            latency = (time.time() - start) * 1000
            if val == 'ok':
                record("2. Redis Cache & Broker", "PASS", latency, "LocMemCache operational (REDIS_URL unset)")
            else:
                record("2. Redis Cache & Broker", "FAIL", latency, "LocMemCache failed write/read")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("2. Redis Cache & Broker", "FAIL", latency, str(e))

def check_celery():
    start = time.time()
    try:
        from config.celery import app as celery_app
        ping_res = celery_app.control.ping(timeout=0.5)
        latency = (time.time() - start) * 1000
        if ping_res:
            workers = list(ping_res.keys()) if isinstance(ping_res, dict) else [str(x) for x in ping_res]
            record("3. Celery Worker Ping", "PASS", latency, f"Workers active: {', '.join(workers[:3])}")
        else:
            record("3. Celery Worker Ping", "WARN", latency, "No active workers responded (is celery worker running?)")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("3. Celery Worker Ping", "WARN", latency, f"Celery ping error: {e}")

def check_r2():
    start = time.time()
    try:
        from storage.r2 import R2StorageClient
        client = R2StorageClient()
        ok, msg = client.check_connection()
        latency = (time.time() - start) * 1000
        if ok:
            record("4. Cloudflare R2 Bucket", "PASS", latency, msg)
        else:
            status = "WARN" if "not configured" in msg.lower() else "FAIL"
            record("4. Cloudflare R2 Bucket", status, latency, msg)
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("4. Cloudflare R2 Bucket", "FAIL", latency, str(e))

def check_backend_http(backend_url: str):
    start = time.time()
    url = f"{backend_url.rstrip('/')}/healthz"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ConnectionChecker/1.0'})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            latency = (time.time() - start) * 1000
            code = resp.getcode()
            if code == 200:
                record("5. Backend HTTP Healthz", "PASS", latency, f"GET {url} -> HTTP {code} OK")
            else:
                record("5. Backend HTTP Healthz", "FAIL", latency, f"GET {url} -> HTTP {code}")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("5. Backend HTTP Healthz", "WARN", latency, f"{url} offline/unreachable in local check ({e})")

def check_frontend_rewrite(frontend_url: str):
    start = time.time()
    url = f"{frontend_url.rstrip('/')}/api/health"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ConnectionChecker/1.0'})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            latency = (time.time() - start) * 1000
            code = resp.getcode()
            if code == 200:
                record("6. Next.js /api Proxy Rewrite", "PASS", latency, f"GET {url} -> HTTP {code} OK")
            else:
                record("6. Next.js /api Proxy Rewrite", "FAIL", latency, f"GET {url} -> HTTP {code}")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("6. Next.js /api Proxy Rewrite", "WARN", latency, f"{url} offline/unreachable in local check ({e})")

def check_cookies_and_csrf(backend_url: str):
    start = time.time()
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    
    csrf_token = None
    csrf_url = f"{backend_url.rstrip('/')}/api/auth/csrf/"
    try:
        req = urllib.request.Request(csrf_url, headers={'User-Agent': 'ConnectionChecker/1.0'})
        with opener.open(req, timeout=3.0) as resp:
            cookies = [c.name for c in cookie_jar]
            for c in cookie_jar:
                if c.name in ('csrftoken', 'csrf_token'):
                    csrf_token = c.value
        latency = (time.time() - start) * 1000
        if csrf_token:
            record("7. Cookie Roundtrip (CSRF/Session)", "PASS", latency, f"Received csrftoken: {csrf_token[:8]}... (cookies: {', '.join(cookies)})")
        else:
            record("7. Cookie Roundtrip (CSRF/Session)", "WARN", latency, f"HTTP OK but no csrftoken in cookies: {cookies}")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("7. Cookie Roundtrip (CSRF/Session)", "WARN", latency, f"{csrf_url} ({e})")

    # Hop 8: CSRF POST Verification
    start = time.time()
    if not csrf_token:
        record("8. CSRF POST Verification", "SKIPPED", -1, "Skipped because Hop 7 did not yield a csrftoken")
        return

    post_url = f"{backend_url.rstrip('/')}/api/auth/login/"
    try:
        import json
        payload = json.dumps({'identifier': 'health_probe', 'password': 'dummy'}).encode('utf-8')
        req = urllib.request.Request(
            post_url,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf_token,
                'Referer': backend_url,
                'User-Agent': 'ConnectionChecker/1.0',
            },
            method='POST',
        )
        with opener.open(req, timeout=3.0) as resp:
            latency = (time.time() - start) * 1000
            record("8. CSRF POST Verification", "PASS", latency, f"POST {post_url} validated CSRF")
    except urllib.error.HTTPError as e:
        latency = (time.time() - start) * 1000
        # If it returns 400 (Bad credentials) rather than 403 Forbidden (CSRF failed), CSRF succeeded!
        if e.code in (400, 401):
            record("8. CSRF POST Verification", "PASS", latency, f"CSRF token accepted (HTTP {e.code} auth rejection as expected)")
        elif e.code == 403:
            record("8. CSRF POST Verification", "FAIL", latency, f"HTTP 403 Forbidden - CSRF validation failed")
        else:
            record("8. CSRF POST Verification", "WARN", latency, f"HTTP {e.code}: {e.reason}")
    except Exception as e:
        latency = (time.time() - start) * 1000
        record("8. CSRF POST Verification", "WARN", latency, f"{e}")

def main():
    parser = argparse.ArgumentParser(description="Test AdeptEduverse infrastructure connection hops.")
    parser.add_argument('--backend', default=os.environ.get('BACKEND_URL', 'http://127.0.0.1:8000'))
    parser.add_argument('--frontend', default=os.environ.get('FRONTEND_URL', 'http://127.0.0.1:3000'))
    args = parser.parse_args()

    print("\n" + "=" * 80)
    print(" AdeptEduverse Connection & Infrastructure Verification")
    print("=" * 80 + "\n")

    check_database()
    check_redis()
    check_celery()
    check_r2()
    check_backend_http(args.backend)
    check_frontend_rewrite(args.frontend)
    check_cookies_and_csrf(args.backend)

    print("-" * 80)
    print(f"{'HOP':<35} | {'STATUS':<7} | {'LATENCY':<8} | {'DETAILS'}")
    print("-" * 80)
    for r in results:
        print(f"{r['hop']:<35} | {r['status']:<7} | {r['latency']:<8} | {r['details']}")
    print("-" * 80 + "\n")

if __name__ == '__main__':
    main()
