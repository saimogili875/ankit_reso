from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.academics.models import Enrollment
from .models import ScheduleEvent, LiveClass, LiveAttendance, Notification
from .serializers import (
    ScheduleEventSerializer,
    LiveClassSerializer,
    NotificationSerializer,
)


class ScheduleListView(APIView):
    """
    Student schedule endpoint returning only items belonging to the student's enrolled courses.
    Supports tab grouping: Today, Upcoming (next 30 days), and Past.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        enrolled_course_ids = list(
            Enrollment.objects.filter(user=user, status='ACTIVE').values_list('course_id', flat=True)
        )

        if not enrolled_course_ids:
            return Response({
                'enrolled_courses_count': 0,
                'today': [],
                'upcoming': [],
                'past': [],
                'message': 'Enroll in a course to see your schedule.'
            }, status=status.HTTP_200_OK)

        now = timezone.now()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_today = start_of_today + timedelta(days=1)
        next_30_days = end_of_today + timedelta(days=30)

        # Base queryset for published events in enrolled courses
        events_qs = ScheduleEvent.objects.filter(
            course_id__in=enrolled_course_ids,
            is_published=True
        ).select_related(
            'course', 'subject', 'chapter', 'test', 'dpp', 'lecture', 'live_class'
        )

        # 1. Today items (events starting or active today)
        today_events = events_qs.filter(
            Q(start_time__range=(start_of_today, end_of_today)) |
            Q(start_time__lte=now, end_time__gte=now)
        ).order_by('start_time')

        # 2. Upcoming items (events starting after today up to 30 days)
        upcoming_events = events_qs.filter(
            start_time__gte=end_of_today,
            start_time__lte=next_30_days
        ).order_by('start_time')

        # 3. Past items (events before today)
        past_events = events_qs.filter(
            start_time__lt=start_of_today
        ).order_by('-start_time')[:50]

        context = {'request': request}

        return Response({
            'enrolled_courses_count': len(enrolled_course_ids),
            'today': ScheduleEventSerializer(today_events, many=True, context=context).data,
            'upcoming': ScheduleEventSerializer(upcoming_events, many=True, context=context).data,
            'past': ScheduleEventSerializer(past_events, many=True, context=context).data,
        }, status=status.HTTP_200_OK)


class ScheduleTodayView(APIView):
    """
    Returns today's schedule items plus any currently 'LIVE' session for Home banner.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        enrolled_course_ids = list(
            Enrollment.objects.filter(user=user, status='ACTIVE').values_list('course_id', flat=True)
        )

        if not enrolled_course_ids:
            return Response({
                'events': [],
                'live_now': None,
            }, status=status.HTTP_200_OK)

        now = timezone.now()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_today = start_of_today + timedelta(days=1)

        today_events = ScheduleEvent.objects.filter(
            course_id__in=enrolled_course_ids,
            is_published=True,
            start_time__range=(start_of_today, end_of_today)
        ).select_related('course', 'subject', 'chapter', 'live_class').order_by('start_time')

        # Find any currently live class
        live_now_class = LiveClass.objects.filter(
            course_id__in=enrolled_course_ids,
            status=LiveClass.Status.LIVE
        ).first()

        if not live_now_class:
            # Check if there is a class whose scheduled time is now
            live_now_class = LiveClass.objects.filter(
                course_id__in=enrolled_course_ids,
                status=LiveClass.Status.SCHEDULED,
                start_time__lte=now,
                end_time__gte=now
            ).first()

        context = {'request': request}

        return Response({
            'events': ScheduleEventSerializer(today_events, many=True, context=context).data,
            'live_now': LiveClassSerializer(live_now_class, context=context).data if live_now_class else None,
        }, status=status.HTTP_200_OK)


class LiveClassJoinView(APIView):
    """
    Student joins a live class:
    - Enforces course enrollment
    - Records LiveAttendance timestamp
    - Returns join_url and class details
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = LiveClass.objects.filter(id=pk).first()
        if not live_class:
            return Response({'error': 'Live class not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_enrolled = Enrollment.objects.filter(
            user=user,
            course=live_class.course,
            status='ACTIVE'
        ).exists()

        if not is_enrolled and not (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            return Response({
                'error': f"You must be enrolled in '{live_class.course.title}' to join this live class."
            }, status=status.HTTP_403_FORBIDDEN)

        # Record attendance
        LiveAttendance.objects.get_or_create(
            live_class=live_class,
            student=user
        )

        return Response({
            'message': 'Attendance recorded successfully.',
            'title': live_class.title,
            'platform': live_class.platform,
            'join_url': live_class.join_url,
        }, status=status.HTTP_200_OK)


class NotificationListView(APIView):
    """
    Returns notifications for the current authenticated student, with unread count.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        notifications = Notification.objects.filter(
            Q(user=user) | Q(user__isnull=True)
        ).order_by('-created_at')[:30]

        unread_count = Notification.objects.filter(
            Q(user=user) | Q(user__isnull=True),
            is_read=False
        ).count()

        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            'unread_count': unread_count,
            'notifications': serializer.data
        }, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        if pk == 'all' or request.data.get('mark_all'):
            Notification.objects.filter(
                Q(user=request.user) | Q(user__isnull=True)
            ).update(is_read=True)
            return Response({'message': 'All notifications marked as read.'}, status=status.HTTP_200_OK)

        notification = Notification.objects.filter(id=pk).first()
        if not notification:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marked as read.'}, status=status.HTTP_200_OK)
