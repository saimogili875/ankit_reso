from django.contrib import admin
from .models import Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment

@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']

@admin.register(AcademicClass)
class AcademicClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'slug', 'order']
    ordering = ['order', 'name']

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'color_hex']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'price', 'is_free', 'is_published']
    list_filter = ['is_published', 'is_free']
    search_fields = ['title', 'description']

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject']
    list_filter = ['subject']

@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'academic_class', 'order']
    list_filter = ['category__subject', 'academic_class']
    search_fields = ['name']

@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['name', 'chapter', 'order']

@admin.register(Lecture)
class LectureAdmin(admin.ModelAdmin):
    list_display = ['title', 'chapter', 'lecture_number', 'duration_seconds', 'is_published']
    list_filter = ['is_published', 'chapter__category__subject']
    search_fields = ['title']

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'course', 'enrolled_at', 'status']
    list_filter = ['status', 'course']
    search_fields = ['user__email', 'course__title']
