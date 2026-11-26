from rest_framework import serializers
from django.utils import timezone
from apps.content.models import Video
from apps.tests.models import Test
from .models import CourseSection, ContentItem
from .utils import extract_youtube_id


class ContentItemAdminSerializer(serializers.ModelSerializer):
    """
    Serializer for Admin to manage ContentItem.
    Supports a single video input string: either a YouTube URL/ID or an existing Video ID/R2 key.
    """
    video_input = serializers.CharField(write_only=True, required=False, allow_blank=True)
    video_title = serializers.ReadOnlyField(source='video.title')
    video_source_type = serializers.ReadOnlyField(source='video.video_source_type')
    youtube_video_id = serializers.ReadOnlyField(source='video.youtube_video_id')
    exam_title = serializers.ReadOnlyField(source='exam.title')

    class Meta:
        model = ContentItem
        fields = [
            'id',
            'section',
            'title',
            'description',
            'order',
            'is_published',
            'is_free_preview',
            'subject',
            'chapter',
            'year',
            'group_label',
            'pdf',
            'solution_pdf',
            'viewer_mode',
            'video',
            'video_input',
            'video_title',
            'video_source_type',
            'youtube_video_id',
            'exam',
            'exam_title',
            'is_exam',
            'release_at',
            'solution_release_at',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        video_input = validated_data.pop('video_input', None)
        item = super().create(validated_data)
        self._handle_video_input(item, video_input)
        return item

    def update(self, instance, validated_data):
        video_input = validated_data.pop('video_input', None)
        item = super().update(instance, validated_data)
        if video_input is not None:
            self._handle_video_input(item, video_input)
        return item

    def _handle_video_input(self, item: ContentItem, video_input: str):
        if not video_input or not video_input.strip():
            return

        cleaned = video_input.strip()
        yt_id = extract_youtube_id(cleaned)
        if yt_id:
            # YouTube video
            video, _ = Video.objects.get_or_create(
                youtube_video_id=yt_id,
                defaults={
                    'title': item.title,
                    'video_source_type': Video.VideoSourceType.YOUTUBE,
                    'status': Video.Status.READY,
                    'is_published': True,
                }
            )
            item.video = video
            item.save(update_fields=['video'])
        else:
            # Check if it's an existing Video ID or Cloudflare R2 object key
            try:
                existing_video = Video.objects.filter(id=cleaned).first()
                if existing_video:
                    item.video = existing_video
                    item.save(update_fields=['video'])
            except Exception:
                pass


class CourseSectionAdminSerializer(serializers.ModelSerializer):
    """
    Serializer for Admin to manage CourseSections.
    """
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    items = ContentItemAdminSerializer(many=True, read_only=True)

    class Meta:
        model = CourseSection
        fields = [
            'id',
            'course',
            'section_type',
            'title',
            'order',
            'is_published',
            'items_count',
            'items',
            'created_at',
            'updated_at',
        ]


class ContentItemStudentSerializer(serializers.ModelSerializer):
    """
    Student-facing serializer. Strictly gates locked content:
    Non-enrolled students only receive metadata, never protected PDF keys, video URLs or exams.
    """
    is_locked = serializers.SerializerMethodField()
    is_solution_locked = serializers.SerializerMethodField()
    video_info = serializers.SerializerMethodField()
    exam_info = serializers.SerializerMethodField()
    viewer_url = serializers.SerializerMethodField()
    solution_viewer_url = serializers.SerializerMethodField()

    class Meta:
        model = ContentItem
        fields = [
            'id',
            'section',
            'title',
            'description',
            'order',
            'is_free_preview',
            'is_locked',
            'is_solution_locked',
            'subject',
            'chapter',
            'year',
            'group_label',
            'is_exam',
            'viewer_mode',
            'video_info',
            'exam_info',
            'viewer_url',
            'solution_viewer_url',
            'release_at',
            'solution_release_at',
        ]

    def _is_enrolled(self) -> bool:
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN':
            return True
        return self.context.get('is_enrolled', False)

    def get_is_locked(self, obj: ContentItem) -> bool:
        if obj.is_free_preview:
            return False
        if self._is_enrolled():
            if obj.release_at and obj.release_at > timezone.now():
                return True
            return False
        return True

    def get_is_solution_locked(self, obj: ContentItem) -> bool:
        if not self._is_enrolled():
            return True
        if obj.solution_release_at and obj.solution_release_at > timezone.now():
            return True
        return False

    def get_viewer_url(self, obj: ContentItem) -> str | None:
        if self.get_is_locked(obj) or not obj.pdf:
            return None
        return f"/api/course-content/items/{obj.id}/pages/"

    def get_solution_viewer_url(self, obj: ContentItem) -> str | None:
        if self.get_is_solution_locked(obj) or not obj.solution_pdf:
            return None
        return f"/api/course-content/items/{obj.id}/pages/?solution=1"

    def get_video_info(self, obj: ContentItem) -> dict | None:
        if self.get_is_locked(obj) or not obj.video:
            return None

        video = obj.video
        if video.video_source_type == Video.VideoSourceType.YOUTUBE:
            return {
                'id': str(video.id),
                'source_type': 'YOUTUBE',
                'youtube_video_id': video.youtube_video_id,
                'title': video.title,
                'duration_seconds': video.duration_seconds,
            }
        else:
            return {
                'id': str(video.id),
                'source_type': 'CLOUD',
                'hls_url': f"/api/content/videos/{video.id}/playback-info/",
                'title': video.title,
                'duration_seconds': video.duration_seconds,
            }

    def get_exam_info(self, obj: ContentItem) -> dict | None:
        if self.get_is_locked(obj) or not obj.exam:
            return None

        exam = obj.exam
        user = self._get_user()
        latest_attempt = None
        if user and user.is_authenticated:
            try:
                from apps.tests.models import TestAttempt
                latest_attempt = TestAttempt.objects.filter(user=user, test=exam).order_by('-created_at').first()
            except Exception:
                pass

        attempt_info = None
        if latest_attempt:
            attempt_info = {
                'id': str(latest_attempt.id),
                'is_completed': latest_attempt.is_completed,
                'score': str(latest_attempt.score),
                'rank': latest_attempt.rank,
                'percentile': str(latest_attempt.percentile) if latest_attempt.percentile else None,
            }

        return {
            'id': str(exam.id),
            'title': exam.title,
            'duration_minutes': exam.duration_minutes,
            'total_marks': exam.total_marks,
            'start_time': exam.start_time.isoformat() if exam.start_time else None,
            'end_time': exam.end_time.isoformat() if exam.end_time else None,
            'attempt_url': f"/tests/{exam.id}/attempt",
            'result_url': f"/tests/{exam.id}/result?attempt_id={latest_attempt.id}" if latest_attempt and latest_attempt.is_completed else f"/tests/{exam.id}/result",
            'attempt': attempt_info,
        }

    def _get_user(self):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return request.user
        return None


class CourseSectionStudentSerializer(serializers.ModelSerializer):
    """
    Student-facing serializer for sections, bundling items.
    """
    items = serializers.SerializerMethodField()

    class Meta:
        model = CourseSection
        fields = [
            'id',
            'section_type',
            'title',
            'order',
            'items',
        ]

    def get_items(self, obj: CourseSection):
        request = self.context.get('request')
        is_enrolled = self.context.get('is_enrolled', False)

        items_qs = obj.items.filter(is_published=True).select_related('video', 'exam', 'subject', 'chapter')
        return ContentItemStudentSerializer(
            items_qs,
            many=True,
            context={'request': request, 'is_enrolled': is_enrolled}
        ).data
