from django.urls import path, re_path
from .views import (
    CreateOrderView,
    VerifyPaymentView,
    WebhookView,
    AdminPaymentListView,
)

urlpatterns = [
    re_path(r'^create-order/?$', CreateOrderView.as_view(), name='payment-create-order'),
    re_path(r'^verify/?$', VerifyPaymentView.as_view(), name='payment-verify'),
    re_path(r'^verify-payment/?$', VerifyPaymentView.as_view(), name='payment-verify-payment'),
    re_path(r'^webhook/?$', WebhookView.as_view(), name='payment-webhook'),
    re_path(r'^admin/?$', AdminPaymentListView.as_view(), name='payment-admin-list'),
]
