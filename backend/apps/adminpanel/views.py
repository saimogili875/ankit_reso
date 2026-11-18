import csv
from django.http import HttpResponse
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.db.models import Count, Q, Avg, Max, Min
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminRole
from apps.academics.models import (
    Exam, AcademicClass, Subject, Category, Chapter, Topic, Lecture, Course, Enrollment
)
from apps.content.models import (
    Video, HeroSlide, QuickAccessItem, Announcement, Doubt,
    LiveClass, LiveAttendance, ScheduleEvent, Notification
)
from apps.questions.models import Question, QuestionOption, DPP, DPPQuestion
from apps.materials.models import StudyMaterial
from apps.tests.models import (
    Test, TestSection, TestQuestion, TestAttempt, QuestionAttemptLog,
    TestAttemptAnalysis, AnalysisSettings
)
from apps.progress.models import DPPAttempt, VideoProgress
from apps.analytics.models import RankPredictor
from apps.accounts.serializers import UserSerializer

from .serializers import (
    AdminQuestionSerializer,
    AdminChapterSerializer,
    AdminLectureSerializer,
    AdminVideoSerializer,
    AdminDPPSerializer,
    AdminHeroSlideSerializer,
    AdminQuickAccessSerializer,
    AdminSubjectSerializer,
    AdminCourseSerializer,
    AdminAcademicClassSerializer,
    AdminTestSerializer,
    AdminStudyMaterialSerializer,
    AdminAnnouncementSerializer,
    AdminDoubtSerializer,
    AdminStudentSerializer,
    AdminLiveClassSerializer,
    AdminLiveAttendanceSerializer,
    AdminScheduleEventSerializer,
    AdminNotificationSerializer,
    AdminRankPredictorSerializer,
    extract_youtube_id,
)


class OverviewView(APIView):
    """
    Overview analytics and counts for the Admin Dashboard.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        data = {
            'students_count': User.objects.filter(role=User.Role.STUDENT).count(),
            'courses_count': Course.objects.count(),
            'subjects_count': Subject.objects.count(),
            'chapters_count': Chapter.objects.count(),
            'lectures_count': Lecture.objects.count(),
            'videos_count': Video.objects.count(),
            'dpps_count': DPP.objects.count(),
            'questions_count': Question.objects.count(),
            'tests_count': Test.objects.count(),
            'materials_count': StudyMaterial.objects.count(),
            'open_doubts_count': Doubt.objects.filter(status='OPEN').count(),
            'announcements_count': Announcement.objects.filter(is_active=True).count(),
            'live_classes_count': LiveClass.objects.count(),
            'schedule_events_count': ScheduleEvent.objects.count(),
        }
        return Response(data, status=status.HTTP_200_OK)


class OptionsView(APIView):
    """
    Lookup choices for forms across Question, Chapter, Lecture, Video, Test, Material, and DPP creation.
    """
    permission_classes = [IsAdminRole]

    def get(self, request):
        subjects = Subject.objects.all().order_by('order', 'name').values('id', 'name', 'slug', 'color_hex')
        categories = Category.objects.select_related('subject').all().order_by('subject__name', 'name')
        classes = AcademicClass.objects.all().order_by('order', 'name').values('id', 'name', 'code')
        courses = Course.objects.all().order_by('-created_at').values('id', 'title', 'slug')
        chapters = Chapter.objects.select_related('category__subject', 'academic_class').all().order_by('category__subject__name', 'name')
        lectures = Lecture.objects.select_related('chapter').all().order_by('chapter__name', 'lecture_number')
        exams = Exam.objects.all().values('id', 'name', 'code')

        categories_data = [
            {
                'id': str(c.id),
                'name': c.name,
                'subject_id': str(c.subject.id),
                'subject_name': c.subject.name,
            }
            for c in categories
        ]

        chapters_data = [
            {
                'id': str(ch.id),
                'name': ch.name,
                'category_id': str(ch.category.id),
                'subject_id': str(ch.category.subject.id),
                'subject_name': ch.category.subject.name,
                'class_id': str(ch.academic_class.id) if ch.academic_class else None,
                'class_name': ch.academic_class.name if ch.academic_class else None,
            }
            for ch in chapters
        ]

        lectures_data = [
            {
                'id': str(l.id),
                'title': l.title,
                'lecture_number': l.lecture_number,
                'chapter_id': str(l.chapter.id),
                'chapter_name': l.chapter.name,
            }
            for l in lectures
        ]

        tests = Test.objects.filter(is_published=True).values('id', 'title', 'test_type')
        dpps = DPP.objects.filter(is_published=True).values('id', 'title', 'chapter_id')
        live_classes = LiveClass.objects.values('id', 'title', 'course_id', 'status')

        return Response({
            'subjects': list(subjects),
            'categories': categories_data,
            'classes': list(classes),
            'courses': list(courses),
            'chapters': chapters_data,
            'lectures': lectures_data,
            'exams': list(exams),
            'tests': list(tests),
            'dpps': list(dpps),
            'live_classes': list(live_classes),
        }, status=status.HTTP_200_OK)


class HeroSlideViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminHeroSlideSerializer
    queryset = HeroSlide.objects.all().order_by('order', '-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'subtitle']


class QuickAccessViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminQuickAccessSerializer
    queryset = QuickAccessItem.objects.all().order_by('order', 'title')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description']


class SubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminSubjectSerializer
    queryset = Subject.objects.all().order_by('order', 'name')
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'slug']


class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminCourseSerializer
    queryset = Course.objects.prefetch_related('classes', 'subjects', 'enrollments').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'slug', 'subtitle', 'description']

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        course = self.get_object()
        enrollments = Enrollment.objects.filter(course=course, status='ACTIVE').select_related('user')
        data = [
            {
                'id': str(e.user.id),
                'email': e.user.email,
                'name': f"{e.user.first_name} {e.user.last_name}".strip() or e.user.username,
                'phone_number': e.user.phone_number,
                'enrolled_at': e.enrolled_at,
            }
            for e in enrollments
        ]
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='enroll-student')
    def enroll_student(self, request, pk=None):
        course = self.get_object()
        user_id = request.data.get('user_id')
        user = User.objects.filter(id=user_id, role=User.Role.STUDENT).first()
        if not user:
            return Response({'error': 'Valid student user_id is required.'}, status=status.HTTP_404_NOT_FOUND)
        Enrollment.objects.get_or_create(user=user, course=course, defaults={'status': 'ACTIVE'})
        return Response({'message': f"Student {user.email} enrolled successfully into {course.title}."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unenroll-student')
    def unenroll_student(self, request, pk=None):
        course = self.get_object()
        user_id = request.data.get('user_id')
        Enrollment.objects.filter(course=course, user_id=user_id).delete()
        return Response({'message': f"Student un-enrolled from {course.title} successfully."}, status=status.HTTP_200_OK)


class AcademicClassViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminAcademicClassSerializer
    queryset = AcademicClass.objects.all().order_by('order', 'name')
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code']


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminQuestionSerializer
    queryset = Question.objects.select_related('subject', 'chapter__category__subject', 'topic').prefetch_related('options', 'pyq_meta__exam').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['question_text', 'chapter__name', 'subject__name']

    def get_queryset(self):
        qs = super().get_queryset()
        chapter_id = self.request.query_params.get('chapter')
        subject_id = self.request.query_params.get('subject')
        difficulty = self.request.query_params.get('difficulty')

        if chapter_id:
            qs = qs.filter(chapter_id=chapter_id)
        if subject_id:
            qs = qs.filter(Q(subject_id=subject_id) | Q(chapter__category__subject_id=subject_id))
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        return qs

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        dry_run = request.query_params.get('dry_run', 'false').lower() == 'true'
        rows = request.data.get('questions', [])
        if not isinstance(rows, list) or not rows:
            return Response({'error': 'No questions data provided.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_count = 0
        errors = []
        created_ids = []

        for idx, row in enumerate(rows):
            q_text = row.get('question_text', '').strip()
            if not q_text:
                errors.append({'row': idx + 1, 'error': 'Missing question_text'})
                continue

            q_type = row.get('question_type', Question.QuestionType.SINGLE_CHOICE)
            diff = row.get('difficulty', Question.Difficulty.MEDIUM)
            subj_id = row.get('subject_id')
            chap_id = row.get('chapter_id')
            ideal_t = int(row.get('ideal_time_seconds', 120))
            sol_text = row.get('solution_text', '')

            if dry_run:
                valid_count += 1
                continue

            q_obj = Question.objects.create(
                question_text=q_text,
                question_type=q_type,
                difficulty=diff,
                subject_id=subj_id if subj_id else None,
                chapter_id=chap_id if chap_id else None,
                ideal_time_seconds=ideal_t,
                solution_text=sol_text,
            )

            for opt in row.get('options', []):
                QuestionOption.objects.create(
                    question=q_obj,
                    option_text=opt.get('option_text', ''),
                    is_correct=bool(opt.get('is_correct', False)),
                )

            created_ids.append(str(q_obj.id))
            valid_count += 1

        return Response({
            'dry_run': dry_run,
            'total_rows': len(rows),
            'valid_count': valid_count,
            'error_count': len(errors),
            'errors': errors,
            'created_ids': created_ids,
        }, status=status.HTTP_200_OK if dry_run else status.HTTP_201_CREATED)


class ChapterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminChapterSerializer
    queryset = Chapter.objects.select_related('category__subject', 'academic_class').all().order_by('category__subject__name', 'order', 'name')
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'category__subject__name', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        subject_id = self.request.query_params.get('subject')
        class_id = self.request.query_params.get('academic_class')

        if subject_id:
            qs = qs.filter(category__subject_id=subject_id)
        if class_id:
            qs = qs.filter(academic_class_id=class_id)
        return qs

    @action(detail=True, methods=['get'])
    def cascade_info(self, request, pk=None):
        chapter = self.get_object()
        return Response({
            'chapter_id': str(chapter.id),
            'chapter_name': chapter.name,
            'lectures_count': chapter.lectures.count(),
            'dpps_count': chapter.dpps.count(),
            'questions_count': chapter.questions.count(),
        }, status=status.HTTP_200_OK)


class LectureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminLectureSerializer
    queryset = Lecture.objects.select_related('chapter__category__subject').prefetch_related('videos').all().order_by('chapter', 'lecture_number')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'chapter__name']

    def get_queryset(self):
        qs = super().get_queryset()
        chapter_id = self.request.query_params.get('chapter')
        if chapter_id:
            qs = qs.filter(chapter_id=chapter_id)
        return qs

    @action(detail=True, methods=['get'])
    def cascade_info(self, request, pk=None):
        lecture = self.get_object()
        return Response({
            'lecture_id': str(lecture.id),
            'lecture_title': lecture.title,
            'videos_count': lecture.videos.count(),
        }, status=status.HTTP_200_OK)


class VideoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminVideoSerializer
    queryset = Video.objects.select_related('lecture__chapter', 'topic').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'lecture__title', 'youtube_video_id', 'r2_object_key']

    def get_queryset(self):
        qs = super().get_queryset()
        lecture_id = self.request.query_params.get('lecture')
        source_type = self.request.query_params.get('video_source_type')

        if lecture_id:
            qs = qs.filter(lecture_id=lecture_id)
        if source_type:
            qs = qs.filter(video_source_type=source_type)
        return qs


class DPPViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminDPPSerializer
    queryset = DPP.objects.select_related('chapter__category__subject').prefetch_related('dpp_questions__question').all().order_by('chapter', 'dpp_number')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'chapter__name']

    def get_queryset(self):
        qs = super().get_queryset()
        chapter_id = self.request.query_params.get('chapter')
        if chapter_id:
            qs = qs.filter(chapter_id=chapter_id)
        return qs


class TestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminTestSerializer
    queryset = Test.objects.select_related('exam').prefetch_related('test_questions__question').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        test_type = self.request.query_params.get('test_type')
        if test_type:
            qs = qs.filter(test_type=test_type)
        return qs

    @action(detail=True, methods=['post'], url_path='clone')
    def clone_test(self, request, pk=None):
        original = self.get_object()
        new_test = Test.objects.create(
            title=f"Copy of {original.title}",
            description=original.description,
            test_type=original.test_type,
            duration_minutes=original.duration_minutes,
            total_marks=original.total_marks,
            cutoff_score=original.cutoff_score,
            publish_results_immediately=original.publish_results_immediately,
            is_published=False,
            exam=original.exam,
            course=original.course,
        )

        section_map = {}
        for sec in original.sections.all():
            new_sec = TestSection.objects.create(
                test=new_test,
                subject=sec.subject,
                name=sec.name,
                order=sec.order,
                instructions=sec.instructions,
            )
            section_map[sec.id] = new_sec

        for tq in original.test_questions.all():
            TestQuestion.objects.create(
                test=new_test,
                section=section_map.get(tq.section_id),
                question=tq.question,
                order=tq.order,
                positive_marks=tq.positive_marks,
                negative_marks=tq.negative_marks,
            )

        serializer = self.get_serializer(new_test)
        return Response({
            'message': 'Test cloned successfully.',
            'test': serializer.data,
        }, status=status.HTTP_201_CREATED)


class StudyMaterialViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminStudyMaterialSerializer
    queryset = StudyMaterial.objects.select_related('subject', 'chapter').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'subject__name', 'chapter__name']

    def get_queryset(self):
        qs = super().get_queryset()
        subject_id = self.request.query_params.get('subject')
        chapter_id = self.request.query_params.get('chapter')
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if chapter_id:
            qs = qs.filter(chapter_id=chapter_id)
        return qs


class AnnouncementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminAnnouncementSerializer
    queryset = Announcement.objects.all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'message']


class DoubtViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminDoubtSerializer
    queryset = Doubt.objects.select_related('student', 'subject', 'replied_by').all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'question_text', 'student__email']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        doubt = self.get_object()
        reply_text = request.data.get('reply_text', '').strip()
        if not reply_text:
            return Response({'error': 'reply_text is required'}, status=status.HTTP_400_BAD_REQUEST)

        doubt.reply_text = reply_text
        doubt.replied_by = request.user
        doubt.replied_at = timezone.now()
        doubt.status = Doubt.Status.RESOLVED
        doubt.save()

        return Response(AdminDoubtSerializer(doubt).data, status=status.HTTP_200_OK)


class StudentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminStudentSerializer
    queryset = User.objects.filter(role=User.Role.STUDENT).select_related('student_profile').all().order_by('-date_joined')
    filter_backends = [filters.SearchFilter]
    search_fields = ['email', 'username', 'first_name', 'last_name', 'phone_number']

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        student = self.get_object()
        student.is_active = not student.is_active
        student.save()
        return Response({
            'message': f"Student account {'activated' if student.is_active else 'deactivated'} successfully.",
            'is_active': student.is_active,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        student = self.get_object()
        new_password = request.data.get('new_password', '').strip()
        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        student.set_password(new_password)
        student.save()
        return Response({'message': f"Password reset successfully for {student.email}."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='enroll')
    def enroll_course(self, request, pk=None):
        student = self.get_object()
        course_id = request.data.get('course_id')
        try:
            course = Course.objects.get(id=course_id)
        except (Course.DoesNotExist, ValueError):
            return Response({'error': 'Valid course_id is required.'}, status=status.HTTP_404_NOT_FOUND)

        Enrollment.objects.get_or_create(user=student, course=course, defaults={'status': 'ACTIVE'})
        return Response({'message': f"Student enrolled into {course.title} successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unenroll')
    def unenroll_course(self, request, pk=None):
        student = self.get_object()
        course_id = request.data.get('course_id')
        Enrollment.objects.filter(user=student, course_id=course_id).delete()
        return Response({'message': "Course un-enrolled successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='progress')
    def student_progress(self, request, pk=None):
        student = self.get_object()

        test_attempts = TestAttempt.objects.filter(user=student).select_related('test').order_by('-created_at')
        dpp_attempts = DPPAttempt.objects.filter(user=student).select_related('dpp').order_by('-created_at')
        video_progress = VideoProgress.objects.filter(user=student).select_related('video', 'video__lecture').order_by('-updated_at')

        return Response({
            'student_id': str(student.id),
            'email': student.email,
            'name': f"{student.first_name} {student.last_name}".strip() or student.username,
            'test_attempts': [
                {
                    'id': str(a.id),
                    'test_title': a.test.title,
                    'score': float(a.score),
                    'total_marks': a.test.total_marks,
                    'accuracy': float(a.accuracy_percentage),
                    'completed_at': a.completed_at,
                }
                for a in test_attempts
            ],
            'dpp_attempts': [
                {
                    'id': str(a.id),
                    'dpp_title': a.dpp.title,
                    'score': a.score,
                    'accuracy': float(a.accuracy_percentage),
                    'completed_at': a.completed_at,
                }
                for a in dpp_attempts
            ],
            'video_progress': [
                {
                    'id': str(v.id),
                    'video_title': v.video.title,
                    'watched_seconds': v.watched_seconds,
                    'completed': v.completed,
                }
                for v in video_progress
            ],
        }, status=status.HTTP_200_OK)


class LiveClassViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminLiveClassSerializer
    queryset = LiveClass.objects.select_related('course', 'subject', 'chapter').all().order_by('-start_time')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'teacher', 'course__title', 'subject__name']

    def perform_create(self, serializer):
        live_class = serializer.save()
        # Automatically create or sync a ScheduleEvent of type LIVE_CLASS
        ScheduleEvent.objects.update_or_create(
            live_class=live_class,
            defaults={
                'course': live_class.course,
                'event_type': ScheduleEvent.EventType.LIVE_CLASS,
                'title': f"LIVE: {live_class.title}",
                'description': live_class.description or f"Live interactive session with {live_class.teacher}",
                'subject': live_class.subject,
                'chapter': live_class.chapter,
                'start_time': live_class.start_time,
                'end_time': live_class.end_time,
                'link': live_class.join_url,
                'is_published': True,
            }
        )

    def perform_update(self, serializer):
        live_class = serializer.save()
        ScheduleEvent.objects.filter(live_class=live_class).update(
            course=live_class.course,
            title=f"LIVE: {live_class.title}",
            description=live_class.description or f"Live interactive session with {live_class.teacher}",
            subject=live_class.subject,
            chapter=live_class.chapter,
            start_time=live_class.start_time,
            end_time=live_class.end_time,
            link=live_class.join_url,
        )

    @action(detail=True, methods=['post'], url_path='publish-recording')
    def publish_recording(self, request, pk=None):
        live_class = self.get_object()
        recording_url = request.data.get('recording_url', '').strip()
        lecture_id = request.data.get('lecture_id')

        if recording_url:
            live_class.recording_url = recording_url
        if not live_class.recording_url:
            return Response({'error': 'recording_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

        live_class.recording_published = True
        live_class.status = LiveClass.Status.ENDED

        if lecture_id:
            try:
                lecture = Lecture.objects.get(id=lecture_id)
                live_class.recording_lecture = lecture
                is_yt = 'youtube.com' in live_class.recording_url or 'youtu.be' in live_class.recording_url
                Video.objects.get_or_create(
                    lecture=lecture,
                    title=f"Recording: {live_class.title}",
                    defaults={
                        'video_source_type': Video.VideoSourceType.YOUTUBE if is_yt else Video.VideoSourceType.CLOUD,
                        'youtube_video_id': extract_youtube_id(live_class.recording_url) if is_yt else '',
                        'r2_object_key': live_class.recording_url if not is_yt else '',
                    }
                )
            except Lecture.DoesNotExist:
                pass

        live_class.save()

        # Update or create schedule event for recorded class
        ScheduleEvent.objects.create(
            course=live_class.course,
            event_type=ScheduleEvent.EventType.RECORDED_CLASS,
            title=f"Recorded Class: {live_class.title}",
            description=f"Class recording published for {live_class.title}",
            subject=live_class.subject,
            chapter=live_class.chapter,
            start_time=timezone.now(),
            link="/learn",
            lecture=live_class.recording_lecture,
            is_published=True,
        )

        # Notify enrolled students
        enrolled_users = User.objects.filter(enrollments__course=live_class.course, enrollments__status='ACTIVE')
        for user in enrolled_users:
            Notification.objects.create(
                user=user,
                title="Recording available",
                message=f"The recording for '{live_class.title}' has been published and is now available in your Learn section.",
                notification_type=Notification.NotificationType.RECORDING_AVAILABLE,
                link_url="/learn"
            )

        return Response(AdminLiveClassSerializer(live_class).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def attendance(self, request, pk=None):
        live_class = self.get_object()
        attendances = LiveAttendance.objects.filter(live_class=live_class).select_related('student')
        data = [
            {
                'id': str(a.id),
                'student_id': str(a.student.id),
                'student_name': f"{a.student.first_name} {a.student.last_name}".strip() or a.student.username,
                'student_email': a.student.email,
                'joined_at': a.joined_at,
            }
            for a in attendances
        ]
        return Response(data, status=status.HTTP_200_OK)


class ScheduleEventViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminScheduleEventSerializer
    queryset = ScheduleEvent.objects.select_related('course', 'subject', 'chapter', 'test', 'dpp', 'lecture', 'live_class').all().order_by('-start_time')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'course__title', 'subject__name']

    def perform_create(self, serializer):
        event = serializer.save()
        self._auto_link_event(event)

    def perform_update(self, serializer):
        event = serializer.save()
        self._auto_link_event(event)

    def _auto_link_event(self, event):
        updated = False
        if event.event_type == ScheduleEvent.EventType.EXAM and event.test and not event.link:
            event.link = '/tests'
            updated = True
        elif event.event_type == ScheduleEvent.EventType.PRACTICE_DEADLINE and event.dpp and not event.link:
            event.link = '/practice'
            updated = True
        elif event.event_type == ScheduleEvent.EventType.RECORDED_CLASS and event.lecture and not event.link:
            event.link = '/learn'
            updated = True
        elif event.event_type == ScheduleEvent.EventType.LIVE_CLASS and event.live_class and not event.link:
            event.link = event.live_class.join_url
            updated = True
        if updated:
            event.save()


class NotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminNotificationSerializer
    queryset = Notification.objects.all().order_by('-created_at')
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'message', 'user__email']


class TestAnalyticsViewSet(viewsets.ViewSet):
    """
    Administrative analytics for Tests:
    - Test-level summaries (attempts count, highest/lowest/avg score, pass rate)
    - Question-level distractor analysis & anomaly detection (flagging questions where toppers failed)
    - Batch weak chapters
    - Student roster per test with export to CSV
    """
    permission_classes = [IsAdminRole]

    def list(self, request):
        tests = Test.objects.all().order_by('-created_at')
        data = []
        for t in tests:
            submitted = t.attempts.filter(
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            )
            count = submitted.count()
            scores = [float(a.score) for a in submitted]
            times = [a.time_taken_seconds for a in submitted]
            pass_count = sum(1 for s in scores if s >= float(t.cutoff_score)) if t.cutoff_score > 0 else count

            data.append({
                'id': str(t.id),
                'title': t.title,
                'test_type': t.test_type,
                'total_marks': t.total_marks,
                'duration_minutes': t.duration_minutes,
                'cutoff_score': float(t.cutoff_score),
                'is_published': t.is_published,
                'publish_results_immediately': t.publish_results_immediately,
                'start_time': t.start_time,
                'end_time': t.end_time,
                'attempts_count': count,
                'highest_score': max(scores) if scores else None,
                'lowest_score': min(scores) if scores else None,
                'avg_score': round(sum(scores) / count, 1) if count > 0 else None,
                'avg_time_seconds': round(sum(times) / count, 1) if count > 0 else None,
                'pass_count': pass_count,
                'pass_percentage': round(pass_count / count * 100, 1) if count > 0 else 0.0,
            })
        return Response(data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        test = Test.objects.filter(id=pk).prefetch_related('test_questions__question').first()
        if not test:
            return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

        submitted_attempts = list(
            test.attempts.filter(
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            ).select_related('user').order_by('-score', 'time_taken_seconds')
        )

        count = len(submitted_attempts)
        scores = [float(a.score) for a in submitted_attempts]
        times = [a.time_taken_seconds for a in submitted_attempts]
        cutoff = float(test.cutoff_score)
        pass_count = sum(1 for s in scores if s >= cutoff) if cutoff > 0 else count

        # Top 25% students for anomaly detection
        topper_threshold_idx = max(1, count // 4)
        topper_attempt_ids = set(a.id for a in submitted_attempts[:topper_threshold_idx])

        # Question analytics
        test_questions = test.test_questions.select_related(
            'question', 'question__subject', 'question__chapter'
        ).prefetch_related('question__options').order_by('order')

        question_stats = []
        batch_chapter_map = {}

        for tq in test_questions:
            q = tq.question
            logs = list(
                QuestionAttemptLog.objects.filter(
                    attempt__test=test,
                    question=q,
                    attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
                )
            )

            q_attempts = len(logs)
            q_correct = sum(1 for l in logs if l.is_correct)
            q_accuracy = round(q_correct / q_attempts * 100, 1) if q_attempts > 0 else 0.0
            q_avg_time = round(sum(l.time_spent_seconds for l in logs) / q_attempts, 1) if q_attempts > 0 else 0.0

            # Distractor Analysis (most picked wrong option)
            wrong_picks = {}
            for l in logs:
                if not l.is_correct and l.selected_answer:
                    wrong_picks[l.selected_answer] = wrong_picks.get(l.selected_answer, 0) + 1

            most_picked_option_text = None
            if wrong_picks:
                most_picked_id = max(wrong_picks, key=wrong_picks.get)
                # Find option text
                for opt in q.options.all():
                    if str(opt.id) == most_picked_id or opt.option_text == most_picked_id:
                        most_picked_option_text = f"{opt.option_text} ({wrong_picks[most_picked_id]} students)"
                        break

            # Anomaly Detection: Did top performers fail this question while class did not, or is accuracy < 15%?
            topper_correct_count = sum(1 for l in logs if l.attempt_id in topper_attempt_ids and l.is_correct)
            topper_acc = round(topper_correct_count / max(1, len(topper_attempt_ids)) * 100, 1) if topper_attempt_ids else 0.0
            is_anomaly = (topper_acc < 25.0 and q_attempts >= 2) or (q_accuracy < 15.0 and q_attempts >= 3)

            stat_item = {
                'question_id': str(q.id),
                'order': tq.order,
                'question_text': q.question_text[:120] + '...',
                'difficulty': q.difficulty,
                'subject_name': q.subject.name if q.subject else '',
                'chapter_name': q.chapter.name if q.chapter else '',
                'positive_marks': float(tq.positive_marks),
                'negative_marks': float(tq.negative_marks),
                'total_attempts': q_attempts,
                'correct_count': q_correct,
                'accuracy': q_accuracy,
                'avg_time_seconds': q_avg_time,
                'most_common_wrong_pick': most_picked_option_text,
                'is_flagged_anomaly': is_anomaly,
            }
            question_stats.append(stat_item)

            # Batch chapter aggregation
            if q.chapter:
                chap_id = str(q.chapter.id)
                if chap_id not in batch_chapter_map:
                    batch_chapter_map[chap_id] = {
                        'chapter_id': chap_id,
                        'chapter_name': q.chapter.name,
                        'subject_name': q.chapter.category.subject.name if q.chapter.category and q.chapter.category.subject else '',
                        'total_questions': 0,
                        'correct_count': 0,
                    }
                batch_chapter_map[chap_id]['total_questions'] += q_attempts
                batch_chapter_map[chap_id]['correct_count'] += q_correct

        # Batch weak chapters
        batch_chapters = []
        for bc in batch_chapter_map.values():
            tot = bc['total_questions']
            acc = round(bc['correct_count'] / tot * 100, 1) if tot > 0 else 0.0
            bc['accuracy'] = acc
            batch_chapters.append(bc)
        batch_chapters.sort(key=lambda x: x['accuracy'])

        # Toughest & Easiest questions
        toughest_questions = sorted([q for q in question_stats if q['total_attempts'] > 0], key=lambda x: x['accuracy'])[:5]
        easiest_questions = sorted([q for q in question_stats if q['total_attempts'] > 0], key=lambda x: -x['accuracy'])[:5]

        # Student roster
        roster = [
            {
                'attempt_id': str(a.id),
                'student_id': str(a.user.id),
                'student_name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username,
                'student_email': a.user.email,
                'score': float(a.score),
                'total_marks': test.total_marks,
                'rank': a.rank,
                'percentile': float(a.percentile) if a.percentile is not None else None,
                'accuracy': float(a.accuracy_percentage),
                'time_taken_seconds': a.time_taken_seconds,
                'status': a.status,
                'submitted_at': a.submitted_at,
            }
            for a in submitted_attempts
        ]

        return Response({
            'test': {
                'id': str(test.id),
                'title': test.title,
                'test_type': test.test_type,
                'total_marks': test.total_marks,
                'duration_minutes': test.duration_minutes,
                'cutoff_score': cutoff,
                'is_published': test.is_published,
                'publish_results_immediately': test.publish_results_immediately,
            },
            'overview': {
                'attempts_count': count,
                'highest_score': max(scores) if scores else None,
                'lowest_score': min(scores) if scores else None,
                'avg_score': round(sum(scores) / count, 1) if count > 0 else None,
                'avg_time_seconds': round(sum(times) / count, 1) if count > 0 else None,
                'pass_count': pass_count,
                'pass_percentage': round(pass_count / count * 100, 1) if count > 0 else 0.0,
            },
            'question_stats': question_stats,
            'toughest_questions': toughest_questions,
            'easiest_questions': easiest_questions,
            'batch_weak_chapters': batch_chapters[:5],
            'student_roster': roster,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='export')
    def export_csv(self, request, pk=None):
        test = Test.objects.filter(id=pk).first()
        if not test:
            return Response({'error': 'Test not found'}, status=status.HTTP_404_NOT_FOUND)

        submitted_attempts = test.attempts.filter(
            status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).select_related('user').order_by('-score', 'time_taken_seconds')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="test_{test.id}_results.csv"'

        writer = csv.writer(response)
        writer.writerow(['Rank', 'Student Name', 'Email', 'Score', 'Total Marks', 'Accuracy (%)', 'Time (Seconds)', 'Status', 'Submitted At'])

        for att in submitted_attempts:
            name = f"{att.user.first_name} {att.user.last_name}".strip() or att.user.username
            writer.writerow([
                att.rank or '',
                name,
                att.user.email,
                att.score,
                test.total_marks,
                att.accuracy_percentage,
                att.time_taken_seconds,
                att.status,
                att.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if att.submitted_at else '',
            ])

        return response


class RankPredictorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminRankPredictorSerializer
    queryset = RankPredictor.objects.all().order_by('-min_marks')


class SettingsViewSet(viewsets.ViewSet):
    """
    Manages analysis settings (ideal time per difficulty, quick/wasted thresholds,
    time-slot size, percentile bands, comparative minimum attempts) and rank predictor table.
    """
    permission_classes = [IsAdminRole]

    def list(self, request):
        settings = AnalysisSettings.get_settings()
        predictors = list(RankPredictor.objects.all().order_by('-min_marks').values())
        return Response({
            'analysis_settings': {
                'id': settings.id,
                'name': settings.name,
                'easy_ideal_time': settings.easy_ideal_time,
                'moderate_ideal_time': settings.moderate_ideal_time,
                'tough_ideal_time': settings.tough_ideal_time,
                'quick_wasted_threshold_percent': settings.quick_wasted_threshold_percent,
                'time_slot_minutes': settings.time_slot_minutes,
                'percentile_band_1': settings.percentile_band_1,
                'percentile_band_2': settings.percentile_band_2,
                'comparative_min_attempts': settings.comparative_min_attempts,
                'show_solutions_after_window': settings.show_solutions_after_window,
            },
            'rank_predictor_table': predictors,
        }, status=status.HTTP_200_OK)

    def create(self, request):
        settings = AnalysisSettings.get_settings()
        data = request.data.get('analysis_settings', request.data)
        for field in [
            'easy_ideal_time', 'moderate_ideal_time', 'tough_ideal_time',
            'quick_wasted_threshold_percent', 'time_slot_minutes',
            'percentile_band_1', 'percentile_band_2', 'comparative_min_attempts',
            'show_solutions_after_window'
        ]:
            if field in data:
                setattr(settings, field, data[field])
        settings.save()
        return Response({
            'message': 'Settings saved successfully.',
            'analysis_settings': {
                'easy_ideal_time': settings.easy_ideal_time,
                'moderate_ideal_time': settings.moderate_ideal_time,
                'tough_ideal_time': settings.tough_ideal_time,
                'quick_wasted_threshold_percent': settings.quick_wasted_threshold_percent,
                'time_slot_minutes': settings.time_slot_minutes,
                'percentile_band_1': settings.percentile_band_1,
                'percentile_band_2': settings.percentile_band_2,
                'comparative_min_attempts': settings.comparative_min_attempts,
                'show_solutions_after_window': settings.show_solutions_after_window,
            }
        }, status=status.HTTP_200_OK)


class AdminUserViewSet(viewsets.ModelViewSet):
    """
    CRUD for admin and instructor accounts.
    """
    permission_classes = [IsAdminRole]
    queryset = User.objects.filter(role__in=[User.Role.ADMIN, User.Role.INSTRUCTOR]).order_by('-date_joined')
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        data = request.data
        role = data.get('role', User.Role.INSTRUCTOR)
        if role not in [User.Role.ADMIN, User.Role.INSTRUCTOR]:
            return Response({'error': 'Role must be ADMIN or INSTRUCTOR.'}, status=status.HTTP_400_BAD_REQUEST)

        email = data.get('email', '').strip().lower()
        password = data.get('password')
        if not email or not password:
            return Response({'error': 'Email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'User with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            email=email,
            username=email,
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role=role,
            is_staff=True if role == User.Role.ADMIN else False,
            is_verified=True,
        )
        user.set_password(password)
        user.save()

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


