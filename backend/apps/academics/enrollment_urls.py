from django.urls import path
from .views import EnrollView, MyCoursesView

urlpatterns = [
    path('enroll/', EnrollView.as_view(), name='enroll'),
    path('my-courses/', MyCoursesView.as_view(), name='my-courses'),
]
