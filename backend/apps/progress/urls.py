from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class ProgressOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Progress API foundation operational'})

urlpatterns = [
    path('', ProgressOverviewView.as_view(), name='progress-overview'),
]
