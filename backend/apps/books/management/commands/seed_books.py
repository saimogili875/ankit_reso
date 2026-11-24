import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.books.models import BookProduct

logger = logging.getLogger(__name__)

BOOKS_DATA = [
    {
        'slug': 'cbse-10-pyq-mathematics',
        'title': 'CBSE Class X — Chapter-Wise Previous Years\' Questions (Mathematics)',
        'subtitle': 'Past 10 Years Chapter-Wise Solved Questions with IITian Pedagogical Insights',
        'class_label': 'CBSE Class X',
        'description': 'Master the CBSE Class 10 Board exam with 10+ years of meticulously solved previous question papers with step-by-step marking scheme alignment.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'original_price': Decimal('499.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/pyq-cbse-10.pdf',
        'cover_image': '/images/books/cbse-10-pyq-mathematics.jpg',
        'badge': 'Official PYQ',
        'display_order': 1,
        'is_published': True,
        'highlights': [
            '10+ Years of chapter-wise CBSE official board questions',
            'Official CBSE marking scheme step-by-step point presentation',
            'High-weightage recurring question trend analysis',
            'Authored by Kota veteran Ankit Kumar Sir (B.Tech, IIT Kharagpur, 2019)',
        ],
    },
    {
        'slug': 'cbse-10-mathematics-complete',
        'title': 'Mathematics Complete Syllabus — Class X',
        'subtitle': 'Best School Book Across India — Comprehensive Theory, Proofs & Graded Problems',
        'class_label': 'CBSE Class X',
        'description': 'Comprehensive textbook for CBSE Class 10th Mathematics covering every NCERT concept from first principles with advanced board-level illustrations.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'original_price': Decimal('499.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/cbse-10-math-complete.pdf',
        'cover_image': '/images/books/cbse-10-mathematics-complete.jpg',
        'badge': 'Best School Book',
        'display_order': 2,
        'is_published': True,
        'highlights': [
            'Complete NCERT & CBSE board syllabus with deep conceptual derivations',
            'Over 1,500+ solved examples, graded practice problems & theorems',
            'Special board exam presentation tips to avoid common step mistakes',
            'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
        ],
    },
    {
        'slug': 'cbse-10-mental-ability-reasoning',
        'title': 'Mental Ability & Logical Reasoning — Class X',
        'subtitle': 'Verbal, Non-Verbal, Numerical & Analytical Critical Thinking',
        'class_label': 'CBSE Class X',
        'description': 'Essential aptitude and reasoning masterbook for Class 10 students targeting NTSE, Olympiads, and competitive foundation exams.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'original_price': Decimal('499.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/cbse-10-mental-ability.pdf',
        'cover_image': '/images/books/cbse-10-mental-ability-reasoning.jpg',
        'badge': 'Olympiad & NTSE',
        'display_order': 3,
        'is_published': True,
        'highlights': [
            'Verbal & Non-Verbal reasoning patterns with visual mental models',
            'Numerical ability shortcuts and speed math techniques',
            'Targeted for NTSE, Olympiads, and early competitive aptitude tests',
            'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
        ],
    },
    {
        'slug': 'cbse-10-advanced-question-bank',
        'title': 'Advanced Level Question Bank — Mathematics Complete Syllabus',
        'subtitle': 'Class X to Early JEE Advanced Bridge Mastery',
        'class_label': 'CBSE Class X',
        'description': 'The definitive problem collection for Class 10 students aspiring for 98%+ in board examinations and building an elite bridge to JEE Advanced.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'original_price': Decimal('499.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/adv-qb-10.pdf',
        'cover_image': '/images/books/cbse-10-advanced-question-bank.jpg',
        'badge': 'JEE Foundation',
        'display_order': 4,
        'is_published': True,
        'highlights': [
            'Over 1,200+ advanced non-routine problems extending Class X to JEE',
            'Multi-concept problems bridging Algebra, Geometry & Trigonometry',
            'Detailed analytical and graphical step-by-step solutions',
            'Authored by Ankit Kumar Sir (B.Tech Mechanical, IIT Kharagpur, 2019)',
        ],
    },
    {
        'slug': 'adv-prob-math',
        'title': 'Advanced Problem Book in Mathematics',
        'subtitle': 'For JEE Advanced & Olympiad Aspirants',
        'class_label': 'JEE Advanced',
        'description': 'Crafted for serious aspirants targeting top ranks in JEE Advanced and mathematical Olympiads. Features non-routine, multi-concept problems.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'original_price': Decimal('599.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/adv-prob-math.pdf',
        'cover_image': '/images/books/cbse-10-advanced-question-bank.jpg',
        'badge': 'JEE Elite',
        'display_order': 5,
        'is_published': True,
        'highlights': [
            'Targeted for JEE Advanced Top 500 rank aspirants',
            'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
            'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
            'Detailed historical exam insights from Kota coaching methodology',
        ],
    },
]

OBSOLETE_SLUGS = ['adv-qb-10', 'pyq-cbse-10']


class Command(BaseCommand):
    help = 'Seeds official publication books for guest checkout.'

    def handle(self, *args, **options):
        # 1. Clean up obsolete/duplicate book products
        for old_slug in OBSOLETE_SLUGS:
            old_product = BookProduct.objects.filter(slug=old_slug).first()
            if old_product:
                if old_product.orders.exists():
                    old_product.is_published = False
                    old_product.save(update_fields=['is_published'])
                    self.stdout.write(f"  [Unpublished obsolete] {old_slug}")
                else:
                    old_product.delete()
                    self.stdout.write(f"  [Deleted obsolete] {old_slug}")

        # 2. Seed active official books
        self.stdout.write("Seeding BookProduct catalog...")
        count = 0
        for item in BOOKS_DATA:
            slug = item.pop('slug')
            book, created = BookProduct.objects.update_or_create(
                slug=slug,
                defaults=item
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"  [{verb}] {book.title} (slug: {book.slug}) - cover: {book.cover_image}")
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} official books!"))
