import io
import math
import logging
from typing import Optional, Tuple
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.utils import timezone
from datetime import timedelta
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# Signer with course content scope
signer = TimestampSigner(salt='coursecontent-secure-viewer-v1')


def generate_page_token(user_id: str, item_id: str, page_number: int, is_solution: bool = False) -> str:
    """
    Generates a secure timestamped token tied to user, item, page, and solution mode.
    Expires in 300 seconds (5 minutes).
    """
    payload = f"{user_id}:{item_id}:{page_number}:{int(is_solution)}"
    return signer.sign(payload)


def verify_page_token(token: str, user_id: str, item_id: str, page_number: int, is_solution: bool = False, max_age_seconds: int = 300) -> bool:
    """
    Verifies that the token is valid, matches the user/item/page, and has not expired.
    """
    if not token:
        return False
    try:
        unsigned = signer.unsign(token, max_age=max_age_seconds)
        expected = f"{user_id}:{item_id}:{page_number}:{int(is_solution)}"
        return unsigned == expected
    except (BadSignature, SignatureExpired):
        return False


def get_watermark_position(page_number: int, width: int, height: int) -> Tuple[int, int]:
    """
    Calculates a dynamic, moving watermark coordinate across pages to deter cropping attacks.
    Cycles through 5 distinct positions on the canvas.
    """
    positions = [
        (int(width * 0.15), int(height * 0.20)),
        (int(width * 0.45), int(height * 0.35)),
        (int(width * 0.20), int(height * 0.55)),
        (int(width * 0.50), int(height * 0.70)),
        (int(width * 0.25), int(height * 0.85)),
    ]
    idx = (page_number - 1) % len(positions)
    return positions[idx]


def apply_moving_watermark(image: Image.Image, student_name: str, student_identifier: str, page_number: int) -> Image.Image:
    """
    Applies an indelible, semi-transparent moving watermark with student name, identifier (email/phone),
    and timestamp across the image, plus repeated faint diagonal background patterns.
    """
    # Ensure RGB
    if image.mode != 'RGBA':
        base = image.convert('RGBA')
    else:
        base = image.copy()

    overlay = Image.new('RGBA', base.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    width, height = base.size
    date_str = timezone.now().strftime('%Y-%m-%d %H:%M')
    watermark_text = f"CONFIDENTIAL • {student_name} • {student_identifier} • {date_str} • Page {page_number}"

    # 1. Subtle diagonal repeated watermark grid across entire page
    diag_step_x = max(240, int(width / 3))
    diag_step_y = max(180, int(height / 4))
    faint_color = (180, 180, 180, 35)  # Very faint background pattern

    for y in range(40, height, diag_step_y):
        for x in range(30, width, diag_step_x):
            draw.text((x, y), f"{student_identifier} • AdeptEduverse", fill=faint_color)

    # 2. Prominent moving watermark badge at shifting position
    wx, wy = get_watermark_position(page_number, width, height)
    badge_bg_color = (20, 20, 30, 90)
    badge_text_color = (255, 70, 70, 180)  # High-visibility deterrent red-orange tint

    badge_w = min(width - 40, 520)
    badge_h = 42
    draw.rounded_rectangle(
        [wx - 10, wy - 6, wx + badge_w, wy + badge_h],
        radius=8,
        fill=badge_bg_color,
        outline=(255, 70, 70, 140),
        width=1
    )
    draw.text((wx, wy), watermark_text, fill=badge_text_color)
    draw.text((wx, wy + 18), "DO NOT SHARE • TRACEABLE DIGITAL COPY • LICENSED TO STUDENT", fill=(240, 240, 240, 160))

    # Composite
    watermarked = Image.alpha_composite(base, overlay).convert('RGB')
    return watermarked


def render_pdf_page_to_jpeg(
    pdf_bytes_or_path,
    page_number: int,
    student_name: str,
    student_identifier: str
) -> bytes:
    """
    Renders a single PDF page into a watermarked JPEG byte stream using pypdfium2 + Pillow.
    Falls back to a secure canvas if PDF source is empty or invalid.
    """
    pil_image = None

    if pdf_bytes_or_path:
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(pdf_bytes_or_path)
            total = len(pdf)
            target_idx = max(0, min(page_number - 1, total - 1))
            page = pdf[target_idx]
            # Render at 1.5x scale for crisp reading on mobile & retina
            rendered = page.render(scale=1.5)
            pil_image = rendered.to_pil()
        except Exception as e:
            logger.warning(f"Failed to render PDF with pypdfium2 ({e}), falling back to secure canvas")

    if pil_image is None:
        # Create a clean reading canvas
        width, height = 1200, 1600
        pil_image = Image.new('RGB', (width, height), color=(250, 250, 252))
        draw = ImageDraw.Draw(pil_image)
        draw.text(
            (60, 80),
            f"AdeptEduverse Secure Reader — Page {page_number}",
            fill=(40, 40, 50)
        )
        draw.text(
            (60, 120),
            "Protected Study Material. Server-side watermarking active.",
            fill=(100, 100, 120)
        )

    # Burn moving watermark
    watermarked = apply_moving_watermark(pil_image, student_name, student_identifier, page_number)

    buf = io.BytesIO()
    watermarked.save(buf, format='JPEG', quality=85, optimize=True)
    return buf.getvalue()


def check_and_flag_bulk_viewing(user, item, ip_address: Optional[str], user_agent: str = '') -> bool:
    """
    Logs page access and checks if user has requested excessive pages (>100 pages in 10 minutes).
    If detected, flags the student profile for admin review.
    """
    from .models import ContentItemAccessLog
    from apps.accounts.models import StudentProfile

    now = timezone.now()
    log = ContentItemAccessLog.objects.create(
        user=user,
        item=item,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else ''
    )

    ten_mins_ago = now - timedelta(minutes=10)
    recent_count = ContentItemAccessLog.objects.filter(
        user=user,
        accessed_at__gte=ten_mins_ago
    ).count()

    if recent_count > 100:
        logger.warning(
            f"SECURITY ALERT: Bulk viewing anomaly detected for user {user.id} ({user.email}). "
            f"{recent_count} pages accessed in 10 minutes from IP {ip_address}."
        )
        profile = getattr(user, 'student_profile', None)
        if profile and not profile.is_flagged_bulk_viewing:
            profile.is_flagged_bulk_viewing = True
            profile.save(update_fields=['is_flagged_bulk_viewing'])
        return True

    return False
