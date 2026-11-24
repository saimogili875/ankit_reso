from django.urls import path
from .pricing_views import (
    PricingCardListView,
    BatchDetailView,
    PricingCategoryListView,
)

urlpatterns = [
    path('cards/', PricingCardListView.as_view(), name='pricing-cards-list'),
    path('batches/<slug:slug>/', BatchDetailView.as_view(), name='pricing-batch-detail'),
    path('categories/<str:key>/', PricingCategoryListView.as_view(), name='pricing-category-list'),
]
