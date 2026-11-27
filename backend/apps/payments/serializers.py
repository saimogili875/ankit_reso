from rest_framework import serializers
from .models import Payment

class PaymentSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug = serializers.CharField(source='course.slug', read_only=True)
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
            'course_slug',
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


