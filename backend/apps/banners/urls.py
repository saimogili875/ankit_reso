from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BannerPublicListView,
    BannerAdminViewSet,
)

router = DefaultRouter()
router.register(r'manage', BannerAdminViewSet, basename='banner-manage')
router.register(r'', BannerAdminViewSet, basename='banner-admin')

class DynamicBannerRootView(BannerPublicListView):
    """
    Handles GET /api/banners/:
    - If ?placement=home|login is present or unauthenticated: serves public active slides (cached).
    - If user is staff/admin and no placement filter is supplied: lists all slides for management.
    """
    def get(self, request, *args, **kwargs):
        placement = request.query_params.get('placement')
        is_staff_user = request.user and request.user.is_authenticated and (
            request.user.is_staff or getattr(request.user, 'role', None) == 'ADMIN' or request.user.is_superuser
        )
        if not placement and is_staff_user:
            return BannerAdminViewSet.as_view({'get': 'list'})(request, *args, **kwargs)
        return super().get(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return BannerAdminViewSet.as_view({'post': 'create'})(request, *args, **kwargs)

urlpatterns = [
    # Explicit public list
    path('public/', BannerPublicListView.as_view(), name='banner-public-list'),
    
    # Bulk reorder endpoint
    path('reorder/', BannerAdminViewSet.as_view({'post': 'reorder'}), name='banner-reorder'),
    path('manage/reorder/', BannerAdminViewSet.as_view({'post': 'reorder'}), name='banner-manage-reorder'),

    # Root /api/banners/ router & dynamic root
    path('', DynamicBannerRootView.as_view(), name='banner-root'),
    path('', include(router.urls)),
]
