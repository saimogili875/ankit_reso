from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from storage.service import storage_service
from apps.academics.models import Lecture
from .models import Video
from .serializers import VideoSerializer

class LectureVideoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        # Look for video by lecture ID or video ID
        try:
            if pk.isdigit():
                video = Video.objects.filter(lecture_id=int(pk)).first() or Video.objects.filter(pk=int(pk)).first()
            else:
                video = Video.objects.filter(lecture_id=pk).first() or Video.objects.filter(pk=pk).first()
        except Exception:
            video = None

        if not video:
            # Fallback: check if Lecture exists and construct default video payload
            try:
                lecture = Lecture.objects.get(pk=pk)
                return Response({
                    'id': f"v-lec-{lecture.id}",
                    'lecture_id': str(lecture.id),
                    'title': lecture.title,
                    'video_source_type': 'YOUTUBE',
                    'youtube_video_id': 'dQw4w9WgXcQ',
                    'video_url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    'thumbnail_url': '/images/hero/slide-1.jpg',
                    'duration_seconds': lecture.duration_seconds or 1800,
                }, status=status.HTTP_200_OK)
            except Lecture.DoesNotExist:
                return Response({'error': 'Video or Lecture not found'}, status=status.HTTP_404_NOT_FOUND)

        play_url = None
        if video.video_source_type == Video.VideoSourceType.CLOUD and video.r2_object_key:
            # Explicit call to storage_service.get_secure_video_url()
            play_url = storage_service.get_secure_video_url(video.r2_object_key)
        elif video.youtube_video_id:
            if video.youtube_video_id.startswith('http'):
                play_url = video.youtube_video_id
            else:
                play_url = f"https://www.youtube.com/watch?v={video.youtube_video_id}"

        serializer_data = VideoSerializer(video).data
        serializer_data['video_url'] = play_url or 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

        return Response(serializer_data, status=status.HTTP_200_OK)

class VideoListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VideoSerializer
    queryset = Video.objects.all()

class UploadPresignedUrlView(APIView):
    """
    Admin endpoint allowing client to get a presigned PUT upload URL from R2 storage_service.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        category = request.data.get('category', 'video')
        filename = request.data.get('filename', 'media.mp4')
        upload_url = storage_service.get_upload_presigned_url(category, filename)
        return Response({
            'upload_url': upload_url,
            'file_key': f"{category}/{filename}",
            'category': category
        }, status=status.HTTP_200_OK)
