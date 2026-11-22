import json
import time
from unittest.mock import patch
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User, StudentProfile
from apps.academics.models import Course, Enrollment

class ClerkAuthTests(APITestCase):
    def setUp(self):
        # Existing student
        self.existing_student = User.objects.create_user(
            username='existing_student',
            email='existing@example.com',
            role=User.Role.STUDENT,
            first_name='Existing',
            last_name='Student',
        )
        StudentProfile.objects.create(user=self.existing_student)

        # Existing admin
        self.admin_user = User.objects.create_user(
            username='admin_boss',
            email='admin@example.com',
            role=User.Role.ADMIN,
            is_staff=True,
        )

        # Paid Course
        self.paid_course = Course.objects.create(
            title='Paid JEE Course',
            slug='paid-jee-course',
            price=499.00,
            is_free=False,
            is_published=True
        )

    @patch('apps.accounts.authentication.ClerkJWTAuthentication.verify_token')
    def test_valid_token_creates_new_student(self, mock_verify):
        mock_verify.return_value = {
            'sub': 'user_clerk_new_123',
            'email': 'newstudent@example.com',
            'username': 'newbie',
            'first_name': 'New',
            'last_name': 'Student',
            'exp': int(time.time()) + 3600,
        }

        self.client.credentials(HTTP_AUTHORIZATION='Bearer test_token_new')
        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['authenticated'])
        self.assertEqual(response.data['user']['email'], 'newstudent@example.com')
        self.assertEqual(response.data['user']['role'], 'STUDENT')

        user = User.objects.get(email='newstudent@example.com')
        self.assertEqual(user.clerk_id, 'user_clerk_new_123')
        self.assertTrue(hasattr(user, 'student_profile'))

    @patch('apps.accounts.authentication.ClerkJWTAuthentication.verify_token')
    def test_valid_token_links_existing_student_by_email(self, mock_verify):
        mock_verify.return_value = {
            'sub': 'user_clerk_link_456',
            'email': 'existing@example.com',
            'first_name': 'Existing',
            'last_name': 'Student',
            'exp': int(time.time()) + 3600,
        }

        original_id = self.existing_student.id

        self.client.credentials(HTTP_AUTHORIZATION='Bearer test_token_link')
        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.existing_student.refresh_from_db()
        self.assertEqual(self.existing_student.id, original_id)
        self.assertEqual(self.existing_student.clerk_id, 'user_clerk_link_456')

    @patch('apps.accounts.authentication.ClerkJWTAuthentication.verify_token')
    def test_admin_account_gets_403_on_student_endpoints(self, mock_verify):
        mock_verify.return_value = {
            'sub': 'user_clerk_admin_789',
            'email': 'admin@example.com',
            'exp': int(time.time()) + 3600,
        }

        self.client.credentials(HTTP_AUTHORIZATION='Bearer test_token_admin')
        response = self.client.get('/api/students/onboarding/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Use Admin login", str(response.data))

    @patch('apps.accounts.authentication.ClerkJWTAuthentication.verify_token')
    def test_onboarding_get_and_post(self, mock_verify):
        mock_verify.return_value = {
            'sub': 'user_clerk_onboard_101',
            'email': 'onboarding@example.com',
            'exp': int(time.time()) + 3600,
        }

        self.client.credentials(HTTP_AUTHORIZATION='Bearer test_token_onboard')

        # GET initially
        get_res = self.client.get('/api/students/onboarding/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertFalse(get_res.data['is_onboarded'])

        # POST choices (including optional 10-digit mobile contact)
        payload = {
            'academic_class': '12',
            'target_exam': 'JEE_MAIN',
            'target_year': 2026,
            'city': 'Hyderabad',
            'state': 'Telangana',
            'school_or_coaching': 'Narayana',
            'preferred_language': 'English',
            'contact_phone': '9876543210',
        }
        post_res = self.client.post('/api/students/onboarding/', payload, format='json')
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        self.assertTrue(post_res.data['is_onboarded'])

        user = User.objects.get(email='onboarding@example.com')
        profile = user.student_profile
        self.assertTrue(profile.is_onboarded)
        self.assertEqual(profile.academic_class, '12')
        self.assertEqual(profile.contact_phone, '9876543210')

    @patch('apps.accounts.authentication.ClerkJWTAuthentication.verify_token')
    def test_paid_course_returns_402_without_payment(self, mock_verify):
        mock_verify.return_value = {
            'sub': 'user_clerk_pay_202',
            'email': 'buyer@example.com',
            'exp': int(time.time()) + 3600,
        }

        self.client.credentials(HTTP_AUTHORIZATION='Bearer test_token_pay')
        res = self.client.post('/api/enrollment/enroll/', {'course_id': str(self.paid_course.id)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)

    @override_settings(CLERK_WEBHOOK_SECRET='whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2TFgsOP')
    def test_webhook_invalid_signature_gives_400(self):
        res = self.client.post(
            '/api/auth/clerk-webhook/',
            data=json.dumps({'type': 'user.created', 'data': {'id': 'user_test'}}),
            content_type='application/json',
            HTTP_SVIX_ID='msg_test',
            HTTP_SVIX_TIMESTAMP='1234567890',
            HTTP_SVIX_SIGNATURE='v1,bad_sig'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
