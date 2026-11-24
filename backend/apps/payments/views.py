import hmac
import hashlib
import json
import uuid
import logging
from decimal import Decimal
from django.conf import settings
from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
import razorpay

from apps.accounts.permissions import IsStudent, IsAdminRole
from apps.academics.models import Course, Enrollment, Batch, BatchItem
from .models import Payment, Book, BookOrder
from .serializers import (
    PaymentSerializer,
    BookPublicSerializer,
    BookAdminSerializer,
    BookOrderAdminSerializer,
)
from .book_services import get_book_download_url

logger = logging.getLogger(__name__)

def get_razorpay_keys():
    raw_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
    raw_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
    key_id = str(raw_id).strip().strip("'\"") if raw_id else ""
    key_secret = str(raw_secret).strip().strip("'\"") if raw_secret else ""
    return key_id, key_secret

def get_razorpay_client():
    key_id, key_secret = get_razorpay_keys()
    if not key_id or not key_secret:
        logger.error("Razorpay keys missing")
        raise ValueError("Razorpay keys missing")
    return razorpay.Client(auth=(key_id, key_secret))


class CreateOrderView(APIView):
    """
    POST /api/payments/create-order/
    Creates a new Razorpay order for purchasing a paid Course or Batch.
    Accepts {course_id} OR {batch_id, addon_item_ids: []}.
    Price is calculated strictly on the server from the database. Client prices are completely ignored.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        course_id = request.data.get('course_id')
        batch_id = request.data.get('batch_id') or request.data.get('batch_slug')
        addon_item_ids = request.data.get('addon_item_ids') or request.data.get('addon_items') or []

        if not course_id and not batch_id:
            return Response(
                {'error': 'Either course_id or batch_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        course = None
        batch = None
        total_amount_rupees = Decimal('0.00')
        items_snapshot = []

        # -------------------------------------------------------------
        # 1. BATCH CHECKOUT FLOW
        # -------------------------------------------------------------
        if batch_id:
            try:
                batch = Batch.objects.filter(
                    models.Q(id=batch_id) | models.Q(slug=batch_id),
                    is_published=True
                ).select_related('course').first()
            except (ValidationError, ValueError):
                batch = Batch.objects.filter(slug=batch_id, is_published=True).select_related('course').first()

            if not batch:
                return Response(
                    {'error': 'Batch not found or is not published.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if user already purchased this batch or enrolled in its course
            has_paid_batch = Payment.objects.filter(
                user=request.user,
                batch=batch,
                status=Payment.Status.PAID
            ).exists()
            if has_paid_batch:
                return Response(
                    {'error': 'You have already purchased this batch.'},
                    status=status.HTTP_409_CONFLICT
                )

            if batch.course and Enrollment.objects.filter(user=request.user, course=batch.course, status='ACTIVE').exists():
                return Response(
                    {'error': 'You are already enrolled in the course linked to this batch.'},
                    status=status.HTTP_409_CONFLICT
                )

            # Calculate server-side price
            base_price = Decimal(str(batch.price or 0.00))
            if base_price <= Decimal('0.00'):
                return Response(
                    {'error': 'This batch is free. Direct self-enrollment is available.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_amount_rupees = base_price
            items_snapshot.append({
                'type': 'base_batch',
                'title': batch.name,
                'price': str(base_price),
            })

            # Process add-ons
            if addon_item_ids and isinstance(addon_item_ids, list):
                valid_addons = BatchItem.objects.filter(
                    batch=batch,
                    id__in=addon_item_ids,
                    is_addon=True
                )
                for item in valid_addons:
                    addon_price = Decimal(str(item.price or 0.00))
                    total_amount_rupees += addon_price
                    items_snapshot.append({
                        'id': str(item.id),
                        'item_type': item.item_type,
                        'title': item.title,
                        'price': str(addon_price),
                        'is_addon': True,
                    })

            course = batch.course

        # -------------------------------------------------------------
        # 2. STANDALONE COURSE CHECKOUT FLOW
        # -------------------------------------------------------------
        else:
            try:
                course = Course.objects.filter(
                    models.Q(id=course_id) | models.Q(slug=course_id),
                    is_published=True
                ).first()
            except (ValidationError, ValueError):
                course = Course.objects.filter(slug=course_id, is_published=True).first()

            if not course:
                return Response(
                    {'error': 'Course not found or is not published.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if Enrollment.objects.filter(user=request.user, course=course, status='ACTIVE').exists():
                return Response(
                    {'error': 'You are already enrolled in this course.'},
                    status=status.HTTP_409_CONFLICT
                )

            try:
                total_amount_rupees = Decimal(str(course.price or 0.00))
            except (ValueError, TypeError):
                total_amount_rupees = Decimal('0.00')

            if course.is_free or total_amount_rupees <= Decimal('0.00'):
                return Response(
                    {'error': 'This course is free. Please use standard course enrollment.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            items_snapshot.append({
                'type': 'course',
                'title': course.title,
                'price': str(total_amount_rupees),
            })

        # -------------------------------------------------------------
        # 3. CONVERT TO PAISE & CREATE RAZORPAY ORDER
        # -------------------------------------------------------------
        amount_paise = int(round(float(total_amount_rupees) * 100))
        if amount_paise < 100:
            return Response(
                {'error': 'Minimum order amount is ₹1.00.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        receipt = f"rcpt_{uuid.uuid4().hex[:14]}"
        notes = {
            'user_id': str(request.user.id),
            'course_id': str(course.id) if course else '',
            'batch_id': str(batch.id) if batch else '',
        }

        try:
            client = get_razorpay_client()
            order = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'receipt': receipt,
                'notes': notes,
            })
        except ValueError:
            return Response(
                {'error': 'Payment gateway credentials are not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except (razorpay.errors.BadRequestError, razorpay.errors.ServerError) as e:
            err_msg = str(e).lower()
            if any(k in err_msg for k in ['auth', 'unauthorized', 'credential', 'key']):
                logger.error("Razorpay auth error: %s", type(e).__name__)
                return Response(
                    {'error': 'Payment gateway authentication failed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            logger.exception("create-order failed")
            return Response(
                {'error': 'Payment gateway error. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            err_msg = str(e).lower()
            if any(k in err_msg for k in ['auth', 'unauthorized', 'credential', 'key']):
                logger.error("Razorpay auth error: %s", type(e).__name__)
                return Response(
                    {'error': 'Payment gateway authentication failed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            logger.exception("create-order failed")
            return Response(
                {'error': 'Failed to initiate payment. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 4. Save Payment record
        Payment.objects.create(
            user=request.user,
            course=course,
            batch=batch,
            items_snapshot=items_snapshot,
            amount_paise=amount_paise,
            currency='INR',
            razorpay_order_id=order['id'],
            status=Payment.Status.CREATED,
        )

        key_id, _ = get_razorpay_keys()
        return Response({
            'order_id': order['id'],
            'amount': amount_paise,
            'currency': 'INR',
            'key_id': key_id,
            'total_amount': float(total_amount_rupees),
            'items_count': len(items_snapshot),
        }, status=status.HTTP_201_CREATED)


class VerifyPaymentView(APIView):
    """
    POST /api/payments/verify/
    Verifies the Razorpay payment signature and activates Course / Batch enrollment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id') or data.get('order_id')
        razorpay_payment_id = data.get('razorpay_payment_id') or data.get('payment_id')
        razorpay_signature = data.get('razorpay_signature') or data.get('signature')

        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return Response(
                {'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment = Payment.objects.filter(
            razorpay_order_id=razorpay_order_id,
            user=request.user
        ).select_related('course', 'batch', 'batch__course').first()

        if not payment:
            return Response(
                {'error': 'Payment record not found for this order and user.'},
                status=status.HTTP_404_NOT_FOUND
            )

        _, key_secret = get_razorpay_keys()
        if not key_secret:
            logger.error("Razorpay keys missing")
            return Response(
                {'error': 'Payment gateway credentials are not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        is_valid = False
        try:
            client = get_razorpay_client()
            client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature,
            })
            is_valid = True
        except (razorpay.errors.SignatureVerificationError, ValueError):
            is_valid = False

        if not is_valid:
            msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
            generated = hmac.new(key_secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()
            if hmac.compare_digest(generated, razorpay_signature):
                is_valid = True

        if not is_valid:
            logger.warning("Signature mismatch for order=%s, payment=%s", razorpay_order_id, razorpay_payment_id)
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response(
                {'error': 'Payment signature verification failed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Atomic idempotent enrollment
        with transaction.atomic():
            locked_payment = Payment.objects.select_for_update().get(id=payment.id)
            if locked_payment.status == Payment.Status.PAID:
                return Response({
                    'success': True,
                    'message': 'Payment already verified.',
                    'order_id': locked_payment.razorpay_order_id,
                    'payment_id': locked_payment.razorpay_payment_id,
                    'enrolled': True,
                }, status=status.HTTP_200_OK)

            locked_payment.status = Payment.Status.PAID
            locked_payment.razorpay_payment_id = razorpay_payment_id
            locked_payment.paid_at = timezone.now()
            locked_payment.save(update_fields=['status', 'razorpay_payment_id', 'paid_at'])

            target_course = locked_payment.course or (locked_payment.batch.course if locked_payment.batch else None)
            if target_course:
                enrollment, _ = Enrollment.objects.get_or_create(
                    user=request.user,
                    course=target_course,
                    defaults={'status': 'ACTIVE'}
                )
                if enrollment.status != 'ACTIVE':
                    enrollment.status = 'ACTIVE'
                    enrollment.save(update_fields=['status'])

        return Response({
            'success': True,
            'message': 'Payment verified successfully.',
            'order_id': locked_payment.razorpay_order_id,
            'payment_id': locked_payment.razorpay_payment_id,
            'batch_id': str(locked_payment.batch_id) if locked_payment.batch_id else None,
            'enrolled': bool(target_course),
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class WebhookView(APIView):
    """
    POST /api/payments/webhook/
    Asynchronously processes Razorpay webhooks (payment.captured, order.paid, payment.failed).
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = []

    def post(self, request):
        signature = request.META.get('HTTP_X_RAZORPAY_SIGNATURE', '')
        if not signature:
            return Response({'error': 'Missing X-Razorpay-Signature header.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        webhook_secret = str(raw_secret).strip().strip("'\"") if raw_secret else ""
        if not webhook_secret:
            logger.error("Razorpay webhook secret missing")
            return Response({'error': 'Webhook secret unconfigured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        raw_body = request.body.decode('utf-8') if isinstance(request.body, bytes) else str(request.body)

        try:
            client = get_razorpay_client()
            client.utility.verify_webhook_signature(raw_body, signature, webhook_secret)
        except (razorpay.errors.SignatureVerificationError, ValueError):
            dig = hmac.new(webhook_secret.encode('utf-8'), raw_body.encode('utf-8'), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(dig, signature):
                logger.warning("Invalid Razorpay webhook signature received.")
                return Response({'error': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event_data = json.loads(raw_body)
        except Exception:
            return Response({'error': 'Invalid JSON body.'}, status=status.HTTP_400_BAD_REQUEST)

        event = event_data.get('event')
        payload = event_data.get('payload', {})
        payment_entity = payload.get('payment', {}).get('entity', {})
        order_entity = payload.get('order', {}).get('entity', {})

        order_id = payment_entity.get('order_id') or order_entity.get('id')
        payment_id = payment_entity.get('id')

        if event in ['payment.captured', 'order.paid']:
            if order_id:
                payment = Payment.objects.filter(razorpay_order_id=order_id).select_related('course', 'batch', 'batch__course').first()
                if payment:
                    with transaction.atomic():
                        locked = Payment.objects.select_for_update().get(id=payment.id)
                        if locked.status != Payment.Status.PAID:
                            locked.status = Payment.Status.PAID
                            if payment_id:
                                locked.razorpay_payment_id = payment_id
                            locked.paid_at = timezone.now()
                            locked.save(update_fields=['status', 'razorpay_payment_id', 'paid_at'])

                            target_course = locked.course or (locked.batch.course if locked.batch else None)
                            if target_course:
                                enrollment, _ = Enrollment.objects.get_or_create(
                                    user=locked.user,
                                    course=target_course,
                                    defaults={'status': 'ACTIVE'}
                                )
                                if enrollment.status != 'ACTIVE':
                                    enrollment.status = 'ACTIVE'
                                    enrollment.save(update_fields=['status'])

            return Response({'status': 'ok', 'message': 'Event processed successfully.'}, status=status.HTTP_200_OK)

        elif event == 'payment.failed':
            if order_id:
                payment = Payment.objects.filter(razorpay_order_id=order_id).first()
                if payment and payment.status != Payment.Status.PAID:
                    payment.status = Payment.Status.FAILED
                    payment.save(update_fields=['status'])

            return Response({'status': 'ok', 'message': 'Payment marked failed.'}, status=status.HTTP_200_OK)

        return Response({'status': 'ok', 'message': 'Event acknowledged.'}, status=status.HTTP_200_OK)


class AdminPaymentListView(generics.ListAPIView):
    """
    GET /api/admin/payments/
    Admin-only paginated listing of all payment transactions with filters.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('user', 'course', 'batch').all().order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param.lower())
        batch_param = self.request.query_params.get('batch')
        if batch_param:
            qs = qs.filter(models.Q(batch__id=batch_param) | models.Q(batch__slug=batch_param))
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(user__email__icontains=search) |
                models.Q(course__title__icontains=search) |
                models.Q(batch__name__icontains=search) |
                models.Q(razorpay_order_id__icontains=search) |
                models.Q(razorpay_payment_id__icontains=search)
            )
        return qs


class AdminGrantEnrollmentView(APIView):
    """
    POST /api/payments/admin/grant-enrollment/
    Allows an administrator to manually grant an enrollment or mark payment as verified.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        user_id = request.data.get('user_id')
        user_email = request.data.get('user_email')
        course_id = request.data.get('course_id')
        batch_id = request.data.get('batch_id')

        from apps.accounts.models import User
        user = None
        if user_id:
            user = User.objects.filter(id=user_id).first()
        elif user_email:
            user = User.objects.filter(email=user_email.strip().lower()).first()

        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        course = None
        batch = None
        if course_id:
            course = Course.objects.filter(models.Q(id=course_id) | models.Q(slug=course_id)).first()
        if batch_id:
            batch = Batch.objects.filter(models.Q(id=batch_id) | models.Q(slug=batch_id)).select_related('course').first()
            if batch and batch.course:
                course = batch.course

        if not course and not batch:
            return Response({'error': 'Either course_id or batch_id must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            manual_payment = Payment.objects.create(
                user=user,
                course=course,
                batch=batch,
                items_snapshot=[{'type': 'manual_grant', 'by': request.user.email}],
                amount_paise=0,
                currency='INR',
                razorpay_order_id=f"manual_{uuid.uuid4().hex[:12]}",
                razorpay_payment_id=f"manual_{uuid.uuid4().hex[:12]}",
                status=Payment.Status.PAID,
                paid_at=timezone.now(),
            )
            if course:
                enrollment, _ = Enrollment.objects.get_or_create(
                    user=user,
                    course=course,
                    defaults={'status': 'ACTIVE'}
                )
                if enrollment.status != 'ACTIVE':
                    enrollment.status = 'ACTIVE'
                    enrollment.save(update_fields=['status'])

        return Response({
            'success': True,
            'message': f"Enrollment granted to {user.email}.",
            'payment_id': str(manual_payment.id),
        }, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# BOOK PURCHASES & SECURE DIGITAL DELIVERY ENDPOINTS
# ---------------------------------------------------------------------------

class BookListView(generics.ListAPIView):
    """
    GET /api/payments/books/
    Returns published books with pricing and metadata (strictly excludes pdf_key).
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BookPublicSerializer
    queryset = Book.objects.filter(is_published=True).order_by('order', 'created_at')


class BookCreateOrderView(APIView):
    """
    POST /api/payments/books/create-order/
    Creates a Razorpay order for purchasing a book (digital or hardcopy).
    Computes prices server-side: base price + 18% GST.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        book_id = request.data.get('book_id') or request.data.get('bookId')
        format_type = request.data.get('format', BookOrder.Format.DIGITAL)
        customer = request.data.get('customer', {})

        if not book_id:
            return Response({'error': 'book_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        book = Book.objects.filter(models.Q(id=book_id) | models.Q(id__iexact=book_id)).first()
        if not book or not book.is_published:
            return Response({'error': 'Book not found or unpublished.'}, status=status.HTTP_404_NOT_FOUND)

        buyer_name = customer.get('name') or request.data.get('fullName') or (request.user.full_name if request.user.is_authenticated else '')
        buyer_email = customer.get('email') or request.data.get('email') or (request.user.email if request.user.is_authenticated else '')
        buyer_phone = customer.get('phone') or request.data.get('phone') or ''

        if not buyer_name:
            return Response({'error': 'Buyer full name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not buyer_phone or len(buyer_phone.replace(' ', '')) < 10:
            return Response({'error': 'Valid 10-digit mobile phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if format_type == BookOrder.Format.HARDCOPY:
            shipping_address = customer.get('address') or request.data.get('shippingAddress') or ''
            shipping_city = customer.get('city') or request.data.get('city') or ''
            shipping_state = customer.get('state') or request.data.get('stateName') or ''
            shipping_pincode = customer.get('pincode') or request.data.get('pincode') or ''
            if not (shipping_address and shipping_city and shipping_state and shipping_pincode):
                return Response({'error': 'Complete physical shipping address is required for hard copies.'}, status=status.HTTP_400_BAD_REQUEST)
            base_price = Decimal(str(book.hardcopy_price))
        else:
            shipping_address = ''
            shipping_city = ''
            shipping_state = ''
            shipping_pincode = ''
            base_price = Decimal(str(book.digital_price))

        gst_percent = Decimal(str(book.gst_percent or 18.00))
        gst_amount = round(base_price * (gst_percent / Decimal('100.00')), 2)
        total_amount = base_price + gst_amount
        amount_paise = int(round(float(total_amount) * 100))

        receipt = f"bk_{uuid.uuid4().hex[:12]}"
        notes = {
            'book_id': str(book.id),
            'format': format_type,
            'buyer_email': buyer_email,
        }

        try:
            client = get_razorpay_client()
            order = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'receipt': receipt,
                'notes': notes,
            })
        except Exception as e:
            logger.exception("Failed to create Razorpay book order: %s", e)
            return Response({'error': 'Payment gateway error. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        book_order = BookOrder.objects.create(
            book=book,
            user=request.user if request.user.is_authenticated else None,
            format=format_type,
            base_price=base_price,
            gst_amount=gst_amount,
            total_amount=total_amount,
            amount_paise=amount_paise,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone,
            shipping_address=shipping_address,
            shipping_city=shipping_city,
            shipping_state=shipping_state,
            shipping_pincode=shipping_pincode,
            razorpay_order_id=order['id'],
            status=BookOrder.Status.CREATED,
        )

        key_id, _ = get_razorpay_keys()
        return Response({
            'order_id': order['id'],
            'amount': amount_paise,
            'currency': 'INR',
            'key_id': key_id,
            'base_price': float(base_price),
            'gst_amount': float(gst_amount),
            'total_amount': float(total_amount),
            'book_order_id': str(book_order.id),
        }, status=status.HTTP_201_CREATED)


class BookVerifyPaymentView(APIView):
    """
    POST /api/payments/books/verify/
    Verifies Razorpay signature for book purchases.
    If format is digital, issues a short-lived download token and secure presigned URL.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id') or data.get('order_id')
        razorpay_payment_id = data.get('razorpay_payment_id') or data.get('payment_id')
        razorpay_signature = data.get('razorpay_signature') or data.get('signature')

        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return Response(
                {'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order = BookOrder.objects.filter(razorpay_order_id=razorpay_order_id).select_related('book').first()
        if not order:
            return Response({'error': 'Book order not found.'}, status=status.HTTP_404_NOT_FOUND)

        _, key_secret = get_razorpay_keys()
        if not key_secret:
            return Response({'error': 'Payment gateway credentials unconfigured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        is_valid = False
        try:
            client = get_razorpay_client()
            client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature,
            })
            is_valid = True
        except Exception:
            is_valid = False

        if not is_valid:
            msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
            dig = hmac.new(key_secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()
            if hmac.compare_digest(dig, razorpay_signature):
                is_valid = True

        if not is_valid:
            order.status = BookOrder.Status.FAILED
            order.save(update_fields=['status'])
            return Response({'error': 'Payment signature verification failed.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            locked = BookOrder.objects.select_for_update().get(id=order.id)
            locked.status = BookOrder.Status.PAID
            locked.razorpay_payment_id = razorpay_payment_id
            locked.paid_at = timezone.now()

            download_url = None
            if locked.format == BookOrder.Format.DIGITAL:
                if not locked.download_token:
                    locked.download_token = uuid.uuid4().hex
                    locked.download_token_expires_at = timezone.now() + timezone.timedelta(minutes=10)
                
                download_url = get_book_download_url(locked.book.pdf_key, expiration_seconds=600)
            
            locked.save()

        return Response({
            'success': True,
            'message': 'Book purchase verified successfully.',
            'order_id': locked.razorpay_order_id,
            'payment_id': locked.razorpay_payment_id,
            'format': locked.format,
            'download_token': locked.download_token if locked.format == BookOrder.Format.DIGITAL else None,
            'download_url': download_url,
            'book_title': locked.book.title,
        }, status=status.HTTP_200_OK)


class BookDownloadView(APIView):
    """
    GET /api/payments/books/download/<token>/
    Serves a verified, time-limited digital PDF download strictly via temporary token.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        order = BookOrder.objects.filter(
            download_token=token,
            status=BookOrder.Status.PAID,
            format=BookOrder.Format.DIGITAL
        ).select_related('book').first()

        if not order:
            return Response({'error': 'Invalid or unverified download token.'}, status=status.HTTP_404_NOT_FOUND)

        if order.download_token_expires_at and timezone.now() > order.download_token_expires_at:
            return Response({'error': 'Download token has expired (10-minute limit). Please contact support.'}, status=status.HTTP_410_GONE)

        if order.download_count >= order.max_downloads:
            return Response({'error': 'Maximum download limit reached for this purchase.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        order.download_count += 1
        order.save(update_fields=['download_count'])

        url = get_book_download_url(order.book.pdf_key, expiration_seconds=600)
        if not url:
            return Response({'error': 'Secure storage file not found.'}, status=status.HTTP_404_NOT_FOUND)

        from django.http import HttpResponseRedirect
        return HttpResponseRedirect(url)

