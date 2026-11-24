from rest_framework import serializers
from .models import Payment, Book, BookOrder

class PaymentSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    batch_name = serializers.CharField(source='batch.name', read_only=True)
    amount_rupees = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id',
            'user',
            'user_email',
            'user_name',
            'course',
            'course_title',
            'batch',
            'batch_name',
            'items_snapshot',
            'amount_paise',
            'amount_rupees',
            'currency',
            'status',
            'razorpay_order_id',
            'razorpay_payment_id',
            'created_at',
            'paid_at',
        ]
        read_only_fields = fields

    def get_amount_rupees(self, obj):
        return round(obj.amount_paise / 100, 2)


class BookPublicSerializer(serializers.ModelSerializer):
    """
    Public student-facing book serializer.
    STRICTLY omits pdf_key and internal storage identifiers to prevent direct download bypassing.
    """
    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'subtitle',
            'badge',
            'highlights',
            'order',
            'cover_image_url',
            'digital_price',
            'hardcopy_price',
            'mrp',
            'gst_percent',
            'is_published',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class BookAdminSerializer(serializers.ModelSerializer):
    """
    Full admin serializer for Book model CRUD operations.
    Includes pdf_key and management flags.
    """
    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'subtitle',
            'badge',
            'highlights',
            'order',
            'is_published',
            'cover_image_url',
            'pdf_key',
            'digital_price',
            'hardcopy_price',
            'mrp',
            'gst_percent',
            'created_at',
            'updated_at',
        ]


class BookOrderAdminSerializer(serializers.ModelSerializer):
    """
    Admin serializer for managing digital and physical book orders.
    """
    book_title = serializers.CharField(source='book.title', read_only=True)

    class Meta:
        model = BookOrder
        fields = [
            'id',
            'book',
            'book_title',
            'user',
            'format',
            'base_price',
            'gst_amount',
            'total_amount',
            'amount_paise',
            'currency',
            'buyer_name',
            'buyer_email',
            'buyer_phone',
            'shipping_address',
            'shipping_city',
            'shipping_state',
            'shipping_pincode',
            'razorpay_order_id',
            'razorpay_payment_id',
            'status',
            'paid_at',
            'download_token',
            'download_token_expires_at',
            'download_count',
            'max_downloads',
            'shipping_status',
            'tracking_id',
            'shipping_provider',
            'shipped_at',
            'delivered_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'razorpay_order_id', 'razorpay_payment_id', 'amount_paise',
            'paid_at', 'download_token', 'download_token_expires_at', 'created_at', 'updated_at'
        ]

