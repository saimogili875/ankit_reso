from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User
from apps.academics.models import (
    Exam, Subject, Category, Chapter, Lecture, AcademicClass,
    Course, CourseFeature, CourseAddon, Enrollment
)
from apps.content.models import Video, LandingBanner, LandingBannerSettings, ScheduleEvent
from apps.questions.models import Question, QuestionOption, DPP, DPPQuestion
from apps.books.models import BookProduct, BookOrder
from apps.tests.models import Test, TestAttempt, TestQuestion
from apps.coursecontent.models import CourseSection, ContentItem
from apps.payments.models import Payment
from django.utils import timezone
from datetime import timedelta


class AdminPanelSecurityAndCrudTests(APITestCase):
    def setUp(self):
        # Student user
        self.student = User.objects.create_user(
            username='student_test',
            email='student_test@example.com',
            password='Password123!',
            role=User.Role.STUDENT
        )
        # Admin user
        self.admin = User.objects.create_user(
            username='admin_test',
            email='admin_test@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True
        )

        # Academics fixtures
        self.exam, _ = Exam.objects.get_or_create(slug='jee-main', defaults={'name': 'JEE Main'})
        self.academic_class = AcademicClass.objects.create(name='Class 11 Test', slug='class-11-test', code='11T', exam=self.exam)
        self.subject = Subject.objects.create(name='Physics Test', slug='physics-test', academic_class=self.academic_class)
        self.category = Category.objects.create(subject=self.subject, name='Mechanics Test', slug='mechanics-test')
        self.chapter = Chapter.objects.create(
            subject=self.subject,
            category=self.category,
            name='Kinematics Test',
            slug='kinematics-test',
            order=1
        )
        self.lecture = Lecture.objects.create(
            chapter=self.chapter,
            lecture_number=1,
            title='Intro to Motion',
            duration_seconds=1200
        )

    def test_anonymous_and_student_blocked_on_admin_endpoints(self):
        endpoints = [
            reverse('admin-overview'),
            reverse('admin-overview-trends'),
            reverse('admin-options'),
            reverse('admin-questions-list'),
            reverse('admin-chapters-list'),
            reverse('admin-lectures-list'),
            reverse('admin-videos-list'),
            reverse('admin-dpps-list'),
        ]

        # 1. Anonymous requests
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN], f"Anonymous allowed on {ep}")

        # 2. Student requests
        self.client.force_authenticate(user=self.student)
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"Student allowed on {ep}")

    def test_admin_access_overview_and_options(self):
        self.client.force_authenticate(user=self.admin)
        res_overview = self.client.get(reverse('admin-overview'))
        self.assertEqual(res_overview.status_code, status.HTTP_200_OK)
        self.assertIn('questions_count', res_overview.data)
        self.assertIn('students_count', res_overview.data)

        res_options = self.client.get(reverse('admin-options'))
        self.assertEqual(res_options.status_code, status.HTTP_200_OK)
        self.assertIn('subjects', res_options.data)
        self.assertIn('chapters', res_options.data)

    def test_admin_create_single_choice_question(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-questions-list')
        payload = {
            'chapter': self.chapter.id,
            'question_text': 'What is the SI unit of acceleration?',
            'question_type': 'SINGLE',
            'difficulty': 'EASY',
            'options': [
                {'option_text': 'm/s', 'is_correct': False},
                {'option_text': 'm/s^2', 'is_correct': True},
                {'option_text': 'km/h', 'is_correct': False},
            ],
            'pyq_exam': self.exam.id,
            'pyq_year': 2024,
            'pyq_shift_or_paper': 'Shift 1',
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['subject'], self.subject.id)  # Auto-derived subject
        self.assertEqual(len(res.data['options']), 3)
        self.assertEqual(res.data['pyq_meta']['year'], 2024)

    def test_admin_create_multiple_choice_question(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-questions-list')
        payload = {
            'chapter': self.chapter.id,
            'question_text': 'Which of the following are vector quantities?',
            'question_type': 'MULTIPLE',
            'difficulty': 'MEDIUM',
            'options': [
                {'option_text': 'Velocity', 'is_correct': True},
                {'option_text': 'Acceleration', 'is_correct': True},
                {'option_text': 'Speed', 'is_correct': False},
            ]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        correct = [opt for opt in res.data['options'] if opt['is_correct']]
        self.assertEqual(len(correct), 2)

    def test_admin_create_numerical_question(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-questions-list')
        payload = {
            'chapter': self.chapter.id,
            'question_text': 'Calculate displacement when v=5m/s and t=4s (in meters):',
            'question_type': 'NUMERICAL',
            'difficulty': 'EASY',
            'options': [
                {'option_text': '20', 'is_correct': True}
            ]
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data['options']), 1)
        self.assertEqual(res.data['options'][0]['option_text'], '20')

    def test_invalid_option_rules_return_400(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-questions-list')

        # 1. Single choice with 2 correct answers -> must fail
        res1 = self.client.post(url, {
            'chapter': self.chapter.id,
            'question_text': 'Bad single choice',
            'question_type': 'SINGLE',
            'options': [
                {'option_text': 'A', 'is_correct': True},
                {'option_text': 'B', 'is_correct': True},
            ]
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('options', res1.data)

        # 2. Single choice with 0 correct answers -> must fail
        res2 = self.client.post(url, {
            'chapter': self.chapter.id,
            'question_text': 'No correct single choice',
            'question_type': 'SINGLE',
            'options': [
                {'option_text': 'A', 'is_correct': False},
                {'option_text': 'B', 'is_correct': False},
            ]
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Multiple choice with 0 correct answers -> must fail
        res3 = self.client.post(url, {
            'chapter': self.chapter.id,
            'question_text': 'No correct multi choice',
            'question_type': 'MULTIPLE',
            'options': [
                {'option_text': 'A', 'is_correct': False},
                {'option_text': 'B', 'is_correct': False},
            ]
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Numerical with > 1 option -> must fail
        res4 = self.client.post(url, {
            'chapter': self.chapter.id,
            'question_text': 'Bad numerical',
            'question_type': 'NUMERICAL',
            'options': [
                {'option_text': '10', 'is_correct': True},
                {'option_text': '20', 'is_correct': False},
            ]
        }, format='json')
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Empty question text -> must fail
        res5 = self.client.post(url, {
            'chapter': self.chapter.id,
            'question_text': '   ',
            'question_type': 'NUMERICAL',
            'options': [{'option_text': '10', 'is_correct': True}]
        }, format='json')
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)

    def test_youtube_url_parsing_extracts_11_char_id(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-videos-list')

        # Test full youtube URL formats
        urls_to_test = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ?si=abcdef',
            'https://www.youtube.com/embed/dQw4w9WgXcQ',
            'dQw4w9WgXcQ'
        ]

        for yt_input in urls_to_test:
            res = self.client.post(url, {
                'lecture': self.lecture.id,
                'title': f'Video for {yt_input[:20]}',
                'video_source_type': 'YOUTUBE',
                'youtube_video_id': yt_input,
                'duration_seconds': 600
            })
            self.assertEqual(res.status_code, status.HTTP_201_CREATED, f"Failed on URL {yt_input}")
            self.assertEqual(res.data['youtube_video_id'], 'dQw4w9WgXcQ')

    def test_dpp_creation_with_ordered_questions(self):
        self.client.force_authenticate(user=self.admin)
        # Create 3 questions
        q1 = Question.objects.create(chapter=self.chapter, question_text='Q1', question_type='SINGLE')
        q2 = Question.objects.create(chapter=self.chapter, question_text='Q2', question_type='SINGLE')
        q3 = Question.objects.create(chapter=self.chapter, question_text='Q3', question_type='SINGLE')

        url = reverse('admin-dpps-list')
        res = self.client.post(url, {
            'chapter': self.chapter.id,
            'dpp_number': 1,
            'title': 'Kinematics Practice Set 1',
            'duration_minutes': 30,
            'question_ids': [q3.id, q1.id, q2.id],
            'positive_marks': 4,
            'negative_marks': 1
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        dpp_id = res.data['id']
        entries = DPPQuestion.objects.filter(dpp_id=dpp_id).order_by('order')
        self.assertEqual(entries.count(), 3)
        self.assertEqual(entries[0].question_id, q3.id)
        self.assertEqual(entries[0].order, 1)
        self.assertEqual(entries[1].question_id, q1.id)
        self.assertEqual(entries[1].order, 2)
        self.assertEqual(entries[2].question_id, q2.id)
        self.assertEqual(entries[2].order, 3)

    def test_dpp_creation_fails_with_invalid_question_id(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('admin-dpps-list')
        res = self.client.post(url, {
            'chapter': self.chapter.id,
            'dpp_number': 2,
            'title': 'Bad DPP',
            'question_ids': ['00000000-0000-0000-0000-000000000000']
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('question_ids', res.data)

    def test_upload_presigned_url_security_and_validation(self):
        url = reverse('upload-presigned-url')

        # 1. Anonymous blocked
        res_anon = self.client.post(url, {'category': 'video', 'filename': 'lecture1.mp4'})
        self.assertIn(res_anon.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # 2. Student blocked
        self.client.force_authenticate(user=self.student)
        res_student = self.client.post(url, {'category': 'video', 'filename': 'lecture1.mp4'})
        self.assertEqual(res_student.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Admin allowed with valid category & filename
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post(url, {'category': 'video', 'filename': '../../etc/passwd.mp4'})
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        # Verify path traversal stripped
        self.assertNotIn('../', res_admin.data['file_key'])
        self.assertEqual(res_admin.data['category'], 'video')

        # 4. Invalid category rejected
        res_invalid_cat = self.client.post(url, {'category': 'hacked_category', 'filename': 'test.mp4'})
        self.assertEqual(res_invalid_cat.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_throttling(self):
        # Trigger 10 allowed requests, 11th should be 429
        url = reverse('login')
        for _ in range(10):
            self.client.post(url, {'email': 'test@example.com', 'password': 'wrong'})

        # 11th request within same minute from same IP
        res_throttled = self.client.post(url, {'email': 'test@example.com', 'password': 'wrong'})
        self.assertEqual(res_throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_landing_banners_admin_crud_and_public_filtering(self):
        # 1. Admin creates a scheduled banner in the future
        self.client.force_authenticate(user=self.admin)
        future_time = timezone.now() + timedelta(days=2)
        res_create = self.client.post(reverse('admin-landing-banners-list'), {
            'title': 'Future JEE Seminar',
            'caption': 'Live webinar with Ankit Sir',
            'image_url': 'https://example.com/banner.jpg',
            'link_url': 'https://example.com/join',
            'show_from': future_time.isoformat(),
            'order': 1,
            'is_active': True,
        }, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        future_banner_id = res_create.data['id']

        # 2. Admin creates a currently active banner
        now_time = timezone.now()
        res_create2 = self.client.post(reverse('admin-landing-banners-list'), {
            'title': 'Admissions Open 2025-26',
            'caption': 'Class 11 & 12 Evening Course',
            'image_url': 'https://example.com/active.jpg',
            'link_url': 'https://example.com/enroll',
            'show_from': (now_time - timedelta(days=1)).isoformat(),
            'show_until': (now_time + timedelta(days=30)).isoformat(),
            'order': 0,
            'is_active': True,
        }, format='json')
        self.assertEqual(res_create2.status_code, status.HTTP_201_CREATED)

        # 3. Public endpoint GET /api/content/landing-banners/ returns ONLY currently active banners
        self.client.logout()
        res_public = self.client.get(reverse('landing-banners'))
        self.assertEqual(res_public.status_code, status.HTTP_200_OK)
        self.assertEqual(res_public.data['display_count'], 1)
        public_titles = [b['title'] for b in res_public.data['banners']]
        self.assertIn('Admissions Open 2025-26', public_titles)
        self.assertNotIn('Future JEE Seminar', public_titles)

        # 4. Admin updates landing-banner-settings display_count to 2
        self.client.force_authenticate(user=self.admin)
        res_settings = self.client.put(reverse('admin-landing-banner-settings'), {
            'display_count': 2
        }, format='json')
        self.assertEqual(res_settings.status_code, status.HTTP_200_OK)
        self.assertEqual(res_settings.data['display_count'], 2)

        # Public endpoint now reflects display_count = 2
        self.client.logout()
        res_public2 = self.client.get(reverse('landing-banners'))
        self.assertEqual(res_public2.data['display_count'], 2)

    def test_overview_trends_data(self):
        from apps.payments.models import Payment
        self.client.force_authenticate(user=self.admin)
        # Create a paid payment
        Payment.objects.create(
            user=self.student,
            amount_paise=499900,
            status=Payment.Status.PAID,
            razorpay_order_id='order_trends_test_1',
            razorpay_payment_id='pay_trends_test_1',
        )

        res = self.client.get(reverse('admin-overview-trends'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['trends']), 30)
        self.assertGreaterEqual(res.data['total_signups_30d'], 1)
        self.assertEqual(res.data['total_payments_count_30d'], 1)
        self.assertEqual(res.data['total_revenue_30d'], 4999.0)

    def test_chatbot_endpoint_responses(self):
        # 1. Chatbot handles course timing query via keyword fallback
        res1 = self.client.post(reverse('chatbot'), {
            'message': 'What are the class timings and schedule?',
            'history': []
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertIn('reply', res1.data)
        self.assertIn('6:30 PM', res1.data['reply'])

        # 2. Chatbot handles fee query without inventing fees (directs to WhatsApp)
        res2 = self.client.post(reverse('chatbot'), {
            'message': 'What is the fee for dropper course?',
            'history': []
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIn('WhatsApp at +91 93825 57693', res2.data['reply'])

        # 3. Empty message returns 400
        res3 = self.client.post(reverse('chatbot'), {'message': ''}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Chatbot with mocked Anthropic API response
        from unittest.mock import patch, MagicMock
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"content": [{"type": "text", "text": "Hello from Swecha powered by Claude!"}]}'
        mock_response.__enter__.return_value = mock_response

        with patch('os.environ.get') as mock_env, patch('urllib.request.urlopen', return_value=mock_response):
            mock_env.side_effect = lambda k, default='': 'test-key' if k == 'ANTHROPIC_API_KEY' else default
            from apps.content.chatbot_service import generate_chatbot_response
            reply = generate_chatbot_response('Hello', [])
            self.assertEqual(reply, 'Hello from Swecha powered by Claude!')

    def test_delete_course_with_all_relations(self):
        """
        Verify deleting a course with enrollments, payments, schedule events,
        features, add-ons, and tests succeeds cleanly via the Admin API without 500 error.
        """
        import uuid
        from django.utils import timezone
        from apps.academics.models import Course, Enrollment, CourseFeature, CourseAddon
        from apps.payments.models import Payment, Entitlement
        from apps.content.models import ScheduleEvent
        from apps.tests.models import Test

        self.client.force_authenticate(user=self.admin)
        course = Course.objects.create(
            title="Complete Deletion Target Course",
            slug=f"del-target-{uuid.uuid4().hex[:6]}",
            price=1999
        )

        # 1. Feature & Addon
        CourseFeature.objects.create(course=course, text="Comprehensive curriculum", order=1)
        addon = CourseAddon.objects.create(course=course, title="Specialized Test Series", price=499)

        # 2. Enrollment
        Enrollment.objects.create(user=self.student, course=course, status="ACTIVE")

        # 3. Payment & Entitlement
        payment = Payment.objects.create(
            user=self.student,
            course=course,
            amount_paise=199900,
            status=Payment.Status.PAID,
            razorpay_order_id=f"order_{uuid.uuid4().hex[:12]}",
            razorpay_payment_id=f"pay_{uuid.uuid4().hex[:12]}"
        )
        Entitlement.objects.create(user=self.student, payment=payment, course=course, course_addon=addon)

        # 4. Schedule Event
        now = timezone.now()
        ScheduleEvent.objects.create(
            course=course,
            title="Doubt Clearing Live Session",
            start_time=now,
            end_time=now + timezone.timedelta(hours=1)
        )

        # 5. Test
        Test.objects.create(title="Weekly Exam", course=course, total_marks=100)

        # 6. Student profile last_selected_course_id
        if hasattr(self.student, 'profile') and self.student.profile:
            self.student.profile.last_selected_course_id = course.id
            self.student.profile.save()

        # Delete course via admin endpoint
        res = self.client.delete(f'/api/admin-panel/courses/{course.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        # Confirm course is gone
        self.assertFalse(Course.objects.filter(id=course.id).exists())

    def test_course_creation_auto_generates_unique_slug_and_validates_title(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Create course without slug
        payload_1 = {
            'title': 'Pinnacle JEE Batch 2026',
            'description': 'Advanced training for top rankers',
            'price': 4999,
            'status': 'PUBLISHED'
        }
        res_1 = self.client.post('/api/admin-panel/courses/', payload_1)
        self.assertEqual(res_1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_1.data['slug'], 'pinnacle-jee-batch-2026')

        # 2. Duplicate title (case-insensitive with whitespace) should be blocked with 400
        payload_dup = {
            'title': '   pinnacle jee batch 2026   ',
            'price': 4999
        }
        res_dup = self.client.post('/api/admin-panel/courses/', payload_dup)
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('A course with this title already exists.', str(res_dup.data))

        # 3. Create another course that would collide on slug if not handled
        # Manually create another course with a different title but pre-occupy a colliding slug
        Course.objects.create(title='Other Course', slug='pinnacle-jee-batch-2027', price=0)
        payload_3 = {
            'title': 'Pinnacle JEE Batch 2027',
            'price': 5999
        }
        res_3 = self.client.post('/api/admin-panel/courses/', payload_3)
        self.assertEqual(res_3.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_3.data['slug'], 'pinnacle-jee-batch-2027-2')

        # 4. Updating the first course with the same title should succeed (excluding self)
        course_1_id = res_1.data['id']
        patch_res = self.client.patch(f'/api/admin-panel/courses/{course_1_id}/', {
            'title': 'Pinnacle JEE Batch 2026',
            'description': 'Updated description'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['description'], 'Updated description')

    def test_delete_book_with_orders_returns_409(self):
        self.client.force_authenticate(user=self.admin)
        book = BookProduct.objects.create(
            slug='physics-handbook',
            title='Physics Handbook',
            digital_price=299,
            hardcopy_price=499,
            is_published=True
        )
        BookOrder.objects.create(
            user=self.student,
            product=book,
            format='DIGITAL',
            buyer_name='Student User',
            buyer_phone='9876543210',
            buyer_email='student@example.com',
            base_amount=299,
            gst_amount=53.82,
            total_amount_paise=35282,
            razorpay_order_id='order_del_test_1',
            status='PAID'
        )

        res = self.client.delete(f'/api/admin/books/products/{book.id}/')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('This book has 1 order(s). Unpublish it instead.', res.data.get('detail', ''))
        self.assertEqual(res.data.get('action'), 'unpublish')

    def test_delete_book_without_orders_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        book = BookProduct.objects.create(
            slug='chemistry-handbook',
            title='Chemistry Handbook',
            digital_price=199,
            is_published=True
        )
        res = self.client.delete(f'/api/admin/books/products/{book.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BookProduct.objects.filter(id=book.id).exists())

    def test_delete_test_with_attempts_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        test = Test.objects.create(
            title='Full Mock Test 1',
            total_marks=300,
            duration_minutes=180
        )
        attempt = TestAttempt.objects.create(
            user=self.student,
            test=test,
            score=250,
            status='SUBMITTED'
        )

        res = self.client.delete(f'/api/admin-panel/tests/{test.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Test.objects.filter(id=test.id).exists())
        self.assertFalse(TestAttempt.objects.filter(id=attempt.id).exists())

    def test_delete_question_used_in_test_and_dpp_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        q = Question.objects.create(
            chapter=self.chapter,
            question_text='Sample Question for deletion?',
            question_type='SINGLE'
        )
        test = Test.objects.create(title='Question Test', total_marks=100)
        TestQuestion.objects.create(test=test, question=q, positive_marks=4)

        dpp = DPP.objects.create(chapter=self.chapter, title='Kinematics DPP')
        DPPQuestion.objects.create(dpp=dpp, question=q, order=1)

        res = self.client.delete(f'/api/admin-panel/questions/{q.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Question.objects.filter(id=q.id).exists())

    def test_delete_video_used_in_course_content_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        video = Video.objects.create(
            title='Vector Basics',
            video_source_type='YOUTUBE',
            original_key='test.mp4'
        )
        course = Course.objects.create(title='Course for Video Test', price=500)
        section = CourseSection.objects.create(course=course, title='Section 1')
        ContentItem.objects.create(section=section, title='Lecture 1 Video', video=video)

        res = self.client.delete(f'/api/admin-panel/videos/{video.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Video.objects.filter(id=video.id).exists())

    def test_delete_subject_and_academic_class_with_chapters_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        exam = Exam.objects.create(name='NEET Exam', slug='neet-exam')
        ac_class = AcademicClass.objects.create(name='Class 12', slug='class-12', code='12', exam=exam)
        subject = Subject.objects.create(name='Mathematics', slug='mathematics', academic_class=ac_class)
        cat = Category.objects.create(subject=subject, name='Algebra', slug='algebra')
        Chapter.objects.create(subject=subject, category=cat, name='Matrices', slug='matrices', order=1)

        # Delete subject without confirm returns 400
        res_sub_unconfirmed = self.client.delete(f'/api/admin-panel/subjects/{subject.id}/')
        self.assertEqual(res_sub_unconfirmed.status_code, status.HTTP_400_BAD_REQUEST)

        # Delete subject with confirm succeeds
        res_sub = self.client.delete(f'/api/admin-panel/subjects/{subject.id}/?confirm=true')
        self.assertEqual(res_sub.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Subject.objects.filter(id=subject.id).exists())

        # Create another subject under ac_class to test class delete safeguard
        Subject.objects.create(name='Biology', slug='biology', academic_class=ac_class)

        # Delete academic class without confirm returns 400
        res_cls_unconfirmed = self.client.delete(f'/api/admin-panel/classes/{ac_class.id}/')
        self.assertEqual(res_cls_unconfirmed.status_code, status.HTTP_400_BAD_REQUEST)

        # Delete academic class with confirm succeeds
        res_cls = self.client.delete(f'/api/admin-panel/classes/{ac_class.id}/?confirm=true')
        self.assertEqual(res_cls.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AcademicClass.objects.filter(id=ac_class.id).exists())

    def test_exam_viewset_crud_and_cascade_info(self):
        self.client.force_authenticate(user=self.admin)
        # Create
        res = self.client.post('/api/admin-panel/exams/', {
            'name': 'KVPY',
            'description': 'KVPY Exam'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        exam_id = res.data['id']
        self.assertEqual(res.data['slug'], 'kvpy')

        # Add class
        cls = AcademicClass.objects.create(name='SX', slug='sx', code='SX', exam_id=exam_id)

        # Cascade info
        res_cascade = self.client.get(f'/api/admin-panel/exams/{exam_id}/cascade_info/')
        self.assertEqual(res_cascade.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cascade.data['classes_count'], 1)

        # Delete without confirm returns 400
        res_del = self.client.delete(f'/api/admin-panel/exams/{exam_id}/')
        self.assertEqual(res_del.status_code, status.HTTP_400_BAD_REQUEST)

        # Delete with confirm succeeds
        res_del_ok = self.client.delete(f'/api/admin-panel/exams/{exam_id}/?confirm=true')
        self.assertEqual(res_del_ok.status_code, status.HTTP_204_NO_CONTENT)

    def test_subject_viewset_scoping_and_duplicate_handling(self):
        self.client.force_authenticate(user=self.admin)
        exam_jee = Exam.objects.create(name='JEE Adv', slug='jee-adv')
        cls_11 = AcademicClass.objects.create(name='Class 11', slug='c11', code='C11', exam=exam_jee)
        cls_12 = AcademicClass.objects.create(name='Class 12', slug='c12', code='C12', exam=exam_jee)

        # Create Physics under Class 11
        res1 = self.client.post('/api/admin-panel/subjects/', {
            'academic_class': str(cls_11.id),
            'name': 'Physics'
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)
        self.assertEqual(res1.data['subject_label'], 'Class 11 · Physics')

        # Duplicate in Class 11 is rejected
        res_dup = self.client.post('/api/admin-panel/subjects/', {
            'academic_class': str(cls_11.id),
            'name': 'physics'  # case-insensitive
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Same name in Class 12 is ALLOWED
        res2 = self.client.post('/api/admin-panel/subjects/', {
            'academic_class': str(cls_12.id),
            'name': 'Physics'
        })
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res2.data['subject_label'], 'Class 12 · Physics')

        # Filter by class
        res_filter = self.client.get(f'/api/admin-panel/subjects/?class={cls_11.id}')
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        returned_ids = [s['id'] for s in res_filter.data]
        self.assertIn(res1.data['id'], returned_ids)
        self.assertNotIn(res2.data['id'], returned_ids)

    def test_chapter_viewset_scoping_and_slug_autogen(self):
        self.client.force_authenticate(user=self.admin)
        exam = Exam.objects.create(name='Olympiad', slug='olympiad')
        cls = AcademicClass.objects.create(name='Junior', slug='junior', code='JR', exam=exam)
        subj = Subject.objects.create(name='Astronomy', slug='astronomy', academic_class=cls)

        # Create chapter
        res1 = self.client.post('/api/admin-panel/chapters/', {
            'subject': subj.id,
            'name': 'Solar System'
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)
        self.assertEqual(res1.data['slug'], 'solar-system')
        self.assertEqual(res1.data['subject_label'], 'Junior · Astronomy')

        # Duplicate chapter name in same subject rejected
        res_dup = self.client.post('/api/admin-panel/chapters/', {
            'subject': subj.id,
            'name': 'Solar System'
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

    def test_course_serializer_exam_class_subject_validation(self):
        self.client.force_authenticate(user=self.admin)
        exam1 = Exam.objects.create(name='Exam A', slug='exam-a')
        exam2 = Exam.objects.create(name='Exam B', slug='exam-b')

        cls_a = AcademicClass.objects.create(name='Class A1', slug='ca1', code='CA1', exam=exam1)
        cls_b = AcademicClass.objects.create(name='Class B1', slug='cb1', code='CB1', exam=exam2)

        subj_a = Subject.objects.create(name='Subject A', slug='sa', academic_class=cls_a)
        subj_b = Subject.objects.create(name='Subject B', slug='sb', academic_class=cls_b)

        # Mismatch: course has exam1, but selected class is from exam2
        res_mismatch = self.client.post('/api/admin-panel/courses/', {
            'title': 'Invalid Exam Course',
            'exam': str(exam1.id),
            'classes': [str(cls_b.id)],
            'price': 100
        })
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('classes', res_mismatch.data)

        # Mismatch: subject does not belong to selected classes
        res_subj_mismatch = self.client.post('/api/admin-panel/courses/', {
            'title': 'Invalid Subject Course',
            'exam': str(exam1.id),
            'classes': [str(cls_a.id)],
            'subjects': [subj_b.id],
            'price': 100
        })
        self.assertEqual(res_subj_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('subjects', res_subj_mismatch.data)

    def test_options_view_hierarchy_tree(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/options/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('exams', res.data)
        self.assertIn('classes', res.data)
        self.assertIn('subjects', res.data)
        self.assertIn('categories', res.data)
        self.assertIn('chapters', res.data)
        self.assertIn('topics', res.data)
        self.assertIn('tree', res.data)
        self.assertIsInstance(res.data['tree'], list)






