from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel

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
