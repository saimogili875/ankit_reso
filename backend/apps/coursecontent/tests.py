from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import Course, Enrollment, Subject, Chapter
from apps.tests.models import Test
from apps.content.models import Video
from .models import CourseSection, ContentItem
from .utils import extract_youtube_id

User = get_user_model()


class YouTubeParserTestCase(TestCase):
    def test_extract_various_youtube_url_formats(self):
        cases = [
            ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
            ('https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'dQw4w9WgXcQ'),
            ('https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
            ('https://youtu.be/dQw4w9WgXcQ?t=45', 'dQw4w9WgXcQ'),
            ('https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
            ('https://www.youtube.com/v/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
            ('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
            ('dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ]
        for url, expected_id in cases:
            self.assertEqual(extract_youtube_id(url), expected_id, f"Failed for {url}")

    def test_extract_invalid_values(self):
        invalid_cases = [
            '',
            None,
            'https://vimeo.com/12345678',
            'https://example.com/video.mp4',
            'not_a_yt_id',
            'too_short',
            'way_too_long_to_be_an_11_char_id_123456',
        ]
        for val in invalid_cases:
            self.assertIsNone(extract_youtube_id(val), f"Should be None for {val}")


class CourseContentGatingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='content_admin',
            email='content_admin@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.enrolled_student = User.objects.create_user(
            username='enrolled_student',
            email='enrolled_student@example.com',
            password='Password123!',
            role=User.Role.STUDENT,
        )
        self.unenrolled_student = User.objects.create_user(
            username='unenrolled_student',
            email='unenrolled_student@example.com',
            password='Password123!',
            role=User.Role.STUDENT,
        )

        self.course = Course.objects.create(
            title='JEE Main & Advanced 2026 Complete Batch',
            slug='jee-complete-2026',
            price=7999,
            is_free=False,
            is_published=True,
        )

        Enrollment.objects.create(
            user=self.enrolled_student,
            course=self.course,
            status='ACTIVE'
        )

        # 1. Modules Section
        self.modules_sec = CourseSection.objects.create(
            course=self.course,
            section_type=CourseSection.SectionType.MODULES,
            title='Mathematics Practice Modules',
            order=1,
            is_published=True,
        )
        self.module_item = ContentItem.objects.create(
            section=self.modules_sec,
            title='Quadratic Equations Complete Module',
            pdf='courses/modules/maths-quad-10.pdf',
            solution_pdf='courses/modules/maths-quad-10-sol.pdf',
            order=1,
            is_published=True,
            is_free_preview=False,
        )
        self.preview_item = ContentItem.objects.create(
            section=self.modules_sec,
            title='Sample Free Chapter Preview',
            pdf='courses/modules/sample-preview.pdf',
            order=2,
            is_published=True,
            is_free_preview=True,
        )

        # 2. Test Series Section with Exam & Video
        self.test_sec = CourseSection.objects.create(
            course=self.course,
            section_type=CourseSection.SectionType.TEST_SERIES,
            title='Weekly CBT Test Series',
            order=2,
            is_published=True,
        )
        self.exam = Test.objects.create(
            title='All India Test Series - Test 1',
            duration_minutes=180,
            total_marks=300,
            is_published=True,
        )
        self.video = Video.objects.create(
            title='Test 1 Full Video Solution',
            youtube_video_id='dQw4w9WgXcQ',
            video_source_type=Video.VideoSourceType.YOUTUBE,
            status=Video.Status.READY,
            is_published=True,
        )
        self.exam_item = ContentItem.objects.create(
            section=self.test_sec,
            title='AITS Minor Test 01',
            exam=self.exam,
            is_exam=True,
            video=self.video,
            pdf='tests/aits-01.pdf',
            solution_pdf='tests/aits-01-sol.pdf',
            solution_release_at=timezone.now() + timedelta(days=2), # solution locked for 2 days
            order=1,
            is_published=True,
        )

    def test_unenrolled_student_cannot_access_locked_files_or_video(self):
        self.client.force_authenticate(user=self.unenrolled_student)
        res = self.client.get(f'/api/course-content/courses/{self.course.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertFalse(data['course']['is_enrolled'])
        sections = data['sections']
        self.assertEqual(len(sections), 2)

        # Check module items
        module_items = sections[0]['items']
        # Item 1 is locked
        self.assertTrue(module_items[0]['is_locked'])
        self.assertIsNone(module_items[0]['viewer_url'])
        self.assertIsNone(module_items[0]['solution_viewer_url'])
        # Item 2 is free preview
        self.assertFalse(module_items[1]['is_locked'])
        self.assertIsNotNone(module_items[1]['viewer_url'])

        # Check test series item
        test_items = sections[1]['items']
        self.assertTrue(test_items[0]['is_locked'])
        self.assertIsNone(test_items[0]['video_info'])
        self.assertIsNone(test_items[0]['exam_info'])
        self.assertIsNone(test_items[0]['viewer_url'])

    def test_enrolled_student_gets_unlocked_content_with_solution_gate(self):
        self.client.force_authenticate(user=self.enrolled_student)
        res = self.client.get(f'/api/course-content/courses/{self.course.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertTrue(data['course']['is_enrolled'])
        sections = data['sections']

        # Enrolled student has access to module item
        module_item = sections[0]['items'][0]
        self.assertFalse(module_item['is_locked'])
        self.assertEqual(module_item['viewer_url'], f"/api/course-content/items/{self.module_item.id}/pages/")

        # Test series item
        test_item = sections[1]['items'][0]
        self.assertFalse(test_item['is_locked'])
        self.assertIsNotNone(test_item['exam_info'])
        self.assertEqual(test_item['exam_info']['id'], str(self.exam.id))
        self.assertIsNotNone(test_item['video_info'])
        self.assertEqual(test_item['video_info']['youtube_video_id'], 'dQw4w9WgXcQ')

        # Solution release is in future -> solution is locked
        self.assertTrue(test_item['is_solution_locked'])
        self.assertIsNone(test_item['solution_viewer_url'])

    def test_admin_can_manage_sections_and_paste_youtube_url(self):
        self.client.force_authenticate(user=self.admin)

        # Create new section
        res_sec = self.client.post('/api/course-content/admin/sections/', {
            'course': str(self.course.id),
            'section_type': 'SHORT_NOTES',
            'title': 'High-Yield Formula Sheets',
            'order': 3,
            'is_published': True,
        })
        self.assertEqual(res_sec.status_code, status.HTTP_201_CREATED)
        sec_id = res_sec.json()['id']

        # Create item with YouTube video input
        res_item = self.client.post('/api/course-content/admin/items/', {
            'section': sec_id,
            'title': 'Mechanics in 60 Minutes',
            'video_input': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'order': 1,
            'is_published': True,
        })
        self.assertEqual(res_item.status_code, status.HTTP_201_CREATED)
        item_data = res_item.json()
        self.assertEqual(item_data['youtube_video_id'], 'dQw4w9WgXcQ')
        self.assertEqual(item_data['video_source_type'], 'YOUTUBE')


class SecureViewingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.enrolled_user = User.objects.create_user(
            username='enrolled_viewer',
            email='viewer@example.com',
            password='TestPassword123!',
        )
        self.outsider_user = User.objects.create_user(
            username='outsider_viewer',
            email='outsider@example.com',
            password='TestPassword123!',
        )

        self.course = Course.objects.create(
            title='JEE Main & Advanced Complete',
            slug='jee-complete-secure',
            is_published=True,
            price=4999.00
        )

        Enrollment.objects.create(
            user=self.enrolled_user,
            course=self.course,
            status='ACTIVE'
        )

        self.section = CourseSection.objects.create(
            course=self.course,
            section_type='MODULES',
            title='Physics Modules',
            order=1,
            is_published=True
        )

        self.item = ContentItem.objects.create(
            section=self.section,
            title='Rotational Dynamics Module',
            pdf='courses/modules/rotational-dynamics.pdf',
            solution_pdf='courses/modules/rotational-dynamics-sol.pdf',
            order=1,
            is_published=True,
            is_free_preview=False,
        )

    def test_non_enrolled_user_cannot_access_pages_meta(self):
        self.client.force_authenticate(user=self.outsider_user)
        res = self.client.get(f"/api/course-content/items/{self.item.id}/pages/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_enrolled_user_gets_signed_page_urls(self):
        self.client.force_authenticate(user=self.enrolled_user)
        res = self.client.get(f"/api/course-content/items/{self.item.id}/pages/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['viewer_mode'], 'STRONG')
        self.assertTrue(len(data['pages']) > 0)
        first_page = data['pages'][0]
        self.assertIn('token=', first_page['url'])

        # Now fetch the image using the signed token
        img_res = self.client.get(first_page['url'])
        self.assertEqual(img_res.status_code, status.HTTP_200_OK)
        self.assertEqual(img_res['Content-Type'], 'image/jpeg')
        self.assertIn('private, no-store', img_res['Cache-Control'])
        self.assertTrue(len(img_res.content) > 100)

    def test_invalid_token_rejected_with_403(self):
        self.client.force_authenticate(user=self.enrolled_user)
        bad_url = f"/api/course-content/items/{self.item.id}/page/1/?token=tampered_signature_token"
        res = self.client.get(bad_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

