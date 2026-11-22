from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class AuthLoopFixTests(TestCase):
    """
    Validates P0 Auth Loop Fix:
    1. Anonymous GET /api/auth/me/ returns 200 {"authenticated": false, "user": null}.
    2. Anonymous GET to protected endpoints returns 401 with WWW-Authenticate: Session.
    3. Anonymous PATCH to /api/auth/me/ returns 401.
    4. Authenticated GET /api/auth/me/ returns 200 {"authenticated": true, "user": {...}}.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='student.test@adepteduverse.com',
            username='studenttest',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )

    def test_anonymous_get_me_returns_200_not_authenticated(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('authenticated'), False)
        self.assertIsNone(response.data.get('user'))

    def test_anonymous_get_protected_returns_401_with_session_header(self):
        response = self.client.get('/api/courses/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(response.headers.get('WWW-Authenticate') in ['Session', 'Bearer realm="Clerk"'])

    def test_anonymous_patch_me_returns_401(self):
        response = self.client.patch('/api/auth/me/', {'full_name': 'Hacker'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_get_me_returns_200_with_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('authenticated'), True)
        self.assertIsNotNone(response.data.get('user'))
        self.assertEqual(response.data['user']['email'], self.user.email)
