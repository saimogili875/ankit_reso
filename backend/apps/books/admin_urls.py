from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookProductAdminViewSet, BookOrderAdminViewSet

router = DefaultRouter()
router.register(r'products', BookProductAdminViewSet, basename='admin-book-products')
router.register(r'orders', BookOrderAdminViewSet, basename='admin-book-orders')

urlpatterns = [
    path('', include(router.urls)),
]
