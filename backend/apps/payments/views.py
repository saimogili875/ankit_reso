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
from .models import Payment, Entitlement
from .serializers import PaymentSerializer
from .services import fulfill_payment
from .throttles import CheckoutRateThrottle

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
    throttle_classes = [CheckoutRateThrottle]

    def post(self, request):
        course_id = request.data.get('course_id')
        batch_id = request.data.get('batch_id') or request.data.get('batch_slug')
        addon_item_ids = request.data.get('addon_item_ids') or request.data.get('addon_items') or []

        if not course_id and not batch_id:
            return Response(
                {'error': 'Either course_id or batch_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate addon_item_ids strictly as UUIDs (400, not 500)
        if addon_item_ids:
            if not isinstance(addon_item_ids, list):
                return Response(
                    {'error': 'addon_item_ids must be a list of item IDs.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cleaned_addon_ids = []
            for item_id in addon_item_ids:
                try:
                    cleaned_addon_ids.append(str(uuid.UUID(str(item_id))))
                except (ValueError, TypeError, AttributeError):
                    return Response(
                        {'error': f'Invalid addon item ID: {item_id}. Must be a valid UUID.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            addon_item_ids = cleaned_addon_ids

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

            # Block checkout if batch has no linked course to prevent paid-but-not-delivered state
            if not batch.course:
                return Response(
                    {'error': 'This batch cannot be purchased because no active course is linked to it.'},
                    status=status.HTTP_400_BAD_REQUEST
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
            if addon_item_ids:
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
        # 3. CONVERT TO PAISE (EXACT DECIMAL MATH) & CREATE RAZORPAY ORDER
        # -------------------------------------------------------------
        amount_paise = int(total_amount_rupees * Decimal('100'))
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
            'total_amount': str(total_amount_rupees),
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
            if payment.status != Payment.Status.PAID:
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=['status'])
            return Response(
                {'error': 'Payment signature verification failed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check paid amount and currency against payment.amount_paise via Razorpay API
        try:
            client = get_razorpay_client()
            payment_info = client.payment.fetch(razorpay_payment_id)
            if isinstance(payment_info, dict):
                paid_amount = payment_info.get('amount')
                paid_currency = payment_info.get('currency', 'INR')
                if paid_amount is not None and (paid_amount != payment.amount_paise or paid_currency != payment.currency):
                    logger.critical(
                        "SECURITY ALERT: Payment amount/currency mismatch! Order %s, Payment %s: expected %s %s, got %s %s",
                        payment.razorpay_order_id, razorpay_payment_id, payment.amount_paise, payment.currency, paid_amount, paid_currency
                    )
                    return Response(
                        {'error': 'Paid amount or currency does not match order record. Fulfillment blocked.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        except Exception as exc:
            logger.warning("Razorpay API fetch check encountered: %s", exc)

        # Atomic idempotent fulfillment
        locked_payment, is_enrolled = fulfill_payment(payment, razorpay_payment_id)

        return Response({
            'success': True,
            'message': 'Payment verified successfully.',
            'order_id': locked_payment.razorpay_order_id,
            'payment_id': locked_payment.razorpay_payment_id,
            'batch_id': str(locked_payment.batch_id) if locked_payment.batch_id else None,
            'enrolled': is_enrolled,
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
                    paid_amount = payment_entity.get('amount')
                    paid_currency = payment_entity.get('currency', 'INR')
                    if paid_amount is not None and (paid_amount != payment.amount_paise or paid_currency != payment.currency):
                        logger.critical(
                            "SECURITY ALERT: Webhook payment amount/currency mismatch for order %s: expected %s %s, got %s %s",
                            order_id, payment.amount_paise, payment.currency, paid_amount, paid_currency
                        )
                        return Response({'error': 'Amount or currency mismatch. Fulfillment blocked.'}, status=status.HTTP_400_BAD_REQUEST)

                    fulfill_payment(payment, payment_id)
                else:
                    # Look up BookOrder by razorpay_order_id when no Course Payment matches
                    try:
                        from apps.books.models import BookOrder
                        from apps.books.services import finalize_book_order
                        book_order = BookOrder.objects.filter(razorpay_order_id=order_id).first()
                        if book_order:
                            finalize_book_order(book_order, payment_id)
                    except Exception as exc:
                        logger.exception("Failed to finalize book order %s from payments webhook: %s", order_id, exc)

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


