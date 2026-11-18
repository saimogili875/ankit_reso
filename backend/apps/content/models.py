from django.db import models
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.academics.models import Topic, Lecture, Subject, Course, Chapter

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


class LiveClass(TimeStampedModel):
    """
    Live teaching sessions (YouTube Live / Zoom / Google Meet).
    """
    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        LIVE = 'LIVE', 'Live Now'
        ENDED = 'ENDED', 'Ended'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class Platform(models.TextChoices):
        YOUTUBE_LIVE = 'YOUTUBE_LIVE', 'YouTube Live'
        ZOOM = 'ZOOM', 'Zoom Meeting'
        MEET = 'MEET', 'Google Meet'
        OTHER = 'OTHER', 'Other Platform'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='live_classes')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_classes')
    chapter = models.ForeignKey(Chapter, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_classes')
    teacher = models.CharField(max_length=150, default='Faculty Educator')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    platform = models.CharField(max_length=30, choices=Platform.choices, default=Platform.YOUTUBE_LIVE)
    join_url = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    recording_url = models.CharField(max_length=500, blank=True)
    recording_published = models.BooleanField(default=False)
    recording_lecture = models.ForeignKey(Lecture, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_class_recordings')

    class Meta:
        ordering = ['start_time']
        verbose_name_plural = 'Live Classes'

    def __str__(self):
        return f"{self.title} ({self.status}) [{self.course.title}]"


class LiveAttendance(TimeStampedModel):
    """
    Attendance records for students attending live classes.
    """
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='live_attendances')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('live_class', 'student')
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.student.email} - {self.live_class.title}"


class ScheduleEvent(TimeStampedModel):
    """
    Calendar and timetable items per course.
    """
    class EventType(models.TextChoices):
        LIVE_CLASS = 'LIVE_CLASS', 'Live Class'
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
    live_class = models.ForeignKey(LiveClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedule_events')
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
        LIVE_CLASS_REMINDER = 'LIVE_CLASS_REMINDER', 'Live Class Reminder'
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

