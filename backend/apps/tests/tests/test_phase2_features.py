import uuid
from decimal import Decimal
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.academics.models import Exam, Course, CourseAddon, Enrollment
from apps.payments.models import Payment, Entitlement
from apps.tests.models import Test, TestSeries, TestAttempt
from apps.progress.models import DPPAttempt
from apps.questions.models import DPP

User = get_user_model()


class Phase2FeaturesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            email='student_phase2@adepteduverse.com',
            username='student_phase2',
            password='TestPassword123!',
            role=User.Role.STUDENT
        )
        self.other_student = User.objects.create_user(
            email='other_phase2@adepteduverse.com',
            username='other_phase2',
            password='TestPassword123!',
            role=User.Role.STUDENT
        )
        self.admin = User.objects.create_user(
            email='admin_phase2@adepteduverse.com',
            username='admin_phase2',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True
        )

        self.course = Course.objects.create(
            title='JEE 2026 Comprehensive',
            slug=f'jee-2026-{uuid.uuid4().hex[:6]}',
            price=4999
        )
        self.addon = CourseAddon.objects.create(
            course=self.course,
            title='Premium JEE Test Series Pack',
            addon_type=CourseAddon.AddonType.TEST_SERIES,
            price=999
        )
        self.series = TestSeries.objects.create(
            course=self.course,
            title='All-India Rank Booster Series',
            order=1,
            is_published=True,
            price=999,
            course_addon=self.addon
        )

        now = timezone.now()
        # 1. Live Test (Present)
        self.test_live = Test.objects.create(
            course=self.course,
            test_series=self.series,
            title='Live JEE Mock 01',
            duration_minutes=180,
            total_marks=300,
            start_time=now - timezone.timedelta(hours=1),
            end_time=now + timezone.timedelta(hours=2),
            is_published=True,
            priority=10,
            rank_board_enabled=True
        )
        # 2. Upcoming Test
        self.test_upcoming = Test.objects.create(
            course=self.course,
            test_series=self.series,
            title='Upcoming JEE Mock 02',
            duration_minutes=180,
            total_marks=300,
            start_time=now + timezone.timedelta(days=2),
            end_time=now + timezone.timedelta(days=3),
            is_published=True,
            priority=5,
            rank_board_enabled=True
        )
        # 3. Expired Test
        self.test_expired = Test.objects.create(
            course=self.course,
            test_series=self.series,
            title='Expired JEE Mock 00',
            duration_minutes=180,
            total_marks=300,
            start_time=now - timezone.timedelta(days=5),
            end_time=now - timezone.timedelta(days=4),
            is_published=True,
            priority=1,
            rank_board_enabled=True
        )

    def test_series_access_control_enrollment_and_entitlement(self):
        # Student without enrollment or entitlement sees nothing
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f'/api/tests/series/?course={self.course.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

        # Student with entitlement for addon sees the series
        payment = Payment.objects.create(
            user=self.student,
            course=self.course,
            amount_paise=99900,
            status=Payment.Status.PAID,
            razorpay_order_id=f'order_{uuid.uuid4().hex[:10]}',
            razorpay_payment_id=f'pay_{uuid.uuid4().hex[:10]}'
        )
        Entitlement.objects.create(user=self.student, payment=payment, course=self.course, course_addon=self.addon)
        res_entitled = self.client.get(f'/api/tests/series/?course={self.course.id}')
        self.assertEqual(res_entitled.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_entitled.data), 1)
        self.assertEqual(res_entitled.data[0]['title'], 'All-India Rank Booster Series')

        # Other student with full active enrollment sees the series
        Enrollment.objects.create(user=self.other_student, course=self.course, status='ACTIVE')
        self.client.force_authenticate(user=self.other_student)
        res_enrolled = self.client.get(f'/api/tests/series/?course={self.course.id}')
        self.assertEqual(res_enrolled.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_enrolled.data), 1)
        self.assertEqual(res_enrolled.data[0]['tests_count'], 3)

    def test_exams_list_server_side_classification_and_states(self):
        self.client.force_authenticate(user=self.student)

        # Before any attempts:
        # test_live -> present ("Start")
        # test_upcoming -> upcoming ("Starts in")
        # test_expired -> completed ("Expired")
        res = self.client.get(f'/api/tests/exams/?course={self.course.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        present = res.data['present']
        upcoming = res.data['upcoming']
        completed = res.data['completed']

        self.assertEqual(len(present), 1)
        self.assertEqual(present[0]['id'], str(self.test_live.id))
        self.assertEqual(present[0]['state'], 'Start')

        self.assertEqual(len(upcoming), 1)
        self.assertEqual(upcoming[0]['id'], str(self.test_upcoming.id))
        self.assertEqual(upcoming[0]['state'], 'Starts in')

        self.assertEqual(len(completed), 1)
        self.assertEqual(completed[0]['id'], str(self.test_expired.id))
        self.assertEqual(completed[0]['state'], 'Expired')

        # Now student starts live test (IN_PROGRESS) -> state becomes "Resume"
        attempt = TestAttempt.objects.create(
            user=self.student,
            test=self.test_live,
            status=TestAttempt.Status.IN_PROGRESS
        )
        res2 = self.client.get(f'/api/tests/exams/?course={self.course.id}')
        self.assertEqual(res2.data['present'][0]['state'], 'Resume')

        # Now student submits test -> moves to completed with "View Result"
        attempt.status = TestAttempt.Status.SUBMITTED
        attempt.score = Decimal('240.0')
        attempt.save()

        res3 = self.client.get(f'/api/tests/exams/?course={self.course.id}')
        self.assertEqual(len(res3.data['present']), 0)
        completed_ids = [c['id'] for c in res3.data['completed']]
        self.assertIn(str(self.test_live.id), completed_ids)
        live_completed = next(c for c in res3.data['completed'] if c['id'] == str(self.test_live.id))
        self.assertEqual(live_completed['state'], 'View Result')

    def test_rank_board_access_gating(self):
        # 1. Unsubmitted student is blocked with 403
        self.client.force_authenticate(user=self.student)
        res_blocked = self.client.get(f'/api/tests/{self.test_live.id}/rank-board/')
        self.assertEqual(res_blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(res_blocked.data.get('locked'))

        # 2. Student submits attempt
        att1 = TestAttempt.objects.create(
            user=self.student,
            test=self.test_live,
            status=TestAttempt.Status.SUBMITTED,
            score=Decimal('250.0'),
            rank=1,
            percentile=Decimal('100.0'),
            time_taken_seconds=5400
        )
        att2 = TestAttempt.objects.create(
            user=self.other_student,
            test=self.test_live,
            status=TestAttempt.Status.SUBMITTED,
            score=Decimal('220.0'),
            rank=2,
            percentile=Decimal('50.0'),
            time_taken_seconds=5600
        )

        # 3. Student can now access rank board
        res_allowed = self.client.get(f'/api/tests/{self.test_live.id}/rank-board/')
        self.assertEqual(res_allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_allowed.data['own_rank'], 1)
        self.assertEqual(res_allowed.data['total_participants'], 2)
        self.assertEqual(len(res_allowed.data['leaderboard']), 2)

        # 4. If admin disables rank board, student is blocked with 403
        self.test_live.rank_board_enabled = False
        self.test_live.save()
        res_disabled = self.client.get(f'/api/tests/{self.test_live.id}/rank-board/')
        self.assertEqual(res_disabled.status_code, status.HTTP_403_FORBIDDEN)

        # 5. If rank_publish_time is in the future, student is blocked with 403
        self.test_live.rank_board_enabled = True
        self.test_live.rank_publish_time = timezone.now() + timezone.timedelta(days=1)
        self.test_live.save()
        res_scheduled = self.client.get(f'/api/tests/{self.test_live.id}/rank-board/')
        self.assertEqual(res_scheduled.status_code, status.HTTP_403_FORBIDDEN)
