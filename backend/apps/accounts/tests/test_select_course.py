from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import StudentProfile
from apps.academics.models import Course, Enrollment

User = get_user_model()


class SelectCourseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='student_test',
            email='student_test@example.com',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(user=self.user)

    def test_select_course_persists_to_student_profile(self):
        response = self.client.post('/api/auth/select-course/', {'course_id': 'jee-2026-complete'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(response.data.get('last_selected_course_id'), 'jee-2026-complete')

        profile = StudentProfile.objects.get(user=self.user)
        self.assertEqual(profile.last_selected_course_id, 'jee-2026-complete')

    def test_select_course_validates_enrollment_and_falls_back(self):
        course_1 = Course.objects.create(title="Course 1", slug="course-1", price=100)
        course_2 = Course.objects.create(title="Course 2", slug="course-2", price=200)

        # Enrolled only in Course 1
        Enrollment.objects.create(user=self.user, course=course_1, status='ACTIVE')

        # Select Course 1 -> matches enrollment
        res1 = self.client.post('/api/auth/select-course/', {'course_id': str(course_1.id)})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertFalse(res1.data.get('fallback'))
        self.assertEqual(res1.data.get('last_selected_course_id'), str(course_1.id))

        # Select Course 2 (not enrolled) -> falls back to Course 1
        res2 = self.client.post('/api/auth/select-course/', {'course_id': str(course_2.id)})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data.get('fallback'))
        self.assertEqual(res2.data.get('last_selected_course_id'), str(course_1.id))

    def test_current_user_me_returns_last_selected_course(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.user)
        profile.last_selected_course_id = 'jee-adv-fast-track'
        profile.save()

        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user_data = response.data.get('user', {})
        self.assertEqual(
            user_data.get('student_profile', {}).get('last_selected_course_id'),
            'jee-adv-fast-track'
        )

    def test_select_course_requires_authentication(self):
        unauth_client = APIClient()
        response = unauth_client.post('/api/auth/select-course/', {'course_id': 'any'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
