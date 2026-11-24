from rest_framework import serializers
from django.utils import timezone
from .models import (
    Video, HeroSlide, QuickAccessItem, Announcement, Doubt,
    ScheduleEvent, Notification,
    LandingBanner, LandingBannerSettings, StudentResult
)

class StudentResultSerializer(serializers.ModelSerializer):
    """
    Public student/parent-facing serializer for verified achievements.
    Excludes internal verification notes and raw consent flags.
    """
    class Meta:
        model = StudentResult
        fields = [
            'id',
            'name',
            'exam',
            'rank',
            'year',
            'photo',
            'display_order',
        ]
        read_only_fields = fields

class VideoSerializer(serializers.ModelSerializer):
    lecture_title = serializers.CharField(source='lecture.title', read_only=True)
    chapter_name = serializers.CharField(source='lecture.chapter.name', read_only=True)

    class Meta:
        model = Video
        fields = [
            'id', 'lecture', 'lecture_title', 'chapter_name', 'topic', 'title', 'description', 
            'duration_seconds', 'video_source_type', 'status', 'processing_progress', 'error_message',
            'original_key', 'hls_manifest_key', 'poster_key', 'sprite_key', 'vtt_key',
            'source_width', 'source_height', 'source_fps', 'file_size', 'renditions',
            'youtube_video_id', 'r2_object_key', 'thumbnail_key', 'is_free_preview',
            'is_published', 'processed_at', 'created_at'
        ]

class HeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSlide
        fields = '__all__'

class QuickAccessItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickAccessItem
        fields = '__all__'

class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = '__all__'

class DoubtSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    replied_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Doubt
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name',
            'title', 'question_text', 'image_url', 'status',
            'reply_text', 'replied_by_name', 'replied_at', 'created_at'
        ]
        read_only_fields = ['student', 'status', 'reply_text', 'replied_by_name', 'replied_at']

    def get_student_name(self, obj):
        name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return name or obj.student.username

    def get_replied_by_name(self, obj):
        if not obj.replied_by:
            return None
        name = f"{obj.replied_by.first_name} {obj.replied_by.last_name}".strip()
        return name or obj.replied_by.username


class ScheduleEventSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    status_label = serializers.SerializerMethodField()
    is_attended = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleEvent
        fields = [
            'id', 'course', 'course_title', 'event_type', 'title', 'description',
            'subject', 'subject_name', 'chapter', 'chapter_name',
            'start_time', 'end_time', 'link',
            'test', 'dpp', 'lecture',
            'status_label', 'is_attended', 'is_completed',
            'is_published', 'created_at'
        ]

    def get_status_label(self, obj):
        now = timezone.now()
        if obj.end_time and now > obj.end_time:
            return 'Done' if self.get_is_completed(obj) else 'Missed'
        elif obj.start_time > now:
            return 'Upcoming'
        else:
            return 'Active'

    def get_is_attended(self, obj):
        return False

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if obj.test:
            from apps.tests.models import TestAttempt
            return TestAttempt.objects.filter(test=obj.test, user=request.user).exists()
        if obj.dpp:
            from apps.progress.models import DPPAttempt
            return DPPAttempt.objects.filter(dpp=obj.dpp, user=request.user).exists()
        if obj.lecture:
            from apps.progress.models import VideoProgress
            return VideoProgress.objects.filter(video__lecture=obj.lecture, user=request.user, completed=True).exists()
        return False


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'link_url', 'is_read', 'created_at'
        ]


class VideoSerializer(serializers.ModelSerializer):
    lecture_title = serializers.CharField(source='lecture.title', read_only=True)
    chapter_name = serializers.CharField(source='lecture.chapter.name', read_only=True)

    class Meta:
        model = Video
        fields = [
            'id', 'lecture', 'lecture_title', 'chapter_name', 'topic', 'title', 'description', 
            'duration_seconds', 'video_source_type', 'status', 'processing_progress', 'error_message',
            'original_key', 'hls_manifest_key', 'poster_key', 'sprite_key', 'vtt_key',
            'source_width', 'source_height', 'source_fps', 'file_size', 'renditions',
            'youtube_video_id', 'r2_object_key', 'thumbnail_key', 'is_free_preview',
            'is_published', 'processed_at', 'created_at'
        ]

class HeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSlide
        fields = '__all__'

class QuickAccessItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickAccessItem
        fields = '__all__'

class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = '__all__'

class DoubtSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    replied_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Doubt
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name',
            'title', 'question_text', 'image_url', 'status',
            'reply_text', 'replied_by_name', 'replied_at', 'created_at'
        ]
        read_only_fields = ['student', 'status', 'reply_text', 'replied_by_name', 'replied_at']

    def get_student_name(self, obj):
        name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return name or obj.student.username

    def get_replied_by_name(self, obj):
        if not obj.replied_by:
            return None
        name = f"{obj.replied_by.first_name} {obj.replied_by.last_name}".strip()
        return name or obj.replied_by.username


class LandingBannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = LandingBanner
        fields = [
            'id', 'title', 'caption', 'image_url', 'link_url',
            'show_from', 'show_until', 'order', 'is_active', 'created_at'
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or ''


class LandingBannerSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingBannerSettings
        fields = ['display_count']


