from django.urls import path
from .views import MaterialListView

urlpatterns = [
    path('', MaterialListView.as_view(), name='material-list'),
]
