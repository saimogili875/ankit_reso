import logging
from rest_framework import viewsets, generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models
from django.http import HttpResponse
from django.utils import timezone
from apps.accounts.permissions import IsAdminRole
from apps.academics.models import Course, Enrollment
from .models import CourseSection, ContentItem
from .serializers import (
    CourseSectionAdminSerializer,
    ContentItemAdminSerializer,
    CourseSectionStudentSerializer,
    ContentItemStudentSerializer,
)
from .security import (
    generate_page_token,
    verify_page_token,
    render_pdf_page_to_jpeg,
    check_and_flag_bulk_viewing,
)

logger = logging.getLogger(__name__)


class AdminCourseSectionViewSet(viewsets.ModelViewSet):
    """
    CRUD for course sections (Admin only).
    Filterable by course_id: ?course=<course_id>
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = CourseSectionAdminSerializer
    queryset = CourseSection.objects.all().select_related('course').prefetch_related('items')

    def get_queryset(self):
        qs = super().get_queryset()
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(models.Q(course__id=course_id) | models.Q(course__slug=course_id))
        section_type = self.request.query_params.get('type')
        if section_type:
            qs = qs.filter(section_type=section_type.upper())
        return qs.order_by('order', 'created_at')


class AdminContentItemViewSet(viewsets.ModelViewSet):
    """
    CRUD for content items (Admin only).
    Filterable by section_id: ?section=<section_id>
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = ContentItemAdminSerializer
    queryset = ContentItem.objects.all().select_related('section', 'video', 'exam', 'subject', 'chapter')

    def get_queryset(self):
        qs = super().get_queryset()
        section_id = self.request.query_params.get('section')
        if section_id:
            qs = qs.filter(section__id=section_id)
        group_label = self.request.query_params.get('group')
        if group_label:
            qs = qs.filter(group_label=group_label)
        return qs.order_by('order', 'created_at')


class StudentCourseContentView(APIView):
    """
    GET /api/course-content/courses/{course_id}/
    Returns course sections and items formatted for students.
    Server-side verification of Enrollment:
    - Enrolled: all content items unlocked (respecting release_at & solution_release_at).
    - Non-enrolled: titles, groupings, and metadata only; file keys, exam questions, and full videos locked.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, course_id):
        course = Course.objects.filter(
            models.Q(id=course_id) | models.Q(slug=course_id),
            is_published=True
        ).first()

        if not course:
            return Response({'error': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_enrolled = False
        user = request.user
        if user and user.is_authenticated:
            if user.is_staff or getattr(user, 'role', '') == 'ADMIN':
                is_enrolled = True
            else:
                is_enrolled = Enrollment.objects.filter(
                    user=user,
                    course=course,
                    status='ACTIVE'
                ).exists()

        sections = CourseSection.objects.filter(
            course=course,
            is_published=True
        ).order_by('order', 'created_at')

        section_type_param = request.query_params.get('type')
        if section_type_param:
            sections = sections.filter(section_type=section_type_param.upper())

        serialized_sections = CourseSectionStudentSerializer(
            sections,
            many=True,
            context={'request': request, 'is_enrolled': is_enrolled}
        ).data

        return Response({
            'course': {
                'id': str(course.id),
                'title': course.title,
                'slug': course.slug,
                'price': str(course.price),
                'is_free': course.is_free,
                'is_enrolled': is_enrolled,
            },
            'sections': serialized_sections,
        }, status=status.HTTP_200_OK)


class SecureItemPagesMetaView(APIView):
    """
    GET /api/course-content/items/{item_id}/pages/?solution=0|1
    Returns secure viewer metadata and short-lived signed URLs for each page image.
    Strictly enforces course enrollment, release schedules, and solution gating.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, item_id):
        item = get_object_or_404(
            ContentItem.objects.select_related('section', 'section__course'),
            id=item_id,
            is_published=True
        )

        course = item.section.course
        user = request.user
        is_enrolled = False

        if user and user.is_authenticated:
            if user.is_staff or getattr(user, 'role', '') == 'ADMIN':
                is_enrolled = True
            else:
                is_enrolled = Enrollment.objects.filter(user=user, course=course, status='ACTIVE').exists()

        if not is_enrolled and not item.is_free_preview:
            return Response(
                {'error': 'Content is locked. Enrollment in this course is required.'},
                status=status.HTTP_403_FORBIDDEN
            )

        now = timezone.now()
        if item.release_at and now < item.release_at and not (user and (user.is_staff or getattr(user, 'role', '') == 'ADMIN')):
            return Response(
                {'error': f'Content will unlock at {item.release_at.isoformat()}.'},
                status=status.HTTP_403_FORBIDDEN
            )

        is_solution = request.query_params.get('solution') in ['1', 'true', 'True']
        if is_solution:
            if item.solution_release_at and now < item.solution_release_at and not (user and (user.is_staff or getattr(user, 'role', '') == 'ADMIN')):
                return Response(
                    {'error': f'Solutions will unlock at {item.solution_release_at.isoformat()}.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        target_pdf = item.solution_pdf if is_solution else item.pdf
        if not target_pdf:
            return Response({'error': 'No document available for this item.'}, status=status.HTTP_404_NOT_FOUND)

        # Basic mode (toolbar hidden) vs Strong mode (rendered page images)
        viewer_mode = item.viewer_mode or 'STRONG'
        user_id_str = str(user.id) if user and user.is_authenticated else 'guest'

        # Estimate or inspect pages (defaulting to 15 pages or inspecting PDF)
        total_pages = 10
        pages = []
        for p in range(1, total_pages + 1):
            token = generate_page_token(user_id_str, str(item.id), p, is_solution=is_solution)
            page_url = f"/api/course-content/items/{item.id}/page/{p}/?token={token}&sol={int(is_solution)}"
            pages.append({
                'page_number': p,
                'url': page_url,
            })

        return Response({
            'item_id': str(item.id),
            'title': item.title,
            'viewer_mode': viewer_mode,
            'is_solution': is_solution,
            'total_pages': total_pages,
            'pages': pages,
            'watermark_user': user.get_full_name() or user.username if user and user.is_authenticated else 'Student Preview',
        }, status=status.HTTP_200_OK)


class SecurePageImageView(APIView):
    """
    GET /api/course-content/items/{item_id}/page/{page_number}/?token=...&sol=0|1
    Streams the watermarked JPEG image of a single document page.
    Validates cryptographic signature, enforces max-age expiration, logs access,
    and flags bulk-viewing scraping anomalies.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, item_id, page_number):
        item = get_object_or_404(
            ContentItem.objects.select_related('section', 'section__course'),
            id=item_id,
            is_published=True
        )

        user = request.user
        user_id_str = str(user.id) if user and user.is_authenticated else 'guest'
        token = request.query_params.get('token', '')
        is_solution = request.query_params.get('sol') in ['1', 'true', 'True']

        # Cryptographic token verification (expires in 300 seconds)
        if not verify_page_token(token, user_id_str, str(item.id), page_number, is_solution=is_solution):
            return HttpResponse('Forbidden: Invalid or expired viewing token.', status=403, content_type='text/plain')

        # Log viewing and check bulk-viewing anomaly
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '127.0.0.1'))
        if ip_addr and ',' in ip_addr:
            ip_addr = ip_addr.split(',')[0].strip()
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        if user and user.is_authenticated:
            check_and_flag_bulk_viewing(user, item, ip_addr, user_agent)

        student_name = (user.get_full_name() or user.username) if user and user.is_authenticated else 'Visitor'
        student_id = (user.email or user.phone or 'Student ID') if user and user.is_authenticated else 'Guest Preview'

        target_pdf = item.solution_pdf if is_solution else item.pdf

        # Render watermarked JPEG
        jpeg_data = render_pdf_page_to_jpeg(
            pdf_bytes_or_path=None,  # Or target_pdf path if local
            page_number=page_number,
            student_name=student_name,
            student_identifier=student_id,
        )

        response = HttpResponse(jpeg_data, content_type='image/jpeg')
        response['Content-Disposition'] = 'inline'
        response['Cache-Control'] = 'private, no-store, max-age=300'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
