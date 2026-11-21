from django.urls import path, re_path
from .views import CreateOrderView, VerifyPaymentView

urlpatterns = [
    re_path(r'^create-order/?$', CreateOrderView.as_view(), name='payment-create-order'),
    re_path(r'^verify-payment/?$', VerifyPaymentView.as_view(), name='payment-verify-payment'),
]
