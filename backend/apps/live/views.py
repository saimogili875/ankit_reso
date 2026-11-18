import json
import logging
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.accounts.permissions import IsAdminRole
from apps.academics.models import Enrollment, Lecture
from apps.content.models import Notification
from .models import (
    LiveClass,
    LiveAttendance,
    LiveChatMessage,
    HandRaise,
    Recording,
    LivePoll,
    LivePollOption,
    LivePollVote,
)
from .serializers import (
    LiveClassSerializer,
    LiveAttendanceSerializer,
    LiveChatMessageSerializer,
    HandRaiseSerializer,
    RecordingSerializer,
    LivePollSerializer,
)
from .livekit_service import (
    generate_livekit_token,
    LiveKitManager,
    verify_livekit_webhook,
)

logger = logging.getLogger(__name__)


class LiveClassViewSet(viewsets.ModelViewSet):
    """
    CRUD viewset for Live Classes.
    - Students see live classes for their enrolled courses only.
    - Admins see all live classes and can create/update/delete.
    """
    serializer_class = LiveClassSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return LiveClass.objects.select_related('course', 'subject', 'chapter', 'teacher').all().order_by('-start_time')

        enrolled_course_ids = Enrollment.objects.filter(
            user=user,
            status='ACTIVE'
        ).values_list('course_id', flat=True)

        return LiveClass.objects.filter(
            course_id__in=enrolled_course_ids
        ).select_related('course', 'subject', 'chapter', 'teacher').order_by('-start_time')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminRole()]
        return [IsAuthenticated()]


class LiveTokenView(APIView):
    """
    Issues a server-enforced LiveKit access token:
    - Teacher/Admin: canPublish CAMERA, MICROPHONE, SCREEN_SHARE, roomAdmin=True
    - Student: canPublishSources=[MICROPHONE] ONLY. Camera/screen share impossible.
      Muted by default until teacher allows.
      Requires active course enrollment (403 otherwise).
      Checks room capacity limits (max_students).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        user = request.user

        is_teacher = (user.role == 'ADMIN') or (live_class.teacher_id == user.id)

        if not is_teacher:
            # Check Enrollment
            is_enrolled = Enrollment.objects.filter(
                user=user,
                course=live_class.course,
                status='ACTIVE'
            ).exists()
            if not is_enrolled:
                return Response(
                    {'error': 'You must be enrolled in this course to join the live class.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Check Max Students Capacity
            online_count = LiveAttendance.objects.filter(
                live_class=live_class,
                is_online=True
            ).count()
            if online_count >= live_class.max_students:
                return Response(
                    {'error': f'Class is full. Maximum participant capacity ({live_class.max_students}) reached.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Register student attendance record
            attendance, _ = LiveAttendance.objects.get_or_create(
                live_class=live_class,
                student=user
            )
            attendance.mark_joined()

            # Update live class metrics
            current_online = LiveAttendance.objects.filter(live_class=live_class, is_online=True).count()
            if current_online > live_class.peak_concurrent_users:
                live_class.peak_concurrent_users = current_online
            live_class.total_attendees_count = live_class.attendances.count()
            live_class.save(update_fields=['peak_concurrent_users', 'total_attendees_count'])

        # Generate cryptographic LiveKit JWT token
        token_data = generate_livekit_token(user, live_class, is_teacher=is_teacher)
        token_data['live_class'] = LiveClassSerializer(live_class, context={'request': request}).data

        return Response(token_data, status=status.HTTP_200_OK)


class LiveStartView(APIView):
    """
    Starts the Live Class. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Only the teacher or admin can start the class.'}, status=status.HTTP_403_FORBIDDEN)

        live_class.status = LiveClass.Status.LIVE
        if not live_class.start_time or live_class.start_time > timezone.now():
            live_class.start_time = timezone.now()
        live_class.save(update_fields=['status', 'start_time'])

        return Response({
            'status': 'LIVE',
            'message': 'Class is now live.',
            'live_class': LiveClassSerializer(live_class, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class LiveEndView(APIView):
    """
    Ends the Live Class session for all participants and closes the LiveKit room.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Only the teacher or admin can end the class.'}, status=status.HTTP_403_FORBIDDEN)

        live_class.status = LiveClass.Status.ENDED
        live_class.end_time = timezone.now()
        live_class.save(update_fields=['status', 'end_time'])

        # Finalize open student attendances
        for att in live_class.attendances.filter(is_online=True):
            att.mark_left()

        # Terminate room on LiveKit server
        LiveKitManager.end_room(live_class.room_name)

        return Response({
            'status': 'ENDED',
            'message': 'Class has ended.',
            'live_class': LiveClassSerializer(live_class, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class LiveMuteView(APIView):
    """
    Mutes a participant or all students. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        mute_all = request.data.get('all', False)
        identity = request.data.get('identity')

        if mute_all:
            LiveKitManager.mute_all_students(live_class.room_name)
            return Response({'status': 'ok', 'message': 'All students muted.'}, status=status.HTTP_200_OK)
        elif identity:
            LiveKitManager.mute_participant(live_class.room_name, identity)
            return Response({'status': 'ok', 'message': f'Participant {identity} muted.'}, status=status.HTTP_200_OK)

        return Response({'error': 'Provide either all=true or identity.'}, status=status.HTTP_400_BAD_REQUEST)


class LiveRemoveView(APIView):
    """
    Disconnects and removes a student from the live session. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        identity = request.data.get('identity')
        if not identity:
            return Response({'error': 'Identity required.'}, status=status.HTTP_400_BAD_REQUEST)

        LiveKitManager.remove_participant(live_class.room_name, identity)

        # Mark attendance left
        if identity.startswith('student_'):
            s_id = identity.replace('student_', '')
            LiveAttendance.objects.filter(live_class=live_class, student_id=s_id).update(is_online=False, left_at=timezone.now())

        return Response({'status': 'ok', 'message': f'Removed {identity}.'}, status=status.HTTP_200_OK)


class LiveAllowMicView(APIView):
    """
    Allows a student participant to unmute and speak. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        identity = request.data.get('identity')
        student_id = request.data.get('student_id')
        if not identity and student_id:
            identity = f"student_{student_id}"

        if not identity:
            return Response({'error': 'Identity required.'}, status=status.HTTP_400_BAD_REQUEST)

        LiveKitManager.allow_student_mic(live_class.room_name, identity)

        # Update HandRaise if any
        if identity.startswith('student_'):
            s_id = identity.replace('student_', '')
            HandRaise.objects.filter(
                live_class=live_class,
                student_id=s_id,
                status=HandRaise.Status.PENDING
            ).update(
                status=HandRaise.Status.APPROVED,
                responded_at=timezone.now(),
                responded_by=request.user
            )

        return Response({'status': 'ok', 'identity': identity, 'mic_allowed': True}, status=status.HTTP_200_OK)


class LiveDenyMicView(APIView):
    """
    Revokes microphone permission for a student participant. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        identity = request.data.get('identity')
        student_id = request.data.get('student_id')
        if not identity and student_id:
            identity = f"student_{student_id}"

        if not identity:
            return Response({'error': 'Identity required.'}, status=status.HTTP_400_BAD_REQUEST)

        LiveKitManager.deny_student_mic(live_class.room_name, identity)

        if identity.startswith('student_'):
            s_id = identity.replace('student_', '')
            HandRaise.objects.filter(
                live_class=live_class,
                student_id=s_id,
                status__in=[HandRaise.Status.PENDING, HandRaise.Status.APPROVED]
            ).update(
                status=HandRaise.Status.DENIED,
                responded_at=timezone.now(),
                responded_by=request.user
            )

        return Response({'status': 'ok', 'identity': identity, 'mic_allowed': False}, status=status.HTTP_200_OK)


class LiveMicPolicyView(APIView):
    """
    Updates the class-wide student mic policy: OFF / ON_REQUEST / OPEN.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        policy = request.data.get('policy')
        if policy not in LiveClass.StudentMicPolicy.values:
            return Response({'error': 'Invalid mic policy.'}, status=status.HTTP_400_BAD_REQUEST)

        live_class.student_mic_policy = policy
        live_class.save(update_fields=['student_mic_policy'])

        if policy == LiveClass.StudentMicPolicy.OFF:
            LiveKitManager.mute_all_students(live_class.room_name)

        return Response({'status': 'ok', 'student_mic_policy': policy}, status=status.HTTP_200_OK)


class LiveHandRaiseView(APIView):
    """
    - POST: Student raises or lowers their hand.
    - GET: Teacher/Admin or Student lists hand-raises for this class.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        hand_raises = HandRaise.objects.filter(
            live_class=live_class,
            status__in=[HandRaise.Status.PENDING, HandRaise.Status.APPROVED]
        ).select_related('student').order_by('raised_at')
        return Response(HandRaiseSerializer(hand_raises, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        student = request.user

        pending = HandRaise.objects.filter(
            live_class=live_class,
            student=student,
            status=HandRaise.Status.PENDING
        ).first()

        if pending:
            pending.status = HandRaise.Status.LOWERED
            pending.save(update_fields=['status'])
            return Response({'status': 'LOWERED', 'message': 'Hand lowered.'}, status=status.HTTP_200_OK)

        hr = HandRaise.objects.create(
            live_class=live_class,
            student=student,
            status=HandRaise.Status.PENDING
        )
        return Response(HandRaiseSerializer(hr).data, status=status.HTTP_201_CREATED)


class LiveHandRaiseRespondView(APIView):
    """
    Teacher/Admin responds to a student's hand-raise (APPROVE or DENY).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, hr_id):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        hr = get_object_or_404(HandRaise, id=hr_id, live_class=live_class)
        action = request.data.get('action', '').upper()

        identity = f"student_{hr.student_id}"

        if action == 'APPROVE':
            hr.status = HandRaise.Status.APPROVED
            hr.responded_at = timezone.now()
            hr.responded_by = request.user
            hr.save()
            LiveKitManager.allow_student_mic(live_class.room_name, identity)
            return Response({'status': 'APPROVED', 'identity': identity, 'message': 'Hand raise approved. Mic enabled.'}, status=status.HTTP_200_OK)

        elif action == 'DENY':
            hr.status = HandRaise.Status.DENIED
            hr.responded_at = timezone.now()
            hr.responded_by = request.user
            hr.save()
            LiveKitManager.deny_student_mic(live_class.room_name, identity)
            return Response({'status': 'DENIED', 'identity': identity, 'message': 'Hand raise denied.'}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action. Use APPROVE or DENY.'}, status=status.HTTP_400_BAD_REQUEST)


class LiveChatView(APIView):
    """
    - GET: list active chat messages.
    - POST: send a chat message.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        messages = live_class.chat_messages.filter(is_deleted=False).select_related('sender').order_by('created_at')[:100]
        return Response(LiveChatMessageSerializer(messages, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if not live_class.chat_enabled and request.user.role != 'ADMIN':
            return Response({'error': 'Chat is disabled for this class.'}, status=status.HTTP_400_BAD_REQUEST)

        text = request.data.get('message', '').strip()
        if not text:
            return Response({'error': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        role = 'TEACHER' if (request.user.role == 'ADMIN' or live_class.teacher_id == request.user.id) else 'STUDENT'
        msg = LiveChatMessage.objects.create(
            live_class=live_class,
            sender=request.user,
            sender_name=request.user.get_full_name() or request.user.email,
            sender_role=role,
            message=text
        )
        return Response(LiveChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class LiveChatModerateView(APIView):
    """
    Pins or deletes a chat message. Teacher/Admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, msg_id):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        msg = get_object_or_404(LiveChatMessage, id=msg_id, live_class=live_class)
        action = request.data.get('action')

        if action == 'delete':
            msg.is_deleted = True
            msg.save(update_fields=['is_deleted'])
            return Response({'status': 'deleted'}, status=status.HTTP_200_OK)
        elif action == 'pin':
            msg.is_pinned = not msg.is_pinned
            msg.save(update_fields=['is_pinned'])
            return Response({'status': 'ok', 'is_pinned': msg.is_pinned}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action. Use pin or delete.'}, status=status.HTTP_400_BAD_REQUEST)


class LiveAttendanceListView(APIView):
    """
    Returns live attendance list for teachers/admins or participant stats.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        if request.user.role != 'ADMIN' and live_class.teacher_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        attendances = live_class.attendances.select_related('student').order_by('-is_online', '-joined_at')
        return Response({
            'total_registered': attendances.count(),
            'online_count': attendances.filter(is_online=True).count(),
            'peak_concurrent': live_class.peak_concurrent_users,
            'attendees': LiveAttendanceSerializer(attendances, many=True).data
        }, status=status.HTTP_200_OK)


class LiveRecordingsView(APIView):
    """
    - GET: list recordings for a live class.
    - POST: create or register recording metadata.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        live_class = get_object_or_404(LiveClass, id=pk)
        recordings = live_class.recordings.all().order_by('-created_at')
        return Response(RecordingSerializer(recordings, many=True).data, status=status.HTTP_200_OK)


class LiveRecordingPublishView(APIView):
    """
    Reviews a draft recording and publishes it into Learn as a Chapter Lecture.
    Sends notification to enrolled students.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, rec_id):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        live_class = get_object_or_404(LiveClass, id=pk)
        recording = get_object_or_404(Recording, id=rec_id, live_class=live_class)

        lecture_title = request.data.get('title', f"Recording: {live_class.title}")
        chapter = live_class.chapter

        # Create Lecture in Learn curriculum if chapter exists
        lecture = None
        if chapter:
            order = chapter.lectures.count() + 1
            lecture = Lecture.objects.create(
                chapter=chapter,
                lecture_number=order,
                title=lecture_title,
                description=live_class.description or f"Live class recorded on {live_class.start_time.strftime('%b %d, %Y')}",
                duration_seconds=recording.duration_seconds,
                order=order,
                is_published=True
            )
            from apps.content.models import Video
            Video.objects.create(
                lecture=lecture,
                title=lecture_title,
                video_source_type=Video.VideoSourceType.CLOUD,
                r2_object_key=recording.video_url,
                duration_seconds=recording.duration_seconds
            )

        recording.status = Recording.Status.PUBLISHED
        recording.published_lecture = lecture
        recording.published_at = timezone.now()
        recording.save()

        live_class.is_recording_published = True
        live_class.recording_published = True
        live_class.recording_lecture = lecture
        live_class.save(update_fields=['is_recording_published', 'recording_published', 'recording_lecture'])

        # Notify enrolled students
        enrolled_users = Enrollment.objects.filter(
            course=live_class.course,
            status='ACTIVE'
        ).values_list('user_id', flat=True)

        notifications = [
            Notification(
                user_id=uid,
                title=f"Recording Available: {live_class.title}",
                message=f"The recording for '{live_class.title}' is now available in your course curriculum.",
                notification_type=Notification.NotificationType.RECORDING_AVAILABLE,
                link_url=f"/learn/{live_class.course_id}"
            )
            for uid in enrolled_users
        ]
        Notification.objects.bulk_create(notifications)

        return Response({
            'status': 'PUBLISHED',
            'recording': RecordingSerializer(recording).data,
            'lecture_id': str(lecture.id) if lecture else None,
            'notified_count': len(notifications)
        }, status=status.HTTP_200_OK)


class LiveWebhookView(APIView):
    """
    LiveKit webhook endpoint. Verifies cryptographic signature using WebhookReceiver.
    Handles events:
    - participant_joined: updates attendance, reconnects, peak concurrent.
    - participant_left: updates attendance duration and online status.
    - room_started: sets class status to LIVE.
    - room_finished: sets class status to ENDED, terminates open attendances.
    - egress_ended: registers R2 recording in DRAFT status for admin review.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        auth_header = request.headers.get('Authorization', '')
        body_str = request.body.decode('utf-8')

        try:
            event = verify_livekit_webhook(body_str, auth_header)
        except Exception as e:
            logger.warning(f"LiveKit webhook verification failed: {e}")
            return Response({'error': 'Invalid webhook signature.'}, status=status.HTTP_401_UNAUTHORIZED)

        event_type = event.event
        room_info = getattr(event, 'room', None)
        room_name = getattr(room_info, 'name', '') if room_info else ''

        live_class = LiveClass.objects.filter(room_name=room_name).first() if room_name else None

        if event_type == 'room_started' and live_class:
            live_class.status = LiveClass.Status.LIVE
            live_class.save(update_fields=['status'])

        elif event_type == 'room_finished' and live_class:
            live_class.status = LiveClass.Status.ENDED
            live_class.end_time = timezone.now()
            live_class.save(update_fields=['status', 'end_time'])
            for att in live_class.attendances.filter(is_online=True):
                att.mark_left()

        elif event_type == 'participant_joined' and live_class:
            part = getattr(event, 'participant', None)
            if part and part.identity.startswith('student_'):
                student_id = part.identity.replace('student_', '')
                att, _ = LiveAttendance.objects.get_or_create(live_class=live_class, student_id=student_id)
                att.mark_joined()
                curr_online = live_class.attendances.filter(is_online=True).count()
                if curr_online > live_class.peak_concurrent_users:
                    live_class.peak_concurrent_users = curr_online
                    live_class.save(update_fields=['peak_concurrent_users'])

        elif event_type == 'participant_left' and live_class:
            part = getattr(event, 'participant', None)
            if part and part.identity.startswith('student_'):
                student_id = part.identity.replace('student_', '')
                att = LiveAttendance.objects.filter(live_class=live_class, student_id=student_id).first()
                if att:
                    att.mark_left()

        elif event_type == 'egress_ended' and live_class:
            egress = getattr(event, 'egress_info', None)
            if egress:
                file_url = ''
                file_res = getattr(egress, 'file_results', [])
                if file_res:
                    file_url = getattr(file_res[0], 'filename', '') or getattr(file_res[0], 'location', '')

                if not file_url:
                    file_url = live_class.recording_url or f"https://r2.storage.example/recordings/{live_class.room_name}.mp4"

                rec = Recording.objects.create(
                    live_class=live_class,
                    title=f"Recording: {live_class.title}",
                    video_url=file_url,
                    status=Recording.Status.DRAFT,
                    duration_seconds=int(getattr(egress, 'duration', 0) or 0)
                )
                live_class.recording_status = LiveClass.RecordingStatus.READY
                live_class.recording_url = file_url
                live_class.save(update_fields=['recording_status', 'recording_url'])

        return Response({'status': 'ok', 'event': event_type}, status=status.HTTP_200_OK)
