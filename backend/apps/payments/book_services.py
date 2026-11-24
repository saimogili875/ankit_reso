import os
import io
import uuid
import logging
import tempfile
from typing import Optional, Tuple
from django.conf import settings
from storage.service import storage_service

logger = logging.getLogger(__name__)


def generate_cover_from_pdf(pdf_file_or_bytes) -> Tuple[Optional[str], Optional[str]]:
    """
    Renders page 1 of a PDF into an optimized WebP cover image using pypdfium2.
    Uploads the resulting image to R2 (or media fallback) and returns (public_url, object_key).
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

        # Convert to RGB if needed for WebP
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

        # Upload to R2 or save locally in media/books/
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=True) as temp_dest:
            temp_dest.write(webp_bytes)
            temp_dest.flush()
            uploaded = storage_service.upload_file_direct(temp_dest.name, object_key, content_type="image/webp")

        if not uploaded:
            # Fallback to local MEDIA_ROOT
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


def upload_book_pdf_file(pdf_file, filename: str) -> Optional[str]:
    """
    Uploads a PDF file object to Cloudflare R2 (or local media directory)
    under books/pdfs/<uuid>.pdf and returns the private object_key.
    """
    try:
        clean_name = os.path.basename(filename)
        unique_key = f"books/pdfs/{uuid.uuid4().hex[:12]}_{clean_name}"

        if hasattr(pdf_file, 'read'):
            content = pdf_file.read()
            if hasattr(pdf_file, 'seek'):
                pdf_file.seek(0)
        else:
            content = bytes(pdf_file)

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
        return None


def get_book_download_url(pdf_key: str, expiration_seconds: int = 1800) -> Optional[str]:
    """
    Generates a secure, temporary presigned URL for downloading a purchased PDF.
    If R2 is not configured or in local development, checks local MEDIA_ROOT.
    """
    if not pdf_key:
        return None

    # Check R2 presigned URL
    url = storage_service.provider.generate_presigned_url(
        pdf_key,
        expiration=expiration_seconds,
        client_method='get_object'
    )
    if url:
        return url

    # Dev/local fallback: if file exists in MEDIA_ROOT
    local_path = os.path.join(settings.MEDIA_ROOT, 'books', 'pdfs', os.path.basename(pdf_key))
    if os.path.exists(local_path):
        return f"{settings.MEDIA_URL.rstrip('/')}/books/pdfs/{os.path.basename(pdf_key)}"

    return None
