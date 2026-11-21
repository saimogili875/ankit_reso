from django.core.exceptions import ValidationError
import os
import re
import math
import uuid
import logging
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from storage.service import storage_service
from apps.academics.models import Lecture
from apps.accounts.permissions import IsAdminRole
from .models import (
    Video, HeroSlide, QuickAccessItem, Announcement, Doubt, VideoPlaybackStat,
    LandingBanner, LandingBannerSettings
)
from .serializers import (
    VideoSerializer,
    HeroSlideSerializer,
    QuickAccessItemSerializer,
    AnnouncementSerializer,
    DoubtSerializer,
    LandingBannerSerializer,
    LandingBannerSettingsSerializer,
)
from .chatbot_service import generate_chatbot_response

logger = logging.getLogger(__name__)


class LectureVideoView(APIView):
    def get(self, request, pk):
        video = None
        try:
            video = Video.objects.filter(lecture_id=pk).first() or Video.objects.filter(id=pk).first()
        except (ValidationError, ValueError):
            video = None

        if not video:
            try:
                lecture = Lecture.objects.get(id=pk)
                return Response({
                    'id': None,
                    'lecture_id': str(lecture.id),
                    'title': lecture.title,
                    'video_url': None,
                    'message': 'No video uploaded yet for this lecture.',
                }, status=status.HTTP_404_NOT_FOUND)
            except (Lecture.DoesNotExist, Exception):
                return Response({'error': 'Video or Lecture not found'}, status=status.HTTP_404_NOT_FOUND)

        play_url = None
        if video.video_source_type == Video.VideoSourceType.CLOUD and video.r2_object_key:
            play_url = storage_service.get_secure_video_url(video.r2_object_key)
        elif video.youtube_video_id:
            vid = video.youtube_video_id.strip()
            if vid.startswith('http'):
                play_url = vid
            else:
                play_url = f"https://www.youtube.com/watch?v={vid}"

        serializer_data = VideoSerializer(video).data
        serializer_data['video_url'] = play_url

        return Response(serializer_data, status=status.HTTP_200_OK)


class LecturePlaybackView(APIView):
    """
    Secure HLS playback endpoint for students and admins.
    - Checks course enrollment for students (returns 403 Forbidden if not enrolled and not free preview).
    - Generates short-lived cryptographically signed token (HMAC-SHA256, 6 hours expiry).
    - Returns master.m3u8 HLS URL, thumbnail WebVTT URL, poster URL, student's resume position (VideoProgress),
      and video renditions metadata.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        lecture = Lecture.objects.filter(id=pk).select_related('chapter__category__subject').first()
        video = None
        if lecture:
            video = Video.objects.filter(lecture=lecture).first()
        else:
            video = Video.objects.filter(id=pk).select_related('lecture').first()
            if video:
                lecture = video.lecture

        if not video:
            return Response({'error': 'Video or Lecture not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce enrollment check (Admins bypass; free previews bypass)
        is_admin = (user.is_staff or getattr(user, 'role', '') == 'ADMIN')
        if not is_admin and not video.is_free_preview:
            course = None
            if lecture and lecture.chapter:
                subject = getattr(lecture.chapter.category, 'subject', None)
                if subject:
                    course = subject.courses.first()

            if course:
                from apps.academics.models import Enrollment
                is_enrolled = Enrollment.objects.filter(
                    user=user,
                    course=course,
                    status='ACTIVE'
                ).exists()
                if not is_enrolled:
                    return Response(
                        {'error': 'You must be enrolled in this course to access lecture video playback.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        # Fetch student resume progress
        from apps.progress.models import VideoProgress
        prog = VideoProgress.objects.filter(user=user, video=video).first()
        if not prog and lecture:
            prog = VideoProgress.objects.filter(user=user, lecture=lecture).first()

        last_pos = prog.last_position_seconds if prog else 0
        watched_sec = prog.watched_seconds if prog else 0
        completed = prog.completed if prog else False
        completion_pct = float(prog.completion_percent) if prog else 0.0

        # Build secure streaming URLs
        from .streaming import build_playback_urls
        stream_data = build_playback_urls(video, user)

        return Response({
            'video_id': str(video.id),
            'lecture_id': str(lecture.id) if lecture else None,
            'title': video.title,
            'description': video.description,
            'duration_seconds': video.duration_seconds,
            'video_source_type': video.video_source_type,
            'status': video.status,
            'youtube_video_id': video.youtube_video_id,
            'manifest_url': stream_data['manifest_url'],
            'vtt_url': stream_data['vtt_url'],
            'poster_url': stream_data['poster_url'],
            'token': stream_data['token'],
            'expires_in_seconds': stream_data['expires_in_seconds'],
            'renditions': video.renditions or [],
            'last_position_seconds': last_pos,
            'watched_seconds': watched_sec,
            'completed': completed,
            'completion_percent': completion_pct,
            'is_free_preview': video.is_free_preview,
        }, status=status.HTTP_200_OK)


class VideoMultipartUploadInitiateView(APIView):
    """
    Admin endpoint to initiate an S3/R2 multipart upload for large original video files (up to 5 GB).
    Creates a Video asset in UPLOADED state and returns upload credentials.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        filename = str(request.data.get('filename', '')).strip()
        file_size = int(request.data.get('file_size', 0))
        content_type = str(request.data.get('content_type', 'video/mp4')).strip().lower()
        title = str(request.data.get('title', '')).strip() or filename
        lecture_id = request.data.get('lecture_id')

        # 5 GB limit
        MAX_SIZE = 5 * 1024 * 1024 * 1024
        if file_size > MAX_SIZE:
            return Response(
                {'error': 'File size exceeds maximum permitted limit of 5 GB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        clean_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(filename)).lstrip('.')
        if not clean_filename:
            clean_filename = f"video_{uuid.uuid4().hex[:8]}.mp4"

        unique_key = f"originals/{uuid.uuid4().hex}_{clean_filename}"

        upload_id, _ = storage_service.initiate_multipart_upload('originals', clean_filename, content_type=content_type)
        if not upload_id:
            return Response(
                {'error': 'Failed to initiate multipart upload on Cloudflare R2.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        lecture = None
        if lecture_id:
            lecture = Lecture.objects.filter(id=lecture_id).first()

        video = Video.objects.create(
            title=title,
            lecture=lecture,
            video_source_type=Video.VideoSourceType.CLOUD,
            status=Video.Status.UPLOADED,
            original_key=unique_key,
            file_size=file_size,
            processing_progress=0,
        )

        PART_SIZE = 10 * 1024 * 1024 # 10 MB per part
        num_parts = max(1, math.ceil(file_size / PART_SIZE)) if file_size > 0 else 1

        return Response({
            'upload_id': upload_id,
            'key': unique_key,
            'video_id': str(video.id),
            'part_size': PART_SIZE,
            'estimated_parts': num_parts,
        }, status=status.HTTP_200_OK)


class VideoMultipartPartUrlView(APIView):
    """
    Issues a presigned PUT URL for uploading a specific part chunk in an in-progress multipart upload.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        key = str(request.data.get('key', '')).strip()
        upload_id = str(request.data.get('upload_id', '')).strip()
        part_number = int(request.data.get('part_number', 1))

        if not (key and upload_id and part_number > 0):
            return Response({'error': 'key, upload_id, and valid part_number are required.'}, status=status.HTTP_400_BAD_REQUEST)

        url = storage_service.get_multipart_part_presigned_url(key, upload_id, part_number)
        if not url:
            return Response({'error': 'Failed to generate part upload URL.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'upload_url': url,
            'part_number': part_number,
        }, status=status.HTTP_200_OK)


class VideoMultipartUploadCompleteView(APIView):
    """
    Completes multipart upload on Cloudflare R2 and enqueues video for HLS transcoding in Celery.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        video_id = request.data.get('video_id')
        key = str(request.data.get('key', '')).strip()
        upload_id = str(request.data.get('upload_id', '')).strip()
        parts = request.data.get('parts', [])

        if not (key and upload_id and parts):
            return Response({'error': 'key, upload_id, and parts list are required.'}, status=status.HTTP_400_BAD_REQUEST)

        video = Video.objects.filter(id=video_id).first()
        if not video:
            return Response({'error': 'Video record not found.'}, status=status.HTTP_404_NOT_FOUND)

        res = storage_service.complete_multipart_upload(key, upload_id, parts)
        if not res:
            return Response({'error': 'Failed to complete multipart upload on Cloudflare R2.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        video.status = Video.Status.QUEUED
        video.original_key = key
        video.save(update_fields=['status', 'original_key'])

        # Enqueue HLS transcode task on dedicated 'video' queue
        from .tasks import transcode_video_hls_task
        transcode_video_hls_task.delay(str(video.id))

        return Response({
            'status': 'QUEUED',
            'message': 'Video successfully assembled on R2 and queued for HLS transcoding.',
            'video_id': str(video.id)
        }, status=status.HTTP_200_OK)


class VideoMultipartUploadAbortView(APIView):
    """
    Cancels an in-progress multipart upload on R2.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        key = str(request.data.get('key', '')).strip()
        upload_id = str(request.data.get('upload_id', '')).strip()
        video_id = request.data.get('video_id')

        if key and upload_id:
            storage_service.abort_multipart_upload(key, upload_id)

        if video_id:
            Video.objects.filter(id=video_id, status=Video.Status.UPLOADED).delete()

        return Response({'status': 'aborted', 'message': 'Upload aborted.'}, status=status.HTTP_200_OK)


class VideoReprocessView(APIView):
    """
    Triggers re-transcoding of an existing video asset. Admin only.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        video = get_object_or_404(Video, id=pk)
        if not video.original_key:
            return Response({'error': 'No original video source key available to reprocess.'}, status=status.HTTP_400_BAD_REQUEST)

        video.status = Video.Status.QUEUED
        video.processing_progress = 0
        video.error_message = ''
        video.save(update_fields=['status', 'processing_progress', 'error_message'])

        from .tasks import transcode_video_hls_task
        transcode_video_hls_task.delay(str(video.id))

        return Response({
            'status': 'QUEUED',
            'message': f"Video '{video.title}' re-queued for transcoding.",
            'video_id': str(video.id),
        }, status=status.HTTP_200_OK)


class VideoDetailDeleteView(APIView):
    """
    Admin endpoint to view, edit or delete a Video asset.
    Deleting removes the database record AND purges all associated R2 objects
    (original MP4, master playlist, rendition playlists, .ts segments, poster, thumbnails).
    """
    permission_classes = [IsAdminRole]

    def delete(self, request, pk):
        video = get_object_or_404(Video, id=pk)

        # 1. Purge R2 HLS directory (videos/{id}/)
        hls_prefix = f"videos/{video.id}/"
        deleted_count = storage_service.delete_prefix(hls_prefix)

        # 2. Purge original MP4 if exists
        if video.original_key:
            storage_service.delete_object(video.original_key)

        video_title = video.title
        video.delete()

        return Response({
            'status': 'deleted',
            'message': f"Video '{video_title}' and {deleted_count} cloud objects deleted successfully.",
        }, status=status.HTTP_200_OK)


class VideoPlaybackStatView(APIView):
    """
    Collects student player Quality of Experience (QoE) metrics:
    time to first frame, startup time, rebuffering events, errors, selected quality.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        video = Video.objects.filter(id=pk).first()
        if not video:
            return Response({'error': 'Video not found.'}, status=status.HTTP_404_NOT_FOUND)

        stat = VideoPlaybackStat.objects.create(
            user=request.user,
            video=video,
            lecture=video.lecture,
            time_to_first_frame_ms=request.data.get('time_to_first_frame_ms'),
            startup_time_ms=request.data.get('startup_time_ms'),
            rebuffer_count=int(request.data.get('rebuffer_count', 0)),
            total_rebuffer_duration_ms=int(request.data.get('total_rebuffer_duration_ms', 0)),
            selected_quality=str(request.data.get('selected_quality', '')),
            errors=request.data.get('errors', []),
            device_info=request.data.get('device_info', {}),
        )

        return Response({'status': 'ok', 'id': str(stat.id)}, status=status.HTTP_201_CREATED)


class VideoListView(generics.ListAPIView):
    serializer_class = VideoSerializer
    queryset = Video.objects.all()


class HeroSlideListView(generics.ListAPIView):
    serializer_class = HeroSlideSerializer
    pagination_class = None

    def get_queryset(self):
        return HeroSlide.objects.filter(is_active=True).order_by('order', '-created_at')


class QuickAccessListView(generics.ListAPIView):
    serializer_class = QuickAccessItemSerializer
    pagination_class = None

    def get_queryset(self):
        return QuickAccessItem.objects.filter(is_visible=True).order_by('order', 'title')


class AnnouncementListView(generics.ListAPIView):
    serializer_class = AnnouncementSerializer
    pagination_class = None

    def get_queryset(self):
        return Announcement.objects.filter(is_active=True).order_by('-created_at')


class StudentDoubtListView(generics.ListCreateAPIView):
    serializer_class = DoubtSerializer
    pagination_class = None

    def get_queryset(self):
        return Doubt.objects.filter(student=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)


class UploadPresignedUrlView(APIView):
    """
    Admin endpoint allowing client to get a presigned PUT upload URL from R2 storage_service.
    Protected by IsAdminRole and enforces strict filename sanitization and category whitelist.
    """
    permission_classes = [IsAdminRole]

    ALLOWED_CATEGORIES = {'video', 'thumbnail', 'material', 'image'}

    def post(self, request):
        category = str(request.data.get('category', 'video')).strip().lower()
        if category not in self.ALLOWED_CATEGORIES:
            return Response(
                {'error': f"Invalid category. Allowed categories are: {', '.join(sorted(self.ALLOWED_CATEGORIES))}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        raw_filename = str(request.data.get('filename', '')).strip()
        filename = os.path.basename(raw_filename)
        filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename).lstrip('.')

        if not filename:
            return Response(
                {'error': 'A valid filename is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        upload_url = storage_service.get_upload_presigned_url(category, filename)
        return Response({
            'upload_url': upload_url,
            'file_key': f"{category}/{filename}",
            'category': category
        }, status=status.HTTP_200_OK)


class LandingBannerListView(APIView):
    """
    Public AllowAny endpoint returning active landing banners within valid schedule window,
    plus the landing display_count configuration (1 or 2).
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        now = timezone.now()
        banners = LandingBanner.objects.filter(is_active=True).filter(
            Q(show_from__isnull=True) | Q(show_from__lte=now),
            Q(show_until__isnull=True) | Q(show_until__gte=now)
        ).order_by('order', '-created_at')

        settings = LandingBannerSettings.load()
        serializer = LandingBannerSerializer(banners, many=True, context={'request': request})

        return Response({
            'display_count': settings.display_count,
            'banners': serializer.data
        }, status=status.HTTP_200_OK)


class ChatbotView(APIView):
    """
    Public AllowAny endpoint for the Swecha assistant.
    Takes { message: str, history: list }.
    Hardened with chatbot rate throttling, message size bounds, and history sanitization.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'chatbot'

    def post(self, request):
        message = str(request.data.get('message', '')).strip()
        if not message:
            return Response({'error': 'Message content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(message) > 500:
            return Response({'error': 'Message too long. Maximum 500 characters allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_history = request.data.get('history', [])
        sanitized_history = []
        if isinstance(raw_history, list):
            # Limit history to the last 6 turns
            total_chars = 0
            for item in raw_history[-6:]:
                if isinstance(item, dict):
                    role = str(item.get('role', '')).strip().lower()
                    content = str(item.get('content', '')).strip()
                    if role in ('user', 'assistant') and content:
                        total_chars += len(content)
                        if total_chars > 3000:
                            break
                        sanitized_history.append({'role': role, 'content': content[:1000]})

        reply = generate_chatbot_response(message, sanitized_history)
        return Response({'reply': reply}, status=status.HTTP_200_OK)

