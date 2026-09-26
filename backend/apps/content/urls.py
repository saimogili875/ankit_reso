from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class ContentOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Content API foundation operational'})

urlpatterns = [
    path('', ContentOverviewView.as_view(), name='content-overview'),
]
