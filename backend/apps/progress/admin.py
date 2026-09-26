from django.contrib import admin
from .models import VideoProgress, QuestionAttempt, Bookmark, StudentProgress, DPPAttempt

@admin.register(DPPAttempt)
class DPPAttemptAdmin(admin.ModelAdmin):
    list_display = ['user', 'dpp', 'score', 'accuracy_percentage', 'completed_at']
    list_filter = ['dpp']

@admin.register(VideoProgress)
class VideoProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'video', 'watched_seconds', 'completed']

@admin.register(StudentProgress)
class StudentProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'videos_watched_count', 'questions_solved_count', 'overall_accuracy_percentage']
