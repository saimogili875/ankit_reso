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
from decimal import Decimal
from django.test import TestCase
from django.core.management import call_command
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import PricingCard, Batch, BatchItem, BatchFeature, AcademicClass
from apps.academics.pricing_views import clear_pricing_cache


class PricingSystemTests(TestCase):
    def setUp(self):
        clear_pricing_cache()
        self.client = APIClient()

    def test_seed_pricing_is_idempotent(self):
        """
        Verify that running seed_pricing multiple times produces identical results
        without throwing IntegrityErrors or creating duplicate records.
        """
        call_command('seed_pricing')
        cards_count_1 = PricingCard.objects.count()
        batches_count_1 = Batch.objects.count()
        items_count_1 = BatchItem.objects.count()
        features_count_1 = BatchFeature.objects.count()

        self.assertEqual(cards_count_1, 3)
        self.assertEqual(batches_count_1, 8)
        self.assertGreater(items_count_1, 0)
        self.assertGreater(features_count_1, 0)

        # Run second time
        call_command('seed_pricing')
        self.assertEqual(PricingCard.objects.count(), cards_count_1)
        self.assertEqual(Batch.objects.count(), batches_count_1)
        self.assertEqual(BatchItem.objects.count(), items_count_1)
        self.assertEqual(BatchFeature.objects.count(), features_count_1)

    def test_public_api_hides_unpublished_cards_and_batches(self):
        """
        Verify that unpublished cards and batches are excluded from public API responses.
        """
        card = PricingCard.objects.create(
            key='school',
            title='School Batches',
            is_published=True,
            order=1
        )
        pub_batch = Batch.objects.create(
            card=card,
            name='Published Batch',
            slug='published-batch',
            price=Decimal('2000.00'),
            is_published=True,
            display_order=1
        )
        draft_batch = Batch.objects.create(
            card=card,
            name='Draft Batch',
            slug='draft-batch',
            price=Decimal('5000.00'),
            is_published=False,
            display_order=2
        )

        clear_pricing_cache()
        res = self.client.get('/api/pricing/cards/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Only pub_batch should be nested in card
        card_data = res.json()[0]
        batch_slugs = [b['slug'] for b in card_data['batches']]
        self.assertIn('published-batch', batch_slugs)
        self.assertNotIn('draft-batch', batch_slugs)

        # Direct slug lookup for draft batch should return 404 for unauthenticated/students
        draft_res = self.client.get('/api/pricing/batches/draft-batch/')
        self.assertEqual(draft_res.status_code, status.HTTP_404_NOT_FOUND)

        pub_res = self.client.get('/api/pricing/batches/published-batch/')
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.json()['name'], 'Published Batch')

    def test_pricing_categories_endpoint(self):
        """
        Verify /api/pricing/categories/<key>/ returns published batches.
        """
        call_command('seed_pricing')
        clear_pricing_cache()

        res = self.client.get('/api/pricing/categories/school/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['card']['key'], 'school')
        self.assertEqual(len(data['batches']), 5)
