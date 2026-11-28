import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch
from datetime import timedelta

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

from apps.books.models import BookProduct, BookOrder, InvoiceSequence
from apps.books.services import get_client_ip, finalize_book_order

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
        cache.clear()
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

    # --------------------------------------------------------------------------
    # 1. RATE LIMITS
    # --------------------------------------------------------------------------
    @patch('apps.books.views.get_razorpay_client')
    def test_rate_limit_rapid_order_creation_returns_429(self, mock_get_client):
        """The 6th rapid order creation from one IP returns 429."""
        fake_client = mock_get_client.return_value
        fake_client.order.create.side_effect = lambda data: {
            'id': f"order_rzp_{data['receipt']}",
            'amount': data['amount'],
            'currency': 'INR',
        }

        # Issue 5 orders with different phones from the same IP (192.168.1.100)
        for i in range(5):
            payload = {
                'product_slug': self.book.slug,
                'format': 'DIGITAL',
                'buyer_name': f'Buyer {i}',
                'buyer_phone': f'987654321{i}',
                'buyer_email': f'buyer{i}@example.com',
            }
            res = self.client.post(
                '/api/books/orders/',
                payload,
                format='json',
                REMOTE_ADDR='192.168.1.100',
            )
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # 6th request from the same IP -> throttled with 429
        payload_6 = {
            'product_slug': self.book.slug,
            'format': 'DIGITAL',
            'buyer_name': 'Buyer 6',
            'buyer_phone': '9876543299',
            'buyer_email': 'buyer6@example.com',
        }
        res_6 = self.client.post(
            '/api/books/orders/',
            payload_6,
            format='json',
            REMOTE_ADDR='192.168.1.100',
        )
        self.assertEqual(res_6.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch('apps.books.views.get_razorpay_client')
    def test_rate_limit_buyer_phone_returns_429(self, mock_get_client):
        """4th order within an hour for the same buyer_phone returns 429."""
        fake_client = mock_get_client.return_value
        fake_client.order.create.side_effect = lambda data: {
            'id': f"order_rzp_{data['receipt']}",
            'amount': data['amount'],
            'currency': 'INR',
        }

        same_phone = '9876500000'
        for i in range(3):
            payload = {
                'product_slug': self.book.slug,
                'format': 'DIGITAL',
                'buyer_name': f'Same Phone Buyer {i}',
                'buyer_phone': same_phone,
                'buyer_email': f'samephone{i}@example.com',
            }
            # Rotating IP to ensure IP throttle does not trigger
            res = self.client.post(
                '/api/books/orders/',
                payload,
                format='json',
                REMOTE_ADDR=f'10.0.0.{i+1}',
            )
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # 4th attempt with same phone -> 429
        payload_4 = {
            'product_slug': self.book.slug,
            'format': 'DIGITAL',
            'buyer_name': 'Same Phone Buyer 4',
            'buyer_phone': same_phone,
            'buyer_email': 'samephone4@example.com',
        }
        res_4 = self.client.post(
            '/api/books/orders/',
            payload_4,
            format='json',
            REMOTE_ADDR='10.0.0.99',
        )
        self.assertEqual(res_4.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    # --------------------------------------------------------------------------
    # 2. VERIFY ENDPOINT ORDER OF CHECKS
    # --------------------------------------------------------------------------
    @patch('apps.books.views.get_razorpay_client')
    def test_verify_order_marks_paid_and_issues_download_token(self, mock_get_client):
        """Verifies signature, sets status=PAID, sets SHA-256 hashed download_token."""
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
        raw_token = data['download_token']
        self.assertIsNotNone(raw_token)
        self.assertIsNotNone(data['download_url'])

        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.PAID)
        self.assertEqual(order.razorpay_payment_id, payment_id)
        self.assertIsNotNone(order.paid_at)
        # Database stores only SHA-256 hash
        self.assertEqual(order.download_token, hashlib.sha256(raw_token.encode('utf-8')).hexdigest())
        self.assertGreater(order.download_expires_at, timezone.now())

        # Test idempotency: re-calling verify with same data returns 200 with raw token from cache
        res_repeat = self.client.post('/api/books/orders/verify/', verify_payload, format='json')
        self.assertEqual(res_repeat.status_code, status.HTTP_200_OK)
        self.assertEqual(res_repeat.json()['download_token'], raw_token)

    def test_already_paid_order_with_bad_signature_returns_400_and_no_token(self):
        """An already-PAID order sent with bad signature returns 400 and no download token."""
        raw_token = 'secret_raw_token_xyz123'
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Legit Buyer',
            buyer_phone='+919876543210',
            buyer_email='legit@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_already_paid_test',
            razorpay_payment_id='pay_valid_prev',
            status=BookOrder.Status.PAID,
            download_token=token_hash,
            invoice_number='INV-BK-20261124-0010',
        )

        res = self.client.post('/api/books/orders/verify/', {
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': 'pay_hacker_tamper',
            'razorpay_signature': 'bad_fake_signature_xyz',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('download_token', res.json())
        self.assertNotIn('download_url', res.json())

    def test_verify_bad_signature_does_not_mark_order_failed(self):
        """Invalid payment signature returns 400 and does NOT set order.status = FAILED."""
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Visitor',
            buyer_phone='+919876543210',
            buyer_email='visitor@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_bad_sig_test',
            status=BookOrder.Status.CREATED,
        )

        res = self.client.post('/api/books/orders/verify/', {
            'razorpay_order_id': order.razorpay_order_id,
            'razorpay_payment_id': 'pay_fake',
            'razorpay_signature': 'invalid_signature_xyz',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        order.refresh_from_db()
        # Must NOT be marked FAILED
        self.assertEqual(order.status, BookOrder.Status.CREATED)

    # --------------------------------------------------------------------------
    # 3. SINGLE WEBHOOK FOR BOTH COURSES AND BOOKS
    # --------------------------------------------------------------------------
    def test_payments_webhook_finalizes_book_order_idempotently(self):
        """
        Signed payment.captured payload sent to /api/payments/webhook/ marks
        BookOrder PAID once, and sending it twice does not duplicate.
        """
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Webhook Buyer',
            buyer_phone='+919876543210',
            buyer_email='webhook_buyer@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_payments_webhook_123',
            status=BookOrder.Status.CREATED,
        )

        payload_str = (
            '{"event": "payment.captured", "payload": {'
            '"payment": {"entity": {"id": "pay_hook_999", "order_id": "order_payments_webhook_123"}},'
            '"order": {"entity": {"id": "order_payments_webhook_123"}}'
            '}}'
        )
        signature = hmac.new(TEST_WEBHOOK_SECRET.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()

        # Send to /api/payments/webhook/
        res = self.client.post(
            '/api/payments/webhook/',
            payload_str,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.PAID)
        self.assertEqual(order.razorpay_payment_id, 'pay_hook_999')
        self.assertTrue(order.invoice_number.startswith('INV-BK-'))
        first_invoice = order.invoice_number

        # Sending second time does not duplicate invoice or fail
        res_repeat = self.client.post(
            '/api/payments/webhook/',
            payload_str,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=signature,
        )
        self.assertEqual(res_repeat.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.invoice_number, first_invoice)

    def test_books_webhook_bad_signature_rejected(self):
        """Webhook with invalid HMAC signature returns 400."""
        res = self.client.post(
            '/api/books/webhook/',
            '{"event": "payment.captured"}',
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE='bad_webhook_sig'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 4. INVOICE NUMBERS
    # --------------------------------------------------------------------------
    def test_invoice_number_sequential_generation_and_uniqueness(self):
        """Sequential invoice numbers (INV-BK-YYYYMMDD-0001, 0002) and uniqueness."""
        order1 = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Buyer 1',
            buyer_phone='+919876543210',
            buyer_email='b1@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_seq_1',
            status=BookOrder.Status.CREATED,
        )
        order2 = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Buyer 2',
            buyer_phone='+919876543211',
            buyer_email='b2@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_seq_2',
            status=BookOrder.Status.CREATED,
        )

        fin1, _ = finalize_book_order(order1, 'pay_seq_1')
        fin2, _ = finalize_book_order(order2, 'pay_seq_2')

        today_str = timezone.now().strftime('%Y%m%d')
        self.assertEqual(fin1.invoice_number, f"INV-BK-{today_str}-0001")
        self.assertEqual(fin2.invoice_number, f"INV-BK-{today_str}-0002")

    # --------------------------------------------------------------------------
    # 5. ATOMIC COUNTERS AND MONEY
    # --------------------------------------------------------------------------
    def test_atomic_stock_decrement_and_out_of_stock_rejection(self):
        """Decrements stock with F() and refuses order when stock <= 0 at verify time."""
        self.book.stock_hardcopy = 1
        self.book.save(update_fields=['stock_hardcopy'])

        order1 = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.HARDCOPY,
            buyer_name='Hardcopy 1',
            buyer_phone='+919876543210',
            buyer_email='hc1@example.com',
            shipping_address='Street 1',
            city='City',
            state='State',
            pincode='560001',
            base_amount=Decimal('399.00'),
            gst_amount=Decimal('71.82'),
            total_amount_paise=47082,
            razorpay_order_id='order_stock_1',
            status=BookOrder.Status.CREATED,
        )
        order2 = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.HARDCOPY,
            buyer_name='Hardcopy 2',
            buyer_phone='+919876543211',
            buyer_email='hc2@example.com',
            shipping_address='Street 2',
            city='City',
            state='State',
            pincode='560001',
            base_amount=Decimal('399.00'),
            gst_amount=Decimal('71.82'),
            total_amount_paise=47082,
            razorpay_order_id='order_stock_2',
            status=BookOrder.Status.CREATED,
        )

        # First order finalization succeeds and decrements stock to 0
        finalize_book_order(order1, 'pay_stock_1')
        self.book.refresh_from_db()
        self.assertEqual(self.book.stock_hardcopy, 0)

        # Second order finalization is refused due to 0 stock
        with self.assertRaises(Exception):
            finalize_book_order(order2, 'pay_stock_2')

        order2.refresh_from_db()
        self.assertIn('REFUND_REQUIRED', order2.admin_note)

    # --------------------------------------------------------------------------
    # 6. CLIENT IP HELPER
    # --------------------------------------------------------------------------
    def test_client_ip_helper_uses_num_proxies(self):
        """Client IP helper extracts the Nth address from the right using NUM_PROXIES."""
        class MockRequest:
            META = {
                'HTTP_X_FORWARDED_FOR': '1.1.1.1, 203.0.113.195, 10.0.0.1',
                'REMOTE_ADDR': '127.0.0.1',
            }
        ip = get_client_ip(MockRequest())
        # With NUM_PROXIES=2, the 2nd from right in ['1.1.1.1', '203.0.113.195', '10.0.0.1'] is '203.0.113.195'
        self.assertEqual(ip, '203.0.113.195')

    # --------------------------------------------------------------------------
    # 7. DOWNLOAD TOKEN AND STATUS PAGE
    # --------------------------------------------------------------------------
    @patch('storage.service.storage_service.provider.generate_presigned_url')
    def test_download_access_controls_and_token_hashing(self, mock_presign):
        """Enforces SHA-256 hash in DB, valid token, expiry check, and download limit."""
        mock_presign.return_value = 'https://r2.example.com/books/pdfs/secret_math.pdf?token=presigned'

        raw_token = 'valid_token_1234567890abcdef'
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

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
            download_token=token_hash,  # Only hash stored in DB
            download_expires_at=timezone.now() + timedelta(days=7),
            download_count=0,
            max_downloads=5,
        )

        # 1. Invalid token -> 403
        res_bad_token = self.client.get(f'/api/books/orders/{order.public_id}/download/?token=wrong_token')
        self.assertEqual(res_bad_token.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Valid raw token -> 200 (format=json) & download_count incremented via F()
        res_valid = self.client.get(
            f'/api/books/orders/{order.public_id}/download/?token={raw_token}&format=json'
        )
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertIn('download_url', res_valid.json())
        order.refresh_from_db()
        self.assertEqual(order.download_count, 1)

        # 3. Exhausted download limit
        order.download_count = 5
        order.save(update_fields=['download_count'])
        res_limit = self.client.get(f'/api/books/orders/{order.public_id}/download/?token={raw_token}')
        self.assertEqual(res_limit.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # 4. Expired token
        order.download_count = 1
        order.download_expires_at = timezone.now() - timedelta(minutes=1)
        order.save(update_fields=['download_count', 'download_expires_at'])
        res_expired = self.client.get(f'/api/books/orders/{order.public_id}/download/?token={raw_token}')
        self.assertEqual(res_expired.status_code, status.HTTP_410_GONE)

    def test_public_status_endpoint_never_exposes_token_without_query_param(self):
        """Public status endpoint GET /api/books/orders/<public_id>/ returns download_url: null unless token is supplied."""
        raw_token = 'status_page_token_abc'
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Status Viewer',
            buyer_phone='+919876543210',
            buyer_email='viewer@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_status_view_test',
            status=BookOrder.Status.PAID,
            download_token=token_hash,
            download_expires_at=timezone.now() + timedelta(days=7),
            invoice_number='INV-BK-20261124-0099',
        )

        # Request without token query param
        res_no_tok = self.client.get(f'/api/books/orders/{order.public_id}/')
        self.assertEqual(res_no_tok.status_code, status.HTTP_200_OK)
        data_no_tok = res_no_tok.json()
        self.assertIsNone(data_no_tok['download_url'])
        self.assertNotIn('download_token', data_no_tok)
        self.assertEqual(data_no_tok['masked_email'], 'vi***@example.com')

        # Request with valid token query param
        res_with_tok = self.client.get(f'/api/books/orders/{order.public_id}/?token={raw_token}')
        self.assertEqual(res_with_tok.status_code, status.HTTP_200_OK)
        data_with_tok = res_with_tok.json()
        self.assertIsNotNone(data_with_tok['download_url'])
        self.assertIn(raw_token, data_with_tok['download_url'])

    @patch('storage.service.storage_service.provider.generate_presigned_url')
    def test_download_endpoint_returns_503_when_r2_not_configured(self, mock_presign):
        """When R2 is unconfigured or returns None, download returns 503 and does not increment count."""
        mock_presign.return_value = None

        raw_token = 'token_r2_down_test_123'
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='R2 Test Buyer',
            buyer_phone='+919876543210',
            buyer_email='r2buyer@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_r2_test_1',
            status=BookOrder.Status.PAID,
            download_token=token_hash,
            download_expires_at=timezone.now() + timedelta(days=7),
            download_count=0,
            max_downloads=5,
        )

        with self.assertLogs('apps.books.views', level='ERROR') as cm:
            res = self.client.get(f'/api/books/orders/{order.public_id}/download/?token={raw_token}')
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.json(), {'error': 'Download temporarily unavailable, contact support.'})
        order.refresh_from_db()
        self.assertEqual(order.download_count, 0)
        self.assertTrue(any("Book download failed" in msg for msg in cm.output))

    def test_download_endpoint_returns_503_when_book_has_no_pdf_key(self):
        """When BookProduct has no pdf_key, download returns 503 and logs ERROR."""
        self.book.pdf_key = ''
        self.book.save(update_fields=['pdf_key'])

        raw_token = 'token_no_pdf_key_test'
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='No Key Buyer',
            buyer_phone='+919876543210',
            buyer_email='nokey@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_no_key_test_2',
            status=BookOrder.Status.PAID,
            download_token=token_hash,
            download_expires_at=timezone.now() + timedelta(days=7),
            download_count=0,
            max_downloads=5,
        )

        with self.assertLogs('apps.books.views', level='ERROR') as cm:
            res = self.client.get(f'/api/books/orders/{order.public_id}/download/?token={raw_token}')
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(res.json(), {'error': 'Download temporarily unavailable, contact support.'})
        order.refresh_from_db()
        self.assertEqual(order.download_count, 0)
        self.assertTrue(any("Book download failed" in msg for msg in cm.output))

    @override_settings(FRONTEND_URL='https://custom.adepteduverse.com')
    def test_order_email_download_url_uses_frontend_url(self):
        """Order confirmation email download URL must use FRONTEND_URL setting."""
        from apps.books.services import send_order_confirmation_email
        from django.core import mail

        order = BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.DIGITAL,
            buyer_name='Email Test Buyer',
            buyer_phone='+919876543210',
            buyer_email='emailbuyer@example.com',
            base_amount=Decimal('299.00'),
            gst_amount=Decimal('53.82'),
            total_amount_paise=35282,
            razorpay_order_id='order_email_test_3',
            status=BookOrder.Status.PAID,
            invoice_number='INV-BK-20261128-0001',
        )

        raw_token = 'secret_raw_token_email_test'
        success = send_order_confirmation_email(order, raw_download_token=raw_token)
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        expected_url = f"https://custom.adepteduverse.com/books/order/{order.public_id}?token={raw_token}"
        self.assertIn(expected_url, email.body)

    # --------------------------------------------------------------------------
    # 8. ADMIN SAFETY
    # --------------------------------------------------------------------------
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

    def test_admin_csv_export_neutralizes_formula_injection(self):
        """CSV export prefixes cells starting with =, +, -, @ with a single quote."""
        BookOrder.objects.create(
            product=self.book,
            format=BookOrder.Format.HARDCOPY,
            buyer_name='=cmd|/C calc!A0',  # Formula injection attempt
            buyer_phone='+919999999999',
            buyer_email='@dangerous_domain.com',
            shipping_address='-10% Discount Coupon Street',
            city='Delhi',
            state='Delhi',
            pincode='110001',
            base_amount=Decimal('399.00'),
            gst_amount=Decimal('71.82'),
            total_amount_paise=47082,
            razorpay_order_id='order_csv_formula_1',
            status=BookOrder.Status.PAID,
            invoice_number='INV-BK-20261124-0001',
            admin_note='@HYPERLINK("http://evil.com")',
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin/books/orders/export-csv/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'text/csv; charset=utf-8')
        content = res.content.decode('utf-8')

        # Check formulas were prepended with single quote
        self.assertIn("'=cmd|/C calc!A0", content)
        self.assertIn("'+919999999999", content)
        self.assertIn("'@dangerous_domain.com", content)
        self.assertIn("'-10% Discount Coupon Street", content)
        self.assertIn("'@HYPERLINK", content)

