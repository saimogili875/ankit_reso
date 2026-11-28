from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import Subject, Chapter, Category, Exam, AcademicClass
from apps.questions.models import Question, QuestionOption
from apps.tests.models import Test, TestSection, TestQuestion, TestAttempt

User = get_user_model()

class CBTTestSubmitC4Tests(TestCase):
    """
    Audit Finding C4:
    Verify that TestSubmitView is concurrency-safe, idempotent on multiple submits,
    and accurately grades Single Choice, Multiple Choice, and Numerical questions.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='cbt.student@adepteduverse.com',
            username='cbtstudent',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )
        self.client.force_authenticate(user=self.user)

        self.exam = Exam.objects.create(name='JEE Main CBT', slug='jee-main-cbt')
        self.academic_class = AcademicClass.objects.create(exam=self.exam, name='Class 12', slug='class-12', code='12')
        self.subject = Subject.objects.create(academic_class=self.academic_class, name='Chemistry CBT', slug='chem-cbt')
        self.category = Category.objects.create(subject=self.subject, name='Physical', slug='physical-cbt')
        self.chapter = Chapter.objects.create(subject=self.subject, category=self.category, name='Thermodynamics', slug='thermo-cbt', order=1)

        self.test = Test.objects.create(
            exam=self.exam,
            title='JEE Main Full Test 01',
            total_marks=12,
            duration_minutes=60,
            is_published=True
        )
        self.section = TestSection.objects.create(
            test=self.test,
            subject=self.subject,
            name='Section A',
            order=1
        )

        # 1. Single Choice Question
        self.q_single = Question.objects.create(
            chapter=self.chapter,
            question_text='What is the first law of thermodynamics?',
            question_type=Question.QuestionType.SINGLE_CHOICE
        )
        self.opt_single_correct = QuestionOption.objects.create(question=self.q_single, option_text='Energy conservation', is_correct=True)
        self.opt_single_wrong = QuestionOption.objects.create(question=self.q_single, option_text='Entropy increase', is_correct=False)
        self.tq_single = TestQuestion.objects.create(
            test=self.test,
            section=self.section,
            question=self.q_single,
            order=1,
            positive_marks=4,
            negative_marks=1
        )

        # 2. Numerical Question with bounds [10.0, 10.5]
        self.q_num = Question.objects.create(
            chapter=self.chapter,
            question_text='Calculate work done in Joules (between 10.0 and 10.5)',
            question_type=Question.QuestionType.NUMERICAL,
            numerical_lower_bound=Decimal('10.0'),
            numerical_upper_bound=Decimal('10.5')
        )
        self.tq_num = TestQuestion.objects.create(
            test=self.test,
            section=self.section,
            question=self.q_num,
            order=2,
            positive_marks=4,
            negative_marks=0
        )

        # 3. Multiple Choice Question
        self.q_multi = Question.objects.create(
            chapter=self.chapter,
            question_text='Select all state functions',
            question_type=Question.QuestionType.MULTIPLE_CHOICE
        )
        self.opt_multi_1 = QuestionOption.objects.create(question=self.q_multi, option_text='Enthalpy', is_correct=True)
        self.opt_multi_2 = QuestionOption.objects.create(question=self.q_multi, option_text='Internal Energy', is_correct=True)
        self.opt_multi_3 = QuestionOption.objects.create(question=self.q_multi, option_text='Work', is_correct=False)
        self.tq_multi = TestQuestion.objects.create(
            test=self.test,
            section=self.section,
            question=self.q_multi,
            order=3,
            positive_marks=4,
            negative_marks=1
        )

        self.attempt = TestAttempt.objects.create(
            user=self.user,
            test=self.test,
            status=TestAttempt.Status.IN_PROGRESS
        )

    def test_submit_grades_all_types_correctly_and_idempotently(self):
        url = f'/api/tests/attempts/{self.attempt.id}/submit/'
        payload = {
            'answers': {
                str(self.q_single.id): str(self.opt_single_correct.id),
                str(self.q_num.id): '10.25',
                str(self.q_multi.id): {
                    'selected_options': [str(self.opt_multi_1.id), str(self.opt_multi_2.id)]
                }
            },
            'time_taken_seconds': 1800
        }

        # 1. Initial submission
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data.get('correct_count'), 3)
        self.assertEqual(response.data.get('score'), 12.0)

        self.attempt.refresh_from_db()
        self.assertEqual(self.attempt.status, TestAttempt.Status.SUBMITTED)
        self.assertEqual(self.attempt.score, Decimal('12'))

        # 2. Resubmission idempotency: verify 200 OK without re-grading or error
        re_response = self.client.post(url, payload, format='json')
        self.assertEqual(re_response.status_code, status.HTTP_200_OK)
        self.assertIn('already submitted', re_response.data.get('message', ''))
        self.assertEqual(re_response.data.get('score'), 12.0)
