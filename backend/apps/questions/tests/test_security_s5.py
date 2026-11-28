from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import Exam, AcademicClass, Subject, Category, Chapter, AcademicClass
from apps.questions.models import DPP, Question, QuestionOption, DPPQuestion

User = get_user_model()

class DPPAnswerLeakageSecurityTests(TestCase):
    """
    Audit Finding S5 & S6:
    Verify that GET /api/questions/dpps/<id>/questions/ does NOT leak answers or explanations,
    requires authentication (401), and that solutions are only returned upon POST /submit/.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='student.dpp@adepteduverse.com',
            username='studentdpp',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )

        self.exam = Exam.objects.create(name='JEE Main S5', slug='jee-main-s5')
        self.academic_class = AcademicClass.objects.create(exam=self.exam, name='Class 11', slug='class-11', code='11')
        self.subject = Subject.objects.create(
            academic_class=self.academic_class,
            name='Physics',
            slug='physics'
        )
        self.category = Category.objects.create(
            subject=self.subject,
            name='Mechanics',
            slug='mechanics'
        )
        self.chapter = Chapter.objects.create(
            subject=self.subject,
            category=self.category,
            name='Kinematics',
            slug='kinematics',
            order=1
        )
        self.dpp = DPP.objects.create(
            chapter=self.chapter,
            title='Kinematics DPP 01',
            dpp_number=1,
            duration_minutes=30,
            is_published=True
        )

        self.q1 = Question.objects.create(
            chapter=self.chapter,
            question_text='What is the acceleration due to gravity on Earth?',
            solution_text='The standard acceleration due to gravity is approximately 9.8 m/s^2.',
            difficulty=Question.Difficulty.EASY
        )
        self.opt1 = QuestionOption.objects.create(question=self.q1, option_text='9.8 m/s^2', is_correct=True)
        self.opt2 = QuestionOption.objects.create(question=self.q1, option_text='15 m/s^2', is_correct=False)

        DPPQuestion.objects.create(
            dpp=self.dpp,
            question=self.q1,
            order=1,
            positive_marks=4,
            negative_marks=1
        )

    def test_anonymous_access_returns_401(self):
        url = f'/api/questions/dpps/{self.dpp.id}/questions/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dpp_questions_endpoint_strips_answers_and_explanations(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/questions/dpps/{self.dpp.id}/questions/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        questions = response.data.get('questions', [])
        self.assertEqual(len(questions), 1)

        q_data = questions[0]
        # Verify answer leakage fields are completely absent
        self.assertNotIn('correctAnswerId', q_data)
        self.assertNotIn('explanation', q_data)
        self.assertNotIn('solution_text', q_data)

        # Verify options do not expose is_correct
        options = q_data.get('options', [])
        self.assertEqual(len(options), 2)
        for opt in options:
            self.assertNotIn('is_correct', opt)

    def test_dpp_submit_endpoint_grades_and_returns_solutions(self):
        self.client.force_authenticate(user=self.user)
        url = f'/api/questions/dpps/{self.dpp.id}/submit/'
        payload = {
            'answers': {
                str(self.q1.id): str(self.opt1.id)
            }
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data.get('correct'), 1)
        self.assertEqual(response.data.get('score'), 4)

        # Verify solutions map is returned upon submission
        solutions = response.data.get('solutions')
        self.assertIsNotNone(solutions)
        self.assertIn(str(self.q1.id), solutions)
        self.assertEqual(solutions[str(self.q1.id)]['correctAnswerId'], str(self.opt1.id))
        self.assertIn('9.8 m/s^2', solutions[str(self.q1.id)]['explanation'])
