import re
from rest_framework import serializers
from .models import BookProduct, BookOrder
from .services import normalize_indian_phone


class BookProductPublicSerializer(serializers.ModelSerializer):
    """
    Public student/guest-facing serializer for books catalog.
    Strictly excludes pdf_key to prevent direct unauthorized access.
    """
    class Meta:
        model = BookProduct
        fields = [
            'id',
            'slug',
            'title',
            'subtitle',
            'description',
            'cover_image',
            'class_label',
            'digital_price',
            'hardcopy_price',
            'original_price',
            'gst_percent',
            'is_published',
            'display_order',
            'stock_hardcopy',
            'highlights',
            'badge',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class BookProductAdminSerializer(serializers.ModelSerializer):
    """
    Full admin serializer for BookProduct CRUD management.
    Includes pdf_key and internal stock controls.
    """
    class Meta:
        model = BookProduct
        fields = [
            'id',
            'slug',
            'title',
            'subtitle',
            'description',
            'cover_image',
            'class_label',
            'digital_price',
            'hardcopy_price',
            'original_price',
            'gst_percent',
            'pdf_key',
            'is_published',
            'display_order',
            'stock_hardcopy',
            'highlights',
            'badge',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BookOrderCreateSerializer(serializers.Serializer):
    """
    Validates guest checkout order initiation request.
    Server calculates financial amounts directly from the database product.
    """
    product_slug = serializers.CharField(max_length=150)
    format = serializers.ChoiceField(choices=BookOrder.Format.choices)
    buyer_name = serializers.CharField(max_length=150, min_length=2)
    buyer_phone = serializers.CharField(max_length=25)
    buyer_email = serializers.EmailField()

    # Required for physical hardcopy delivery
    shipping_address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)

    def validate_buyer_phone(self, value):
        return normalize_indian_phone(value)

    def validate(self, attrs):
        order_format = attrs.get('format')
        if order_format == BookOrder.Format.HARDCOPY:
            address = (attrs.get('shipping_address') or '').strip()
            city = (attrs.get('city') or '').strip()
            state = (attrs.get('state') or '').strip()
            pincode = (attrs.get('pincode') or '').strip()

            if not address or len(address) < 5:
                raise serializers.ValidationError({'shipping_address': 'Complete street address is required for physical book delivery.'})
            if not city:
                raise serializers.ValidationError({'city': 'City is required.'})
            if not state:
                raise serializers.ValidationError({'state': 'State is required.'})
            if not pincode or not re.match(r'^\d{6}$', pincode):
                raise serializers.ValidationError({'pincode': 'Valid 6-digit Indian PIN code is required.'})

        return attrs


class BookOrderPublicSerializer(serializers.ModelSerializer):
    """
    Public receipt serializer for guests viewing their order confirmation or tracking status.
    Partially masks phone and email for guest privacy.
    Provides download link if order is paid and format is digital.
    """
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_cover_image = serializers.CharField(source='product.cover_image', read_only=True)
    masked_email = serializers.SerializerMethodField()
    masked_phone = serializers.SerializerMethodField()
    can_download = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = BookOrder
        fields = [
            'public_id',
            'product_title',
            'product_slug',
            'product_cover_image',
            'format',
            'buyer_name',
            'masked_email',
            'masked_phone',
            'shipping_address',
            'city',
            'state',
            'pincode',
            'base_amount',
            'gst_amount',
            'total_amount_paise',
            'status',
            'shipping_status',
            'tracking_id',
            'courier',
            'paid_at',
            'invoice_number',
            'download_expires_at',
            'download_count',
            'max_downloads',
            'can_download',
            'download_url',
            'created_at',
        ]
        read_only_fields = fields

    def get_masked_email(self, obj):
        email = obj.buyer_email or ''
        if '@' in email:
            parts = email.split('@')
            user_part = parts[0]
            masked_user = user_part[:2] + '***' if len(user_part) > 2 else user_part + '***'
            return f"{masked_user}@{parts[1]}"
        return email

    def get_masked_phone(self, obj):
        phone = obj.buyer_phone or ''
        if len(phone) >= 10:
            return f"{phone[:3]}****{phone[-3:]}"
        return phone

    def get_can_download(self, obj):
        from django.utils import timezone
        if obj.format != BookOrder.Format.DIGITAL or obj.status != BookOrder.Status.PAID:
            return False
        if not obj.download_token:
            return False
        if obj.download_expires_at and timezone.now() > obj.download_expires_at:
            return False
        if obj.download_count >= obj.max_downloads:
            return False
        return True

    def get_download_url(self, obj):
        if not self.get_can_download(obj):
            return None
        # Return download endpoint with token
        return f"/api/books/orders/{obj.public_id}/download/?token={obj.download_token}"


class BookOrderAdminSerializer(serializers.ModelSerializer):
    """
    Comprehensive admin serializer for inspecting, searching, and managing student book orders.
    """
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    total_inr = serializers.SerializerMethodField()

    class Meta:
        model = BookOrder
        fields = [
            'id',
            'public_id',
            'product',
            'product_title',
            'product_slug',
            'format',
            'buyer_name',
            'buyer_phone',
            'buyer_email',
            'shipping_address',
            'city',
            'state',
            'pincode',
            'base_amount',
            'gst_amount',
            'total_amount_paise',
            'total_inr',
            'razorpay_order_id',
            'razorpay_payment_id',
            'status',
            'shipping_status',
            'tracking_id',
            'courier',
            'admin_note',
            'download_token',
            'download_expires_at',
            'download_count',
            'max_downloads',
            'invoice_number',
            'paid_at',
            'ip_address',
            'user',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'public_id', 'razorpay_order_id', 'razorpay_payment_id',
            'base_amount', 'gst_amount', 'total_amount_paise', 'paid_at',
            'created_at', 'updated_at'
        ]

    def get_total_inr(self, obj):
        return round(obj.total_amount_paise / 100, 2)


class BookOrderUpdateShippingSerializer(serializers.Serializer):
    """
    Validates shipping status and tracking updates by institute admins.
    """
    shipping_status = serializers.ChoiceField(choices=BookOrder.ShippingStatus.choices)
    tracking_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    courier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    admin_note = serializers.CharField(required=False, allow_blank=True)
