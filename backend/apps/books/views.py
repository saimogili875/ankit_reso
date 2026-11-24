import csv
import hmac
import uuid
import hashlib
import logging
from decimal import Decimal
from datetime import timedelta

from django.conf import settings
from django.db import transaction, models
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from django.shortcuts import get_object_or_404
import razorpay

from rest_framework import generics, viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from apps.accounts.permissions import IsAdminRole
from .models import BookProduct, BookOrder
from .serializers import (
    BookProductPublicSerializer,
    BookProductAdminSerializer,
    BookOrderCreateSerializer,
    BookOrderPublicSerializer,
    BookOrderAdminSerializer,
    BookOrderUpdateShippingSerializer,
)
from .services import (
    get_book_download_url,
    process_and_upload_book_cover,
    upload_book_pdf_private,
    generate_cover_from_pdf,
    send_order_confirmation_email,
    send_admin_order_notification,
    send_shipping_update_email,
)

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
        logger.error("Razorpay API credentials not configured in environment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing).")
        raise ValueError("Payment gateway credentials unconfigured.")
    return razorpay.Client(auth=(key_id, key_secret))


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ==============================================================================
# PUBLIC GUEST-FACING BOOKS ENDPOINTS
# ==============================================================================

class BookProductListView(generics.ListAPIView):
    """
    GET /api/books/
    Returns list of all published books sorted by display_order.
    Strictly excludes pdf_key.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BookProductPublicSerializer
    queryset = BookProduct.objects.filter(is_published=True).order_by('display_order', 'created_at')


class BookProductDetailView(generics.RetrieveAPIView):
    """
    GET /api/books/<slug>/
    Returns single published book details.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BookProductPublicSerializer
    queryset = BookProduct.objects.filter(is_published=True)
    lookup_field = 'slug'


class BookOrderCreateView(APIView):
    """
    POST /api/books/orders/
    Guest checkout endpoint: initiates purchase for a digital or physical book.
    Prices and GST are strictly computed on the server from the database.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = BookOrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        product_slug = data['product_slug']
        order_format = data['format']

        try:
            product = BookProduct.objects.get(slug=product_slug, is_published=True)
        except BookProduct.DoesNotExist:
            return Response({'error': f"Book '{product_slug}' not found or unpublished."}, status=status.HTTP_404_NOT_FOUND)

        # Server-side pricing calculation
        if order_format == BookOrder.Format.HARDCOPY:
            base_amount = product.hardcopy_price
            if product.stock_hardcopy is not None and product.stock_hardcopy <= 0:
                return Response({'error': "Hard copy is currently out of stock."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            base_amount = product.digital_price

        gst_percent = product.gst_percent or Decimal('18.00')
        gst_amount = round(base_amount * (gst_percent / Decimal('100.00')), 2)
        total_amount = base_amount + gst_amount
        total_amount_paise = int(round(float(total_amount) * 100))

        # Initialize Razorpay order
        try:
            key_id, _ = get_razorpay_keys()
            client = get_razorpay_client()
        except ValueError as e:
            logger.exception("Book checkout failed due to missing gateway credentials: %s", e)
            return Response({'error': 'Payment gateway service is currently unavailable. Please contact support.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        public_order_id = uuid.uuid4()
        receipt = f"bk_{public_order_id.hex[:12]}"
        notes = {
            'order_public_id': str(public_order_id),
            'product_slug': product.slug,
            'format': order_format,
            'buyer_phone': data['buyer_phone'],
        }

        try:
            rzp_order = client.order.create({
                'amount': total_amount_paise,
                'currency': 'INR',
                'receipt': receipt,
                'notes': notes,
            })
        except Exception as exc:
            logger.exception("Failed to create Razorpay order for book checkout: %s", exc)
            return Response({'error': 'Payment gateway error initiating order. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Client IP for audit
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')

        # Create BookOrder record
        book_order = BookOrder.objects.create(
            public_id=public_order_id,
            product=product,
            format=order_format,
            buyer_name=data['buyer_name'],
            buyer_phone=data['buyer_phone'],
            buyer_email=data['buyer_email'],
            shipping_address=data.get('shipping_address', ''),
            city=data.get('city', ''),
            state=data.get('state', ''),
            pincode=data.get('pincode', ''),
            base_amount=base_amount,
            gst_amount=gst_amount,
            total_amount_paise=total_amount_paise,
            razorpay_order_id=rzp_order['id'],
            status=BookOrder.Status.CREATED,
            shipping_status=BookOrder.ShippingStatus.NA if order_format == BookOrder.Format.DIGITAL else BookOrder.ShippingStatus.PENDING,
            ip_address=ip,
            user=request.user if request.user.is_authenticated else None,
        )

        return Response({
            'order_public_id': str(book_order.public_id),
            'razorpay_order_id': rzp_order['id'],
            'amount_paise': total_amount_paise,
            'currency': 'INR',
            'key_id': key_id,
            'product': {
                'title': product.title,
                'slug': product.slug,
                'format': order_format,
                'base_amount': float(base_amount),
                'gst_amount': float(gst_amount),
                'total_amount': float(total_amount),
            }
        }, status=status.HTTP_201_CREATED)


class BookOrderVerifyView(APIView):
    """
    POST /api/books/orders/verify/
    Verifies Razorpay payment signature, marks order PAID idempotently,
    generates secure download tokens for digital books, and triggers email receipts.
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

        order = BookOrder.objects.filter(razorpay_order_id=razorpay_order_id).select_related('product').first()
        if not order:
            return Response({'error': 'Book order not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency check: if order is already marked PAID, return existing details immediately
        if order.status == BookOrder.Status.PAID:
            return Response({
                'success': True,
                'message': 'Order already verified.',
                'order_public_id': str(order.public_id),
                'format': order.format,
                'invoice_number': order.invoice_number,
                'download_token': order.download_token if order.format == BookOrder.Format.DIGITAL else None,
                'download_url': f"/api/books/orders/{order.public_id}/download/?token={order.download_token}" if order.format == BookOrder.Format.DIGITAL and order.download_token else None,
            }, status=status.HTTP_200_OK)

        _, key_secret = get_razorpay_keys()
        if not key_secret:
            logger.error("RAZORPAY_KEY_SECRET missing during book order verify.")
            return Response({'error': 'Payment gateway credentials unconfigured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Verify HMAC signature
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
            return Response({'error': 'Invalid payment signature.'}, status=status.HTTP_400_BAD_REQUEST)

        # Optional: check payment status and amount with Razorpay API
        try:
            client = get_razorpay_client()
            payment_info = client.payment.fetch(razorpay_payment_id)
            if payment_info.get('status') not in ('captured', 'authorized'):
                return Response({'error': f"Payment status '{payment_info.get('status')}' is not authorized/captured."}, status=status.HTTP_400_BAD_REQUEST)
            paid_amount = payment_info.get('amount')
            if paid_amount != order.total_amount_paise:
                logger.error("Payment amount mismatch for order %s: expected %s, got %s", order.public_id, order.total_amount_paise, paid_amount)
                return Response({'error': 'Paid amount mismatch.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.warning("Could not fetch payment from Razorpay API (proceeding with HMAC check): %s", exc)

        # Atomic finalize
        with transaction.atomic():
            locked = BookOrder.objects.select_for_update().get(id=order.id)
            if locked.status == BookOrder.Status.PAID:
                # Race condition handled
                return Response({
                    'success': True,
                    'order_public_id': str(locked.public_id),
                    'format': locked.format,
                    'invoice_number': locked.invoice_number,
                }, status=status.HTTP_200_OK)

            locked.status = BookOrder.Status.PAID
            locked.razorpay_payment_id = razorpay_payment_id
            locked.razorpay_signature = razorpay_signature
            locked.paid_at = timezone.now()

            # Invoice number: INV-BK-YYYYMMDD-XXXX
            today_str = timezone.now().strftime('%Y%m%d')
            locked.invoice_number = f"INV-BK-{today_str}-{locked.public_id.hex[:4].upper()}"

            if locked.format == BookOrder.Format.DIGITAL:
                locked.download_token = uuid.uuid4().hex + uuid.uuid4().hex  # 64-char secure token
                locked.download_expires_at = timezone.now() + timedelta(days=7)
                locked.shipping_status = BookOrder.ShippingStatus.NA
            else:
                locked.shipping_status = BookOrder.ShippingStatus.PENDING
                if locked.product.stock_hardcopy is not None and locked.product.stock_hardcopy > 0:
                    locked.product.stock_hardcopy -= 1
                    locked.product.save(update_fields=['stock_hardcopy'])

            locked.save()

        # Send notifications asynchronously/safely
        send_order_confirmation_email(locked)
        send_admin_order_notification(locked)

        download_url = None
        if locked.format == BookOrder.Format.DIGITAL:
            download_url = f"/api/books/orders/{locked.public_id}/download/?token={locked.download_token}"

        return Response({
            'success': True,
            'message': 'Book purchase verified successfully.',
            'order_public_id': str(locked.public_id),
            'format': locked.format,
            'invoice_number': locked.invoice_number,
            'download_token': locked.download_token if locked.format == BookOrder.Format.DIGITAL else None,
            'download_url': download_url,
        }, status=status.HTTP_200_OK)


class BookWebhookView(APIView):
    """
    POST /api/books/webhook/
    Listens for Razorpay webhook events ('payment.captured' or 'order.paid').
    Verifies raw body signature and idempotently marks order PAID.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        if not webhook_secret:
            logger.error("RAZORPAY_WEBHOOK_SECRET not configured.")
            return Response({'error': 'Webhook secret unconfigured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        signature = request.headers.get('X-Razorpay-Signature') or request.META.get('HTTP_X_RAZORPAY_SIGNATURE')
        if not signature:
            return Response({'error': 'Missing X-Razorpay-Signature header.'}, status=status.HTTP_400_BAD_REQUEST)

        body = request.body
        expected_sig = hmac.new(webhook_secret.encode('utf-8'), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, signature):
            logger.warning("Invalid Razorpay webhook signature attempt.")
            return Response({'error': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)

        event = request.data.get('event')
        payload = request.data.get('payload', {})

        if event in ('payment.captured', 'order.paid'):
            payment_entity = payload.get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id') or payload.get('order', {}).get('entity', {}).get('id')
            payment_id = payment_entity.get('id')

            if order_id:
                order = BookOrder.objects.filter(razorpay_order_id=order_id).select_related('product').first()
                if order and order.status != BookOrder.Status.PAID:
                    with transaction.atomic():
                        locked = BookOrder.objects.select_for_update().get(id=order.id)
                        if locked.status != BookOrder.Status.PAID:
                            locked.status = BookOrder.Status.PAID
                            locked.razorpay_payment_id = payment_id or locked.razorpay_payment_id
                            locked.paid_at = timezone.now()
                            today_str = timezone.now().strftime('%Y%m%d')
                            locked.invoice_number = f"INV-BK-{today_str}-{locked.public_id.hex[:4].upper()}"

                            if locked.format == BookOrder.Format.DIGITAL:
                                if not locked.download_token:
                                    locked.download_token = uuid.uuid4().hex + uuid.uuid4().hex
                                    locked.download_expires_at = timezone.now() + timedelta(days=7)
                                locked.shipping_status = BookOrder.ShippingStatus.NA
                            else:
                                locked.shipping_status = BookOrder.ShippingStatus.PENDING

                            locked.save()

                    send_order_confirmation_email(locked)
                    send_admin_order_notification(locked)

        return Response({'status': 'ok'}, status=status.HTTP_200_OK)


class BookOrderDownloadView(APIView):
    """
    GET /api/books/orders/<public_id>/download/?token=<download_token>
    Verifies order is PAID, format is DIGITAL, token matches, expiry has not passed,
    and download limit has not been exceeded.
    Returns 302 redirect to 10-minute presigned R2 URL, or JSON URL if requested.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, public_id):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'Missing download token.'}, status=status.HTTP_400_BAD_REQUEST)

        order = BookOrder.objects.filter(
            public_id=public_id,
            status=BookOrder.Status.PAID,
            format=BookOrder.Format.DIGITAL
        ).select_related('product').first()

        if not order:
            return Response({'error': 'Order not found, unpaid, or not a digital purchase.'}, status=status.HTTP_404_NOT_FOUND)

        if not hmac.compare_digest(order.download_token or '', token):
            return Response({'error': 'Invalid download token.'}, status=status.HTTP_403_FORBIDDEN)

        if order.download_expires_at and timezone.now() > order.download_expires_at:
            return Response({'error': 'Download link has expired (7-day validity). Please contact support.'}, status=status.HTTP_410_GONE)

        if order.download_count >= order.max_downloads:
            return Response({
                'error': f'Maximum download limit ({order.max_downloads} downloads) exceeded for this purchase.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Increment download count
        order.download_count += 1
        order.save(update_fields=['download_count'])

        # Generate temporary 10-minute presigned URL
        presigned_url = get_book_download_url(order.product.pdf_key, expiration_seconds=600)
        if not presigned_url:
            return Response({'error': 'PDF file is currently unavailable. Please contact support.'}, status=status.HTTP_404_NOT_FOUND)

        # Check if caller wants JSON (e.g. frontend fetch) or direct redirect
        if request.query_params.get('format') == 'json' or 'application/json' in request.headers.get('Accept', ''):
            return Response({
                'download_url': presigned_url,
                'downloads_remaining': max(0, order.max_downloads - order.download_count),
                'expires_in_seconds': 600,
            })

        return HttpResponseRedirect(presigned_url)


class BookOrderStatusView(generics.RetrieveAPIView):
    """
    GET /api/books/orders/<public_id>/
    Public guest status/receipt endpoint.
    Returns masked buyer details, fulfillment status, and active download link.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BookOrderPublicSerializer
    queryset = BookOrder.objects.all().select_related('product')
    lookup_field = 'public_id'


# ==============================================================================
# ADMIN MANAGEMENT ENDPOINTS (IsAdminRole)
# ==============================================================================

class BookProductAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for institute publication catalog.
    Supports cover image upload and private PDF upload.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = BookProductAdminSerializer
    queryset = BookProduct.objects.all().order_by('display_order', 'created_at')
    pagination_class = AdminPagination

    @action(detail=True, methods=['post'], url_path='upload-cover')
    def upload_cover(self, request, pk=None):
        """Uploads and compresses cover image to WebP in R2."""
        product = self.get_object()
        file_obj = request.FILES.get('cover') or request.FILES.get('image')
        if not file_obj:
            return Response({'error': 'No image file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        image_url, object_key = process_and_upload_book_cover(file_obj, filename_hint=product.slug)
        product.cover_image = image_url
        product.save(update_fields=['cover_image'])

        return Response({
            'message': 'Cover uploaded successfully.',
            'cover_image': image_url,
            'object_key': object_key,
        })

    @action(detail=True, methods=['post'], url_path='upload-pdf')
    def upload_pdf(self, request, pk=None):
        """Uploads private PDF to R2 and optionally generates WebP cover from page 1."""
        product = self.get_object()
        file_obj = request.FILES.get('pdf') or request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No PDF file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        pdf_key = upload_book_pdf_private(file_obj, filename=file_obj.name)
        if not pdf_key:
            return Response({'error': 'Failed to upload PDF.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        product.pdf_key = pdf_key

        # Automatically extract cover if book doesn't already have one
        auto_cover = request.data.get('auto_cover') in ('true', '1', True)
        if auto_cover or not product.cover_image:
            cover_url, _ = generate_cover_from_pdf(file_obj)
            if cover_url:
                product.cover_image = cover_url

        product.save()

        return Response({
            'message': 'PDF uploaded successfully.',
            'pdf_key': pdf_key,
            'cover_image': product.cover_image,
        })


class BookOrderAdminViewSet(viewsets.ModelViewSet):
    """
    Admin management viewset for inspecting and fulfilling book orders.
    Supports filtering, search, CSV export, shipping updates, and email resends.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = BookOrderAdminSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = BookOrder.objects.all().select_related('product', 'user').order_by('-created_at')

        # Filters
        order_status = self.request.query_params.get('status')
        if order_status:
            qs = qs.filter(status=order_status.upper())

        shipping_status = self.request.query_params.get('shipping_status')
        if shipping_status:
            qs = qs.filter(shipping_status=shipping_status.upper())

        order_format = self.request.query_params.get('format')
        if order_format:
            qs = qs.filter(format=order_format.upper())

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(buyer_name__icontains=search) |
                models.Q(buyer_email__icontains=search) |
                models.Q(buyer_phone__icontains=search) |
                models.Q(tracking_id__icontains=search) |
                models.Q(invoice_number__icontains=search) |
                models.Q(razorpay_order_id__icontains=search) |
                models.Q(razorpay_payment_id__icontains=search) |
                models.Q(product__title__icontains=search)
            )

        return qs

    @action(detail=True, methods=['post'], url_path='update-shipping')
    def update_shipping(self, request, pk=None):
        """Updates shipping status, tracking ID, and courier partner."""
        order = self.get_object()
        serializer = BookOrderUpdateShippingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        prev_status = order.shipping_status
        new_status = serializer.validated_data['shipping_status']

        order.shipping_status = new_status
        if 'tracking_id' in serializer.validated_data:
            order.tracking_id = serializer.validated_data['tracking_id'].strip()
        if 'courier' in serializer.validated_data:
            order.courier = serializer.validated_data['courier'].strip()
        if 'admin_note' in serializer.validated_data:
            order.admin_note = serializer.validated_data['admin_note'].strip()

        order.save()

        # If transitioned to SHIPPED, dispatch email to student
        if new_status == BookOrder.ShippingStatus.SHIPPED and prev_status != BookOrder.ShippingStatus.SHIPPED:
            send_shipping_update_email(order)

        return Response({
            'message': 'Shipping details updated successfully.',
            'shipping_status': order.shipping_status,
            'tracking_id': order.tracking_id,
            'courier': order.courier,
        })

    @action(detail=True, methods=['post'], url_path='resend-email')
    def resend_email(self, request, pk=None):
        """Manually re-sends order confirmation / receipt email to student."""
        order = self.get_object()
        success = send_order_confirmation_email(order)
        if success:
            return Response({'message': f"Order receipt successfully resent to {order.buyer_email}."})
        return Response({'error': 'Failed to send email. Check SMTP settings.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='mark-refunded')
    def mark_refunded(self, request, pk=None):
        """Marks the order as REFUNDED and revokes download access."""
        order = self.get_object()
        order.status = BookOrder.Status.REFUNDED
        order.download_expires_at = timezone.now()  # Instantly expire downloads
        order.save(update_fields=['status', 'download_expires_at'])
        return Response({'message': f"Order #{order.public_id} marked as REFUNDED."})

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        """Exports filtered orders as a downloadable CSV spreadsheet."""
        qs = self.get_queryset()

        response = HttpResponse(content_type='text/csv')
        filename = f"book_orders_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'Order Public ID',
            'Invoice No',
            'Date (UTC)',
            'Book Title',
            'Format',
            'Amount (INR)',
            'Status',
            'Buyer Name',
            'Buyer Email',
            'Buyer Phone',
            'Shipping Address',
            'City',
            'State',
            'Pincode',
            'Shipping Status',
            'Courier',
            'Tracking ID',
            'Razorpay Order ID',
            'Razorpay Payment ID',
            'Download Count',
            'Admin Note',
        ])

        for o in qs:
            writer.writerow([
                str(o.public_id),
                o.invoice_number,
                o.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                o.product.title,
                o.format,
                f"{o.total_amount_paise / 100:.2f}",
                o.status,
                o.buyer_name,
                o.buyer_email,
                o.buyer_phone,
                o.shipping_address.replace('\n', ', '),
                o.city,
                o.state,
                o.pincode,
                o.shipping_status,
                o.courier,
                o.tracking_id,
                o.razorpay_order_id,
                o.razorpay_payment_id or '',
                o.download_count,
                o.admin_note,
            ])

        return response
