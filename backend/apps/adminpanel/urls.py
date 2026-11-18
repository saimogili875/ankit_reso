from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OverviewView,
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
    TestViewSet,
    StudyMaterialViewSet,
    AnnouncementViewSet,
    DoubtViewSet,
    StudentViewSet,
    LiveClassViewSet,
    ScheduleEventViewSet,
    NotificationViewSet,
    TestAnalyticsViewSet,
    RankPredictorViewSet,
)

router = DefaultRouter()
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
router.register('tests', TestViewSet, basename='admin-tests')
router.register('test-analytics', TestAnalyticsViewSet, basename='admin-test-analytics')
router.register('rank-predictor', RankPredictorViewSet, basename='admin-rank-predictor')
router.register('materials', StudyMaterialViewSet, basename='admin-materials')
router.register('announcements', AnnouncementViewSet, basename='admin-announcements')
router.register('doubts', DoubtViewSet, basename='admin-doubts')
router.register('students', StudentViewSet, basename='admin-students')
router.register('live-classes', LiveClassViewSet, basename='admin-live-classes')
router.register('schedule', ScheduleEventViewSet, basename='admin-schedule-events')
router.register('notifications', NotificationViewSet, basename='admin-notifications')

urlpatterns = [
    path('overview/', OverviewView.as_view(), name='admin-overview'),
    path('options/', OptionsView.as_view(), name='admin-options'),
    path('', include(router.urls)),
]
