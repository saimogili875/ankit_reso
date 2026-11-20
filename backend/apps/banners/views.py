import logging
from django.core.cache import cache
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.permissions import IsAdminRole
from .models import BannerSlide
from .serializers import (
    BannerSlidePublicSerializer,
    BannerSlideAdminSerializer,
    BannerReorderSerializer,
)
from .services import delete_banner_image

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60
CACHE_KEY_PREFIX = "banners_public_"


def get_public_banner_cache_key(placement: str) -> str:
    return f"{CACHE_KEY_PREFIX}{placement or 'all'}"


def clear_banner_caches():
    """Invalidates public banner slider cache across placements."""
    for placement in ['home', 'login', 'all', '']:
        cache.delete(get_public_banner_cache_key(placement))


class IsStaffOrAdminUser(permissions.BasePermission):
    """
    Allows access only to authenticated staff users or users with ADMIN role.
    """
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and
            user.is_authenticated and
            user.is_active and
            (user.is_staff or getattr(user, 'role', None) == 'ADMIN' or user.is_superuser)
        )


class BannerPublicListView(generics.ListAPIView):
    """
    Public AllowAny endpoint returning ordered active banner slides.
    Accepts ?placement=home|login. Results cached for ~60s.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BannerSlidePublicSerializer
    pagination_class = None  # Sliders need full unpaginated array

    def get_queryset(self):
        placement = self.request.query_params.get('placement', '').lower().strip()
        qs = BannerSlide.objects.filter(is_active=True)

        if placement == 'home':
            qs = qs.filter(placement__in=[BannerSlide.Placement.HOME, BannerSlide.Placement.BOTH])
        elif placement == 'login':
            qs = qs.filter(placement__in=[BannerSlide.Placement.LOGIN, BannerSlide.Placement.BOTH])
        elif placement:
            qs = qs.filter(placement=placement)

        return qs.order_by('order', 'created_at')

    def list(self, request, *args, **kwargs):
        placement = request.query_params.get('placement', '').lower().strip()
        cache_key = get_public_banner_cache_key(placement)
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(cached_data)

        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        # Cache response for ~60 seconds
        cache.set(cache_key, data, CACHE_TTL_SECONDS)
        return Response(data)


class BannerAdminViewSet(viewsets.ModelViewSet):
    """
    Full administration ViewSet for BannerSlide management.
    Requires staff or ADMIN role permissions.
    """
    permission_classes = [IsStaffOrAdminUser]
    serializer_class = BannerSlideAdminSerializer
    queryset = BannerSlide.objects.all().order_by('order', '-created_at')
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def perform_create(self, serializer):
        instance = serializer.save()
        clear_banner_caches()
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        clear_banner_caches()
        return instance

    def perform_destroy(self, instance):
        image_key = instance.image_key
        instance.delete()
        if image_key:
            delete_banner_image(image_key)
        clear_banner_caches()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        Batch updates slide ordering based on an ordered list of IDs.
        Payload: { "ids": ["<uuid1>", "<uuid2>", ...] }
        """
        serializer = BannerReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']

        slides_by_id = {slide.id: slide for slide in BannerSlide.objects.filter(id__in=ids)}
        updates = []
        for index, slide_id in enumerate(ids):
            slide = slides_by_id.get(slide_id)
            if slide and slide.order != index:
                slide.order = index
                updates.append(slide)

        if updates:
            BannerSlide.objects.bulk_update(updates, ['order'])

        clear_banner_caches()
        all_slides = self.get_queryset()
        return Response(self.get_serializer(all_slides, many=True).data)
