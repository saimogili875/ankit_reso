from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User

class AuthSecurityTests(APITestCase):
    def setUp(self):
        # Create student user
        self.student = User.objects.create_user(
            username='student1',
            email='student@example.com',
            password='Password123!',
            role=User.Role.STUDENT,
            phone_number='9876543210'
        )
        # Create admin user
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            phone_number='9123456780'
        )

    def test_student_login_ok(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'student@example.com',
            'password': 'Password123!',
            'portal': 'student'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['user']['is_admin'])
        self.assertEqual(response.data['user']['role'], 'STUDENT')

    def test_student_blocked_from_admin_portal(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'student@example.com',
            'password': 'Password123!',
            'portal': 'admin'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Generic error message to prevent enumeration
        self.assertIn("Invalid credentials", str(response.data['errors']))

    def test_admin_login_ok(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'admin@example.com',
            'password': 'AdminPassword123!',
            'portal': 'admin'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['user']['is_admin'])
        self.assertEqual(response.data['user']['role'], 'ADMIN')

    def test_admin_blocked_from_student_portal(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'admin@example.com',
            'password': 'AdminPassword123!',
            'portal': 'student'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Use Admin login", str(response.data['errors']))

    def test_superuser_gets_role_admin_automatically(self):
        superuser = User.objects.create_superuser(
            username='superuser1',
            email='super@example.com',
            password='SuperPassword123!'
        )
        self.assertEqual(superuser.role, User.Role.ADMIN)

    def test_wrong_password_gives_generic_error(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'student@example.com',
            'password': 'WrongPassword999!',
            'portal': 'student'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid credentials", str(response.data['errors']))

    def test_nonexistent_user_gives_same_generic_error(self):
        url = reverse('login')
        response = self.client.post(url, {
            'email': 'nobody@example.com',
            'password': 'RandomPassword!',
            'portal': 'student'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid credentials", str(response.data['errors']))

    def test_csrf_endpoint(self):
        url = reverse('csrf')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('csrfToken', response.data)
        self.assertTrue(len(response.data['csrfToken']) > 10)
