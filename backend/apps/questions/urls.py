from django.urls import path
from .views import DPPListView, DPPQuestionsView, DPPSubmitView

urlpatterns = [
    path('dpps/', DPPListView.as_view(), name='dpp-list'),
    path('dpps/<str:pk>/questions/', DPPQuestionsView.as_view(), name='dpp-questions'),
    path('dpps/<str:pk>/submit/', DPPSubmitView.as_view(), name='dpp-submit'),
]
