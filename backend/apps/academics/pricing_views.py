import logging
from django.core.cache import cache
from django.db import transaction, models
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.accounts.permissions import IsAdminRole
from .models import PricingCard, Batch, BatchFeature, BatchItem, AcademicClass
from .serializers import (
    PricingCardPublicSerializer,
    PricingCardAdminSerializer,
    BatchPublicSerializer,
    BatchAdminSerializer,
    BatchFeatureAdminSerializer,
    BatchItemAdminSerializer,
)
from .services import process_and_upload_batch_image

logger = logging.getLogger(__name__)

PRICING_CACHE_KEY = "pricing_cards_public"
CACHE_TTL = 60  # seconds


def clear_pricing_cache():
    cache.delete(PRICING_CACHE_KEY)


# ---------------------------------------------------------------------------
# PUBLIC READ-ONLY ENDPOINTS (Cached 60s, published only)
# ---------------------------------------------------------------------------

class PricingCardListView(APIView):
    """
    GET /api/pricing/cards/
    Returns all published pricing cards with nested batches, features, and images.
    Cached for 60 seconds.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cached = cache.get(PRICING_CACHE_KEY)
        if cached is not None:
            return Response(cached)

        cards = PricingCard.objects.filter(
            is_published=True
        ).prefetch_related(
            'batches',
            'features',
            'batches__items',
            'batches__features',
            'batches__academic_class',
        ).order_by('order', 'created_at')

        data = PricingCardPublicSerializer(cards, many=True).data
        cache.set(PRICING_CACHE_KEY, data, CACHE_TTL)
        return Response(data)


class BatchDetailView(APIView):
    """
    GET /api/pricing/batches/<slug>/
    Returns detailed batch info, items breakdown, and features.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        qs = Batch.objects.select_related('card', 'academic_class').prefetch_related('items', 'features')
        
        is_admin = request.user.is_authenticated and (
            request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN'
        )
        if not is_admin:
            qs = qs.filter(is_published=True)

        batch = qs.filter(slug=slug).first()
        if not batch:
            return Response({'error': 'Batch not found or not published.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(BatchPublicSerializer(batch).data)


class PricingCategoryListView(APIView):
    """
    GET /api/pricing/categories/<key>/
    Returns all published batches belonging to the category key (school, senior, dropper).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, key):
        card = PricingCard.objects.filter(key=key, is_published=True).first()
        if not card:
            return Response({'error': f'Category {key} not found.'}, status=status.HTTP_404_NOT_FOUND)

        batches = Batch.objects.filter(
            card=card,
            is_published=True
        ).select_related('card', 'academic_class').prefetch_related('items', 'features').order_by('display_order', 'created_at')

        return Response({
            'card': PricingCardPublicSerializer(card).data,
            'batches': BatchPublicSerializer(batches, many=True).data
        })


# ---------------------------------------------------------------------------
# ADMIN MANAGEMENT VIEWSETS (IsAdminRole)
# ---------------------------------------------------------------------------

class PricingCardAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD management for PricingCard categories.
    """
    permission_classes = [IsAdminRole]
    serializer_class = PricingCardAdminSerializer
    queryset = PricingCard.objects.all().prefetch_related('features', 'batches').order_by('order', 'created_at')
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


class BatchAdminViewSet(viewsets.ModelViewSet):
    """
    CRUD management for Batches, pricing, images, and items.
    """
    permission_classes = [IsAdminRole]
    serializer_class = BatchAdminSerializer
    queryset = Batch.objects.all().select_related('card', 'academic_class').prefetch_related('items', 'features').order_by('display_order', 'created_at')
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def perform_create(self, serializer):
        instance = serializer.save()
        self._handle_image_upload(instance)
        clear_pricing_cache()

    def perform_update(self, serializer):
        instance = serializer.save()
        self._handle_image_upload(instance)
        clear_pricing_cache()

    def perform_destroy(self, instance):
        instance.delete()
        clear_pricing_cache()

    def _handle_image_upload(self, batch_instance):
        uploaded_file = self.request.FILES.get('image_file') or self.request.FILES.get('image')
        if uploaded_file:
            image_url, _ = process_and_upload_batch_image(uploaded_file, filename_hint=batch_instance.slug)
            batch_instance.image = image_url
            batch_instance.save(update_fields=['image'])

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser], url_path='upload-image')
    def upload_image(self, request, pk=None):
        batch = self.get_object()
        uploaded_file = request.FILES.get('image') or request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        image_url, _ = process_and_upload_batch_image(uploaded_file, filename_hint=batch.slug)
        batch.image = image_url
        batch.save(update_fields=['image'])
        clear_pricing_cache()
        return Response({'success': True, 'image_url': image_url})

    @action(detail=True, methods=['post'], url_path='sync-items')
    def sync_items(self, request, pk=None):
        """
        Replaces batch items in bulk.
        Expects: items = [{item_type, title, price, is_addon}]
        """
        batch = self.get_object()
        items_data = request.data.get('items', [])
        if not isinstance(items_data, list):
            return Response({'error': 'items must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch.items.all().delete()
            for it in items_data:
                BatchItem.objects.create(
                    batch=batch,
                    item_type=it.get('item_type', BatchItem.ItemType.MODULE),
                    title=it.get('title', 'Item'),
                    price=it.get('price', 0),
                    is_addon=it.get('is_addon', False),
                )
        clear_pricing_cache()
        return Response(BatchPublicSerializer(batch).data)

    @action(detail=True, methods=['post'], url_path='sync-features')
    def sync_features(self, request, pk=None):
        """
        Replaces batch-level feature bullets.
        Expects: features = [{text, order}] or ['bullet1', 'bullet2']
        """
        batch = self.get_object()
        features_data = request.data.get('features', [])
        if not isinstance(features_data, list):
            return Response({'error': 'features must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch.features.all().delete()
            for idx, item in enumerate(features_data, start=1):
                text = item if isinstance(item, str) else item.get('text', '')
                order = idx if isinstance(item, str) else item.get('order', idx)
                if text.strip():
                    BatchFeature.objects.create(batch=batch, text=text.strip(), order=order)
        clear_pricing_cache()
        return Response(BatchPublicSerializer(batch).data)


class BatchItemAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = BatchItemAdminSerializer
    queryset = BatchItem.objects.all()
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


class BatchFeatureAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = BatchFeatureAdminSerializer
    queryset = BatchFeature.objects.all()
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
