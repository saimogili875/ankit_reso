from django.urls import path
from .views import ProgressOverviewView, RecentActivityView, VideoProgressUpdateView

urlpatterns = [
    path('', ProgressOverviewView.as_view(), name='progress-overview'),
    path('recent/', RecentActivityView.as_view(), name='recent-activity'),
    path('video/', VideoProgressUpdateView.as_view(), name='video-progress-update'),
]
