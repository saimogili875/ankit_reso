from django.urls import path, re_path
from .views import (
    BookProductListView,
    BookProductDetailView,
    BookOrderCreateView,
    BookOrderVerifyView,
    BookWebhookView,
    BookOrderDownloadView,
    BookOrderStatusView,
)

urlpatterns = [
    # Catalog
    path('', BookProductListView.as_view(), name='book-list'),
    
    # Orders & Checkout
    path('orders/', BookOrderCreateView.as_view(), name='book-order-create'),
    path('orders/verify/', BookOrderVerifyView.as_view(), name='book-order-verify'),
    path('webhook/', BookWebhookView.as_view(), name='book-webhook'),
    
    # Order Status & Download
    path('orders/<uuid:public_id>/download/', BookOrderDownloadView.as_view(), name='book-order-download'),
    path('orders/<str:public_id>/download/', BookOrderDownloadView.as_view(), name='book-order-download-str'),
    path('orders/<uuid:public_id>/', BookOrderStatusView.as_view(), name='book-order-status'),
    path('orders/<str:public_id>/', BookOrderStatusView.as_view(), name='book-order-status-str'),

    # Detail by slug (placed last so it doesn't collide with static subpaths)
    path('<slug:slug>/', BookProductDetailView.as_view(), name='book-detail'),
]
