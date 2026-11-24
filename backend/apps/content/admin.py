from django.contrib import admin
from .models import Video, StudentResult

@admin.register(StudentResult)
class StudentResultAdmin(admin.ModelAdmin):
    list_display = ['name', 'exam', 'rank', 'year', 'consent_flag', 'is_published', 'display_order']
    list_filter = ['exam', 'year', 'consent_flag', 'is_published']
    search_fields = ['name', 'rank', 'notes']
    list_editable = ['consent_flag', 'is_published', 'display_order']

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ['title', 'lecture', 'video_source_type', 'duration_seconds', 'is_free_preview']
    list_filter = ['video_source_type', 'is_free_preview']
    search_fields = ['title', 'youtube_video_id', 'r2_object_key']
