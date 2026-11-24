from django.db import models
from django.conf import settings
import uuid
from apps.core.models import TimeStampedModel


def generate_book_id():
    return uuid.uuid4().hex[:12]


class Book(TimeStampedModel):
    id = models.CharField(max_length=64, primary_key=True, default=generate_book_id)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=500, blank=True)
    badge = models.CharField(max_length=100, blank=True)
    highlights = models.JSONField(default=list, blank=True)
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)
    cover_image_url = models.CharField(max_length=1000, blank=True)
    pdf_key = models.CharField(max_length=500, blank=True, help_text="Private Cloudflare R2 object key")
    digital_price = models.DecimalField(max_digits=10, decimal_places=2, default=299.00)
    hardcopy_price = models.DecimalField(max_digits=10, decimal_places=2, default=399.00)
    mrp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    gst_percent = models.DecimalField(max_digits=4, decimal_places=2, default=18.00)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.title} (Digital: ₹{self.digital_price}, Hardcopy: ₹{self.hardcopy_price})"


class BookOrder(TimeStampedModel):
    class Format(models.TextChoices):
        DIGITAL = 'digital', 'Digital PDF'
        HARDCOPY = 'hardcopy', 'Physical Hard Copy'

    class Status(models.TextChoices):
        CREATED = 'created', 'Created'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'

    class ShippingStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Dispatch'
        PROCESSING = 'processing', 'Processing'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name='orders')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='book_orders'
    )
    format = models.CharField(max_length=20, choices=Format.choices, default=Format.DIGITAL)
    
    # Financial breakdown (in INR Rupees and paise)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paise = models.IntegerField(help_text="Total charged in paise")
    currency = models.CharField(max_length=10, default='INR')

    # Buyer contact info
    buyer_name = models.CharField(max_length=150)
    buyer_email = models.EmailField(db_index=True)
    buyer_phone = models.CharField(max_length=20)

    # Shipping address (required for hardcopy)
    shipping_address = models.TextField(blank=True)
    shipping_city = models.CharField(max_length=100, blank=True)
    shipping_state = models.CharField(max_length=100, blank=True)
    shipping_pincode = models.CharField(max_length=10, blank=True)

    # Razorpay tracking
    razorpay_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # Digital delivery
    download_token = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    download_token_expires_at = models.DateTimeField(null=True, blank=True)
    download_count = models.IntegerField(default=0)
    max_downloads = models.IntegerField(default=5)

    # Physical fulfillment
    shipping_status = models.CharField(
        max_length=20,
        choices=ShippingStatus.choices,
        default=ShippingStatus.PENDING,
        db_index=True
    )
    tracking_id = models.CharField(max_length=100, blank=True)
    shipping_provider = models.CharField(max_length=100, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"BookOrder {self.id} - {self.book.title} ({self.format}) - ₹{self.total_amount} [{self.status}]"


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
