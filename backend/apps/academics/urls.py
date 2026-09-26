from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class AcademicsOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Academics API foundation operational'})

urlpatterns = [
    path('', AcademicsOverviewView.as_view(), name='academics-overview'),
]
