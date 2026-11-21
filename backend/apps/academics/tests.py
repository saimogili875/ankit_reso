from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.academics.models import Course, Enrollment
from apps.payments.models import Payment

User = get_user_model()

class AcademicsEnrollmentTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            username='academic_student',
            email='acad_student@example.com',
            password='Password123!',
            role=User.Role.STUDENT
        )

        self.admin = User.objects.create_user(
            username='academic_admin',
            email='acad_admin@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True
        )

        self.free_course = Course.objects.create(
            title='Free Foundation Course',
            slug='free-foundation',
            price=Decimal('0.00'),
            is_free=True,
            is_published=True,
            allow_self_enrollment=True
        )

        self.paid_course = Course.objects.create(
            title='Paid Comprehensive Batch',
            slug='paid-comprehensive',
            price=Decimal('2999.00'),
            is_free=False,
            is_published=True,
            allow_self_enrollment=True
        )

    def test_free_course_enrollment_succeeds(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.free_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.student, course=self.free_course, status='ACTIVE').exists()
        )

    def test_paid_course_enrollment_without_payment_returns_402(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertTrue(response.data.get('payment_required'))
        self.assertFalse(
            Enrollment.objects.filter(user=self.student, course=self.paid_course).exists()
        )

    def test_paid_course_enrollment_with_paid_payment_succeeds(self):
        # Create a paid Payment record
        Payment.objects.create(
            user=self.student,
            course=self.paid_course,
            amount_paise=299900,
            currency='INR',
            razorpay_order_id='order_paid_check_1',
            razorpay_payment_id='pay_paid_check_1',
            status=Payment.Status.PAID
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.student, course=self.paid_course, status='ACTIVE').exists()
        )

    def test_admin_can_bypass_paid_course_restriction(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.admin, course=self.paid_course).exists()
        )
