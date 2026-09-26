from rest_framework import serializers
from .models import Video

class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = [
            'id', 'lecture', 'topic', 'title', 'description', 
            'duration_seconds', 'video_source_type', 'youtube_video_id', 
            'r2_object_key', 'thumbnail_key', 'is_free_preview'
        ]
