from django.contrib import admin
from .models import Payment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user_email',
        'course_title',
        'amount_display',
        'currency',
        'status',
        'razorpay_order_id',
        'razorpay_payment_id',
        'created_at',
        'paid_at',
    )
    list_filter = ('status', 'currency', 'created_at')
    search_fields = (
        'user__email',
        'user__username',
        'course__title',
        'razorpay_order_id',
        'razorpay_payment_id',
    )
    readonly_fields = [
        'id',
        'user',
        'course',
        'amount_paise',
        'currency',
        'razorpay_order_id',
        'razorpay_payment_id',
        'status',
        'created_at',
        'updated_at',
        'paid_at',
    ]

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User Email'

    def course_title(self, obj):
        return obj.course.title
    course_title.short_description = 'Course'

    def amount_display(self, obj):
        return f"₹{obj.amount_paise / 100:.2f}"
    amount_display.short_description = 'Amount (₹)'

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
