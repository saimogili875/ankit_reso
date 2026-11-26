from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminCourseSectionViewSet,
    AdminContentItemViewSet,
    StudentCourseContentView,
    SecureItemPagesMetaView,
    SecurePageImageView,
)

router = DefaultRouter()
router.register('admin/sections', AdminCourseSectionViewSet, basename='admin-course-sections')
router.register('admin/items', AdminContentItemViewSet, basename='admin-content-items')

urlpatterns = [
    path('courses/<str:course_id>/', StudentCourseContentView.as_view(), name='student-course-content'),
    path('items/<str:item_id>/pages/', SecureItemPagesMetaView.as_view(), name='secure-item-pages-meta'),
    path('items/<str:item_id>/page/<int:page_number>/', SecurePageImageView.as_view(), name='secure-page-image'),
    path('', include(router.urls)),
]
