import logging
from django.db import transaction
from django.utils import timezone
from apps.academics.models import Enrollment, CourseAddon
from .models import Payment, Entitlement

logger = logging.getLogger(__name__)


def fulfill_payment(payment: Payment, razorpay_payment_id: str = None) -> tuple[Payment, bool]:
    """
    Single source of truth for payment fulfillment.
    Idempotently transitions Payment to PAID, activates Course Enrollment,
    and creates Entitlement records for any purchased add-ons.
    Returns (locked_payment, is_enrolled).
    """
    with transaction.atomic():
        locked_payment = Payment.objects.select_for_update().get(id=payment.id)
        if locked_payment.status == Payment.Status.PAID:
            target_course = locked_payment.course
            return locked_payment, bool(target_course)

        locked_payment.status = Payment.Status.PAID
        if razorpay_payment_id:
            locked_payment.razorpay_payment_id = razorpay_payment_id
        locked_payment.paid_at = timezone.now()
        locked_payment.save(update_fields=['status', 'razorpay_payment_id', 'paid_at'])

        # 1. Course Enrollment
        target_course = locked_payment.course
        is_enrolled = False
        if target_course:
            enrollment, created = Enrollment.objects.get_or_create(
                user=locked_payment.user,
                course=target_course,
                defaults={'status': 'ACTIVE'}
            )
            if not created and enrollment.status != 'ACTIVE':
                enrollment.status = 'ACTIVE'
                enrollment.save(update_fields=['status'])
            is_enrolled = True

        # 2. Add-on Entitlements
        if locked_payment.items_snapshot and isinstance(locked_payment.items_snapshot, list):
            for item in locked_payment.items_snapshot:
                if isinstance(item, dict) and item.get('is_addon'):
                    item_id = item.get('id')
                    course_addon = None
                    if item_id:
                        course_addon = CourseAddon.objects.filter(id=item_id).first()
                    title = item.get('title') or (course_addon.title if course_addon else 'Addon Item')
                    item_type = item.get('item_type') or (course_addon.addon_type if course_addon else '')

                    Entitlement.objects.get_or_create(
                        user=locked_payment.user,
                        payment=locked_payment,
                        title=title,
                        defaults={
                            'course': target_course,
                            'course_addon': course_addon,
                            'item_type': item_type,
                            'is_active': True,
                        }
                    )

        logger.info(
            "Payment fulfilled successfully: payment_id=%s, order_id=%s, user_id=%s, enrolled=%s",
            locked_payment.id, locked_payment.razorpay_order_id, locked_payment.user_id, is_enrolled
        )
        return locked_payment, is_enrolled
