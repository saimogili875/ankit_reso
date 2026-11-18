import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.academics.models import Course, Subject, Chapter, Lecture


class LiveClass(TimeStampedModel):
    """
    Live Class session conducted via LiveKit with WebRTC audio/video/screenshare.
    Supports role-based token permissions, participant management, and R2 recording.
    """
    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        LIVE = 'LIVE', 'Live Now'
        ENDED = 'ENDED', 'Ended'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class Platform(models.TextChoices):
        LIVEKIT = 'LIVEKIT', 'LiveKit WebRTC Room'
        YOUTUBE_LIVE = 'YOUTUBE_LIVE', 'YouTube Live Stream'
        ZOOM = 'ZOOM', 'Zoom Meeting'
        OTHER = 'OTHER', 'Other Platform'

    class StudentMicPolicy(models.TextChoices):
        OFF = 'OFF', 'Mic Disallowed / Muted'
        ON_REQUEST = 'ON_REQUEST', 'Mic on Hand-Raise Approval'
        OPEN = 'OPEN', 'Open Discussion / Free Mic'

    class RecordingStatus(models.TextChoices):
        NONE = 'NONE', 'No Recording'
        RECORDING = 'RECORDING', 'Recording In Progress'
        PROCESSING = 'PROCESSING', 'Processing Recording'
        READY = 'READY', 'Recording Ready'
        FAILED = 'FAILED', 'Recording Failed'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='live_classes')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_classes')
    chapter = models.ForeignKey(Chapter, on_delete=models.SET_NULL, null=True, blank=True, related_name='live_classes')

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_live_classes'
    )
    teacher_name = models.CharField(max_length=150, blank=True, default='Faculty Educator')

    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    platform = models.CharField(max_length=30, choices=Platform.choices, default=Platform.LIVEKIT)
    join_url = models.CharField(max_length=500, blank=True)

    # LiveKit Room Config
    room_name = models.CharField(max_length=255, unique=True, blank=True)
    max_students = models.IntegerField(default=100)
    chat_enabled = models.BooleanField(default=True)
    student_mic_policy = models.CharField(
        max_length=20,
        choices=StudentMicPolicy.choices,
        default=StudentMicPolicy.ON_REQUEST
    )

    # LiveKit Egress & Recording
    egress_id = models.CharField(max_length=128, blank=True)
    recording_status = models.CharField(
        max_length=20,
        choices=RecordingStatus.choices,
        default=RecordingStatus.NONE
    )
    recording_url = models.CharField(max_length=500, blank=True)
    recording_duration_seconds = models.IntegerField(default=0)
    recording_published = models.BooleanField(default=False)
    is_recording_published = models.BooleanField(default=False)
    recording_lecture = models.ForeignKey(
        'academics.Lecture',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='live_class_recordings'
    )

    # Session Metrics & Scale
    peak_concurrent_users = models.IntegerField(default=0)
    total_attendees_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['start_time']
        verbose_name = 'Live Class'
        verbose_name_plural = 'Live Classes'

    def __str__(self):
        return f"{self.title} ({self.status}) [{self.course.title}]"

    def save(self, *args, **kwargs):
        if not self.room_name:
            uid = str(uuid.uuid4())[:8]
            self.room_name = f"room_live_{uid}"
        if not self.teacher_name and self.teacher:
            self.teacher_name = self.teacher.get_full_name() or self.teacher.email
        self.recording_published = self.is_recording_published
        super().save(*args, **kwargs)


class LiveAttendance(TimeStampedModel):
    """
    Logs student attendance, connection status, reconnects, and watch time in Live Classes.
    """
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_attendances'
    )
    joined_at = models.DateTimeField(default=timezone.now)
    left_at = models.DateTimeField(null=True, blank=True)
    total_seconds = models.IntegerField(default=0)
    reconnect_count = models.IntegerField(default=0)
    is_online = models.BooleanField(default=False)
    device_info = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('live_class', 'student')
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.student.email} - {self.live_class.title}"

    def mark_joined(self):
        self.is_online = True
        self.reconnect_count += 1
        self.joined_at = timezone.now()
        self.save(update_fields=['is_online', 'reconnect_count', 'joined_at', 'updated_at'])

    def mark_left(self):
        if self.is_online and self.joined_at:
            session_duration = int((timezone.now() - self.joined_at).total_seconds())
            self.total_seconds += max(0, session_duration)
        self.is_online = False
        self.left_at = timezone.now()
        self.save(update_fields=['is_online', 'total_seconds', 'left_at', 'updated_at'])


class LiveChatMessage(TimeStampedModel):
    """
    In-room chat messages for Live Classes. Supports pinning and admin moderation/deletion.
    """
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='chat_messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_chat_messages'
    )
    sender_name = models.CharField(max_length=150, blank=True)
    sender_role = models.CharField(max_length=20, default='STUDENT')
    message = models.TextField()
    is_pinned = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.live_class.title}] {self.sender_name}: {self.message[:30]}"


class HandRaise(TimeStampedModel):
    """
    Queue of students requesting microphone speak access during a Live Class.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Mic Approved'
        DENIED = 'DENIED', 'Denied'
        LOWERED = 'LOWERED', 'Lowered by Student'

    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='hand_raises')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hand_raises'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    raised_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handled_hand_raises'
    )

    class Meta:
        ordering = ['raised_at']

    def __str__(self):
        return f"{self.student.email} HandRaise ({self.status}) for {self.live_class.title}"


class Recording(TimeStampedModel):
    """
    Recorded session captured via LiveKit Egress stored on Cloudflare R2.
    Starts as DRAFT, reviewed by admin, and published into Learn (as a Chapter Lecture).
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft / Under Review'
        PUBLISHED = 'PUBLISHED', 'Published to Learn'
        ARCHIVED = 'ARCHIVED', 'Archived'

    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='recordings')
    title = models.CharField(max_length=255)
    video_url = models.CharField(max_length=500)
    thumbnail_url = models.CharField(max_length=500, blank=True)
    duration_seconds = models.IntegerField(default=0)
    file_size_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_lecture = models.ForeignKey(
        'academics.Lecture',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recordings'
    )
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.status})"


class LivePoll(TimeStampedModel):
    """
    Interactive in-class live poll.
    """
    live_class = models.ForeignKey(LiveClass, on_delete=models.CASCADE, related_name='polls')
    question = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Poll: {self.question[:40]}"


class LivePollOption(TimeStampedModel):
    poll = models.ForeignKey(LivePoll, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=255)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.option_text}"


class LivePollVote(TimeStampedModel):
    poll = models.ForeignKey(LivePoll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(LivePollOption, on_delete=models.CASCADE, related_name='votes')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='poll_votes'
    )

    class Meta:
        unique_together = ('poll', 'student')
