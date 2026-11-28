from django.urls import path
from .pricing_views import (
    CourseCategoryListView,
    CourseCategoryDetailView,
    CoursePricingDetailView,
    PricingCardListView,
)

urlpatterns = [
    # Course Pricing & Categories
    path('categories/', CourseCategoryListView.as_view(), name='pricing-categories-list'),
    path('categories/<slug:key>/', CourseCategoryDetailView.as_view(), name='pricing-category-detail'),
    path('courses/<slug:slug>/', CoursePricingDetailView.as_view(), name='pricing-course-detail'),

    # Legacy routes (alias to course pricing views)
    path('cards/', PricingCardListView.as_view(), name='pricing-cards-list'),
]
