from django.urls import path
from .views import (
    LectureVideoView,
    VideoListView,
    UploadPresignedUrlView,
    HeroSlideListView,
    QuickAccessListView,
    AnnouncementListView,
    StudentDoubtListView,
)

urlpatterns = [
    path('hero-slides/', HeroSlideListView.as_view(), name='hero-slides'),
    path('quick-access/', QuickAccessListView.as_view(), name='quick-access'),
    path('announcements/', AnnouncementListView.as_view(), name='announcements'),
    path('doubts/', StudentDoubtListView.as_view(), name='student-doubts'),
    path('doubts/my/', StudentDoubtListView.as_view(), name='student-doubts-my'),
    path('videos/', VideoListView.as_view(), name='video-list'),
    path('lectures/<str:pk>/video/', LectureVideoView.as_view(), name='lecture-video'),
    path('upload-presigned-url/', UploadPresignedUrlView.as_view(), name='upload-presigned-url'),
    path('upload-url/', UploadPresignedUrlView.as_view(), name='upload-url'),
]
