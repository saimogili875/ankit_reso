from django.core.exceptions import ValidationError
from django.db import IntegrityError, models
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment
from .serializers import (
    AcademicClassSerializer, SubjectSerializer, CourseSerializer,
    ChapterSerializer, LectureSerializer, EnrollmentSerializer
)

class CourseListView(generics.ListAPIView):
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.filter(is_published=True)

class CourseDetailView(generics.RetrieveAPIView):
    serializer_class = CourseSerializer
    queryset = Course.objects.all()

class CourseClassesView(APIView):
    def get(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
            classes = course.classes.all().order_by('order', 'name')
            serializer = AcademicClassSerializer(classes, many=True)
            return Response(serializer.data)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

class AcademicClassListView(generics.ListAPIView):
    serializer_class = AcademicClassSerializer
    queryset = AcademicClass.objects.all().order_by('order', 'name')
    pagination_class = None

class SubjectListView(generics.ListAPIView):
    serializer_class = SubjectSerializer
    queryset = Subject.objects.all().order_by('name')
    pagination_class = None

class ClassSubjectsView(APIView):
    def get(self, request, pk):
        subjects = Subject.objects.filter(
            models.Q(academic_class_id=pk) |
            models.Q(academic_class__code=pk) |
            models.Q(academic_class__slug=pk)
        ).order_by('order', 'name')
        return Response(SubjectSerializer(subjects, many=True).data)

class SubjectChaptersView(APIView):
    def get(self, request, pk):
        class_param = request.query_params.get('class', None)
        subject = None
        try:
            subject = Subject.objects.filter(id=pk).first()
        except (ValidationError, ValueError):
            pass

        if not subject:
            qs = Subject.objects.filter(slug=pk)
            if class_param:
                qs = qs.filter(
                    models.Q(academic_class_id=class_param) |
                    models.Q(academic_class__code=class_param) |
                    models.Q(academic_class__slug=class_param)
                )
            subject = qs.first()

        if not subject:
            return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

        chapters = Chapter.objects.filter(
            models.Q(subject=subject) | models.Q(category__subject=subject)
        ).distinct().order_by('order', 'id')

        serializer = ChapterSerializer(chapters, many=True)
        return Response(serializer.data)

class ChapterLecturesView(generics.ListAPIView):
    serializer_class = LectureSerializer

    def get_queryset(self):
        chapter_id = self.kwargs.get('pk')
        return Lecture.objects.filter(chapter_id=chapter_id, is_published=True).order_by('order', 'lecture_number')

class EnrollView(APIView):
    def post(self, request):
        course_id = request.data.get('course_id') or request.data.get('courseId')
        if not course_id:
            return Response({'error': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        course = None
        try:
            course = Course.objects.filter(models.Q(id=course_id) | models.Q(slug=course_id)).first()
        except (ValidationError, ValueError):
            course = Course.objects.filter(slug=course_id).first()

        if not course:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        is_admin_or_staff = request.user.is_staff or getattr(request.user, 'role', '') == 'ADMIN'
        if not course.allow_self_enrollment and not is_admin_or_staff:
            return Response({
                'error': 'Direct self-enrollment is disabled for this course. Please contact administration to enroll.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if course requires payment
        is_paid = (not course.is_free) and (course.price and course.price > 0)
        if is_paid and not is_admin_or_staff:
            from apps.payments.models import Payment
            has_paid = Payment.objects.filter(
                course=course,
                user=request.user,
                status=Payment.Status.PAID
            ).exists()
            if not has_paid:
                return Response({
                    'error': 'Payment required to enroll in this course.',
                    'payment_required': True,
                    'course_id': str(course.id),
                    'price': str(course.price),
                }, status=status.HTTP_402_PAYMENT_REQUIRED)

        user = request.user
        enrollment, created = Enrollment.objects.get_or_create(
            user=user,
            course=course,
            defaults={'status': 'ACTIVE'}
        )
        return Response({
            'message': 'Enrollment successful' if created else 'Already enrolled',
            'already_enrolled': not created,
            'enrollment': EnrollmentSerializer(enrollment).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class MyCoursesView(APIView):
    def get(self, request):
        enrollments = Enrollment.objects.filter(user=request.user, status='ACTIVE')
        courses = [e.course for e in enrollments]
        return Response(CourseSerializer(courses, many=True).data)
