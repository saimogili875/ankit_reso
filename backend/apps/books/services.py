import os
import io
import re
import uuid
import secrets
import hashlib
import logging
import tempfile
from typing import Optional, Tuple
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.db import transaction, models
from django.core.cache import cache
from django.core.mail import EmailMultiAlternatives
from rest_framework.exceptions import ValidationError
from storage.service import storage_service

logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}


def normalize_indian_phone(phone_str: str) -> str:
    """
    Normalizes an Indian mobile phone number:
    - Strips spaces, dashes, parentheses, dots.
    - Accepts standard 10 digits starting with 6, 7, 8, 9.
    - Strips leading 0 or +91 / 91 country codes.
    - Returns standardized '+91XXXXXXXXXX'.
    - Raises ValidationError if invalid.
    """
    if not phone_str:
        raise ValidationError("Phone number is required.")
    
    cleaned = re.sub(r'[\s\-\(\)\.]', '', str(phone_str))
    if cleaned.startswith('+91'):
        cleaned = cleaned[3:]
    elif cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith('0') and len(cleaned) == 11:
        cleaned = cleaned[1:]

    if not re.match(r'^[6-9]\d{9}$', cleaned):
        raise ValidationError("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.")

    return f"+91{cleaned}"


def get_client_ip(request) -> str:
    """
    Extracts client IP using NUM_PROXIES setting (defaults to 2):
    takes the Nth address from the right of X-Forwarded-For header,
    falling back to REMOTE_ADDR.
    """
    num_proxies = 2
    if hasattr(settings, 'REST_FRAMEWORK') and isinstance(settings.REST_FRAMEWORK, dict):
        num_proxies = settings.REST_FRAMEWORK.get('NUM_PROXIES', 2)
    elif hasattr(settings, 'NUM_PROXIES'):
        num_proxies = getattr(settings, 'NUM_PROXIES', 2)

    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        parts = [p.strip() for p in xff.split(',') if p.strip()]
        if parts:
            idx = min(num_proxies, len(parts))
            return parts[-idx]

    return request.META.get('REMOTE_ADDR') or ''


def generate_next_invoice_number(now_dt=None) -> str:
    """
    Generates next sequential invoice number: INV-BK-YYYYMMDD-0001
    Guarantees uniqueness across concurrent transactions via select_for_update().
    """
    from .models import InvoiceSequence
    if now_dt is None:
        now_dt = timezone.now()
    date_str = now_dt.strftime('%Y%m%d')

    seq_obj, _ = InvoiceSequence.objects.select_for_update().get_or_create(
        date_str=date_str,
        defaults={'last_seq': 0}
    )
    seq_obj.last_seq += 1
    seq_obj.save(update_fields=['last_seq'])

    return f"INV-BK-{date_str}-{seq_obj.last_seq:04d}"


def finalize_book_order(order_or_id, payment_id: str, signature: Optional[str] = None) -> Tuple[object, Optional[str]]:
    """
    Idempotently finalizes a BookOrder upon verified payment.
    - Locked transaction with select_for_update().
    - If already PAID, returns (order, cached_raw_token).
    - Checks hardcopy stock: if out of stock, flags admin_note and raises ValidationError for manual refund.
    - Decrements hardcopy stock using F() atomic expression.
    - Generates sequential invoice number: INV-BK-YYYYMMDD-0001 via InvoiceSequence.
    - For digital books: generates secure 64-char raw token, stores SHA-256 hash in DB, caches raw token.
    - Dispatches confirmation email (with raw token) and admin notification.
    - Returns (locked_order, raw_download_token).
    """
    from .models import BookOrder, BookProduct
    order_id = order_or_id.id if hasattr(order_or_id, 'id') else order_or_id
    raw_token = None

    with transaction.atomic():
        locked = BookOrder.objects.select_for_update().select_related('product').get(id=order_id)

        # Idempotency check: if already PAID, return without duplicating invoice, tokens, or stock
        if locked.status == BookOrder.Status.PAID:
            cached_token = cache.get(f"book_raw_token_{locked.id}")
            return locked, cached_token

        is_out_of_stock = False
        # Check hardcopy stock
        if locked.format == BookOrder.Format.HARDCOPY:
            if locked.product.stock_hardcopy is not None:
                if locked.product.stock_hardcopy <= 0:
                    locked.admin_note = (locked.admin_note + "\nREFUND_REQUIRED: Out of stock at payment verification.").strip()
                    if payment_id:
                        locked.razorpay_payment_id = payment_id
                    locked.save(update_fields=['admin_note', 'razorpay_payment_id'])
                    is_out_of_stock = True
                else:
                    # Atomic decrement using F() expression
                    BookProduct.objects.filter(id=locked.product_id).update(stock_hardcopy=models.F('stock_hardcopy') - 1)
                    locked.product.refresh_from_db(fields=['stock_hardcopy'])

        if not is_out_of_stock:
            locked.status = BookOrder.Status.PAID
            locked.razorpay_payment_id = payment_id or locked.razorpay_payment_id
            if signature:
                locked.razorpay_signature = signature
            locked.paid_at = timezone.now()

            # Generate unique sequential invoice number
            locked.invoice_number = generate_next_invoice_number(locked.paid_at)

            if locked.format == BookOrder.Format.DIGITAL:
                raw_token = secrets.token_hex(32)  # 64 hex characters
                token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
                locked.download_token = token_hash
                locked.download_expires_at = timezone.now() + timedelta(days=7)
                locked.shipping_status = BookOrder.ShippingStatus.NA
                # Cache raw token for 7 days so subsequent verify calls can return the raw token
                cache.set(f"book_raw_token_{locked.id}", raw_token, timeout=86400 * 7)
            else:
                locked.shipping_status = BookOrder.ShippingStatus.PENDING

            locked.save()

    if is_out_of_stock:
        raise ValidationError("Hard copy is currently out of stock. Order flagged for manual refund.")

    # Outside atomic block: send notifications safely
    send_order_confirmation_email(locked, raw_download_token=raw_token)
    send_admin_order_notification(locked)

    return locked, raw_token



def get_book_download_url(pdf_key: str, expiration_seconds: int = 600) -> Optional[str]:
    """
    Generates a secure, temporary presigned URL for downloading a purchased PDF (10 minutes default).
    Does not expose storage credentials or buckets.
    """
    if not pdf_key:
        return None

    try:
        url = storage_service.provider.generate_presigned_url(
            pdf_key,
            expiration=expiration_seconds,
            client_method='get_object'
        )
        if url:
            return url
    except Exception as e:
        logger.warning("Failed to generate presigned R2 URL for %s: %s", pdf_key, e)

    # Local development / media fallback
    local_path = os.path.join(settings.MEDIA_ROOT, 'books', 'pdfs', os.path.basename(pdf_key))
    if os.path.exists(local_path):
        return f"{settings.MEDIA_URL.rstrip('/')}/books/pdfs/{os.path.basename(pdf_key)}"

    return None


def process_and_upload_book_cover(uploaded_file, filename_hint: str = "book-cover") -> Tuple[str, str]:
    """
    Validates, optimizes, and uploads a book cover image to Cloudflare R2:
    - Validates size <= 5 MB.
    - Verifies image integrity with Pillow.
    - Converts to high-quality WebP (85 quality).
    - Uploads under images/books/<uuid>.webp.
    - Returns (image_url, object_key).
    """
    file_size = getattr(uploaded_file, 'size', None)
    if file_size is None:
        try:
            uploaded_file.seek(0, io.SEEK_END)
            file_size = uploaded_file.tell()
            uploaded_file.seek(0)
        except (OSError, IOError, AttributeError):
            file_size = 0

    if file_size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(
            f"Image file size cannot exceed 5 MB. Current file size: {file_size / (1024 * 1024):.2f} MB"
        )

    try:
        from PIL import Image
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img.verify()
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
    except Exception as e:
        logger.warning("Invalid image upload attempt: %s", e)
        raise ValidationError("Uploaded file is not a valid or readable image.")

    image_format = (img.format or '').upper()
    if image_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(
            f"Unsupported image format: {image_format}. Allowed formats are JPG, PNG, and WebP."
        )

    # Convert RGBA/palette to RGB if necessary for clean WebP
    if img.mode in ('RGBA', 'LA'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if unusually large (max 1600px width/height)
    max_dimension = 1600
    if img.width > max_dimension or img.height > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format='WEBP', quality=85, method=6)
    webp_bytes = buf.getvalue()

    unique_name = f"{uuid.uuid4().hex}.webp"
    object_key = f"images/books/{unique_name}"

    with tempfile.NamedTemporaryFile(suffix=".webp", delete=True) as temp_dest:
        temp_dest.write(webp_bytes)
        temp_dest.flush()
        uploaded = storage_service.upload_file_direct(temp_dest.name, object_key, content_type="image/webp")

    if not uploaded:
        media_dir = os.path.join(settings.MEDIA_ROOT, 'books', 'covers')
        os.makedirs(media_dir, exist_ok=True)
        local_path = os.path.join(media_dir, unique_name)
        with open(local_path, "wb") as f:
            f.write(webp_bytes)
        image_url = f"{settings.MEDIA_URL.rstrip('/')}/books/covers/{unique_name}"
        return image_url, object_key

    r2_public_url = getattr(settings, 'R2_PUBLIC_URL', '').rstrip('/')
    if r2_public_url:
        image_url = f"{r2_public_url}/{object_key}"
    else:
        presigned = storage_service.provider.generate_presigned_url(object_key, expiration=86400 * 30)
        image_url = presigned or f"https://{settings.R2_BUCKET_NAME}.r2.cloudflarestorage.com/{object_key}"

    return image_url, object_key


def generate_cover_from_pdf(pdf_file_or_bytes) -> Tuple[Optional[str], Optional[str]]:
    """
    Renders page 1 of a PDF into an optimized WebP cover image using pypdfium2.
    Uploads the resulting image to R2 (or media fallback) and returns (image_url, object_key).
    """
    try:
        import pypdfium2 as pdfium
        from PIL import Image

        if isinstance(pdf_file_or_bytes, (bytes, bytearray)):
            doc = pdfium.PdfDocument(pdf_file_or_bytes)
        elif hasattr(pdf_file_or_bytes, 'read'):
            raw_bytes = pdf_file_or_bytes.read()
            if hasattr(pdf_file_or_bytes, 'seek'):
                pdf_file_or_bytes.seek(0)
            doc = pdfium.PdfDocument(raw_bytes)
        elif isinstance(pdf_file_or_bytes, str) and os.path.exists(pdf_file_or_bytes):
            doc = pdfium.PdfDocument(pdf_file_or_bytes)
        else:
            logger.error("Invalid PDF input for cover generation: %s", type(pdf_file_or_bytes))
            return None, None

        if len(doc) == 0:
            logger.warning("PDF document has 0 pages, cannot generate cover.")
            return None, None

        page = doc[0]
        pil_image = page.render(scale=2).to_pil()

        if pil_image.mode in ('RGBA', 'LA'):
            bg = Image.new('RGB', pil_image.size, (255, 255, 255))
            bg.paste(pil_image, mask=pil_image.split()[-1])
            pil_image = bg
        elif pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')

        buf = io.BytesIO()
        pil_image.save(buf, format='WEBP', quality=85, method=6)
        webp_bytes = buf.getvalue()

        unique_name = f"{uuid.uuid4().hex}.webp"
        object_key = f"images/books/{unique_name}"

        with tempfile.NamedTemporaryFile(suffix=".webp", delete=True) as temp_dest:
            temp_dest.write(webp_bytes)
            temp_dest.flush()
            uploaded = storage_service.upload_file_direct(temp_dest.name, object_key, content_type="image/webp")

        if not uploaded:
            media_dir = os.path.join(settings.MEDIA_ROOT, 'books', 'covers')
            os.makedirs(media_dir, exist_ok=True)
            local_path = os.path.join(media_dir, unique_name)
            with open(local_path, "wb") as f:
                f.write(webp_bytes)
            image_url = f"{settings.MEDIA_URL.rstrip('/')}/books/covers/{unique_name}"
            return image_url, object_key

        r2_public_url = getattr(settings, 'R2_PUBLIC_URL', '').rstrip('/')
        if r2_public_url:
            image_url = f"{r2_public_url}/{object_key}"
        else:
            presigned = storage_service.provider.generate_presigned_url(object_key, expiration=86400 * 30)
            image_url = presigned or f"https://{settings.R2_BUCKET_NAME}.r2.cloudflarestorage.com/{object_key}"

        return image_url, object_key

    except Exception as exc:
        logger.exception("Failed to generate cover image from PDF: %s", exc)
        return None, None


def upload_book_pdf_private(pdf_file, filename: str) -> Optional[str]:
    """
    Uploads a private book PDF to Cloudflare R2 (or local media fallback).
    Returns the private object key (e.g. 'books/pdfs/<uuid>_<filename>').
    Never exposes this key directly to students.
    """
    try:
        clean_name = os.path.basename(filename).replace(' ', '_')
        unique_key = f"books/pdfs/{uuid.uuid4().hex[:12]}_{clean_name}"

        if hasattr(pdf_file, 'read'):
            content = pdf_file.read()
            if hasattr(pdf_file, 'seek'):
                pdf_file.seek(0)
        else:
            content = bytes(pdf_file)

        if len(content) > MAX_PDF_SIZE_BYTES:
            raise ValidationError(f"PDF exceeds maximum allowed size of 100 MB.")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as temp_dest:
            temp_dest.write(content)
            temp_dest.flush()
            uploaded = storage_service.upload_file_direct(temp_dest.name, unique_key, content_type="application/pdf")

        if not uploaded:
            media_dir = os.path.join(settings.MEDIA_ROOT, 'books', 'pdfs')
            os.makedirs(media_dir, exist_ok=True)
            local_path = os.path.join(media_dir, os.path.basename(unique_key))
            with open(local_path, "wb") as f:
                f.write(content)
            return unique_key

        return unique_key

    except Exception as exc:
        logger.exception("Failed to upload book PDF: %s", exc)
        if isinstance(exc, ValidationError):
            raise
        return None


def send_order_confirmation_email(order, raw_download_token: Optional[str] = None) -> bool:
    """
    Sends order receipt & fulfillment instructions to the buyer.
    Never fails the transaction if SMTP fails. Never logs raw download tokens.
    """
    if not order or not order.buyer_email:
        return False

    try:
        product_title = order.product.title
        total_inr = f"₹{order.total_amount_paise / 100:.2f}"
        base_url = (getattr(settings, 'FRONTEND_URL', None) or 'https://adepteduverse.com').strip().rstrip('/')
        if not base_url:
            base_url = 'https://adepteduverse.com'
        token_param = f"?token={raw_download_token}" if raw_download_token else ""
        receipt_url = f"{base_url}/books/order/{order.public_id}{token_param}"

        subject = f"Order Confirmed: {product_title} [{order.get_format_display()}] - {order.invoice_number or str(order.public_id)[:8]}"
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ANKIT JEE <no-reply@adepteduverse.com>')
        to_email = [order.buyer_email]

        if order.format == 'DIGITAL':
            body_text = f"""Hello {order.buyer_name},

Thank you for your purchase from Adept Eduverse!

Order Details:
- Book: {product_title}
- Format: Digital PDF Edition
- Invoice No: {order.invoice_number}
- Total Paid: {total_inr} (incl. 18% GST)
- Payment ID: {order.razorpay_payment_id}

To access and download your PDF edition:
{receipt_url}

Note: Your digital download link is valid for 7 days with a limit of {order.max_downloads} downloads.
We recommend saving your PDF to your device immediately.

Best regards,
Ankit Sir & Team Adept Eduverse
https://adepteduverse.com
"""
            body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">Order Confirmed!</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Adept Eduverse Official Publication</p>
    </div>
    <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p>Dear <strong>{order.buyer_name}</strong>,</p>
        <p>Thank you for your order! Your payment has been verified successfully.</p>
        
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Book:</strong> {product_title}</p>
            <p style="margin: 4px 0;"><strong>Format:</strong> Digital PDF Edition</p>
            <p style="margin: 4px 0;"><strong>Invoice:</strong> {order.invoice_number}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> {total_inr} (incl. 18% GST)</p>
            <p style="margin: 4px 0;"><strong>Payment ID:</strong> {order.razorpay_payment_id}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{receipt_url}" style="background: #2563eb; color: #ffffff; padding: 14px 28px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block;">
                Download Your Book (PDF)
            </a>
        </div>

        <p style="font-size: 13px; color: #64748b;">
            <strong>Important:</strong> Your digital download link is valid for 7 days. You have up to {order.max_downloads} downloads. Please save a copy directly to your laptop or phone.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            Adept Eduverse &bull; Guided by Ankit Sir &bull; support@adepteduverse.com
        </p>
    </div>
</div>
"""
        else:
            shipping_info = f"{order.shipping_address}, {order.city}, {order.state} - {order.pincode}"
            body_text = f"""Hello {order.buyer_name},

Thank you for ordering the physical printed edition from Adept Eduverse!

Order Details:
- Book: {product_title}
- Format: Physical Hard Copy
- Invoice No: {order.invoice_number}
- Total Paid: {total_inr} (incl. 18% GST)
- Payment ID: {order.razorpay_payment_id}
- Delivery Address: {shipping_info}
- Contact Phone: {order.buyer_phone}

Your order is currently being prepared for dispatch. As soon as your package is dispatched, we will send you your courier tracking details.

Track your order anytime:
{receipt_url}

Best regards,
Ankit Sir & Team Adept Eduverse
https://adepteduverse.com
"""
            body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #f8fafc; margin: 0; font-size: 24px;">Order Confirmed!</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Physical Book Dispatch Pending</p>
    </div>
    <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p>Dear <strong>{order.buyer_name}</strong>,</p>
        <p>Thank you for ordering the physical copy of <strong>{product_title}</strong>! Your payment has been received.</p>
        
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Book:</strong> {product_title}</p>
            <p style="margin: 4px 0;"><strong>Format:</strong> Physical Hard Copy</p>
            <p style="margin: 4px 0;"><strong>Invoice:</strong> {order.invoice_number}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> {total_inr} (incl. 18% GST)</p>
            <p style="margin: 4px 0;"><strong>Shipping To:</strong> {shipping_info}</p>
            <p style="margin: 4px 0;"><strong>Mobile:</strong> {order.buyer_phone}</p>
        </div>

        <p>Our team is packaging your book. As soon as it ships via our courier partner, we will email you the tracking number.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{receipt_url}" style="background: #0f172a; color: #ffffff; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Order Status
            </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            Adept Eduverse &bull; Guided by Ankit Sir &bull; support@adepteduverse.com
        </p>
    </div>
</div>
"""

        msg = EmailMultiAlternatives(subject, body_text, from_email, to_email)
        msg.attach_alternative(body_html, "text/html")
        msg.send(fail_silently=True)
        logger.info("Order confirmation email dispatched for order %s to %s", order.public_id, order.buyer_email)
        return True

    except Exception as exc:
        logger.warning("Failed to send order confirmation email for order %s: %s", order.public_id, exc)
        return False


def send_admin_order_notification(order) -> bool:
    """
    Notifies institute admin/staff of a new book order.
    """
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ANKIT JEE <no-reply@adepteduverse.com>')
        admin_email = getattr(settings, 'ORDER_NOTIFICATION_EMAIL', 'orders@adepteduverse.com')
        subject = f"[New Book Order] {order.product.title} - {order.get_format_display()} - {order.buyer_name}"
        total_inr = f"₹{order.total_amount_paise / 100:.2f}"
        
        body = f"""New Book Order Received!

Order ID: {order.public_id}
Invoice No: {order.invoice_number}
Product: {order.product.title}
Format: {order.get_format_display()}
Amount: {total_inr}
Payment ID: {order.razorpay_payment_id}

Buyer Details:
- Name: {order.buyer_name}
- Email: {order.buyer_email}
- Phone: {order.buyer_phone}
"""
        if order.format == 'HARDCOPY':
            body += f"""
Shipping Address:
{order.shipping_address}
{order.city}, {order.state} - {order.pincode}
"""

        msg = EmailMultiAlternatives(subject, body, from_email, [admin_email])
        msg.send(fail_silently=True)
        return True
    except Exception as exc:
        logger.warning("Admin order notification failed for order %s: %s", order.public_id, exc)
        return False


def send_shipping_update_email(order) -> bool:
    """
    Sends dispatch and tracking details to the student when order is SHIPPED.
    """
    if not order or not order.buyer_email or order.format != 'HARDCOPY':
        return False

    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ANKIT JEE <no-reply@adepteduverse.com>')
        to_email = [order.buyer_email]
        subject = f"Your Book Has Shipped! - {order.product.title} [{order.courier or 'Courier'}: {order.tracking_id or 'Dispatched'}]"
        base_url = (getattr(settings, 'FRONTEND_URL', None) or 'https://adepteduverse.com').strip().rstrip('/')
        if not base_url:
            base_url = 'https://adepteduverse.com'
        receipt_url = f"{base_url}/books/order/{order.public_id}"

        body_text = f"""Hello {order.buyer_name},

Great news! Your copy of '{order.product.title}' has been dispatched!

Shipping Details:
- Courier Partner: {order.courier or 'Standard Express'}
- Tracking / Consignment Number: {order.tracking_id or 'Check link below'}
- Current Status: {order.get_shipping_status_display()}

View tracking and live updates:
{receipt_url}

Thank you for choosing Adept Eduverse!
Best regards,
Ankit Sir & Team
"""

        body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Package Dispatched!</h1>
        <p style="color: #d1fae5; margin: 6px 0 0 0; font-size: 14px;">Your book is on its way</p>
    </div>
    <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p>Dear <strong>{order.buyer_name}</strong>,</p>
        <p>We are excited to let you know that your order of <strong>{order.product.title}</strong> has been handed over to our courier partner.</p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Courier:</strong> {order.courier or 'Standard Express'}</p>
            <p style="margin: 4px 0;"><strong>Tracking ID:</strong> <span style="font-family: monospace; font-size: 15px; color: #166534; font-weight: bold;">{order.tracking_id or 'In Transit'}</span></p>
            <p style="margin: 4px 0;"><strong>Status:</strong> {order.get_shipping_status_display()}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{receipt_url}" style="background: #059669; color: #ffffff; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block;">
                Track Package Online
            </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            Adept Eduverse &bull; Guided by Ankit Sir &bull; support@adepteduverse.com
        </p>
    </div>
</div>
"""
        msg = EmailMultiAlternatives(subject, body_text, from_email, to_email)
        msg.attach_alternative(body_html, "text/html")
        msg.send(fail_silently=True)
        return True

    except Exception as exc:
        logger.warning("Failed to send shipping email for order %s: %s", order.public_id, exc)
        return False
