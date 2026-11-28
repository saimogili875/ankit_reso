from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.academics.models import Course, Enrollment
from apps.payments.models import Payment

User = get_user_model()

class AcademicsEnrollmentTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.student = User.objects.create_user(
            username='academic_student',
            email='acad_student@example.com',
            password='Password123!',
            role=User.Role.STUDENT
        )

        self.admin = User.objects.create_user(
            username='academic_admin',
            email='acad_admin@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True
        )

        self.free_course = Course.objects.create(
            title='Free Foundation Course',
            slug='free-foundation',
            price=Decimal('0.00'),
            is_free=True,
            is_published=True,
            allow_self_enrollment=True
        )

        self.paid_course = Course.objects.create(
            title='Paid Comprehensive Course',
            slug='paid-comprehensive',
            price=Decimal('2999.00'),
            is_free=False,
            is_published=True,
            allow_self_enrollment=True
        )

    def test_free_course_enrollment_succeeds(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.free_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.student, course=self.free_course, status='ACTIVE').exists()
        )

    def test_paid_course_enrollment_without_payment_returns_402(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertTrue(response.data.get('payment_required'))
        self.assertFalse(
            Enrollment.objects.filter(user=self.student, course=self.paid_course).exists()
        )

    def test_paid_course_enrollment_with_paid_payment_succeeds(self):
        # Create a paid Payment record
        Payment.objects.create(
            user=self.student,
            course=self.paid_course,
            amount_paise=299900,
            currency='INR',
            razorpay_order_id='order_paid_check_1',
            razorpay_payment_id='pay_paid_check_1',
            status=Payment.Status.PAID
        )

        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.student, course=self.paid_course, status='ACTIVE').exists()
        )

    def test_admin_can_bypass_paid_course_restriction(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/enrollment/enroll/', {
            'course_id': str(self.paid_course.id)
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Enrollment.objects.filter(user=self.admin, course=self.paid_course).exists()
        )
from decimal import Decimal
from django.test import TestCase
from django.core.management import call_command
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status
from apps.academics.models import CourseCategory, Course, CourseFeature, CourseAddon, AcademicClass
from apps.academics.pricing_views import clear_pricing_cache


class PricingSystemTests(TestCase):
    def setUp(self):
        clear_pricing_cache()
        self.client = APIClient()

    def test_seed_pricing_is_idempotent(self):
        """
        Verify that running seed_pricing multiple times produces identical results
        without throwing IntegrityErrors or creating duplicate records.
        """
        call_command('seed_pricing')
        categories_count_1 = CourseCategory.objects.count()
        courses_count_1 = Course.objects.count()
        addons_count_1 = CourseAddon.objects.count()
        features_count_1 = CourseFeature.objects.count()

        self.assertEqual(categories_count_1, 3)
        self.assertGreaterEqual(courses_count_1, 8)
        self.assertGreater(addons_count_1, 0)
        self.assertGreater(features_count_1, 0)

        # Run second time
        call_command('seed_pricing')
        self.assertEqual(CourseCategory.objects.count(), categories_count_1)
        self.assertEqual(Course.objects.count(), courses_count_1)
        self.assertEqual(CourseAddon.objects.count(), addons_count_1)
        self.assertEqual(CourseFeature.objects.count(), features_count_1)

    def test_public_api_hides_unpublished_categories_and_courses(self):
        """
        Verify that unpublished categories and courses are excluded from public API responses.
        """
        category = CourseCategory.objects.create(
            slug='school',
            name='School Courses',
            is_published=True,
            order=1
        )
        pub_course = Course.objects.create(
            category=category,
            title='Published Course',
            slug='published-course',
            price=Decimal('2000.00'),
            is_published=True,
            display_order=1
        )
        draft_course = Course.objects.create(
            category=category,
            title='Draft Course',
            slug='draft-course',
            price=Decimal('5000.00'),
            is_published=False,
            display_order=2
        )

        clear_pricing_cache()
        res = self.client.get('/api/pricing/categories/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Only pub_course should be nested in category
        cat_data = res.json()[0]
        course_slugs = [c['slug'] for c in cat_data['courses']]
        self.assertIn('published-course', course_slugs)
        self.assertNotIn('draft-course', course_slugs)

        # Direct slug lookup for draft course should return 404 for unauthenticated/students
        draft_res = self.client.get('/api/pricing/courses/draft-course/')
        self.assertEqual(draft_res.status_code, status.HTTP_404_NOT_FOUND)

        pub_res = self.client.get('/api/pricing/courses/published-course/')
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.json()['title'], 'Published Course')

    def test_pricing_categories_endpoint(self):
        """
        Verify /api/pricing/categories/<key>/ returns published courses.
        """
        call_command('seed_pricing')
        clear_pricing_cache()

        res = self.client.get('/api/pricing/categories/school/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data['category']['slug'], 'school')
        self.assertGreaterEqual(len(data['courses']), 5)

    def test_admin_crud_course_categories_and_addons(self):
        """
        Verify admin can perform CRUD on course categories, features, and addons.
        """
        admin_user = User.objects.create_superuser(
            username='admin_pricing',
            email='admin_pricing@example.com',
            password='Password123!',
            role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=admin_user)

        # 1. Create Category
        cat_res = self.client.post('/api/admin/course-categories/', {
            'name': 'Olympiad Specials',
            'slug': 'olympiad-specials',
            'order': 4,
            'is_published': True,
        }, format='json')
        self.assertEqual(cat_res.status_code, status.HTTP_201_CREATED)
        cat_id = cat_res.json()['id']

        # 2. Create Course in Category
        course_res = self.client.post('/api/admin/courses/', {
            'title': 'RMO Olympiad Accelerator',
            'slug': 'rmo-olympiad-accelerator',
            'category': cat_id,
            'price': '3500.00',
            'is_published': True,
        }, format='json')
        self.assertEqual(course_res.status_code, status.HTTP_201_CREATED)
        course_id = course_res.json()['id']

        # 3. Add Feature to Course
        feat_res = self.client.post('/api/admin/course-features/', {
            'course': course_id,
            'text': 'Personalized Olympiad Mentorship',
            'order': 1,
        }, format='json')
        self.assertEqual(feat_res.status_code, status.HTTP_201_CREATED)

        # 4. Add Addon to Course
        addon_res = self.client.post('/api/admin/course-addons/', {
            'course': course_id,
            'title': 'Olympiad 15-Year Archive Book',
            'addon_type': CourseAddon.AddonType.ADVANCED_BOOK_DIGITAL,
            'price': '800.00',
            'is_published': True,
        }, format='json')
        self.assertEqual(addon_res.status_code, status.HTTP_201_CREATED)


class AcademicHierarchyIntegrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_user(
            username='admin_hierarchy',
            email='admin_hierarchy@example.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.student = User.objects.create_user(
            username='student_hierarchy',
            email='student_hierarchy@example.com',
            password='StudentPassword123!',
            role=User.Role.STUDENT,
        )

        from apps.academics.models import Exam, AcademicClass, Subject, Chapter
        # Hierarchy Structure 1: JEE Main -> Class 11 -> Physics -> Kinematics
        self.exam_jee = Exam.objects.create(name='JEE Main Integration', slug='jee-main-integration', order=1)
        self.class_jee_11 = AcademicClass.objects.create(exam=self.exam_jee, name='Class 11', slug='class-11', code='11', order=1)
        self.subj_jee_11_physics = Subject.objects.create(
            academic_class=self.class_jee_11,
            name='Physics',
            slug='physics',
            order=1
        )
        self.chap_kinematics = Chapter.objects.create(
            subject=self.subj_jee_11_physics,
            name='Kinematics',
            slug='kinematics',
            order=1
        )

        # Hierarchy Structure 2: JEE Main -> Class 12 -> Physics -> Electrostatics
        self.class_jee_12 = AcademicClass.objects.create(exam=self.exam_jee, name='Class 12', slug='class-12', code='12', order=2)
        self.subj_jee_12_physics = Subject.objects.create(
            academic_class=self.class_jee_12,
            name='Physics',
            slug='physics',
            order=1
        )
        self.chap_electrostatics = Chapter.objects.create(
            subject=self.subj_jee_12_physics,
            name='Electrostatics',
            slug='electrostatics',
            order=1
        )

        # Hierarchy Structure 3: NEET -> Class 11 -> Physics (same names under separate exam/class)
        self.exam_neet = Exam.objects.create(name='NEET Integration', slug='neet-integration', order=2)
        self.class_neet_11 = AcademicClass.objects.create(exam=self.exam_neet, name='Class 11', slug='class-11', code='11', order=1)
        self.subj_neet_11_physics = Subject.objects.create(
            academic_class=self.class_neet_11,
            name='Physics',
            slug='physics',
            order=1
        )

    def test_composite_uniqueness_allows_same_names_across_parents(self):
        """Classes under different exams and subjects under different classes can share names/slugs."""
        self.assertEqual(self.class_jee_11.name, self.class_neet_11.name)
        self.assertEqual(self.class_jee_11.slug, self.class_neet_11.slug)
        self.assertNotEqual(self.class_jee_11.exam, self.class_neet_11.exam)

        self.assertEqual(self.subj_jee_11_physics.name, self.subj_jee_12_physics.name)
        self.assertEqual(self.subj_jee_11_physics.slug, self.subj_jee_12_physics.slug)
        self.assertNotEqual(self.subj_jee_11_physics.academic_class, self.subj_jee_12_physics.academic_class)

    def test_composite_uniqueness_blocks_duplicates_under_same_parent(self):
        """Cannot create two classes with the same slug/name under the same Exam."""
        from django.db import IntegrityError, transaction
        from apps.academics.models import AcademicClass, Subject
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                AcademicClass.objects.create(
                    exam=self.exam_jee,
                    name='Class 11 Duplicate',
                    slug='class-11',
                    code='11-dup'
                )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Subject.objects.create(
                    academic_class=self.class_jee_11,
                    name='Physics Duplicate',
                    slug='physics'
                )

    def test_subjects_in_different_classes_are_completely_isolated(self):
        """Chapters in Class 11 Physics never leak into Class 12 Physics."""
        from apps.academics.models import Chapter
        jee_11_chaps = Chapter.objects.filter(subject=self.subj_jee_11_physics)
        jee_12_chaps = Chapter.objects.filter(subject=self.subj_jee_12_physics)

        self.assertEqual(list(jee_11_chaps), [self.chap_kinematics])
        self.assertEqual(list(jee_12_chaps), [self.chap_electrostatics])
        self.assertFalse(jee_11_chaps.filter(name='Electrostatics').exists())
        self.assertFalse(jee_12_chaps.filter(name='Kinematics').exists())

    def test_student_class_subjects_endpoint(self):
        """GET /api/academics/classes/<id>/subjects/ returns only subjects for that class."""
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f'/api/academics/classes/{self.class_jee_11.id}/subjects/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [str(s['id']) for s in res.data]
        self.assertIn(str(self.subj_jee_11_physics.id), returned_ids)
        self.assertNotIn(str(self.subj_jee_12_physics.id), returned_ids)
        self.assertNotIn(str(self.subj_neet_11_physics.id), returned_ids)

    def test_student_subject_chapters_endpoint_by_id(self):
        """GET /api/academics/subjects/<id>/chapters/ returns only chapters belonging to that subject."""
        self.client.force_authenticate(user=self.student)
        res = self.client.get(f'/api/academics/subjects/{self.subj_jee_11_physics.id}/chapters/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_names = [c['name'] for c in res.data]
        self.assertEqual(returned_names, ['Kinematics'])
        self.assertNotIn('Electrostatics', returned_names)

    def test_admin_cascade_info_endpoint(self):
        """GET /api/admin-panel/exams/<id>/cascade_info/ returns count of classes, subjects, chapters."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f'/api/admin-panel/exams/{self.exam_jee.id}/cascade_info/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['classes_count'], 2)
        self.assertEqual(res.data['subjects_count'], 2)
        self.assertEqual(res.data['chapters_count'], 2)

    def test_admin_deletion_safeguard_requires_confirm_true(self):
        """DELETE /api/admin-panel/exams/<id>/ without confirm=true returns 400."""
        from apps.academics.models import Exam
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/admin-panel/exams/{self.exam_jee.id}/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm=true', res.data.get('error', ''))
        self.assertTrue(Exam.objects.filter(id=self.exam_jee.id).exists())

        # With confirm=true, deletion proceeds
        res_confirmed = self.client.delete(f'/api/admin-panel/exams/{self.exam_jee.id}/?confirm=true')
        self.assertIn(res_confirmed.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(Exam.objects.filter(id=self.exam_jee.id).exists())


