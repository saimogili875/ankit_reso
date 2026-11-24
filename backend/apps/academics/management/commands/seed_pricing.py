import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.academics.models import AcademicClass, PricingCard, Batch, BatchFeature, BatchItem

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Idempotently seed PricingCards, Batches, Features, and Items (update_or_create)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Academic Classes and Pricing Batches...")

        with transaction.atomic():
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
                    slug=slug,
                    defaults={
                        'name': name,
                        'code': code,
                        'order': num,
                    }
                )
                class_map[num] = ac

            # 2. Pricing Cards
            cards_data = [
                {
                    'key': PricingCard.CardKey.SCHOOL,
                    'title': 'School Batches, Class VI-X',
                    'tagline': 'Building rigorous foundational problem-solving for Olympiads and early JEE prep',
                    'badge': 'School Friendly · Foundation',
                    'rotate_seconds': 5,
                    'cta_label': 'View all Class VI-X batches',
                    'cta_url': '/batches/school',
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
                    'key': PricingCard.CardKey.SENIOR,
                    'title': 'Class XI & XII, JEE + Board',
                    'tagline': 'Evening live classes designed around school hours, building foundational theory to JEE Advanced mastery',
                    'badge': 'Most Popular · School Friendly',
                    'rotate_seconds': 5,
                    'cta_label': 'Explore Class 11 & 12 Batches',
                    'cta_url': '/batches/senior',
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
                    'key': PricingCard.CardKey.DROPPER,
                    'title': 'Dropper Batch',
                    'tagline': 'A rigorous morning schedule for dedicated aspirants giving their entire undivided focus to secure an elite All-India Rank.',
                    'badge': 'Full-Year Accelerator',
                    'rotate_seconds': 5,
                    'cta_label': 'Join Dropper Batch',
                    'cta_url': '/batches/dropper',
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

            card_objs = {}
            for cdata in cards_data:
                features = cdata.pop('features')
                key = cdata.pop('key')
                card, _ = PricingCard.objects.update_or_create(
                    key=key,
                    defaults=cdata
                )
                card_objs[key] = card
                # Clear and re-populate features for idempotency
                card.features.all().delete()
                for idx, ftext in enumerate(features, start=1):
                    BatchFeature.objects.create(
                        card=card,
                        text=ftext,
                        order=idx
                    )

            # 3. Batches data
            batches_data = [
                {
                    'card_key': PricingCard.CardKey.SCHOOL,
                    'class_num': 6,
                    'name': 'Foundation Star Batch',
                    'slug': 'foundation-star-class-6',
                    'tagline': 'Class 6 Foundation & Science/Maths Olympiad Preparation',
                    'description': 'Ignite critical thinking and logical mastery early. Comprehensive NCERT syllabus plus challenging Olympiad problems.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('2000.00'),
                    'original_price': Decimal('4000.00'),
                    'display_order': 1,
                    'items': [
                        (BatchItem.ItemType.SP, 'Subject Practice Sheets (SP)', Decimal('500.00'), False),
                        (BatchItem.ItemType.PYQ, 'Previous Years Solved Questions (PYQ)', Decimal('300.00'), False),
                        (BatchItem.ItemType.MENTAL_ABILITY, 'Mental Ability & Reasoning Module', Decimal('400.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Junior Olympiad Prep Pack', Decimal('500.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'Chapterwise Foundation Test Series', Decimal('300.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Class 10th Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SCHOOL,
                    'class_num': 7,
                    'name': 'Foundation Plus Batch',
                    'slug': 'foundation-plus-class-7',
                    'tagline': 'Class 7 Foundation & Olympiad Problem-Solving Mastery',
                    'description': 'Step-up conceptual problem solving for Class 7 students. Builds analytical intuition for higher secondary mathematics and physics.',
                    'image': '/images/ankit-sir-headshot.jpg',
                    'price': Decimal('2000.00'),
                    'original_price': Decimal('4000.00'),
                    'display_order': 2,
                    'items': [
                        (BatchItem.ItemType.SP, 'Subject Practice Sheets (SP)', Decimal('500.00'), False),
                        (BatchItem.ItemType.PYQ, 'Previous Years Solved Questions (PYQ)', Decimal('300.00'), False),
                        (BatchItem.ItemType.MENTAL_ABILITY, 'Mental Ability & Logical Reasoning Module', Decimal('400.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Junior Olympiad Prep Pack', Decimal('500.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'Chapterwise Foundation Test Series', Decimal('300.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Class 10th Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SCHOOL,
                    'class_num': 8,
                    'name': 'Olympiad Ready Batch',
                    'slug': 'olympiad-ready-class-8',
                    'tagline': 'Class 8 Foundation, IOQM & NMTC Olympiad Edge',
                    'description': 'Pre-JEE foundation focusing on algebra, geometry theorems, number theory, and mental ability competitions.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('3000.00'),
                    'original_price': Decimal('6000.00'),
                    'display_order': 3,
                    'items': [
                        (BatchItem.ItemType.SP, 'Subject Practice Sheets (SP)', Decimal('500.00'), False),
                        (BatchItem.ItemType.PYQ, 'Previous Years Solved Questions (PYQ)', Decimal('500.00'), False),
                        (BatchItem.ItemType.MENTAL_ABILITY, 'Mental Ability & Advanced Reasoning', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'IOQM / NMTC Olympiad Training Material', Decimal('800.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'All-India Junior Mock Test Series', Decimal('500.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Class 10th Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SCHOOL,
                    'class_num': 9,
                    'name': 'Board Booster Batch',
                    'slug': 'board-booster-class-9',
                    'tagline': 'Class 9 CBSE Board Mastery + Early JEE Foundation',
                    'description': 'Covers the critical transition year. Deep mastery of coordinate geometry, polynomials, and physics fundamentals.',
                    'image': '/images/ankit-sir-headshot.jpg',
                    'price': Decimal('3000.00'),
                    'original_price': Decimal('6000.00'),
                    'display_order': 4,
                    'items': [
                        (BatchItem.ItemType.SP, 'Subject Practice & Problem Practice (SP + PP)', Decimal('1000.00'), False),
                        (BatchItem.ItemType.PYQ, 'CBSE 10-Year Solved PYQs', Decimal('500.00'), False),
                        (BatchItem.ItemType.MENTAL_ABILITY, 'Aptitude & Mental Ability Module', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Olympiad Stage-1 Prep Pack', Decimal('800.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'Full Syllabus Board Mock Tests', Decimal('500.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Class 10th Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SCHOOL,
                    'class_num': 10,
                    'name': 'Board Topper Batch',
                    'slug': 'board-topper-class-10',
                    'tagline': 'Class 10 CBSE 100/100 Target + JEE Foundation Bridge',
                    'description': 'Complete board preparation with chapterwise question bank, 10 years of solved CBSE PYQs, and bridging into JEE class 11 concepts.',
                    'image': '/images/ankit-sir-thumbsup.jpg',
                    'price': Decimal('3000.00'),
                    'original_price': Decimal('6000.00'),
                    'display_order': 5,
                    'items': [
                        (BatchItem.ItemType.SP, 'Subject Practice & Problem Practice (SP + PP)', Decimal('1000.00'), False),
                        (BatchItem.ItemType.PYQ, 'CBSE Board 10-Year Solved Papers (PYQ)', Decimal('500.00'), False),
                        (BatchItem.ItemType.MENTAL_ABILITY, 'NTSE / Aptitude Reasoning Module', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Olympiad & Advanced Problem Set', Decimal('800.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'Board Pre-Board Simulated Test Series', Decimal('500.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Class 10th Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SENIOR,
                    'class_num': 11,
                    'name': 'JEE Foundation Batch',
                    'slug': 'jee-foundation-class-11',
                    'tagline': 'Class 11 Live Comprehensive: Basic NCERT to JEE Advanced Mastery',
                    'description': 'Master Class 11 mathematics from vectors and trigonometry to calculus foundations. Evening live classes with real-time doubt resolution.',
                    'image': '/images/ankit-sir.jpg',
                    'price': Decimal('5500.00'),
                    'original_price': Decimal('12000.00'),
                    'display_order': 1,
                    'items': [
                        (BatchItem.ItemType.MODULE, 'Complete Class 11 Comprehensive Modules', Decimal('3000.00'), False),
                        (BatchItem.ItemType.JEE_MAINS_TEST, 'JEE Mains Regular Test Series', Decimal('500.00'), False),
                        (BatchItem.ItemType.JEE_ADVANCED_TEST, 'JEE Advanced Multi-Concept Test Series', Decimal('500.00'), False),
                        (BatchItem.ItemType.SHORT_NOTES, 'Formula Cheat Sheets & Short Notes', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Senior Olympiad & Higher Math Drills', Decimal('1000.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'All-India Sunday Mock Tests', Decimal('500.00'), False),
                        (BatchItem.ItemType.COACHING_TEST_SERIES, 'Top National Coaching Test Series', Decimal('600.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.SENIOR,
                    'class_num': 12,
                    'name': 'JEE Mains + Advanced Batch',
                    'slug': 'jee-mains-advanced-class-12',
                    'tagline': 'Class 12 Live Comprehensive + Complete XI Revision',
                    'description': 'Rigorous Class 12 syllabus plus revision drills, high-weightage topics, and full-length JEE mock series.',
                    'image': '/images/ankit-sir-headshot.jpg',
                    'price': Decimal('5500.00'),
                    'original_price': Decimal('12000.00'),
                    'display_order': 2,
                    'items': [
                        (BatchItem.ItemType.MODULE, 'Complete Class 12 Modules + 11th Revision', Decimal('3000.00'), False),
                        (BatchItem.ItemType.JEE_MAINS_TEST, 'JEE Mains Full Mock Papers', Decimal('500.00'), False),
                        (BatchItem.ItemType.JEE_ADVANCED_TEST, 'JEE Advanced High-Weightage Tests', Decimal('500.00'), False),
                        (BatchItem.ItemType.SHORT_NOTES, 'Quick-Revision Handwritten Notes', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Olympiad & Challenging Problem Sessions', Decimal('1000.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'Weekly All-India Test Series with Analysis', Decimal('500.00'), False),
                        (BatchItem.ItemType.COACHING_TEST_SERIES, 'National Kota Coaching Mock Series', Decimal('600.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
                {
                    'card_key': PricingCard.CardKey.DROPPER,
                    'class_num': None,
                    'name': 'Dropper Immersion (entire XI + XII, recorded)',
                    'slug': 'dropper-immersion',
                    'tagline': 'Full-Year Accelerator: Complete XI + XII Recorded & Live Problem Dissection',
                    'description': 'Dedicated morning schedule for droppers. 18 hours weekly problem dissection covering the last 20 years of JEE Advanced PYQs.',
                    'image': '/images/ankit-sir-thumbsup.jpg',
                    'price': Decimal('9999.00'),
                    'original_price': Decimal('19999.00'),
                    'display_order': 1,
                    'items': [
                        (BatchItem.ItemType.MODULE, 'Complete Class 11 & 12 Comprehensive Modules', Decimal('3000.00'), False),
                        (BatchItem.ItemType.JEE_MAINS_TEST, 'Full-Length JEE Mains Computer-Based Tests', Decimal('500.00'), False),
                        (BatchItem.ItemType.JEE_ADVANCED_TEST, 'Rigorous JEE Advanced Mock Examination Series', Decimal('500.00'), False),
                        (BatchItem.ItemType.SHORT_NOTES, 'Complete Formula Bible & Quick Revision Notes', Decimal('500.00'), False),
                        (BatchItem.ItemType.OLYMPIAD, 'Advanced Olympiad & Problem-Solving Drills', Decimal('1000.00'), False),
                        (BatchItem.ItemType.TEST_SERIES, 'All-India Test Series with Error Diagnosis', Decimal('500.00'), False),
                        (BatchItem.ItemType.COACHING_TEST_SERIES, 'Premier National Coaching Test Series', Decimal('600.00'), False),
                        (BatchItem.ItemType.ADVANCED_BOOK_DIGITAL, 'Digital Advanced Problem Book (Add-on)', Decimal('299.00'), True),
                    ]
                },
            ]

            for bdata in batches_data:
                card = card_objs[bdata['card_key']]
                class_num = bdata.get('class_num')
                ac_class = class_map.get(class_num) if class_num else None
                items = bdata.pop('items')
                slug = bdata.pop('slug')
                card_key = bdata.pop('card_key')
                bdata.pop('class_num', None)

                batch, _ = Batch.objects.update_or_create(
                    slug=slug,
                    defaults={
                        'card': card,
                        'academic_class': ac_class,
                        'is_published': True,
                        **bdata
                    }
                )

                # Idempotent item replacement
                batch.items.all().delete()
                for item_type, ititle, iprice, is_addon in items:
                    BatchItem.objects.create(
                        batch=batch,
                        item_type=item_type,
                        title=ititle,
                        price=iprice,
                        is_addon=is_addon
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded PricingCards, Batches, Features, and Items."))
