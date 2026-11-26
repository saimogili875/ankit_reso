from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import Course, Enrollment

User = get_user_model()


class DPDPPrivacyTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='dpdp_student',
            email='dpdp_student@example.com',
            password='TestPassword123!',
            role=User.Role.STUDENT,
            first_name='Ankit',
            last_name='Student',
        )
        self.course = Course.objects.create(
            title='Physics Complete Batch',
            slug='physics-complete-batch',
            price=0,
            is_free=True,
            is_published=True,
        )
        Enrollment.objects.create(user=self.user, course=self.course, status='ACTIVE')
        self.client.force_authenticate(user=self.user)

    def test_export_account_data_success(self):
        res = self.client.get('/api/auth/me/export-data/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn('compliance', data)
        self.assertEqual(data['profile']['email'], 'dpdp_student@example.com')
        self.assertEqual(len(data['enrollments']), 1)
        self.assertEqual(data['enrollments'][0]['course_title'], 'Physics Complete Batch')

    def test_delete_account_without_proper_confirmation_fails(self):
        res = self.client.post('/api/auth/me/delete-account/', {'confirmation': 'wrong'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_account_anonymizes_pii(self):
        res = self.client.post('/api/auth/me/delete-account/', {'confirmation': 'DELETE'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.first_name, 'Deleted')
        self.assertTrue(self.user.email.endswith('@anonymized.invalid'))
