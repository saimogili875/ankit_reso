from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from apps.core.views import health_check

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
    path('api/content/', include('apps.content.urls')),
    path('api/questions/', include('apps.questions.urls')),
    path('api/tests/', include('apps.tests.urls')),
    path('api/progress/', include('apps.progress.urls')),
    path('api/materials/', include('apps.materials.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
]
