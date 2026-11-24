import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch
from datetime import timedelta

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.books.models import BookProduct, BookOrder

User = get_user_model()

TEST_RAZORPAY_KEY_ID = "rzp_test_mockbooks123"
TEST_RAZORPAY_KEY_SECRET = "secret_mockbooks_456"
TEST_WEBHOOK_SECRET = "webhook_secret_books_789"


@override_settings(
    RAZORPAY_KEY_ID=TEST_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET=TEST_RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET,
)
class BookGuestCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed test book
        self.book = BookProduct.objects.create(
            slug='adv-math-test',
            title='Advanced Problem Book in Mathematics',
            subtitle='For Olympiad & JEE Advanced',
            description='Test book description',
            class_label='JEE / Advanced',
            digital_price=Decimal('299.00'),
            hardcopy_price=Decimal('399.00'),
            gst_percent=Decimal('18.00'),
            pdf_key='books/pdfs/secret_test_math.pdf',
            is_published=True,
            display_order=1,
            stock_hardcopy=50,
            highlights=['1000+ problems', 'Complete solutions'],
            badge='Bestseller',
        )

        # Admin user
        self.admin = User.objects.create_user(
            email='admin@adepteduverse.com',
            username='admin',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
        )

        # Student user
        self.student = User.objects.create_user(
            email='student@adepteduverse.com',
            username='student',
            password='StudentPassword123!',
            role=User.Role.STUDENT,
        )

    def test_catalog_list_excludes_pdf_key(self):
        """Public catalog must NEVER leak private pdf_key."""
        res = self.client.get('/api/books/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.json().get('results', res.json())
        self.assertGreaterEqual(len(results), 1)
        first_book = results[0]
        self.assertEqual(first_book['slug'], self.book.slug)
        self.assertNotIn('pdf_key', first_book)

    def test_catalog_detail_excludes_pdf_key(self):
        """Public book detail endpoint must NEVER leak private pdf_key."""
        res = self.client.get(f'/api/books/{self.book.slug}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['title'], self.book.title)
        self.assertNotIn('pdf_key', data)

    @patch('apps.books.views.get_razorpay_client')
    def test_guest_checkout_digital_computes_server_price(self, mock_get_client):
        """
        Guest checkout for digital book:
        Base: 299.00, GST 18%: 53.82, Total: 352.82 -> 35282 paise.
        """
        fake_client = mock_get_client.return_value
        fake_client.order.create.return_value = {
            'id': 'order_rzp_digital_123',
            'amount': 35282,
            'currency': 'INR',
        }

        payload = {
            'product_slug': self.book.slug,
            'format': 'DIGITAL',
            'buyer_name': 'Aarav Sharma',
            'buyer_phone': '9876543210',
            'buyer_email': 'aarav@example.com',
            'fake_client_price': '1.00',  # Attacker attempt to pass cheap price
        }

        res = self.client.post('/api/books/orders/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data['amount_paise'], 35282)
        self.assertEqual(data['razorpay_order_id'], 'order_rzp_digital_123')

        # Check DB record
        order = BookOrder.objects.get(razorpay_order_id='order_rzp_digital_123')
        self.assertEqual(order.status, BookOrder.Status.CREATED)
        self.assertEqual(order.format, BookOrder.Format.DIGITAL)
        self.assertEqual(order.base_amount, Decimal('299.00'))
        self.assertEqual(order.gst_amount, Decimal('53.82'))
        self.assertEqual(order.total_amount_paise, 35282)
        self.assertEqual(order.buyer_phone, '+919876543210')

    @patch('apps.books.views.get_razorpay_client')
    def test_guest_checkout_hardcopy_requires_address_and_valid_pin(self, mock_get_client):
        """
        Hardcopy book requires complete address, city, state, and 6-digit Indian PIN.
        Base: 399.00, GST 18%: 71.82, Total: 470.82 -> 47082 paise.
        """
        fake_client = mock_get_client.return_value
        fake_client.order.create.return_value = {
            'id': 'order_rzp_hardcopy_456',
            'amount': 47082,
            'currency': 'INR',
        }

        # Attempt without address -> fails with 400
        bad_payload = {
            'product_slug': self.book.slug,
            'format': 'HARDCOPY',
            'buyer_name': 'Rohan Gupta',
            'buyer_phone': '9123456789',
            'buyer_email': 'rohan@example.com',
        }
        res_bad = self.client.post('/api/books/orders/', bad_payload, format='json')
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid payload
        good_payload = {
            'product_slug': self.book.slug,
            'format': 'HARDCOPY',
            'buyer_name': 'Rohan Gupta',
            'buyer_phone': '9123456789',
            'buyer_email': 'rohan@example.com',
            'shipping_address': 'Flat 402, Green Valley Apartments, MG Road',
            'city': 'Bengaluru',
            'state': 'Karnataka',
            'pincode': '560001',
        }
        res_good = self.client.post('/api/books/orders/', good_payload, format='json')
        self.assertEqual(res_good.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_good.json()['amount_paise'], 47082)

    def test_invalid_phone_rejected(self):
        """Validates phone number format strictly (10-digit Indian mobile starting with 6-9)."""
        payload = {
            'product_slug': self.book.slug,
            'format': 'DIGITAL',
            'buyer_name': 'Test User',
            'buyer_phone': '12345',  # invalid
            'buyer_email': 'test@example.com',
        }
        res = self.client.post('/api/books/orders/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.books.views.get_razorpay_client')
    def test_verify_order_marks_paid_and_issues_download_token(self, mock_get_client):
        """Verifies signature, sets status=PAID, sets download_token and 7-day expiry."""
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Priya Patel',
            buyer_phone='+919876543210',
            buyer_email='priya@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_verify_test_1',
            status=BookOrder.Status.CREATED,
        )

        payment_id = 'pay_verified_123'
        msg = f"{order.razorpay_order_id}|{payment_id}".encode('utf-8')
        valid_signature = hmac.new(TEST_RAZORPAY_KEY_SECRET.encode('utf-8'), msg, hashlib.sha256).hexdigest()

        fake_client = mock_get_client.return_value
        fake_client.payment.fetch.return_value = {
            'id': payment_id,
            'status': 'captured',
            'amount': 35282,
        }

        verify_payload = {
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': valid_signature,
        }

        res = self.client.post('/api/books/orders/verify/', verify_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertTrue(data['success'])
        self.assertIsNotNone(data['download_token'])
        self.assertIsNotNone(data['download_url'])

        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.PAID)
        self.assertEqual(order.razorpay_payment_id, payment_id)
        self.assertIsNotNone(order.paid_at)
        self.assertTrue(len(order.download_token) >= 32)
        self.assertGreater(order.download_expires_at, timezone.now())

        # Test idempotency: re-calling verify with same data returns 200 without changing tokens
        res_repeat = self.client.post('/api/books/orders/verify/', verify_payload, format='json')
        self.assertEqual(res_repeat.status_code, status.HTTP_200_OK)
        self.assertEqual(res_repeat.json()['download_token'], order.download_token)

    def test_verify_bad_signature_rejected(self):
        """Invalid payment signature marks order FAILED and returns 400."""
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Hacker',
            buyer_phone='+919876543210',
            buyer_email='hacker@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_bad_sig_1',
            status=BookOrder.Status.CREATED,
        )

        res = self.client.post('/api/books/orders/verify/', {
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': 'pay_fake',
            'razorpay_signature': 'invalid_signature_xyz',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.FAILED)

    def test_webhook_bad_signature_rejected(self):
        """Webhook with invalid HMAC signature returns 400."""
        res = self.client.post(
            '/api/books/webhook/',
            '{"event": "payment.captured"}',
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE='bad_webhook_sig'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('storage.service.storage_service.provider.generate_presigned_url')
    def test_download_access_controls(self, mock_presign):
        """Enforces PAID status, valid token, expiry check, and download limit."""
        mock_presign.return_value = 'https://r2.example.com/books/pdfs/secret_math.pdf?token=presigned'

        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Student X',
            buyer_phone='+919876543210',
            buyer_email='studentx@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_download_test',
            status=BookOrder.Status.PAID,
            download_token='valid_token_1234567890abcdef',
            download_expires_at=timezone.now() + timedelta(days=7),
            download_count=0,
            max_downloads=5,
        )

        # 1. Invalid token -> 403
        res_bad_token = self.client.get(f'/api/books/orders/{order.public_id}/download/?token=wrong_token')
        self.assertEqual(res_bad_token.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Valid token -> returns 302 redirect (or JSON if requested)
        res_valid = self.client.get(
            f'/api/books/orders/{order.public_id}/download/?token=valid_token_1234567890abcdef&format=json'
        )
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertIn('download_url', res_valid.json())
        order.refresh_from_db()
        self.assertEqual(order.download_count, 1)

        # 3. Exhausted download limit
        order.download_count = 5
        order.save(update_fields=['download_count'])
        res_limit = self.client.get(f'/api/books/orders/{order.public_id}/download/?token=valid_token_1234567890abcdef')
        self.assertEqual(res_limit.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # 4. Expired token
        order.download_count = 1
        order.download_expires_at = timezone.now() - timedelta(minutes=1)
        order.save(update_fields=['download_count', 'download_expires_at'])
        res_expired = self.client.get(f'/api/books/orders/{order.public_id}/download/?token=valid_token_1234567890abcdef')
        self.assertEqual(res_expired.status_code, status.HTTP_410_GONE)

    def test_admin_permissions_enforced(self):
        """Student or unauthenticated access to admin endpoints must be rejected."""
        # Unauthenticated
        res_unauth = self.client.get('/api/admin/books/orders/')
        self.assertIn(res_unauth.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

        # Authenticated as student
        self.client.force_authenticate(user=self.student)
        res_student = self.client.get('/api/admin/books/orders/')
        self.assertEqual(res_student.status_code, status.HTTP_403_FORBIDDEN)

        # Authenticated as admin
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get('/api/admin/books/orders/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

    def test_admin_csv_export(self):
        """Admin can export orders as CSV spreadsheet."""
        BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.HARDCOPY,
            buyer_name='CSV Buyer',
            buyer_phone='+919999999999',
            buyer_email='csv@example.com',
            shipping_address='123 Test Street',
            city='Delhi',
            state='Delhi',
            pincode='110001',
            base_amount=Decimal('399.00'),
            gst_amount=Decimal('71.82'),
            total_amount_paise=47082,
            razorpay_order_id='order_csv_1',
            status=BookOrder.Status.PAID,
            invoice_number='INV-BK-20261124-0001',
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin/books/orders/export-csv/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'text/csv')
        content = res.content.decode('utf-8')
        self.assertIn('CSV Buyer', content)
        self.assertIn('INV-BK-20261124-0001', content)
