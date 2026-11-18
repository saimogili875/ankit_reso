from django.urls import path
from .views import (
    AnalyticsOverviewView,
    AnalyticsTrendsView,
    AnalyticsChaptersView,
    AnalyticsNotebookView,
    NotebookToggleReviseView,
    RankPredictorForecastView,
)

urlpatterns = [
    path('', AnalyticsOverviewView.as_view(), name='analytics-root'),
    path('overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('trends/', AnalyticsTrendsView.as_view(), name='analytics-trends'),
    path('chapters/', AnalyticsChaptersView.as_view(), name='analytics-chapters'),
    path('notebook/', AnalyticsNotebookView.as_view(), name='analytics-notebook'),
    path('notebook/<str:pk>/revise/', NotebookToggleReviseView.as_view(), name='analytics-notebook-revise'),
    path('rank-predictor/', RankPredictorForecastView.as_view(), name='analytics-rank-predictor'),
]
