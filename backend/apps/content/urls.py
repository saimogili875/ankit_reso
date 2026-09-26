from django.urls import path
from .views import LectureVideoView, VideoListView, UploadPresignedUrlView

urlpatterns = [
    path('videos/', VideoListView.as_view(), name='video-list'),
    path('lectures/<str:pk>/video/', LectureVideoView.as_view(), name='lecture-video'),
    path('upload-presigned-url/', UploadPresignedUrlView.as_view(), name='upload-presigned-url'),
]
