import logging
from django.core.cache import cache
from django.db import transaction, models
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.permissions import IsAdminRole
from .models import CourseCategory, Course, CourseFeature, CourseAddon, AcademicClass
from .serializers import (
    CourseCategoryPublicSerializer,
    CourseCategoryAdminSerializer,
    CourseSerializer,
    CourseFeaturePublicSerializer,
    CourseFeatureAdminSerializer,
    CourseAddonPublicSerializer,
    CourseAddonAdminSerializer,
)
from .services import process_and_upload_course_image

logger = logging.getLogger(__name__)

PRICING_CACHE_KEY = "pricing_courses_public"
CACHE_TTL = 60  # seconds


def clear_pricing_cache():
    cache.delete(PRICING_CACHE_KEY)
    cache.delete("pricing_cards_public")


# ---------------------------------------------------------------------------
# PUBLIC READ-ONLY ENDPOINTS (Cached 60s, published only)
# ---------------------------------------------------------------------------

class CourseCategoryListView(APIView):
    """
    GET /api/pricing/categories/ and GET /api/pricing/cards/
    Returns all published course categories with nested courses, features, and images.
    Cached for 60 seconds.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cached = cache.get(PRICING_CACHE_KEY)
        if cached is not None:
            return Response(cached)

        categories = CourseCategory.objects.filter(
            is_published=True
        ).prefetch_related(
            'courses',
            'features',
            'courses__addons',
            'courses__course_features',
            'courses__academic_class',
            'courses__classes',
            'courses__subjects',
        ).order_by('order', 'created_at')

        data = CourseCategoryPublicSerializer(categories, many=True, context={'request': request}).data
        cache.set(PRICING_CACHE_KEY, data, CACHE_TTL)
        return Response(data)


# Backward compatibility alias
PricingCardListView = CourseCategoryListView


class CoursePricingDetailView(APIView):
    """
    GET /api/pricing/courses/<slug>/
    Returns detailed course sales info, addons breakdown, features, and enrollment status.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        qs = Course.objects.select_related('category', 'academic_class').prefetch_related(
            'addons', 'course_features', 'classes', 'subjects'
        )

        is_admin = request.user.is_authenticated and (
            request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN'
        )
        if not is_admin:
            qs = qs.filter(is_published=True)

        course = qs.filter(models.Q(slug=slug) | models.Q(id=slug if len(str(slug)) == 36 else None)).first()
        if not course:
            return Response({'error': 'Course not found or not published.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(CourseSerializer(course, context={'request': request}).data)


# Backward compatibility alias
BatchDetailView = CoursePricingDetailView


class CourseCategoryDetailView(APIView):
    """
    GET /api/pricing/categories/<key>/
    Returns all published courses belonging to the category key (school, senior, dropper).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, key):
        category = CourseCategory.objects.filter(slug=key, is_published=True).first()
        if not category:
            return Response({'error': f'Category {key} not found.'}, status=status.HTTP_404_NOT_FOUND)

        courses = Course.objects.filter(
            category=category,
            is_published=True
        ).select_related('category', 'academic_class').prefetch_related(
            'addons', 'course_features', 'classes', 'subjects'
        ).order_by('display_order', 'created_at')

        return Response({
            'category': CourseCategoryPublicSerializer(category, context={'request': request}).data,
            'courses': CourseSerializer(courses, many=True, context={'request': request}).data
        })


# Backward compatibility alias
PricingCategoryListView = CourseCategoryDetailView


# ---------------------------------------------------------------------------
# ADMIN MANAGEMENT VIEWSETS (IsAdminRole)
# ---------------------------------------------------------------------------

class CourseCategoryAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD management for CourseCategory (replaces PricingCard).
    """
    permission_classes = [IsAdminRole]
    serializer_class = CourseCategoryAdminSerializer
    queryset = CourseCategory.objects.all().prefetch_related('features', 'courses').order_by('order', 'created_at')
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_update(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_destroy(self, instance):
        instance.delete()
        clear_pricing_cache()


# Backward compatibility alias
PricingCardAdminViewSet = CourseCategoryAdminViewSet


class CourseFeatureAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD management for CourseFeature.
    """
    permission_classes = [IsAdminRole]
    serializer_class = CourseFeatureAdminSerializer
    queryset = CourseFeature.objects.all()
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_update(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_destroy(self, instance):
        instance.delete()
        clear_pricing_cache()


# Backward compatibility alias
BatchFeatureAdminViewSet = CourseFeatureAdminViewSet


class CourseAddonAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD management for CourseAddon (replaces BatchItem).
    """
    permission_classes = [IsAdminRole]
    serializer_class = CourseAddonAdminSerializer
    queryset = CourseAddon.objects.all()
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_update(self, serializer):
        serializer.save()
        clear_pricing_cache()

    def perform_destroy(self, instance):
        instance.delete()
        clear_pricing_cache()


# Backward compatibility alias
BatchItemAdminViewSet = CourseAddonAdminViewSet
