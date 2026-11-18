from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LiveClassViewSet,
    LiveTokenView,
    LiveStartView,
    LiveEndView,
    LiveMuteView,
    LiveRemoveView,
    LiveAllowMicView,
    LiveDenyMicView,
    LiveMicPolicyView,
    LiveHandRaiseView,
    LiveHandRaiseRespondView,
    LiveChatView,
    LiveChatModerateView,
    LiveAttendanceListView,
    LiveRecordingsView,
    LiveRecordingPublishView,
    LiveWebhookView,
)

router = DefaultRouter()
router.register('classes', LiveClassViewSet, basename='live-classes-api')

urlpatterns = [
    # LiveKit Webhook
    path('webhook/', LiveWebhookView.as_view(), name='live-webhook'),

    # Live Class Core Operations
    path('<uuid:pk>/token/', LiveTokenView.as_view(), name='live-token'),
    path('<uuid:pk>/start/', LiveStartView.as_view(), name='live-start'),
    path('<uuid:pk>/end/', LiveEndView.as_view(), name='live-end'),
    path('<uuid:pk>/mute/', LiveMuteView.as_view(), name='live-mute'),
    path('<uuid:pk>/remove/', LiveRemoveView.as_view(), name='live-remove'),
    path('<uuid:pk>/allow-mic/', LiveAllowMicView.as_view(), name='live-allow-mic'),
    path('<uuid:pk>/deny-mic/', LiveDenyMicView.as_view(), name='live-deny-mic'),
    path('<uuid:pk>/mic-policy/', LiveMicPolicyView.as_view(), name='live-mic-policy'),

    # Hand-Raise Queue
    path('<uuid:pk>/hand-raise/', LiveHandRaiseView.as_view(), name='live-hand-raise'),
    path('<uuid:pk>/hand-raises/', LiveHandRaiseView.as_view(), name='live-hand-raises-list'),
    path('<uuid:pk>/hand-raise/<uuid:hr_id>/respond/', LiveHandRaiseRespondView.as_view(), name='live-hand-raise-respond'),

    # In-Room Chat
    path('<uuid:pk>/chat/', LiveChatView.as_view(), name='live-chat'),
    path('<uuid:pk>/chat/<uuid:msg_id>/moderate/', LiveChatModerateView.as_view(), name='live-chat-moderate'),

    # Attendance & Analytics
    path('<uuid:pk>/attendances/', LiveAttendanceListView.as_view(), name='live-attendances'),

    # Recordings & R2
    path('<uuid:pk>/recordings/', LiveRecordingsView.as_view(), name='live-recordings'),
    path('<uuid:pk>/recordings/<uuid:rec_id>/publish/', LiveRecordingPublishView.as_view(), name='live-recording-publish'),

    # ViewSet routes
    path('', include(router.urls)),
]
