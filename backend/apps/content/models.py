from django.db import models
from apps.core.models import TimeStampedModel
from apps.academics.models import Topic, Lecture

class Video(TimeStampedModel):
    """
    Video entity supporting both YOUTUBE and CLOUD (Cloudflare R2) storage backends.
    Belongs to a Lecture (and optionally a Topic).
    """
    class VideoSourceType(models.TextChoices):
        YOUTUBE = 'YOUTUBE', 'YouTube Video'
        CLOUD = 'CLOUD', 'Cloudflare R2 Hosted'

    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='videos', null=True, blank=True)
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='videos', null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    duration_seconds = models.IntegerField(default=0)
    video_source_type = models.CharField(
        max_length=20,
        choices=VideoSourceType.choices,
        default=VideoSourceType.YOUTUBE
    )
    
    # Store YouTube video ID or full URL if YOUTUBE
    youtube_video_id = models.CharField(max_length=100, blank=True, null=True)

    # Store Cloudflare R2 file/object reference key if CLOUD
    r2_object_key = models.CharField(max_length=500, blank=True, null=True)

    # Thumbnail storage reference (R2 key or external URL)
    thumbnail_key = models.CharField(max_length=500, blank=True, null=True)

    is_free_preview = models.BooleanField(default=False)

    def __str__(self):
        return f"[{self.video_source_type}] {self.title}"
