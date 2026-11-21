import hmac
import hashlib
import uuid
import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
import razorpay

logger = logging.getLogger(__name__)

def get_razorpay_client():
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', '').strip()
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '').strip()
    if not key_id or not key_secret:
        raise ValueError("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.")
    return razorpay.Client(auth=(key_id, key_secret))

class CreateOrderView(APIView):
    """
    POST /api/create-order or /api/payments/create-order/
    Creates a new Razorpay order.
    Amount must be at least 100 paise (₹1.00). Defaults to 100 paise (₹1).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            # Amount in paise (minimum 100 paise = ₹1.00)
            raw_amount = request.data.get('amount', 100)
            try:
                amount = int(raw_amount)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid amount. Must be an integer representing paise (minimum 100).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if amount < 100:
                return Response(
                    {'error': 'Amount must be at least 100 paise (₹1.00).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            currency = request.data.get('currency', 'INR').upper()
            receipt = request.data.get('receipt') or f"rcpt_{uuid.uuid4().hex[:12]}"

            notes = request.data.get('notes', {})
            if not isinstance(notes, dict):
                notes = {}

            if request.user and request.user.is_authenticated:
                notes['user_id'] = str(request.user.id)
                notes['email'] = request.user.email
                if getattr(request.user, 'full_name', None):
                    notes['name'] = request.user.full_name

            course_id = request.data.get('course_id')
            if course_id:
                notes['course_id'] = str(course_id)

            client = get_razorpay_client()
            order_data = {
                'amount': amount,
                'currency': currency,
                'receipt': receipt,
                'notes': notes,
            }

            order = client.order.create(data=order_data)
            logger.info("Razorpay order created: %s for amount %s %s", order['id'], amount, currency)

            return Response({
                'order_id': order['id'],
                'amount': order['amount'],
                'currency': order['currency'],
                'key_id': getattr(settings, 'RAZORPAY_KEY_ID', ''),
                'receipt': order.get('receipt', receipt),
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            logger.error("Configuration error in CreateOrderView: %s", e)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except razorpay.errors.BadRequestError as e:
            logger.error("Razorpay BadRequestError: %s", e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except razorpay.errors.SignatureVerificationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except razorpay.errors.RazorpayError as e:
            logger.error("Razorpay API error: %s", e)
            return Response({'error': f"Razorpay API error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.exception("Unexpected error creating Razorpay order: %s", e)
            return Response({'error': f"Failed to create order: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyPaymentView(APIView):
    """
    POST /api/verify-payment or /api/payments/verify-payment/
    Verifies payment signature using HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id') or data.get('order_id')
        razorpay_payment_id = data.get('razorpay_payment_id') or data.get('payment_id')
        razorpay_signature = data.get('razorpay_signature') or data.get('signature')

        # Validate presence of required fields
        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            return Response({
                'success': False,
                'error': 'Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '').strip()
        if not key_secret:
            return Response({
                'success': False,
                'error': 'Server payment credentials are not configured.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Generate HMAC-SHA256 signature
        # Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
        secret = key_secret.encode('utf-8')
        generated_signature = hmac.new(
            secret,
            msg,
            hashlib.sha256
        ).hexdigest()

        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(generated_signature, razorpay_signature):
            logger.warning(
                "Razorpay signature mismatch for order %s and payment %s",
                razorpay_order_id,
                razorpay_payment_id
            )
            return Response({
                'success': False,
                'error': 'Payment verification failed: Signature mismatch.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Signature is valid!
        logger.info(
            "Razorpay payment verified successfully! Order: %s, Payment: %s",
            razorpay_order_id,
            razorpay_payment_id
        )

        # If a course_id was passed and user is authenticated, enroll the user
        course_id = data.get('course_id')
        enrolled = False
        course_title = None

        if course_id and request.user and request.user.is_authenticated:
            try:
                from apps.academics.models import Course, Enrollment
                course = Course.objects.filter(id=course_id).first() or Course.objects.filter(slug=course_id).first()
                if course:
                    enrollment, created = Enrollment.objects.get_or_create(
                        user=request.user,
                        course=course,
                        defaults={'status': 'ACTIVE'}
                    )
                    if not created and enrollment.status != 'ACTIVE':
                        enrollment.status = 'ACTIVE'
                        enrollment.save(update_fields=['status'])
                    enrolled = True
                    course_title = course.title
            except Exception as e:
                logger.error("Failed to enroll user after payment verification: %s", e)

        return Response({
            'success': True,
            'message': 'Payment verified successfully.',
            'order_id': razorpay_order_id,
            'payment_id': razorpay_payment_id,
            'enrolled': enrolled,
            'course_title': course_title,
        }, status=status.HTTP_200_OK)
