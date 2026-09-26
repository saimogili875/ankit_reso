from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class AnalyticsOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Analytics API foundation operational'})

urlpatterns = [
    path('', AnalyticsOverviewView.as_view(), name='analytics-overview'),
]
