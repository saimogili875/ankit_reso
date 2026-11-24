import uuid
from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel


class InvoiceSequence(models.Model):
    """
    Daily sequential invoice counter for book orders: INV-BK-YYYYMMDD-XXXX
    Guarantees monotonic sequence per calendar date using row-level select_for_update locking.
    """
    date_str = models.CharField(max_length=8, unique=True, db_index=True)
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Invoice Sequence'
        verbose_name_plural = 'Invoice Sequences'

    def __str__(self):
        return f"{self.date_str}: {self.last_seq}"


class BookProduct(TimeStampedModel):
    """
    Official study book, problem bank, or publication published by the institute.
    """
    slug = models.SlugField(max_length=150, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    cover_image = models.CharField(max_length=1000, blank=True, help_text="Cover image URL (R2 or public WebP)")
    class_label = models.CharField(max_length=100, blank=True, default='Class 10th', help_text="e.g. Class 10th, JEE Foundation")
    digital_price = models.DecimalField(max_digits=10, decimal_places=2, default=299.00)
    hardcopy_price = models.DecimalField(max_digits=10, decimal_places=2, default=399.00)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Original printed MRP / strikethrough price")
    gst_percent = models.DecimalField(max_digits=4, decimal_places=2, default=18.00)
    pdf_key = models.CharField(max_length=500, blank=True, help_text="Private Cloudflare R2 object key")
    is_published = models.BooleanField(default=True, db_index=True)
    display_order = models.IntegerField(default=0)
    stock_hardcopy = models.IntegerField(null=True, blank=True, help_text="Null for unlimited / print-on-demand")
    highlights = models.JSONField(default=list, blank=True)
    badge = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['display_order', 'created_at']
        verbose_name = 'Book Product'
        verbose_name_plural = 'Book Products'

    def __str__(self):
        return f"{self.title} (Digital: ₹{self.digital_price}, Hardcopy: ₹{self.hardcopy_price})"


class BookOrder(TimeStampedModel):
    """
    Purchase transaction for a physical or digital book.
    Supports guest checkout (no user account required).
    """
    class Format(models.TextChoices):
        DIGITAL = 'DIGITAL', 'Digital PDF'
        HARDCOPY = 'HARDCOPY', 'Physical Hard Copy'

    class Status(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    class ShippingStatus(models.TextChoices):
        NA = 'NA', 'Not Applicable (Digital)'
        PENDING = 'PENDING', 'Pending Dispatch'
        PACKED = 'PACKED', 'Packed'
        SHIPPED = 'SHIPPED', 'Shipped'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    product = models.ForeignKey(BookProduct, on_delete=models.PROTECT, related_name='orders')
    format = models.CharField(max_length=20, choices=Format.choices, default=Format.DIGITAL)
    
    # Guest / Buyer contact information
    buyer_name = models.CharField(max_length=150)
    buyer_phone = models.CharField(max_length=20, db_index=True)
    buyer_email = models.EmailField(db_index=True)

    # Shipping details (strictly validated for physical books)
    shipping_address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)

    # Server-verified financial breakdown
    base_amount = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount_paise = models.BigIntegerField(help_text="Total charged in paise")

    # Payment tracking
    razorpay_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # Physical fulfillment tracking
    shipping_status = models.CharField(
        max_length=20,
        choices=ShippingStatus.choices,
        default=ShippingStatus.NA,
        db_index=True
    )
    tracking_id = models.CharField(max_length=100, blank=True)
    courier = models.CharField(max_length=100, blank=True)
    admin_note = models.TextField(blank=True)

    # Secure digital delivery
    download_token = models.CharField(max_length=128, blank=True, db_index=True)
    download_expires_at = models.DateTimeField(null=True, blank=True)
    download_count = models.IntegerField(default=0)
    max_downloads = models.IntegerField(default=5)
    invoice_number = models.CharField(max_length=60, unique=True, null=True, blank=True, db_index=True)

    # Security & Audit metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='books_book_orders'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['public_id', 'status']),
            models.Index(fields=['buyer_email', 'status']),
            models.Index(fields=['buyer_phone', 'status']),
        ]

    def __str__(self):
        return f"Order #{self.public_id} - {self.product.title} [{self.format}] (₹{self.total_amount_paise / 100}) - {self.status}"
