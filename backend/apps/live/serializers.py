from rest_framework import serializers
from .models import LiveClass, LiveAttendance, LiveChatMessage, HandRaise, Recording, LivePoll, LivePollOption, LivePollVote
from apps.academics.models import Enrollment


class LiveClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    chapter_name = serializers.CharField(source='chapter.name', read_only=True, default='')
    teacher_display_name = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    online_count = serializers.SerializerMethodField()

    class Meta:
        model = LiveClass
        fields = [
            'id',
            'title',
            'description',
            'course',
            'course_title',
            'subject',
            'subject_name',
            'chapter',
            'chapter_name',
            'teacher',
            'teacher_name',
            'teacher_display_name',
            'start_time',
            'end_time',
            'status',
            'platform',
            'room_name',
            'max_students',
            'chat_enabled',
            'student_mic_policy',
            'recording_status',
            'recording_url',
            'recording_published',
            'is_recording_published',
            'peak_concurrent_users',
            'total_attendees_count',
            'is_enrolled',
            'online_count',
            'created_at',
            'updated_at',
        ]

    def get_teacher_display_name(self, obj):
        if obj.teacher:
            return obj.teacher.get_full_name() or obj.teacher.email
        return obj.teacher_name or 'Faculty Educator'

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'ADMIN':
            return True
        return Enrollment.objects.filter(
            user=request.user,
            course=obj.course,
            status='ACTIVE'
        ).exists()

    def get_online_count(self, obj):
        return obj.attendances.filter(is_online=True).count()


class LiveAttendanceSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = LiveAttendance
        fields = [
            'id',
            'student',
            'student_email',
            'student_name',
            'joined_at',
            'left_at',
            'total_seconds',
            'reconnect_count',
            'is_online',
            'device_info',
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.email


class LiveChatMessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.CharField(source='sender.email', read_only=True)

    class Meta:
        model = LiveChatMessage
        fields = [
            'id',
            'live_class',
            'sender',
            'sender_name',
            'sender_email',
            'sender_role',
            'message',
            'is_pinned',
            'is_deleted',
            'created_at',
        ]
        read_only_fields = ['id', 'sender', 'sender_name', 'sender_role', 'created_at']


class HandRaiseSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = HandRaise
        fields = [
            'id',
            'live_class',
            'student',
            'student_email',
            'student_name',
            'status',
            'raised_at',
            'responded_at',
        ]
        read_only_fields = ['id', 'student', 'raised_at', 'responded_at']

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.email


class RecordingSerializer(serializers.ModelSerializer):
    live_class_title = serializers.CharField(source='live_class.title', read_only=True)

    class Meta:
        model = Recording
        fields = [
            'id',
            'live_class',
            'live_class_title',
            'title',
            'video_url',
            'thumbnail_url',
            'duration_seconds',
            'file_size_bytes',
            'status',
            'published_lecture',
            'published_at',
            'created_at',
        ]


class LivePollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()

    class Meta:
        model = LivePollOption
        fields = ['id', 'option_text', 'order', 'vote_count']

    def get_vote_count(self, obj):
        return obj.votes.count()


class LivePollSerializer(serializers.ModelSerializer):
    options = LivePollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()

    class Meta:
        model = LivePoll
        fields = ['id', 'live_class', 'question', 'is_active', 'options', 'total_votes', 'has_voted', 'created_at']

    def get_total_votes(self, obj):
        return LivePollVote.objects.filter(poll=obj).count()

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return LivePollVote.objects.filter(poll=obj, student=request.user).exists()
