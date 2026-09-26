from django.db import IntegrityError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment
from .serializers import (
    AcademicClassSerializer, SubjectSerializer, CourseSerializer,
    ChapterSerializer, LectureSerializer, EnrollmentSerializer
)

class CourseListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.filter(is_published=True)

class CourseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseSerializer
    queryset = Course.objects.all()

class CourseClassesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
            classes = course.classes.all().order_by('order', 'name')
            serializer = AcademicClassSerializer(classes, many=True)
            return Response(serializer.data)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

class ClassSubjectsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        # Allow lookup by ID or code (e.g. class11, class12)
        try:
            if pk.isdigit():
                ac_class = AcademicClass.objects.get(pk=int(pk))
            else:
                ac_class = AcademicClass.objects.get(code=pk)
        except AcademicClass.DoesNotExist:
            # Fallback to returning all subjects if class code is general
            subjects = Subject.objects.all()
            return Response(SubjectSerializer(subjects, many=True).data)

        # Return subjects linked to course or all active subjects
        subjects = Subject.objects.all()
        return Response(SubjectSerializer(subjects, many=True).data)

class SubjectChaptersView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        # Lookup subject by ID or slug
        try:
            if pk.isdigit():
                subject = Subject.objects.get(pk=int(pk))
            else:
                subject = Subject.objects.get(slug=pk)
        except Subject.DoesNotExist:
            return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

        chapters = Chapter.objects.filter(category__subject=subject)

        class_code = request.query_params.get('class', None)
        if class_code:
            chapters = chapters.filter(academic_class__code=class_code)

        serializer = ChapterSerializer(chapters.order_by('order', 'id'), many=True)
        return Response(serializer.data)

class ChapterLecturesView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LectureSerializer

    def get_queryset(self):
        chapter_id = self.kwargs.get('pk')
        return Lecture.objects.filter(chapter_id=chapter_id, is_published=True).order_by('order', 'lecture_number')

class EnrollView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        course_id = request.data.get('course_id') or request.data.get('courseId')
        if not course_id:
            return Response({'error': 'course_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = Course.objects.get(pk=course_id)
        except (Course.DoesNotExist, ValueError):
            try:
                course = Course.objects.get(slug=course_id)
            except Course.DoesNotExist:
                return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get authenticated user or default fallback demo user
        user = request.user if request.user.is_authenticated else None
        if not user:
            from apps.accounts.models import User
            user, _ = User.objects.get_or_create(
                email='demo_student@ankitjee.com',
                defaults={'username': 'demo_student', 'first_name': 'Student', 'last_name': 'Demo'}
            )

        try:
            enrollment, created = Enrollment.objects.get_or_create(
                user=user,
                course=course,
                defaults={'status': 'ACTIVE'}
            )
            if created:
                return Response({
                    'message': 'Enrollment successful',
                    'already_enrolled': False,
                    'enrollment': EnrollmentSerializer(enrollment).data
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'message': 'Already enrolled',
                    'already_enrolled': True,
                    'enrollment': EnrollmentSerializer(enrollment).data
                }, status=status.HTTP_200_OK)
        except IntegrityError:
            enrollment = Enrollment.objects.get(user=user, course=course)
            return Response({
                'message': 'Already enrolled',
                'already_enrolled': True,
                'enrollment': EnrollmentSerializer(enrollment).data
            }, status=status.HTTP_200_OK)

class MyCoursesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        if not user:
            from apps.accounts.models import User
            try:
                user = User.objects.get(email='demo_student@ankitjee.com')
            except User.DoesNotExist:
                # If no user logged in and no demo user enrolled yet, return published free course default
                published_courses = Course.objects.filter(is_published=True)
                return Response(CourseSerializer(published_courses, many=True).data)

        enrollments = Enrollment.objects.filter(user=user, status='ACTIVE')
        courses = [e.course for e in enrollments]
        if not courses:
            courses = list(Course.objects.filter(is_published=True))
        return Response(CourseSerializer(courses, many=True).data)
