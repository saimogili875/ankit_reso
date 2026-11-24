from django.urls import path, re_path
from .views import (
    CreateOrderView,
    VerifyPaymentView,
    WebhookView,
    AdminPaymentListView,
    AdminGrantEnrollmentView,
    BookListView,
    BookCreateOrderView,
    BookVerifyPaymentView,
    BookDownloadView,
)

urlpatterns = [
    re_path(r'^create-order/?$', CreateOrderView.as_view(), name='payment-create-order'),
    re_path(r'^verify/?$', VerifyPaymentView.as_view(), name='payment-verify'),
    re_path(r'^verify-payment/?$', VerifyPaymentView.as_view(), name='payment-verify-payment'),
    re_path(r'^webhook/?$', WebhookView.as_view(), name='payment-webhook'),
    re_path(r'^admin/?$', AdminPaymentListView.as_view(), name='payment-admin-list'),
    re_path(r'^admin/grant-enrollment/?$', AdminGrantEnrollmentView.as_view(), name='payment-admin-grant-enrollment'),
    
    # Books payment & secure delivery
    path('books/', BookListView.as_view(), name='payment-books-list'),
    path('books/create-order/', BookCreateOrderView.as_view(), name='payment-books-create-order'),
    path('books/verify/', BookVerifyPaymentView.as_view(), name='payment-books-verify'),
    path('books/download/<str:token>/', BookDownloadView.as_view(), name='payment-books-download'),
]
