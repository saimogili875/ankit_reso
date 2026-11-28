from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class LoginThrottleSecurityTests(TestCase):
    """
    Tests for login hardening and throttle bypass protection:
    1. 11 wrong logins with rotating X-Forwarded-For get a 429 (NUM_PROXIES prevents IP bypass).
    2. 6 wrong logins on one identifier from different IPs get a 429 (Identifier failure throttle).
    3. A successful login works after failures expire or under limit without revealing account existence.
    """

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = User.objects.create_user(
            email='student.secure@adepteduverse.com',
            username='studentsecure',
            password='ValidPassword123!',
            role=User.Role.STUDENT,
        )

    def tearDown(self):
        cache.clear()

    @override_settings(
        REST_FRAMEWORK={
            'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
            'DEFAULT_AUTHENTICATION_CLASSES': (
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
                'login': '10/minute',
                'login_failed_identifier': '5/15min',
                'login_failed_ip': '15/minute',
            },
            'NUM_PROXIES': 2,
        }
    )
    def test_rotating_xff_cannot_bypass_login_throttle(self):
        """
        (a) 11 wrong logins from the same client IP behind Vercel/Render proxies
        with rotating client-injected X-Forwarded-For prefixes must result in a 429.
        """
        real_client_ip = '198.51.100.5'
        vercel_egress_ip = '76.76.21.21'

        for i in range(10):
            # Attacker injects a different fake IP prefix on each attempt
            fake_prefix = f'10.99.{i // 256}.{i % 256}'
            xff_header = f'{fake_prefix}, {real_client_ip}, {vercel_egress_ip}'
            response = self.client.post(
                '/api/auth/login/',
                {
                    'identifier': f'diff_user_{i}@example.com',
                    'password': 'WrongPassword123!',
                },
                HTTP_X_FORWARDED_FOR=xff_header,
                REMOTE_ADDR='10.0.0.1',
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Attempt {i+1} should return 400 Bad Request but returned {response.status_code}"
            )

        # 11th request from the same client IP must be throttled with 429
        response_11 = self.client.post(
            '/api/auth/login/',
            {
                'identifier': 'diff_user_11@example.com',
                'password': 'WrongPassword123!',
            },
            HTTP_X_FORWARDED_FOR=f'10.99.99.99, {real_client_ip}, {vercel_egress_ip}',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(
            response_11.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            "11th request with rotating XFF prefix must be throttled with HTTP 429"
        )

    def test_identifier_failure_throttle_across_different_ips(self):
        """
        (b) 6 wrong logins on one identifier from different client IPs get a 429.
        Does not reveal whether account exists.
        """
        target_identifier = 'victim.account@adepteduverse.com'

        for i in range(5):
            # Each attempt originates from a completely distinct client IP
            client_ip = f'203.0.113.{i + 10}'
            response = self.client.post(
                '/api/auth/login/',
                {
                    'identifier': target_identifier,
                    'password': 'BadPassword999!',
                },
                HTTP_X_FORWARDED_FOR=f'{client_ip}, 76.76.21.21',
                REMOTE_ADDR='10.0.0.1',
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Failure {i+1} should return 400 Bad Request"
            )

        # 6th attempt on the same identifier from yet another new IP must be throttled with 429
        response_6 = self.client.post(
            '/api/auth/login/',
            {
                'identifier': target_identifier,
                'password': 'BadPassword999!',
            },
            HTTP_X_FORWARDED_FOR='192.0.2.99, 76.76.21.21',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(
            response_6.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
            "6th failed login attempt on a single identifier must return HTTP 429"
        )

        # A non-targeted identifier from the same new IP should still be allowed
        other_response = self.client.post(
            '/api/auth/login/',
            {
                'identifier': 'unrelated.user@adepteduverse.com',
                'password': 'BadPassword999!',
            },
            HTTP_X_FORWARDED_FOR='192.0.2.99, 76.76.21.21',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(
            other_response.status_code,
            status.HTTP_400_BAD_REQUEST,
            "Unrelated identifier should not be throttled"
        )

    def test_successful_login_works_and_clears_failures(self):
        """
        (c) A successful login still works after failures expire or under limit.
        Clears previous failure records.
        """
        target_email = self.user.email

        # 2 failed attempts
        for i in range(2):
            res_fail = self.client.post(
                '/api/auth/login/',
                {
                    'identifier': target_email,
                    'password': 'IncorrectPassword!',
                },
                HTTP_X_FORWARDED_FOR=f'203.0.113.{i+1}, 76.76.21.21',
                REMOTE_ADDR='10.0.0.1',
            )
            self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Next attempt with correct password succeeds
        res_success = self.client.post(
            '/api/auth/login/',
            {
                'identifier': target_email,
                'password': 'ValidPassword123!',
            },
            HTTP_X_FORWARDED_FOR='203.0.113.50, 76.76.21.21',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(res_success.status_code, status.HTTP_200_OK)
        self.assertEqual(res_success.data.get('message'), 'Login successful')
        self.assertEqual(res_success.data['user']['email'], target_email)

    def test_login_failed_ip_rate_throttle_across_different_accounts(self):
        """
        5 wrong logins from the same client IP across different accounts result in 429 lockout on the 6th attempt.
        """
        client_ip = '198.51.100.77'

        for i in range(5):
            res = self.client.post(
                '/api/auth/login/',
                {
                    'identifier': f'random_account_{i}@example.com',
                    'password': 'WrongPassword999!',
                },
                HTTP_X_FORWARDED_FOR=f'{client_ip}, 76.76.21.21',
                REMOTE_ADDR='10.0.0.1',
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 6th attempt from the same IP (even for valid user) must be throttled with 429
        res_6 = self.client.post(
            '/api/auth/login/',
            {
                'identifier': self.user.email,
                'password': 'ValidPassword123!',
            },
            HTTP_X_FORWARDED_FOR=f'{client_ip}, 76.76.21.21',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(res_6.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # A different IP is NOT throttled
        res_diff_ip = self.client.post(
            '/api/auth/login/',
            {
                'identifier': self.user.email,
                'password': 'ValidPassword123!',
            },
            HTTP_X_FORWARDED_FOR='198.51.100.88, 76.76.21.21',
            REMOTE_ADDR='10.0.0.1',
        )
        self.assertEqual(res_diff_ip.status_code, status.HTTP_200_OK)

    def test_failed_login_logged_without_sensitive_data(self):
        """Failed login attempts are logged with identifier hash, without password or sensitive info."""
        with self.assertLogs('apps.accounts.views', level='WARNING') as cm:
            res = self.client.post(
                '/api/auth/login/',
                {
                    'identifier': 'sensitive_user@secret.com',
                    'password': 'SuperSecretPasswordXYZ!',
                },
                HTTP_X_FORWARDED_FOR='198.51.100.12, 76.76.21.21',
                REMOTE_ADDR='10.0.0.1',
            )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        log_output = "\n".join(cm.output)
        self.assertIn("Failed login attempt", log_output)
        self.assertIn("identifier_hash=", log_output)
        self.assertNotIn("SuperSecretPasswordXYZ!", log_output)
        self.assertNotIn("sensitive_user@secret.com", log_output)
