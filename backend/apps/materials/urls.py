from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class MaterialsOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Materials API foundation operational'})

urlpatterns = [
    path('', MaterialsOverviewView.as_view(), name='materials-overview'),
]
