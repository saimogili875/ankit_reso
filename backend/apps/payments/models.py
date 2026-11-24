from django.db import models
from django.conf import settings
import uuid
from apps.core.models import TimeStampedModel


def generate_book_id():
    return uuid.uuid4().hex[:12]


class Payment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = 'created', 'Created'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    batch = models.ForeignKey(
        'academics.Batch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )
    items_snapshot = models.JSONField(
        default=list,
        blank=True,
        help_text="Snapshot of selected batch items and add-ons at purchase time"
    )
    amount_paise = models.IntegerField(help_text="Amount in paise (e.g. 100 paise = ₹1.00)")
    currency = models.CharField(max_length=10, default='INR')
    razorpay_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    razorpay_payment_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CREATED,
        db_index=True
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        course_title = self.course.title if self.course else 'Direct Payment'
        return f"{self.user.email} - {course_title} - {self.amount_paise} paise ({self.status})"
