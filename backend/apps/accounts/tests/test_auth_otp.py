import json
from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, normalize_phone
from apps.accounts.otp import OTPService

@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'test-cache',
        }
    },
    SESSION_ENGINE='django.contrib.sessions.backends.db',
    CELERY_TASK_ALWAYS_EAGER=True,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
)
class OTPAuthTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.test_email = "student.test@example.com"
        self.test_phone = "+919876543210"
        self.test_username = "student_test"
        self.test_password = "SecurePassword@123"

    def tearDown(self):
        cache.clear()

    # --- 1. OTP Generation, Verification, Wrong Attempts & Cooldown ---

    def test_otp_flow_and_verification_token(self):
        can_send, _, _ = OTPService.can_send(self.test_email, "signup_email")
        self.assertTrue(can_send)

        otp = OTPService.generate_and_store(self.test_email, "signup_email")
        self.assertEqual(len(otp), 6)

        # Cooldown prevents immediate re-request
        can_send_again, msg, cooldown = OTPService.can_send(self.test_email, "signup_email")
        self.assertFalse(can_send_again)
        self.assertGreater(cooldown, 0)

        # Verify with wrong OTP
        is_valid, msg, token = OTPService.verify_otp(self.test_email, "signup_email", "000000")
        self.assertFalse(is_valid)
        self.assertIsNone(token)

        # Verify with correct OTP
        is_valid, msg, token = OTPService.verify_otp(self.test_email, "signup_email", otp)
        self.assertTrue(is_valid)
        self.assertIsNotNone(token)

        # Validate signed verification token
        is_token_valid = OTPService.validate_verification_token(token, self.test_email, "signup_email")
        self.assertTrue(is_token_valid)

        # Token is rejected for mismatched target or purpose
        self.assertFalse(OTPService.validate_verification_token(token, "other@example.com", "signup_email"))
        self.assertFalse(OTPService.validate_verification_token(token, self.test_email, "signup_phone"))

    def test_max_wrong_attempts_invalidates_otp(self):
        otp = OTPService.generate_and_store(self.test_email, "signup_email")
        
        for i in range(4):
            is_valid, msg, token = OTPService.verify_otp(self.test_email, "signup_email", "111111")
            self.assertFalse(is_valid)
            self.assertIn("remaining", msg)

        # 5th wrong attempt invalidates
        is_valid, msg, token = OTPService.verify_otp(self.test_email, "signup_email", "111111")
        self.assertFalse(is_valid)
        self.assertIn("invalidated", msg)

        # Even correct OTP now fails
        is_valid, msg, token = OTPService.verify_otp(self.test_email, "signup_email", otp)
        self.assertFalse(is_valid)

    # --- 2. Signup Endpoints ---

    def test_signup_requires_valid_tokens_and_enforces_uniqueness(self):
        # 1. Send & verify email OTP
        res_e = self.client.post('/api/auth/signup/email/send-otp/', {'email': self.test_email})
        self.assertEqual(res_e.status_code, status.HTTP_200_OK)

        raw_data = cache.get(f"otp:signup_email:{self.test_email}")
        self.assertIsNotNone(raw_data)
        
        # Verify email OTP
        otp_e = OTPService.generate_and_store(self.test_email, "signup_email")
        _, _, email_token = OTPService.verify_otp(self.test_email, "signup_email", otp_e)

        # 2. Verify phone OTP
        otp_p = OTPService.generate_and_store(self.test_phone, "signup_phone")
        _, _, phone_token = OTPService.verify_otp(self.test_phone, "signup_phone", otp_p)

        # 3. Signup with missing token fails
        res_fail = self.client.post('/api/auth/signup/', {
            'full_name': 'Rahul Sharma',
            'username': self.test_username,
            'email': self.test_email,
            'phone': self.test_phone,
            'password': self.test_password,
            'confirm_password': self.test_password,
            'email_token': 'invalid_token',
            'phone_token': phone_token,
        })
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email_token', res_fail.data.get('errors', {}))

        # 4. Valid signup succeeds
        res_signup = self.client.post('/api/auth/signup/', {
            'full_name': 'Rahul Sharma',
            'username': self.test_username,
            'email': self.test_email,
            'phone': self.test_phone,
            'password': self.test_password,
            'confirm_password': self.test_password,
            'email_token': email_token,
            'phone_token': phone_token,
        })
        self.assertEqual(res_signup.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username=self.test_username).exists())
        user = User.objects.get(username=self.test_username)
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_phone_verified)
        self.assertEqual(user.phone, self.test_phone)

        # 5. Duplicate username/email rejected
        res_dup = self.client.post('/api/auth/signup/', {
            'full_name': 'Rahul Sharma',
            'username': self.test_username,
            'email': self.test_email,
            'phone': '+919999999999',
            'password': self.test_password,
            'confirm_password': self.test_password,
            'email_token': email_token,
            'phone_token': phone_token,
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

    # --- 3. Login with all 3 identifier types ---

    def test_login_with_email_phone_and_username(self):
        user = User.objects.create_user(
            username=self.test_username,
            email=self.test_email,
            password=self.test_password,
            phone=self.test_phone,
            phone_number=self.test_phone,
            full_name="Student Test"
        )

        # Login with Email
        res1 = self.client.post('/api/auth/login/', {
            'identifier': self.test_email,
            'password': self.test_password
        })
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['user']['email'], self.test_email)

        # Login with Phone (10-digit without +91)
        res2 = self.client.post('/api/auth/login/', {
            'identifier': '9876543210',
            'password': self.test_password
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Login with Phone (with +91)
        res3 = self.client.post('/api/auth/login/', {
            'identifier': self.test_phone,
            'password': self.test_password
        })
        self.assertEqual(res3.status_code, status.HTTP_200_OK)

        # Login with Username
        res4 = self.client.post('/api/auth/login/', {
            'identifier': self.test_username,
            'password': self.test_password
        })
        self.assertEqual(res4.status_code, status.HTTP_200_OK)

        # Invalid password returns generic error
        res_invalid = self.client.post('/api/auth/login/', {
            'identifier': self.test_username,
            'password': 'WrongPassword123'
        })
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid credentials", str(res_invalid.data))

    # --- 4. Password Forgot / Reset (Enumeration-safe) ---

    def test_password_forgot_and_reset(self):
        user = User.objects.create_user(
            username=self.test_username,
            email=self.test_email,
            password=self.test_password,
        )

        # Forgot password returns same message for existing and non-existing email
        res_forgot_real = self.client.post('/api/auth/password/forgot/', {'email': self.test_email})
        self.assertEqual(res_forgot_real.status_code, status.HTTP_200_OK)
        self.assertIn('If an account exists', res_forgot_real.data['message'])

        res_forgot_fake = self.client.post('/api/auth/password/forgot/', {'email': 'nonexistent@example.com'})
        self.assertEqual(res_forgot_fake.status_code, status.HTTP_200_OK)
        self.assertEqual(res_forgot_real.data['message'], res_forgot_fake.data['message'])

        # Generate reset OTP & verify
        otp_r = OTPService.generate_and_store(self.test_email, "reset_password")
        res_verify = self.client.post('/api/auth/password/reset/verify-otp/', {
            'email': self.test_email,
            'otp': otp_r
        })
        self.assertEqual(res_verify.status_code, status.HTTP_200_OK)
        reset_token = res_verify.data['reset_token']

        # Reset password with token
        new_pass = "BrandNewSecurePass@2025"
        res_reset = self.client.post('/api/auth/password/reset/', {
            'reset_token': reset_token,
            'new_password': new_pass,
            'confirm_password': new_pass
        })
        self.assertEqual(res_reset.status_code, status.HTTP_200_OK)

        # Login with new password succeeds
        res_new_login = self.client.post('/api/auth/login/', {
            'identifier': self.test_email,
            'password': new_pass
        })
        self.assertEqual(res_new_login.status_code, status.HTTP_200_OK)
