import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.academics.models import Exam, AcademicClass, CourseCategory, Course, CourseFeature, CourseAddon

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Idempotently seed demo CourseCategories, Courses, Features, and Addons (update_or_create demo data)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Academic Classes and Course Categories (DEMO SEED)...")

        with transaction.atomic():
            demo_exam, _ = Exam.objects.get_or_create(
                slug='jee-main',
                defaults={'name': 'JEE Main', 'order': 1, 'is_active': True, 'description': 'Demo JEE Main Exam'}
            )

            # 1. Academic Classes 6-12
            class_defs = [
                (6, "Class 6", "class-6", "class6"),
                (7, "Class 7", "class-7", "class7"),
                (8, "Class 8", "class-8", "class8"),
                (9, "Class 9", "class-9", "class9"),
                (10, "Class 10", "class-10", "class10"),
                (11, "Class 11", "class-11", "class11"),
                (12, "Class 12", "class-12", "class12"),
            ]
            class_map = {}
            for num, name, slug, code in class_defs:
                ac, _ = AcademicClass.objects.update_or_create(
                    exam=demo_exam,
                    code=code,
                    defaults={
                        'name': name,
                        'slug': slug,
                        'order': num,
                    }
                )
                class_map[num] = ac

            # 2. Course Categories (replacing PricingCards)
            categories_data = [
                {
                    'slug': 'school',
                    'name': 'School Courses, Class VI-X',
                    'tagline': 'Building rigorous foundational problem-solving for Olympiads and early JEE prep',
                    'badge': 'School Friendly · Foundation',
                    'rotate_seconds': 5,
                    'cta_label': 'View all Class VI-X courses',
                    'cta_url': '/courses/school',
                    'order': 1,
                    'is_published': True,
                    'features': [
                        "Complete video lecture coverage for NCERT and Olympiads",
                        "Curated Daily Practice Problems (DPP) with step-by-step solutions",
                        "Weekly school-aligned tests and mock Olympiad papers",
                        "Dedicated mental ability & reasoning problem modules",
                        "Live doubt solving and teacher guidance",
                    ]
                },
                {
                    'slug': 'senior',
                    'name': 'Class XI & XII, JEE + Board',
                    'tagline': 'Evening live classes designed around school hours, building foundational theory to JEE Advanced mastery',
                    'badge': 'Most Popular · School Friendly',
                    'rotate_seconds': 5,
                    'cta_label': 'Explore Class 11 & 12 Courses',
                    'cta_url': '/courses/senior',
                    'order': 2,
                    'is_published': True,
                    'features': [
                        "Comprehensive coverage from basic NCERT concepts to multi-concept JEE Advanced problems.",
                        "Live two-way doubt clarification in every single session.",
                        "Curated Daily Practice Problems (DPP) with complete step-by-step solutions.",
                        "Weekly All-India Sunday Mock Test with percentile analysis.",
                        "Full HD video recordings uploaded within 2 hours of every class.",
                    ]
                },
                {
                    'slug': 'dropper',
                    'name': 'Dropper Course',
                    'tagline': 'A rigorous morning schedule for dedicated aspirants giving their entire undivided focus to secure an elite All-India Rank.',
                    'badge': 'Full-Year Accelerator',
                    'rotate_seconds': 5,
                    'cta_label': 'Join Dropper Course',
                    'cta_url': '/courses/dropper',
                    'order': 3,
                    'is_published': True,
                    'features': [
                        "18 hours of weekly live instruction dissecting complex mathematical topics.",
                        "Intensive dissection of the last 20 years of JEE Advanced PYQs.",
                        "Special focus on high-weightage Calculus, Coordinate Geometry & Algebra.",
                        "Personalized performance feedback and test error analysis by Ankit Sir.",
                        "Priority WhatsApp doubt resolution desk for dropper students.",
                    ]
                },
            ]

            category_objs = {}
            for cdata in categories_data:
                features = cdata.pop('features')
                slug = cdata.pop('slug')
                cat, _ = CourseCategory.objects.update_or_create(
                    slug=slug,
                    defaults=cdata
                )
                category_objs[slug] = cat
                # Clear and re-populate features for idempotency
                cat.features.all().delete()
                for idx, ftext in enumerate(features, start=1):
                    CourseFeature.objects.create(
                        category=cat,
                        text=ftext,
                        order=idx
                    )

            # 3. Courses data
            courses_data = [
                {
                    'category_slug': 'school',
                    'class_num': 6,
                    'title': 'Foundation Star Course - Class 6',
                    'slug': 'foundation-star-class-6',
                    'tagline': 'Class 6 Foundation & Science/Maths Olympiad Preparation',
                    'description': 'Ignite critical thinking and logical mastery early. Comprehensive NCERT syllabus plus challenging Olympiad problems.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('2000.00'),
                    'original_price': Decimal('4000.00'),
                    'display_order': 1,
                    'has_live_classes': False,
                    'addons': [
                        (CourseAddon.AddonType.SP, 'Subject Practice Sheets (SP)', Decimal('500.00')),
                        (CourseAddon.AddonType.PYQ, 'Previous Years Solved Questions (PYQ)', Decimal('300.00')),
                        (CourseAddon.AddonType.MENTAL_ABILITY, 'Mental Ability & Reasoning Module', Decimal('400.00')),
                        (CourseAddon.AddonType.OLYMPIAD, 'National Olympiad Mock Drill Package', Decimal('500.00')),
                        (CourseAddon.AddonType.TEST_SERIES, 'Online Monthly CBT Assessment Pass', Decimal('300.00')),
                    ],
                    'features': [
                        "Recorded and interactive theory covering Class 6 Science & Mathematics.",
                        "Weekly live problem-solving and doubt sessions with faculty.",
                        "Chapter-wise DPP with complete typed solutions.",
                        "Special Olympiad and mental ability worksheets.",
                    ]
                },
                {
                    'category_slug': 'school',
                    'class_num': 7,
                    'title': 'Foundation Star Course - Class 7',
                    'slug': 'foundation-star-class-7',
                    'tagline': 'Class 7 Advanced School Curriculum & Olympiad Mastery',
                    'description': 'Bridge the gap between textbook formulas and deep mathematical intuition with Ankit Sir.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('2500.00'),
                    'original_price': Decimal('5000.00'),
                    'display_order': 2,
                    'has_live_classes': False,
                    'addons': [
                        (CourseAddon.AddonType.SP, 'Class 7 Subject Practice Package', Decimal('600.00')),
                        (CourseAddon.AddonType.PYQ, '7-Year Olympiad Archive with Video Hints', Decimal('400.00')),
                        (CourseAddon.AddonType.MENTAL_ABILITY, 'Mental Ability Speed Mastery Workbook', Decimal('500.00')),
                        (CourseAddon.AddonType.MODULE, 'Class 7 Printed Companion Module', Decimal('1000.00')),
                    ],
                    'features': [
                        "Rigorous coverage of Algebra, Geometry, and Physics foundations.",
                        "Bi-weekly live Q&A with master faculty.",
                        "Step-by-step DPP solutions with multiple approaches.",
                    ]
                },
                {
                    'category_slug': 'school',
                    'class_num': 8,
                    'title': 'Foundation Star Course - Class 8',
                    'slug': 'foundation-star-class-8',
                    'tagline': 'Class 8 Pre-JEE Gateway & Analytical Reasoning',
                    'description': 'Transition smoothly into higher algebra, geometry proofs, and mechanics with structured guidance.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('3000.00'),
                    'original_price': Decimal('6000.00'),
                    'display_order': 3,
                    'has_live_classes': False,
                    'addons': [
                        (CourseAddon.AddonType.SP, 'Analytical Problem Sets & SPs', Decimal('700.00')),
                        (CourseAddon.AddonType.PYQ, 'Class 8 Olympiad & Pre-RMO Foundation Bank', Decimal('500.00')),
                        (CourseAddon.AddonType.MODULE, 'Comprehensive Class 8 Theory & Drill Module', Decimal('1200.00')),
                        (CourseAddon.AddonType.TEST_SERIES, 'Sunday CBT Mock Test Series', Decimal('600.00')),
                    ],
                    'features': [
                        "Comprehensive Class 8 STEM foundation preparing for JEE/NEET pathways.",
                        "Live interactive doubt-clearing sessions every week.",
                        "Benchmark ranking across all-India registered peers.",
                    ]
                },
                {
                    'category_slug': 'school',
                    'class_num': 9,
                    'title': 'Foundation Star Course - Class 9',
                    'slug': 'foundation-star-class-9',
                    'tagline': 'Class 9 Early Bird JEE Foundation & IOQM Focus',
                    'description': 'Critical 2-year runway before senior school. Master advanced kinematics, polynomials, and coordinate geometry.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('4000.00'),
                    'original_price': Decimal('8000.00'),
                    'display_order': 4,
                    'has_live_classes': True,
                    'addons': [
                        (CourseAddon.AddonType.SP, 'Class 9 High-Yield Practice Sheets', Decimal('800.00')),
                        (CourseAddon.AddonType.PYQ, '10-Year IOQM & Pre-RMO Archive', Decimal('600.00')),
                        (CourseAddon.AddonType.MODULE, 'AdeptEduverse Class 9 Complete Modules', Decimal('1500.00')),
                        (CourseAddon.AddonType.TEST_SERIES, 'All-India CBT Mock Test Series Class 9', Decimal('1100.00')),
                    ],
                    'features': [
                        "Live and recorded masterclasses with Ankit Kumar.",
                        "IOQM and NMTC level challenge questions included.",
                        "Full solution video discussions for all tests.",
                    ]
                },
                {
                    'category_slug': 'school',
                    'class_num': 10,
                    'title': 'Foundation Star Course - Class 10',
                    'slug': 'foundation-star-class-10',
                    'tagline': 'Class 10 Board Excellence & JEE Advanced Launchpad',
                    'description': 'Dual-focus curriculum ensuring 95%+ in Board examinations while building a formidable bridge to Class 11 JEE concepts.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('5000.00'),
                    'original_price': Decimal('10000.00'),
                    'display_order': 5,
                    'has_live_classes': True,
                    'addons': [
                        (CourseAddon.AddonType.SP, 'Board + JEE Bridge Practice Sheets', Decimal('1000.00')),
                        (CourseAddon.AddonType.PYQ, 'CBSE 10-Yr + Foundation Olympiad Archive', Decimal('800.00')),
                        (CourseAddon.AddonType.MODULE, 'Complete Class 10 Physics & Maths Modules', Decimal('1800.00')),
                        (CourseAddon.AddonType.ADVANCED_BOOK_DIGITAL, 'Early Bird JEE Advanced Problem Book (Digital)', Decimal('1400.00')),
                    ],
                    'features': [
                        "Live interactive classes with real-time audio interaction with Ankit Sir.",
                        "Board exam answer writing guidance alongside JEE shortcuts.",
                        "Full HD recordings available within 2 hours of live session.",
                    ]
                },
                {
                    'category_slug': 'senior',
                    'class_num': 11,
                    'title': 'Class 11 JEE Mains + Advanced Evening Course',
                    'slug': 'class-11-jee-advanced',
                    'tagline': 'Evening Live Course (Mon-Sat, 6:30-8:30 PM) Designed Around School Hours',
                    'description': 'Master foundational theory from ground zero to JEE Advanced peak difficulty. Real-time audio interaction with Ankit Sir in every class.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('15000.00'),
                    'original_price': Decimal('30000.00'),
                    'display_order': 6,
                    'has_live_classes': True,
                    'addons': [
                        (CourseAddon.AddonType.MODULE, 'Complete Class 11 Curriculum Module', Decimal('3000.00')),
                        (CourseAddon.AddonType.JEE_MAINS_TEST, '30 All-India Computer Based JEE Mains Mock Tests', Decimal('2000.00')),
                        (CourseAddon.AddonType.JEE_ADVANCED_TEST, '20 Multi-Concept JEE Advanced Mock Papers', Decimal('3000.00')),
                        (CourseAddon.AddonType.ADVANCED_BOOK_DIGITAL, 'Advanced Problem Book by Ankit Kumar (Digital)', Decimal('2000.00')),
                        (CourseAddon.AddonType.SHORT_NOTES, 'Rapid Revision Formula Sheets & Mind Maps', Decimal('1000.00')),
                        (CourseAddon.AddonType.COACHING_TEST_SERIES, 'National Coaching CBT Benchmark Series', Decimal('4000.00')),
                    ],
                    'features': [
                        "Live classes 6 days a week, 6:30 PM to 8:30 PM (No school overlap).",
                        "Direct mic access during live lectures to ask doubts immediately.",
                        "Curated DPPs with full step-by-step PDF solutions for every session.",
                        "Weekly Sunday CBT with national percentile benchmarking.",
                        "Dedicated WhatsApp desk for priority academic assistance.",
                    ]
                },
                {
                    'category_slug': 'senior',
                    'class_num': 12,
                    'title': 'Class 12 JEE Mains + Advanced & Board Master Course',
                    'slug': 'class-12-jee-advanced',
                    'tagline': 'Comprehensive Class 12 Syllabus Completion + Class 11 Parallel Revision',
                    'description': 'Accelerate syllabus completion by November followed by a 4-month intensive revision program with 2000+ multi-concept advanced questions.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('16000.00'),
                    'original_price': Decimal('32000.00'),
                    'display_order': 7,
                    'has_live_classes': True,
                    'addons': [
                        (CourseAddon.AddonType.MODULE, 'Class 12 Complete Theory & Practice Module', Decimal('3500.00')),
                        (CourseAddon.AddonType.JEE_MAINS_TEST, '40 Full Syllabus JEE Mains Mock CBT Tests', Decimal('2500.00')),
                        (CourseAddon.AddonType.JEE_ADVANCED_TEST, '25 Advanced Subjective & Multi-Choice Tests', Decimal('3500.00')),
                        (CourseAddon.AddonType.ADVANCED_BOOK_DIGITAL, 'JEE Advanced Problem Solving Guide by Ankit Sir', Decimal('2500.00')),
                        (CourseAddon.AddonType.SHORT_NOTES, 'Class 11 & 12 Consolidated Formula Compendium', Decimal('1500.00')),
                        (CourseAddon.AddonType.COACHING_TEST_SERIES, 'Premier All-India CBT Test Series', Decimal('2500.00')),
                    ],
                    'features': [
                        "Complete Class 12 coverage including Calculus, Algebra, and Vectors/3D.",
                        "Weekly integrated Board exam mock tests with step-marking feedback.",
                        "Class 11 revision capsules conducted on alternative weekends.",
                        "Detailed percentile benchmarks and personalized Ankit Sir mentorship.",
                    ]
                },
                {
                    'category_slug': 'dropper',
                    'class_num': 12,
                    'title': 'Droppers Target JEE Advanced Elite Immersion Course',
                    'slug': 'dropper-target-jee-advanced',
                    'tagline': 'Full-Year Morning Accelerated Course (Mon-Sat, 9:00 AM - 12:00 Noon)',
                    'description': 'Designed exclusively for repeat aspirants with 18+ hours of live weekly problem solving, rigorous concept deconstruction, and PYQ analysis.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('18000.00'),
                    'original_price': Decimal('36000.00'),
                    'display_order': 8,
                    'has_live_classes': True,
                    'addons': [
                        (CourseAddon.AddonType.MODULE, 'Complete Dropper 2-Year Theory & Drill Module Set', Decimal('4000.00')),
                        (CourseAddon.AddonType.JEE_MAINS_TEST, '50 Full JEE Mains CBT Tests with Instant Analytics', Decimal('3000.00')),
                        (CourseAddon.AddonType.JEE_ADVANCED_TEST, '35 High-Difficulty JEE Advanced Simulated Papers', Decimal('4000.00')),
                        (CourseAddon.AddonType.ADVANCED_BOOK_DIGITAL, 'IIT JEE Mathematics Masterwork Digital Edition', Decimal('3000.00')),
                        (CourseAddon.AddonType.SHORT_NOTES, 'High-Yield Memory Maps & Trick Compendium', Decimal('1500.00')),
                        (CourseAddon.AddonType.COACHING_TEST_SERIES, 'Comprehensive National Test Series with Rank Predictor', Decimal('2500.00')),
                    ],
                    'features': [
                        "18 hours of weekly live instruction dissecting complex multi-concept problems.",
                        "Complete coverage of Class 11 and 12 syllabus with high-weightage focus.",
                        "Comprehensive analysis of the last 20 years of JEE Advanced papers.",
                        "Weekly 1-on-1 performance review and weak topic diagnosis.",
                    ]
                },
            ]

            for cdata in courses_data:
                category_slug = cdata.pop('category_slug')
                class_num = cdata.pop('class_num')
                addons_info = cdata.pop('addons')
                features_info = cdata.pop('features')
                slug = cdata.pop('slug')

                category = category_objs.get(category_slug)
                academic_class = class_map.get(class_num)

                course, _ = Course.objects.update_or_create(
                    slug=slug,
                    defaults={
                        **cdata,
                        'exam': demo_exam,
                        'category': category,
                        'academic_class': academic_class,
                        'is_published': True,
                        'is_free': (cdata.get('price', 0) == 0),
                        'thumbnail_url': cdata.get('image', '/images/hero/slide-1.jpg'),
                    }
                )
                if academic_class:
                    course.classes.add(academic_class)

                # Features
                course.course_features.all().delete()
                for idx, ftext in enumerate(features_info, start=1):
                    CourseFeature.objects.create(
                        course=course,
                        text=ftext,
                        order=idx
                    )

                # Addons
                course.addons.all().delete()
                for idx, (atype, atitle, aprice) in enumerate(addons_info, start=1):
                    CourseAddon.objects.create(
                        course=course,
                        title=atitle,
                        addon_type=atype,
                        price=aprice,
                        order=idx,
                        is_published=True
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded CourseCategories, Courses, Features, and Addons."))
