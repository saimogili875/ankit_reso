from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OverviewView,
    OverviewTrendsView,
    OptionsView,
    HeroSlideViewSet,
    QuickAccessViewSet,
    SubjectViewSet,
    CourseViewSet,
    AcademicClassViewSet,
    QuestionViewSet,
    ChapterViewSet,
    LectureViewSet,
    VideoViewSet,
    DPPViewSet,
    TestSeriesAdminViewSet,
    TestViewSet,
    StudyMaterialViewSet,
    AnnouncementViewSet,
    DoubtViewSet,
    StudentViewSet,
    ScheduleEventViewSet,
    NotificationViewSet,
    TestAnalyticsViewSet,
    RankPredictorViewSet,
    SettingsViewSet,
    AdminUserViewSet,
    LandingBannerViewSet,
    LandingBannerSettingsView,
)
from apps.academics.pricing_views import (
    CourseCategoryAdminViewSet,
    CourseFeatureAdminViewSet,
    CourseAddonAdminViewSet,
    PricingCardAdminViewSet,
)

router = DefaultRouter()
router.register('course-categories', CourseCategoryAdminViewSet, basename='admin-course-categories')
router.register('course-features', CourseFeatureAdminViewSet, basename='admin-course-features')
router.register('course-addons', CourseAddonAdminViewSet, basename='admin-course-addons')

# Legacy route aliases
router.register('pricing-cards', PricingCardAdminViewSet, basename='admin-pricing-cards')
router.register('landing-banners', LandingBannerViewSet, basename='admin-landing-banners')
router.register('hero-slides', HeroSlideViewSet, basename='admin-hero-slides')
router.register('quick-access', QuickAccessViewSet, basename='admin-quick-access')
router.register('subjects', SubjectViewSet, basename='admin-subjects')
router.register('courses', CourseViewSet, basename='admin-courses')
router.register('classes', AcademicClassViewSet, basename='admin-classes')
router.register('questions', QuestionViewSet, basename='admin-questions')
router.register('chapters', ChapterViewSet, basename='admin-chapters')
router.register('lectures', LectureViewSet, basename='admin-lectures')
router.register('videos', VideoViewSet, basename='admin-videos')
router.register('dpps', DPPViewSet, basename='admin-dpps')
router.register('test-series', TestSeriesAdminViewSet, basename='admin-test-series')
router.register('tests', TestViewSet, basename='admin-tests')
router.register('test-analytics', TestAnalyticsViewSet, basename='admin-test-analytics')
router.register('rank-predictor', RankPredictorViewSet, basename='admin-rank-predictor')
router.register('materials', StudyMaterialViewSet, basename='admin-materials')
router.register('announcements', AnnouncementViewSet, basename='admin-announcements')
router.register('doubts', DoubtViewSet, basename='admin-doubts')
router.register('students', StudentViewSet, basename='admin-students')
router.register('schedule', ScheduleEventViewSet, basename='admin-schedule-events')
router.register('notifications', NotificationViewSet, basename='admin-notifications')
router.register('settings', SettingsViewSet, basename='admin-settings')
router.register('admins', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    path('landing-banner-settings/', LandingBannerSettingsView.as_view(), name='admin-landing-banner-settings'),
    path('overview/trends/', OverviewTrendsView.as_view(), name='admin-overview-trends'),
    path('overview/', OverviewView.as_view(), name='admin-overview'),
    path('options/', OptionsView.as_view(), name='admin-options'),
    path('', include(router.urls)),
]
