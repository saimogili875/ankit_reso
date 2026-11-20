from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from apps.core.views import health_check
from apps.content.views import AnnouncementListView, StudentDoubtListView
from apps.content.schedule_views import (
    ScheduleListView,
    ScheduleTodayView,
    NotificationListView,
    NotificationMarkReadView,
)
from apps.academics.views import CourseListView, CourseDetailView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # System & Health
    path('api/health/', health_check, name='health-check'),

    # OpenAPI Schema & Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Application API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/academics/', include('apps.academics.urls')),
    path('api/enrollment/', include('apps.academics.enrollment_urls')),
    path('api/content/', include('apps.content.urls')),
    path('api/courses/', CourseListView.as_view(), name='courses-list'),
    path('api/courses/<str:pk>/', CourseDetailView.as_view(), name='courses-detail'),
    path('api/schedule/', ScheduleListView.as_view(), name='schedule-list'),
    path('api/schedule/today/', ScheduleTodayView.as_view(), name='schedule-today'),
    path('api/notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('api/notifications/mark-all-read/', NotificationMarkReadView.as_view(), {'pk': 'all'}, name='notifications-mark-all-read'),
    path('api/notifications/<str:pk>/read/', NotificationMarkReadView.as_view(), name='notifications-mark-read'),
    path('api/announcements/', AnnouncementListView.as_view(), name='announcements'),
    path('api/doubts/', StudentDoubtListView.as_view(), name='doubts'),
    path('api/doubts/my/', StudentDoubtListView.as_view(), name='doubts-my'),
    path('api/questions/', include('apps.questions.urls')),
    path('api/tests/', include('apps.tests.urls')),
    path('api/progress/', include('apps.progress.urls')),
    path('api/materials/', include('apps.materials.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/admin-panel/', include('apps.adminpanel.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

