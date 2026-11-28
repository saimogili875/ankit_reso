from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User
from apps.academics.models import Exam, Subject, Category, Chapter, Lecture, AcademicClass
from apps.content.models import Video, LandingBanner, LandingBannerSettings
from apps.questions.models import Question, QuestionOption, DPP, DPPQuestion
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
        self.subject = Subject.objects.create(name='Physics', slug='physics')
        self.category = Category.objects.create(subject=self.subject, name='Mechanics', slug='mechanics')
        self.academic_class = AcademicClass.objects.create(name='Class 11', slug='class-11', code='11')
        self.chapter = Chapter.objects.create(
            category=self.category,
            academic_class=self.academic_class,
            name='Kinematics',
            slug='kinematics',
            order=1
        )
        self.lecture = Lecture.objects.create(
            chapter=self.chapter,
            lecture_number=1,
            title='Intro to Motion',
            duration_seconds=1200
        )
        self.exam = Exam.objects.create(name='JEE Main', slug='jee-main')

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


