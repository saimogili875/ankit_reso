from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from apps.core.views import health_check, healthz, health_deep
from apps.accounts.views import CSRFTokenView, StudentOnboardingView
from apps.content.views import AnnouncementListView, StudentDoubtListView
from apps.content.schedule_views import (
    ScheduleListView,
    ScheduleTodayView,
    NotificationListView,
    NotificationMarkReadView,
)
from apps.academics.views import CourseListView, CourseDetailView
from apps.payments.views import CreateOrderView, VerifyPaymentView, AdminPaymentListView, AdminGrantEnrollmentView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # System & Health
    # Lightweight checks (200 OK without DB/Redis load, accepts GET & HEAD)
    path('', healthz, name='root'),
    path('healthz', healthz, name='healthz-no-slash'),
    path('healthz/', healthz, name='healthz'),
    path('health', healthz, name='health-no-slash'),
    path('health/', healthz, name='health'),
    path('api/health', healthz, name='api-health-no-slash'),
    path('api/health/', healthz, name='api-health'),
    path('api/healthz', healthz, name='api-healthz-no-slash'),
    path('api/healthz/', healthz, name='api-healthz'),

    # Deep checks (verifies Database and Redis/Cache; returns 503 if failing)
    path('health/deep', health_deep, name='health-deep-no-slash'),
    path('health/deep/', health_deep, name='health-deep'),
    path('api/health/deep', health_deep, name='api-health-deep-no-slash'),
    path('api/health/deep/', health_deep, name='api-health-deep'),

    # OpenAPI Schema & Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # CSRF Token Endpoints (both /api/auth/csrf/ and /auth/csrf/ supported)
    path('api/auth/csrf/', CSRFTokenView.as_view(), name='api-auth-csrf'),
    path('auth/csrf/', CSRFTokenView.as_view(), name='auth-csrf-legacy'),

    # Application API endpoints
    path('api/auth/', include('apps.accounts.urls')),
    path('api/academics/', include('apps.academics.urls')),
    path('api/pricing/', include('apps.academics.pricing_urls')),
    path('api/enrollment/', include('apps.academics.enrollment_urls')),
    path('api/content/', include('apps.content.urls')),
    path('api/courses/', CourseListView.as_view(), name='courses-list'),
    path('api/courses/<str:pk>/', CourseDetailView.as_view(), name='courses-detail'),
    path('api/schedule/', ScheduleListView.as_view(), name='schedule-list'),
    path('api/schedule/today/', ScheduleTodayView.as_view(), name='schedule-today'),
    path('api/notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('api/notifications/mark-all-read/', NotificationMarkReadView.as_view(), {'pk': 'all'}, name='notifications-mark-all-read'),
    path('api/notifications/<str:pk>/read/', NotificationMarkReadView.as_view(), name='notifications-mark-read'),
    path('api/students/onboarding/', StudentOnboardingView.as_view(), name='student-onboarding'),
    path('api/students/onboarding', StudentOnboardingView.as_view(), name='student-onboarding-noslash'),
    path('api/announcements/', AnnouncementListView.as_view(), name='announcements'),
    path('api/doubts/', StudentDoubtListView.as_view(), name='doubts'),
    path('api/doubts/my/', StudentDoubtListView.as_view(), name='doubts-my'),
    path('api/questions/', include('apps.questions.urls')),
    path('api/tests/', include('apps.tests.urls')),
    path('api/progress/', include('apps.progress.urls')),
    path('api/materials/', include('apps.materials.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/admin/', include('apps.adminpanel.urls')),
    path('api/admin-panel/', include('apps.adminpanel.urls')),
    path('api/admin/payments/', AdminPaymentListView.as_view(), name='admin-payments-list'),
    path('api/admin/payments/grant-enrollment/', AdminGrantEnrollmentView.as_view(), name='admin-payments-grant-enrollment'),
    path('api/admin-panel/payments/', AdminPaymentListView.as_view(), name='adminpanel-payments-list'),
    path('api/banners/', include('apps.banners.urls')),
    path('api/books/', include('apps.books.urls')),
    path('api/course-content/', include('apps.coursecontent.urls')),
    path('api/admin/books/', include('apps.books.admin_urls')),
    path('api/admin-panel/books/', include('apps.books.admin_urls')),

    # Razorpay Standard Web Checkout Endpoints
    path('api/create-order', CreateOrderView.as_view(), name='create-order-noslash'),
    path('api/create-order/', CreateOrderView.as_view(), name='create-order'),
    path('api/verify-payment', VerifyPaymentView.as_view(), name='verify-payment-noslash'),
    path('api/verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
    path('api/payments/', include('apps.payments.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

