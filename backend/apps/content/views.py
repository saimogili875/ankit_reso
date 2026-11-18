import os
import re
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from storage.service import storage_service
from apps.academics.models import Lecture
from apps.accounts.permissions import IsAdminRole
from .models import Video, HeroSlide, QuickAccessItem, Announcement, Doubt
from .serializers import (
    VideoSerializer,
    HeroSlideSerializer,
    QuickAccessItemSerializer,
    AnnouncementSerializer,
    DoubtSerializer,
)

class LectureVideoView(APIView):
    def get(self, request, pk):
        video = None
        try:
            video = Video.objects.filter(lecture_id=pk).first() or Video.objects.filter(id=pk).first()
        except Exception:
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


class VideoListView(generics.ListAPIView):
    serializer_class = VideoSerializer
    queryset = Video.objects.all()


class HeroSlideListView(generics.ListAPIView):
    serializer_class = HeroSlideSerializer

    def get_queryset(self):
        return HeroSlide.objects.filter(is_active=True).order_by('order', '-created_at')


class QuickAccessListView(generics.ListAPIView):
    serializer_class = QuickAccessItemSerializer

    def get_queryset(self):
        return QuickAccessItem.objects.filter(is_visible=True).order_by('order', 'title')


class AnnouncementListView(generics.ListAPIView):
    serializer_class = AnnouncementSerializer

    def get_queryset(self):
        return Announcement.objects.filter(is_active=True).order_by('-created_at')


class StudentDoubtListView(generics.ListCreateAPIView):
    serializer_class = DoubtSerializer

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
