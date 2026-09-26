from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class QuestionsOverviewView(APIView):
    def get(self, request):
        return Response({'message': 'Questions API foundation operational'})

urlpatterns = [
    path('', QuestionsOverviewView.as_view(), name='questions-overview'),
]
