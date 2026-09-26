from django.contrib import admin
from .models import Video

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ['title', 'lecture', 'video_source_type', 'duration_seconds', 'is_free_preview']
    list_filter = ['video_source_type', 'is_free_preview']
    search_fields = ['title', 'youtube_video_id', 'r2_object_key']
