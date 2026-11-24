from django.db import models
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.academics.models import Topic, Lecture, Subject, Course, Chapter

class Video(TimeStampedModel):
    """
    Video entity supporting both YOUTUBE and CLOUD (Cloudflare R2) storage backends.
    Belongs to a Lecture (and optionally a Topic).
    Supports multi-rendition HLS transcoding (360p, 480p, 720p, 1080p).
    """
    class VideoSourceType(models.TextChoices):
        YOUTUBE = 'YOUTUBE', 'YouTube Video'
        CLOUD = 'CLOUD', 'Cloudflare R2 Hosted'

    class Status(models.TextChoices):
        UPLOADED = 'UPLOADED', 'Original Uploaded'
        QUEUED = 'QUEUED', 'Queued for Transcoding'
        PROCESSING = 'PROCESSING', 'Processing HLS'
        READY = 'READY', 'Ready for Playback'
        FAILED = 'FAILED', 'Transcoding Failed'

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

    # Processing lifecycle and state
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.READY
    )
    processing_progress = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default='')

    # Cloudflare R2 Keys
    original_key = models.CharField(max_length=500, blank=True, null=True, help_text="R2 key of original uploaded MP4")
    r2_object_key = models.CharField(max_length=500, blank=True, null=True, help_text="Legacy or direct object key")
    hls_manifest_key = models.CharField(max_length=500, blank=True, null=True, help_text="R2 key to master.m3u8")
    poster_key = models.CharField(max_length=500, blank=True, null=True, help_text="R2 key to poster.jpg")
    sprite_key = models.CharField(max_length=500, blank=True, null=True, help_text="R2 key to thumbnail sprite sheet")
    vtt_key = models.CharField(max_length=500, blank=True, null=True, help_text="R2 key to thumbnails.vtt seek cue file")
    thumbnail_key = models.CharField(max_length=500, blank=True, null=True)

    # Technical metadata
    source_width = models.IntegerField(null=True, blank=True)
    source_height = models.IntegerField(null=True, blank=True)
    source_fps = models.FloatField(null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True, help_text="Size in bytes of original video")
    renditions = models.JSONField(default=list, blank=True, help_text="List of generated HLS renditions")
    processed_at = models.DateTimeField(null=True, blank=True)

    # Store YouTube video ID or full URL if YOUTUBE
    youtube_video_id = models.CharField(max_length=100, blank=True, null=True)

    is_free_preview = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.video_source_type}][{self.status}] {self.title}"


class VideoPlaybackStat(TimeStampedModel):
    """
    Lightweight telemetry and Quality of Experience (QoE) metric logs collected from student players.
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='playback_stats')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='playback_stats')
    lecture = models.ForeignKey(Lecture, on_delete=models.SET_NULL, null=True, blank=True, related_name='playback_stats')
    time_to_first_frame_ms = models.IntegerField(null=True, blank=True)
    startup_time_ms = models.IntegerField(null=True, blank=True)
    rebuffer_count = models.IntegerField(default=0)
    total_rebuffer_duration_ms = models.IntegerField(default=0)
    selected_quality = models.CharField(max_length=50, blank=True)
    errors = models.JSONField(default=list, blank=True)
    device_info = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Stat for Video #{self.video_id} by {self.user.email if self.user else 'Anon'} ({self.selected_quality})"


class HeroSlide(TimeStampedModel):
    """
    Admin-controlled promotional slides on the Home page.
    """
    title = models.CharField(max_length=200)
    title_highlight = models.CharField(max_length=100, blank=True)
    subtitle = models.TextField(blank=True)
    badge = models.CharField(max_length=100, default='Complete Preparation')
    features = models.JSONField(default=list, blank=True)
    original_price = models.CharField(max_length=50, default='₹7,999')
    offer_price = models.CharField(max_length=50, default='₹0')
    discount_badge = models.CharField(max_length=50, default='100% OFF (FREE)')
    cta_text = models.CharField(max_length=50, default='Enroll Free')
    cta_href = models.CharField(max_length=200, default='/learn')
    image_url = models.CharField(max_length=500, blank=True, default='/images/hero/slide-1.jpg')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title


class QuickAccessItem(TimeStampedModel):
    """
    Admin-controlled quick access navigation cards on the Home page.
    """
    title = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    icon_name = models.CharField(max_length=50, default='BookOpen')
    href = models.CharField(max_length=200)
    badge_text = models.CharField(max_length=50, blank=True)
    order = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'title']

    def __str__(self):
        return self.title


class Announcement(TimeStampedModel):
    """
    Platform-wide announcements from admins visible in the student header bell.
    """
    class AnnouncementType(models.TextChoices):
        INFO = 'INFO', 'Information'
        ALERT = 'ALERT', 'Alert / Urgent'
        UPDATE = 'UPDATE', 'Course Update'

    title = models.CharField(max_length=255)
    message = models.TextField()
    announcement_type = models.CharField(
        max_length=20,
        choices=AnnouncementType.choices,
        default=AnnouncementType.INFO
    )
    link_url = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Doubt(TimeStampedModel):
    """
    Student-submitted academic doubts with faculty/admin answers.
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        RESOLVED = 'RESOLVED', 'Resolved'

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doubts')
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='doubts')
    title = models.CharField(max_length=255, blank=True)
    question_text = models.TextField()
    image_url = models.CharField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    reply_text = models.TextField(blank=True)
    replied_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='replied_doubts')
    replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Doubt #{self.id} by {self.student.email} [{self.status}]"


class ScheduleEvent(TimeStampedModel):
    """
    Calendar and timetable items per course.
    """
    class EventType(models.TextChoices):
        EXAM = 'EXAM', 'Exam / Mock Test'
        PRACTICE_DEADLINE = 'PRACTICE_DEADLINE', 'Practice / DPP Deadline'
        RECORDED_CLASS = 'RECORDED_CLASS', 'Recorded Class Release'
        OTHER = 'OTHER', 'Assignment / Event'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='schedule_events')
    event_type = models.CharField(max_length=30, choices=EventType.choices, default=EventType.OTHER)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')
    chapter = models.ForeignKey(Chapter, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    link = models.CharField(max_length=500, blank=True)

    # Auto-linking to related entities
    test = models.ForeignKey('tests.Test', on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')
    dpp = models.ForeignKey('questions.DPP', on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')
    lecture = models.ForeignKey(Lecture, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')

    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"[{self.event_type}] {self.title} at {self.start_time}"


class Notification(TimeStampedModel):
    """
    Reminders and alert notifications for students.
    """
    class NotificationType(models.TextChoices):
        EXAM_REMINDER = 'EXAM_REMINDER', 'Exam Reminder'
        RECORDING_AVAILABLE = 'RECORDING_AVAILABLE', 'Recording Available'
        SCHEDULE_CHANGE = 'SCHEDULE_CHANGE', 'Schedule Change'
        GENERAL = 'GENERAL', 'General Notice'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices, default=NotificationType.GENERAL)
    link_url = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} [{self.notification_type}]"


class LandingBanner(TimeStampedModel):
    """
    Admin-managed banner images shown on the public landing page hero area.
    """
    title = models.CharField(max_length=255, blank=True, default='')
    caption = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to="landing/", null=True, blank=True)
    image_url = models.CharField(max_length=500, blank=True, default='', help_text="Optional fallback image URL")
    link_url = models.CharField(max_length=500, blank=True, default='')
    show_from = models.DateTimeField(null=True, blank=True)
    show_until = models.DateTimeField(null=True, blank=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title or f"Banner #{self.id}"


class LandingBannerSettings(TimeStampedModel):
    """
    Singleton configuration for landing banner display count (1 or 2).
    """
    DISPLAY_COUNT_CHOICES = (
        (1, '1 Banner'),
        (2, '2 Banners'),
    )
    display_count = models.IntegerField(choices=DISPLAY_COUNT_CHOICES, default=1)

    class Meta:
        verbose_name = 'Landing Banner Settings'
        verbose_name_plural = 'Landing Banner Settings'

    def save(self, *args, **kwargs):
        # Force single instance
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'display_count': 1})
        return obj

    def __str__(self):
        return f"Landing Banner Settings (Display: {self.display_count})"


class StudentResult(TimeStampedModel):
    """
    Verified exam rank or academic achievement with explicit student/parental consent on file.
    Only entries with consent_flag=True and is_published=True are shown publicly.
    No student photo or name may be shown without consent_flag=True (students are minors).
    """
    name = models.CharField(max_length=150)
    exam = models.CharField(max_length=100, help_text="e.g. JEE Advanced, JEE Main, CBSE Class X")
    rank = models.CharField(max_length=50, help_text="e.g. AIR 125, 99.8%ile, 98.4%")
    year = models.IntegerField(default=2024)
    photo = models.CharField(max_length=1000, blank=True, help_text="Photo URL (R2 or WebP)")
    consent_flag = models.BooleanField(
        default=False,
        help_text="Explicit written/parental consent on file to display student name/photo/rank (mandatory for minors)"
    )
    is_published = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    notes = models.TextField(blank=True, help_text="Internal verification notes / consent document reference")

    class Meta:
        ordering = ['display_order', '-year', 'created_at']
        verbose_name = 'Student Result'
        verbose_name_plural = 'Student Results'

    def __str__(self):
        return f"{self.name} - {self.exam} ({self.rank}, {self.year}) [Consent: {self.consent_flag}]"



