from django.contrib import admin
from .models import Test, TestQuestion, TestAttempt

@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ['title', 'test_type', 'duration_minutes', 'total_marks', 'is_published']

@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = ['user', 'test', 'score', 'completed_at']
