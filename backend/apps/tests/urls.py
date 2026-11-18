from django.urls import path
from .views import (
    TestListView,
    TestStartView,
    TestEventLogView,
    TestSubmitView,
    TestResultView,
    TestQuestionsReviewView,
    QuestionTagUpdateView,
)

urlpatterns = [
    path('', TestListView.as_view(), name='test-list'),
    path('<str:pk>/start/', TestStartView.as_view(), name='test-start'),
    path('attempts/<str:pk>/event/', TestEventLogView.as_view(), name='test-attempt-event'),
    path('attempts/<str:pk>/submit/', TestSubmitView.as_view(), name='test-attempt-submit'),
    path('attempts/<str:pk>/result/', TestResultView.as_view(), name='test-attempt-result'),
    path('attempts/<str:pk>/questions/', TestQuestionsReviewView.as_view(), name='test-attempt-questions'),
    path('attempts/<str:pk>/tag-question/', QuestionTagUpdateView.as_view(), name='test-attempt-tag'),
    # Backwards compatibility
    path('<str:pk>/submit/', TestSubmitView.as_view(), name='test-submit-compat'),
    path('attempts/<str:pk>/', TestResultView.as_view(), name='test-attempt-detail-compat'),
]
