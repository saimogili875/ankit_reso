import logging
from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from apps.academics.models import Enrollment
from apps.content.models import Notification
from .models import LiveClass

logger = logging.getLogger(__name__)


@shared_task
def send_live_class_notification(live_class_id, notification_type_code):
    """
    Sends notifications to all enrolled students for a live class:
    - 30_MIN: 30 minutes before start
    - 5_MIN: 5 minutes before start
    - LIVE_NOW: when class goes live
    """
    try:
        live_class = LiveClass.objects.select_related('course').get(id=live_class_id)
    except LiveClass.DoesNotExist:
        return f"LiveClass {live_class_id} not found."

    enrolled_user_ids = list(Enrollment.objects.filter(
        course=live_class.course,
        status='ACTIVE'
    ).values_list('user_id', flat=True))

    if not enrolled_user_ids:
        return "No enrolled students found."

    if notification_type_code == '30_MIN':
        title = f"Live Class in 30 Minutes: {live_class.title}"
        message = f"Your live class for '{live_class.course.title}' starts at {live_class.start_time.strftime('%I:%M %p')}. Get ready to join!"
    elif notification_type_code == '5_MIN':
        title = f"Live Class in 5 Minutes: {live_class.title}"
        message = f"Live class is about to begin. Enter the classroom now!"
    elif notification_type_code == 'LIVE_NOW':
        title = f"🔴 LIVE NOW: {live_class.title}"
        message = f"Teacher has started the live class for '{live_class.course.title}'. Tap to join!"
    else:
        title = f"Live Class Update: {live_class.title}"
        message = f"Update regarding your scheduled live class on {live_class.start_time.strftime('%b %d')}."

    link_url = f"/live/{live_class.id}"

    notifications = [
        Notification(
            user_id=uid,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.LIVE_CLASS_REMINDER,
            link_url=link_url
        )
        for uid in enrolled_user_ids
    ]
    Notification.objects.bulk_create(notifications)
    logger.info(f"Dispatched {len(notifications)} notifications for LiveClass {live_class.title} ({notification_type_code})")
    return f"Created {len(notifications)} notifications."


@shared_task
def check_upcoming_live_class_reminders():
    """
    Periodic task to scan for classes starting in ~30 mins and ~5 mins.
    """
    now = timezone.now()
    window_30 = now + timedelta(minutes=30)
    window_5 = now + timedelta(minutes=5)

    # Classes starting in 28-32 minutes
    classes_30 = LiveClass.objects.filter(
        status=LiveClass.Status.SCHEDULED,
        start_time__range=[window_30 - timedelta(minutes=2), window_30 + timedelta(minutes=2)]
    )
    for lc in classes_30:
        send_live_class_notification.delay(str(lc.id), '30_MIN')

    # Classes starting in 3-7 minutes
    classes_5 = LiveClass.objects.filter(
        status=LiveClass.Status.SCHEDULED,
        start_time__range=[window_5 - timedelta(minutes=2), window_5 + timedelta(minutes=2)]
    )
    for lc in classes_5:
        send_live_class_notification.delay(str(lc.id), '5_MIN')
