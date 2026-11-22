import hmac
import hashlib
import json
import uuid
import logging
from django.conf import settings
from django.db import transaction, models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework import generics, status, permissions
from rest_framework.response import Response
import razorpay

from apps.accounts.permissions import IsStudent, IsAdminRole
from apps.academics.models import Course, Enrollment
from .models import Payment
from .serializers import PaymentSerializer

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
    Creates a new Razorpay order for purchasing a paid course.
    Accepts {course_id} ONLY. Never accepts amount from the client.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        course_id = request.data.get('course_id')
        if not course_id:
            return Response(
                {'error': 'course_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Load course (is_published=True)
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

        # 2. Check if already enrolled -> 409 Conflict
        if Enrollment.objects.filter(user=request.user, course=course).exists():
            return Response(
                {'error': 'You are already enrolled in this course.'},
                status=status.HTTP_409_CONFLICT
            )

        # 3. Read price strictly from server; convert rupees to paise (x100)
        try:
            course_price_rupees = float(course.price or 0)
        except (ValueError, TypeError):
            course_price_rupees = 0.0

        amount_paise = int(round(course_price_rupees * 100))

        # 4. Reject free courses and amounts under 100 paise
        if course.is_free or amount_paise < 100:
            return Response(
                {'error': 'This course is free. Please use standard course enrollment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        receipt = f"rcpt_{uuid.uuid4().hex[:14]}"
        notes = {
            'user_id': str(request.user.id),
            'course_id': str(course.id),
        }

        # 5. Create Razorpay order
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

        # 6. Save Payment row (status=created)
        Payment.objects.create(
            user=request.user,
            course=course,
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
        }, status=status.HTTP_201_CREATED)


class VerifyPaymentView(APIView):
    """
    POST /api/payments/verify/
    Verifies the Razorpay payment signature and activates enrollment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id') or data.get('order_id')
        razorpay_payment_id = data.get('razorpay_payment_id') or data.get('payment_id')
        razorpay_signature = data.get('razorpay_signature') or data.get('signature')

        # 1. Missing fields check
        if not (razorpay_order_id and razorpay_payment_id and razorpay_signature):
            return Response(
                {'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Load Payment by order_id AND user=request.user (else 404)
        payment = Payment.objects.filter(
            razorpay_order_id=razorpay_order_id,
            user=request.user
        ).first()

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

        # 3. Verify signature using Razorpay client utility and constant-time compare
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

        # Fallback constant-time HMAC check
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

        # 4. Atomic idempotent enrollment
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

            if locked_payment.course:
                enrollment, _ = Enrollment.objects.get_or_create(
                    user=request.user,
                    course=locked_payment.course,
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
            'enrolled': bool(locked_payment.course),
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
            logger.error("Razorpay keys missing")
            return Response({'error': 'Webhook secret unconfigured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        raw_body = request.body.decode('utf-8') if isinstance(request.body, bytes) else str(request.body)

        try:
            client = get_razorpay_client()
            client.utility.verify_webhook_signature(raw_body, signature, webhook_secret)
        except (razorpay.errors.SignatureVerificationError, ValueError):
            # Constant-time comparison fallback
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
                payment = Payment.objects.filter(razorpay_order_id=order_id).first()
                if payment:
                    with transaction.atomic():
                        locked = Payment.objects.select_for_update().get(id=payment.id)
                        if locked.status != Payment.Status.PAID:
                            locked.status = Payment.Status.PAID
                            if payment_id:
                                locked.razorpay_payment_id = payment_id
                            locked.paid_at = timezone.now()
                            locked.save(update_fields=['status', 'razorpay_payment_id', 'paid_at'])

                            if locked.course:
                                enrollment, _ = Enrollment.objects.get_or_create(
                                    user=locked.user,
                                    course=locked.course,
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
    Admin-only paginated listing of all payment transactions.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related('user', 'course').all().order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.lower())
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(user__email__icontains=search) |
                models.Q(course__title__icontains=search) |
                models.Q(razorpay_order_id__icontains=search) |
                models.Q(razorpay_payment_id__icontains=search)
            )
        return qs
