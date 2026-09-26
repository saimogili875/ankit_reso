from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class TestsOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Tests API foundation operational'})

urlpatterns = [
    path('', TestsOverviewView.as_view(), name='tests-overview'),
]
