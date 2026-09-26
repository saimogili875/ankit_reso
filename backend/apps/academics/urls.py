from django.urls import path
from .views import (
    CourseListView, CourseDetailView, CourseClassesView, 
    ClassSubjectsView, SubjectChaptersView, ChapterLecturesView,
    EnrollView, MyCoursesView
)

urlpatterns = [
    path('courses/', CourseListView.as_view(), name='course-list'),
    path('courses/<str:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('courses/<str:pk>/classes/', CourseClassesView.as_view(), name='course-classes'),
    path('classes/<str:pk>/subjects/', ClassSubjectsView.as_view(), name='class-subjects'),
    path('subjects/<str:pk>/chapters/', SubjectChaptersView.as_view(), name='subject-chapters'),
    path('chapters/<str:pk>/lectures/', ChapterLecturesView.as_view(), name='chapter-lectures'),
    path('enrollment/enroll/', EnrollView.as_view(), name='academics-enroll'),
    path('enrollment/my-courses/', MyCoursesView.as_view(), name='academics-my-courses'),
]
