import io
import uuid
import tempfile
import logging
from PIL import Image
from django.conf import settings
from rest_framework.exceptions import ValidationError
from apps.core.exceptions import R2StorageNotConfiguredError
from storage.service import storage_service

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_FORMATS = {'JPEG', 'PNG', 'WEBP'}

def process_and_upload_course_image(uploaded_file, filename_hint: str = "course") -> tuple[str, str]:
    """
    Validates, compresses, and uploads a course cover image to Cloudflare R2 public bucket:
    1. Validates size <= 5 MB.
    2. Verifies real image integrity with Pillow.
    3. Verifies format is JPG, PNG, or WebP.
    4. Auto-resizes to max 1200px width with high-quality Lanczos resampling.
    5. Strips all EXIF metadata for privacy and size reduction.
    6. Converts to optimized WebP format (quality 85).
    7. Uploads via StorageService to Cloudflare R2 public bucket under 'images/courses/<uuid>.webp'.
    8. Saves and returns the permanent URL R2_PUBLIC_URL/<object_key>. Never saves a presigned URL.
    9. When settings.DEBUG is False, removes local-disk fallback; raises R2StorageNotConfiguredError on failure.
    
    Returns:
        tuple (image_url, object_key)
    """
    file_size = getattr(uploaded_file, 'size', None)
    if file_size is None:
        try:
            uploaded_file.seek(0, io.SEEK_END)
            file_size = uploaded_file.tell()
            uploaded_file.seek(0)
        except (OSError, IOError, AttributeError):
            file_size = 0

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            f"Image file size cannot exceed 5 MB. Current file size: {file_size / (1024 * 1024):.2f} MB"
        )

    try:
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        img.verify()
        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
    except Exception as e:
        logger.warning(f"Invalid image upload attempt: {e}")
        raise ValidationError("Uploaded file is not a valid or readable image.")

    image_format = (img.format or '').upper()
    if image_format not in ALLOWED_FORMATS:
        raise ValidationError(
            f"Unsupported image format: {image_format}. Allowed formats are JPG, PNG, and WebP."
        )

    # Auto-resize to max 1200px width
    if img.width > 1200:
        ratio = 1200.0 / float(img.width)
        new_height = max(1, int(round(float(img.height) * ratio)))
        img = img.resize((1200, new_height), Image.Resampling.LANCZOS)

    if img.mode in ('RGBA', 'LA'):
        converted_img = img
    elif img.mode != 'RGB':
        converted_img = img.convert('RGB')
    else:
        converted_img = img

    buffer = io.BytesIO()
    converted_img.save(buffer, format='WEBP', quality=85, method=6)
    webp_bytes = buffer.getvalue()

    unique_name = f"{uuid.uuid4().hex}.webp"
    object_key = f"images/courses/{unique_name}"

    with tempfile.NamedTemporaryFile(suffix=".webp", delete=True) as temp_dest:
        temp_dest.write(webp_bytes)
        temp_dest.flush()
        
        uploaded = storage_service.upload_public_file(temp_dest.name, object_key, content_type="image/webp")
        if not uploaded:
            if not settings.DEBUG:
                logger.error("R2 public upload failed for course image %s in production", object_key)
                raise R2StorageNotConfiguredError("File storage (R2) is not configured. Add the R2_* environment variables.")
            import os
            media_courses_dir = os.path.join(settings.MEDIA_ROOT, 'courses')
            os.makedirs(media_courses_dir, exist_ok=True)
            local_path = os.path.join(media_courses_dir, unique_name)
            with open(local_path, "wb") as f:
                f.write(webp_bytes)
            logger.info("Saved course image locally as dev fallback: %s", local_path)
            image_url = f"{settings.MEDIA_URL.rstrip('/')}/courses/{unique_name}"
            return image_url, object_key

    r2_public_url = getattr(settings, 'R2_PUBLIC_URL', '').rstrip('/')
    if r2_public_url:
        image_url = f"{r2_public_url}/{object_key}"
    else:
        if not settings.DEBUG:
            logger.error("R2_PUBLIC_URL is not configured in production")
            raise R2StorageNotConfiguredError("File storage (R2) is not configured. Add the R2_* environment variables.")
        public_bucket = getattr(settings, 'R2_PUBLIC_BUCKET_NAME', '') or getattr(settings, 'R2_BUCKET_NAME', 'adepteduverse-storage')
        image_url = f"https://{public_bucket}.r2.cloudflarestorage.com/{object_key}"

    return image_url, object_key
