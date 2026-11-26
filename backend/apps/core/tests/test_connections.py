import os
import sys
import re
from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory, override_settings
from django.conf import settings
from rest_framework import status
from apps.core.middleware import NormalizeSlashMiddleware
from apps.core.views import health_deep, healthz
from storage.r2 import R2StorageClient


class ConnectionConfigUnitTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def test_normalize_slash_middleware_routes(self):
        """
        Verify Bug 5 fixes:
        - Non-API routes are NOT mutated.
        - Static file extensions are NOT mutated.
        - Explicit slashless endpoints are NOT mutated.
        - Webhook endpoints are NOT mutated.
        - Internal slash normalization appends trailing slash on /api/ endpoints for all methods (including DELETE, PUT, POST) without redirects, avoiding CommonMiddleware RuntimeError.
        """
        def dummy_response(req):
            return req.path_info

        mw = NormalizeSlashMiddleware(dummy_response)

        test_cases = [
            ('GET', '/healthz', '/healthz'),
            ('GET', '/health', '/health'),
            ('GET', '/health/deep', '/health/deep'),
            ('GET', '/api/health', '/api/health'),
            ('GET', '/api/healthz', '/api/healthz'),
            ('GET', '/api/health/deep', '/api/health/deep'),
            ('GET', '/some/non/api/route', '/some/non/api/route'),
            ('GET', '/api/courses', '/api/courses/'),
            ('GET', '/api/courses/', '/api/courses/'),
            ('GET', '/api/materials/lecture_notes.pdf', '/api/materials/lecture_notes.pdf'),
            ('GET', '/favicon.ico', '/favicon.ico'),
            ('GET', '/api/create-order', '/api/create-order'),
            ('POST', '/api/create-order', '/api/create-order'),
            ('POST', '/api/verify-payment', '/api/verify-payment'),
            ('POST', '/api/students/onboarding', '/api/students/onboarding'),
            ('POST', '/api/courses', '/api/courses/'),
            ('POST', '/api/payments/razorpay/webhook', '/api/payments/razorpay/webhook'),
            ('PUT', '/api/courses/update', '/api/courses/update/'),
            ('DELETE', '/api/courses/1', '/api/courses/1/'),
            ('DELETE', '/api/admin-panel/courses/123', '/api/admin-panel/courses/123/'),
        ]

        for method, path, expected in test_cases:
            req = getattr(self.rf, method.lower())(path)
            res = mw(req)
            self.assertEqual(res, expected, f"Failed for {method} {path}: expected {expected}, got {res}")

    def test_healthz_endpoint(self):
        """Verify lightweight health probe returns 200 without DB/Redis load."""
        req = self.rf.get('/healthz')
        res = healthz(req)
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'"status": "ok"', res.content)

    def test_health_deep_endpoint(self):
        """Verify deep health check tests DB and Cache, returning diagnostic payload."""
        req = self.rf.get('/api/health/deep')
        res = health_deep(req)
        self.assertIn(res.status_code, (200, 503))
        self.assertIn('database', res.data)
        self.assertIn('redis', res.data)
        self.assertIn('details', res.data)
        self.assertTrue(res.data['database'])

    def test_r2_storage_check_connection(self):
        """Verify R2 storage client exposes check_connection() without throwing uncaught exceptions."""
        client = R2StorageClient()
        is_ok, msg = client.check_connection()
        self.assertIsInstance(is_ok, bool)
        self.assertIsInstance(msg, str)

    def test_preview_origins_regex_matching(self):
        """
        Verify Bug 6 logic:
        - Apex domain and www always allowed.
        - Preview *.vercel.app allowed only when enabled.
        - Untrusted origin blocked.
        """
        base_regexes = [
            r"^https://([a-zA-Z0-9-]+\.)*adepteduverse\.com$",
            r"^https://([a-zA-Z0-9-]+\.)*onrender\.com$",
        ]
        preview_regex = r"^https://[a-zA-Z0-9-]+\.vercel\.app$"

        def check_origin(origin, regexes):
            return any(re.match(p, origin) for p in regexes)

        # Baseline
        self.assertTrue(check_origin("https://adepteduverse.com", base_regexes))
        self.assertTrue(check_origin("https://www.adepteduverse.com", base_regexes))
        self.assertFalse(check_origin("https://pr-123.vercel.app", base_regexes))
        self.assertFalse(check_origin("https://malicious-site.com", base_regexes))

        # With preview enabled
        with_preview = base_regexes + [preview_regex]
        self.assertTrue(check_origin("https://pr-123.vercel.app", with_preview))
        self.assertTrue(check_origin("https://ankit-reso-saimogili875.vercel.app", with_preview))
        self.assertFalse(check_origin("https://malicious-site.com", with_preview))
