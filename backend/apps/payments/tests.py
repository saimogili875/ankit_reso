from decimal import Decimal
import hmac
import hashlib
import json
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
import razorpay

from apps.academics.models import Course, Enrollment
from apps.payments.models import Payment

User = get_user_model()

TEST_KEY_ID = 'rzp_test_mockkeyid123'
TEST_KEY_SECRET = 'mockkeysecret123'
TEST_WEBHOOK_SECRET = 'mockwebhooksecret123'

@override_settings(
    RAZORPAY_KEY_ID=TEST_KEY_ID,
    RAZORPAY_KEY_SECRET=TEST_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET,
)
class RazorpayPaymentsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Student User A
        self.user_a = User.objects.create_user(
            username='student_a',
            email='student_a@example.com',
            password='TestPassword123!',
            role=User.Role.STUDENT
        )

        # Student User B
        self.user_b = User.objects.create_user(
            username='student_b',
            email='student_b@example.com',
            password='TestPassword123!',
            role=User.Role.STUDENT
        )

        # Admin User
        self.admin_user = User.objects.create_user(
            username='admin_user',
            email='admin@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True
        )

        # Paid Course (Price = ₹4999.00 -> 499900 paise)
        self.course = Course.objects.create(
            title='JEE Advanced Complete Batch',
            slug='jee-adv-complete',
            price=Decimal('4999.00'),
            is_free=False,
            is_published=True,
            allow_self_enrollment=True
        )

        # Free Course
        self.free_course = Course.objects.create(
            title='JEE Free Demo Course',
            slug='jee-free-demo',
            price=Decimal('0.00'),
            is_free=True,
            is_published=True,
            allow_self_enrollment=True
        )

    def _generate_signature(self, order_id, payment_id, secret=TEST_KEY_SECRET):
        msg = f"{order_id}|{payment_id}".encode('utf-8')
        return hmac.new(secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()

    def _generate_webhook_signature(self, body_str, secret=TEST_WEBHOOK_SECRET):
        return hmac.new(secret.encode('utf-8'), body_str.encode('utf-8'), hashlib.sha256).hexdigest()

    # 1. Price comes from server even if client sends amount
    @patch('apps.payments.views.get_razorpay_client')
    def test_price_comes_from_server_ignoring_client_amount(self, mock_client_getter):
        mock_client = MagicMock()
        mock_client.order.create.return_value = {
            'id': 'order_mock_123',
            'amount': 499900,
            'currency': 'INR',
            'receipt': 'rcpt_123',
        }
        mock_client_getter.return_value = mock_client

        self.client.force_authenticate(user=self.user_a)

        # Client attempts to send tampering amount ₹1 (100 paise)
        response = self.client.post('/api/payments/create-order/', {
            'course_id': str(self.course.id),
            'amount': 100,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['amount'], 499900)
        self.assertEqual(response.data['order_id'], 'order_mock_123')

        # Verify Razorpay client was called with server-calculated price (499900), NOT client's 100
        mock_client.order.create.assert_called_once()
        create_args = mock_client.order.create.call_args[0][0]
        self.assertEqual(create_args['amount'], 499900)

        # Verify database row
        payment = Payment.objects.get(razorpay_order_id='order_mock_123')
        self.assertEqual(payment.amount_paise, 499900)
        self.assertEqual(payment.status, Payment.Status.CREATED)
        self.assertEqual(payment.user, self.user_a)

    # 2. Valid signature enrolls student
    def test_valid_signature_enrolls_student(self):
        order_id = 'order_valid_123'
        payment_id = 'pay_valid_456'
        signature = self._generate_signature(order_id, payment_id)

        payment = Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertTrue(response.data['enrolled'])

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertEqual(payment.razorpay_payment_id, payment_id)
        self.assertIsNotNone(payment.paid_at)

        # Check enrollment exists
        self.assertTrue(
            Enrollment.objects.filter(user=self.user_a, course=self.course, status='ACTIVE').exists()
        )

    # 3. Bad signature gives 400 and no enrollment
    def test_bad_signature_gives_400_and_no_enrollment(self):
        order_id = 'order_bad_123'
        payment_id = 'pay_bad_456'
        bad_signature = 'invalid_tampered_signature_hex'

        payment = Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED
        )

        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': bad_signature,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)

        # User must NOT be enrolled
        self.assertFalse(
            Enrollment.objects.filter(user=self.user_a, course=self.course).exists()
        )

    # 4. Verify twice gives no duplicate (idempotent)
    def test_verify_twice_is_idempotent(self):
        order_id = 'order_idem_123'
        payment_id = 'pay_idem_456'
        signature = self._generate_signature(order_id, payment_id)

        payment = Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED
        )

        self.client.force_authenticate(user=self.user_a)

        # First verification
        resp1 = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)

        # Second verification (immediate retry)
        resp2 = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertTrue(resp2.data['success'])

        # Exactly 1 enrollment must exist
        self.assertEqual(
            Enrollment.objects.filter(user=self.user_a, course=self.course).count(),
            1
        )

    # 5. User B cannot verify user A's order
    def test_user_b_cannot_verify_user_a_order(self):
        order_id = 'order_usera_123'
        payment_id = 'pay_usera_456'
        signature = self._generate_signature(order_id, payment_id)

        # Order belongs to User A
        Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED
        )

        # User B attempts to verify it
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        }, format='json')

        # Must return 404 (Not Found)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(
            Enrollment.objects.filter(user=self.user_b, course=self.course).exists()
        )

    # 6. Webhook with bad signature gives 400
    def test_webhook_with_bad_signature_gives_400(self):
        body = json.dumps({'event': 'payment.captured', 'payload': {}})
        response = self.client.post(
            '/api/payments/webhook/',
            data=body,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE='bad_signature_hex'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 7. Webhook after verify gives no duplicate
    def test_webhook_after_verify_gives_no_duplicate(self):
        order_id = 'order_hook_123'
        payment_id = 'pay_hook_456'
        sig = self._generate_signature(order_id, payment_id)

        payment = Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED
        )

        # 1. User verifies via standard frontend redirect
        self.client.force_authenticate(user=self.user_a)
        v_resp = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': sig,
        }, format='json')
        self.assertEqual(v_resp.status_code, status.HTTP_200_OK)

        # 2. Razorpay webhook fires subsequently
        webhook_body = json.dumps({
            'event': 'payment.captured',
            'payload': {
                'payment': {
                    'entity': {
                        'id': payment_id,
                        'order_id': order_id,
                        'amount': 499900,
                        'status': 'captured',
                    }
                }
            }
        })
        webhook_sig = self._generate_webhook_signature(webhook_body)

        self.client.logout()
        w_resp = self.client.post(
            '/api/payments/webhook/',
            data=webhook_body,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=webhook_sig
        )
        self.assertEqual(w_resp.status_code, status.HTTP_200_OK)

        # Check single enrollment
        self.assertEqual(
            Enrollment.objects.filter(user=self.user_a, course=self.course).count(),
            1
        )

    # 8. Unauthenticated gives 401 or 403
    def test_unauthenticated_requests_are_rejected(self):
        self.client.logout()

        # create-order unauthenticated
        res1 = self.client.post('/api/payments/create-order/', {
            'course_id': str(self.course.id)
        }, format='json')
        self.assertIn(res1.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # verify unauthenticated
        res2 = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': 'order_123',
            'razorpay_payment_id': 'pay_123',
            'razorpay_signature': 'sig_123',
        }, format='json')
        self.assertIn(res2.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # 9. Free course rejected in create-order
    def test_free_course_rejected_in_create_order(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/payments/create-order/', {
            'course_id': str(self.free_course.id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('free', response.data['error'].lower())

    # 10. Already enrolled course returns 409
    def test_already_enrolled_returns_409(self):
        Enrollment.objects.create(user=self.user_a, course=self.course, status='ACTIVE')
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post('/api/payments/create-order/', {
            'course_id': str(self.course.id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    # 11. Admin payments list endpoint
    def test_admin_payments_list(self):
        Payment.objects.create(
            user=self.user_a,
            course=self.course,
            amount_paise=499900,
            currency='INR',
            razorpay_order_id='order_admin_test_1',
            status=Payment.Status.PAID
        )

        # Student cannot access admin endpoint
        self.client.force_authenticate(user=self.user_a)
        res_forbidden = self.client.get('/api/admin/payments/')
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can access admin endpoint
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get('/api/admin/payments/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        # Results contains list or paginated results
        results = res_admin.data.get('results', res_admin.data)
        self.assertTrue(len(results) >= 1)
        self.assertEqual(results[0]['razorpay_order_id'], 'order_admin_test_1')
import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.academics.models import PricingCard, Batch, BatchItem, Course, Enrollment
from apps.payments.models import Payment

User = get_user_model()

TEST_RAZORPAY_KEY_ID = "rzp_test_samplekey123"
TEST_RAZORPAY_KEY_SECRET = "sample_secret_key_456"
TEST_WEBHOOK_SECRET = "test_webhook_secret_789"


@override_settings(
    RAZORPAY_KEY_ID=TEST_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET=TEST_RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET,
)
class BatchPaymentSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='rahul@adepteduverse.com',
            username='rahul',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(user=self.student)

        self.card = PricingCard.objects.create(
            key='senior',
            title='Class XI & XII',
            is_published=True,
            order=1
        )
        self.course = Course.objects.create(
            title='JEE Comprehensive Class 11',
            slug='jee-comp-11',
            price=Decimal('5500.00'),
            is_free=False,
            is_published=True,
        )
        self.batch = Batch.objects.create(
            card=self.card,
            name='JEE Foundation Batch',
            slug='jee-foundation-class-11',
            course=self.course,
            price=Decimal('5500.00'),
            is_published=True,
        )
        self.addon_book = BatchItem.objects.create(
            batch=self.batch,
            item_type=BatchItem.ItemType.ADVANCED_BOOK_DIGITAL,
            title='Digital Advanced Book',
            price=Decimal('299.00'),
            is_addon=True,
        )

    @patch('apps.payments.views.get_razorpay_client')
    def test_create_order_uses_db_price_ignoring_client_price(self, mock_get_client):
        """
        Verify that even if an attacker passes a fake client price (e.g. ₹1.00),
        the server strictly queries the database price: batch.price (5500) + addon.price (299) = 5799.00.
        """
        fake_client = mock_get_client.return_value
        fake_client.order.create.return_value = {
            'id': 'order_rzp_mock123',
            'amount': 579900,
            'currency': 'INR',
        }

        tampered_payload = {
            'batch_id': str(self.batch.id),
            'addon_item_ids': [str(self.addon_book.id)],
            'amount': 100,  # Attacker tries paying ₹1 instead of ₹5799
            'price': 1.00,
        }

        res = self.client.post('/api/payments/create-order/', tampered_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verify Razorpay was called with 579900 paise (₹5,799.00)
        call_args = fake_client.order.create.call_args[0][0]
        self.assertEqual(call_args['amount'], 579900)

        payment = Payment.objects.get(razorpay_order_id='order_rzp_mock123')
        self.assertEqual(payment.amount_paise, 579900)
        self.assertEqual(payment.user, self.student)
        self.assertEqual(payment.batch, self.batch)

    def test_bad_signature_rejected(self):
        """
        Verify that forged Razorpay payment signature fails verification and marks payment FAILED.
        """
        payment = Payment.objects.create(
            user=self.student,
            batch=self.batch,
            course=self.course,
            amount_paise=550000,
            currency='INR',
            razorpay_order_id='order_tamper_456',
            status=Payment.Status.CREATED,
        )

        res = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': payment.razorpay_order_id,
            'razorpay_payment_id': 'pay_fake_999',
            'razorpay_signature': 'invalid_forged_hmac_signature',
        })

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertFalse(Enrollment.objects.filter(user=self.student, course=self.course).exists())

    def test_verify_idempotent(self):
        """
        Verify that calling payment verify multiple times on a paid order is idempotent
        and does not duplicate enrollments.
        """
        order_id = 'order_valid_789'
        payment_id = 'pay_valid_789'
        msg = f"{order_id}|{payment_id}".encode('utf-8')
        valid_signature = hmac.new(TEST_RAZORPAY_KEY_SECRET.encode('utf-8'), msg, hashlib.sha256).hexdigest()

        payment = Payment.objects.create(
            user=self.student,
            batch=self.batch,
            course=self.course,
            amount_paise=550000,
            currency='INR',
            razorpay_order_id=order_id,
            status=Payment.Status.CREATED,
        )

        payload = {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': valid_signature,
        }

        # First verification
        res1 = self.client.post('/api/payments/verify/', payload)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.json()['enrolled'])
        self.assertEqual(Enrollment.objects.filter(user=self.student, course=self.course).count(), 1)

        # Second verification (idempotent repeat)
        res2 = self.client.post('/api/payments/verify/', payload)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(Enrollment.objects.filter(user=self.student, course=self.course).count(), 1)

    def test_webhook_bad_signature_returns_400(self):
        """
        Verify that incoming webhook with invalid X-Razorpay-Signature is rejected with 400.
        """
        raw_body = '{"event": "payment.captured", "payload": {}}'
        res = self.client.post(
            '/api/payments/webhook/',
            raw_body,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE='bad_signature_here'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paid_enroll_without_payment_returns_402(self):
        """
        Security check: Ensure students cannot bypass payment and directly self-enroll
        in paid courses/batches via /api/enrollment/enroll/.
        """
        res = self.client.post('/api/enrollment/enroll/', {'course_id': str(self.course.id)})
        self.assertEqual(res.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertFalse(Enrollment.objects.filter(user=self.student, course=self.course).exists())

