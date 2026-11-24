import os
import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.books.models import BookProduct

logger = logging.getLogger(__name__)

BOOKS_DATA = [
    {
        'slug': 'adv-qb-10',
        'title': 'Advanced Question Bank — Class 10th',
        'subtitle': 'Comprehensive Board & Foundation Mastery',
        'class_label': 'Class 10th',
        'description': 'The definitive problem collection designed by Ankit Sir for Class 10 students aspiring for 98%+ in board examinations and setting a rock-solid foundation for JEE/NEET.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/adv-qb-10.pdf',
        'cover_image': '/images/ankit-sir-thumbsup.jpg',
        'badge': 'Bestseller',
        'display_order': 1,
        'is_published': True,
        'highlights': [
            'Over 1,200+ curated problems across Mathematics and Science',
            'Step-by-step rigorous solutions directly authored by Ankit Sir',
            'Three-tier progression: Board Level, NTSE/Olympiad, and Early JEE',
            'Chapter-wise formula sheets and quick revision mindmaps',
        ],
    },
    {
        'slug': 'pyq-cbse-10',
        'title': 'PYQ CBSE Class 10th — Previous Years Solved',
        'subtitle': 'Past 10 Years Chapter-wise Solved Papers',
        'class_label': 'Class 10th',
        'description': 'Master the exact CBSE examination patterns with 10 years of meticulously solved previous question papers with official marking scheme criteria.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/pyq-cbse-10.pdf',
        'cover_image': '/images/ankit-sir.jpg',
        'badge': 'Exam Essential',
        'display_order': 2,
        'is_published': True,
        'highlights': [
            '10 complete years of chapter-wise CBSE official questions',
            'Step-by-step marking scheme alignment for full marks presentation',
            'Trend analysis identifying recurring high-weightage topics',
            'Timed self-evaluation mock papers with answer keys',
        ],
    },
    {
        'slug': 'adv-prob-math',
        'title': 'Advanced Problem Book in Mathematics',
        'subtitle': 'For JEE Advanced & Olympiad Aspirants',
        'class_label': 'JEE / Advanced',
        'description': 'Crafted for serious aspirants targeting top ranks in JEE Advanced and mathematical Olympiads. Features non-routine, multi-concept problems that challenge and deepen understanding.',
        'digital_price': Decimal('299.00'),
        'hardcopy_price': Decimal('399.00'),
        'gst_percent': Decimal('18.00'),
        'pdf_key': 'books/pdfs/adv-prob-math.pdf',
        'cover_image': '/images/ankit-sir-headshot.jpg',
        'badge': 'JEE Elite',
        'display_order': 3,
        'is_published': True,
        'highlights': [
            'Targeted for JEE Advanced Top 500 rank aspirants',
            'Non-routine problems bridging Calculus, Algebra & Coordinate Geometry',
            'Multiple solution techniques: analytical, graphical, and elegant shortcuts',
            'Detailed historical exam insights from Kota coaching methodology',
        ],
    },
]


class Command(BaseCommand):
    help = 'Seeds official publication books for guest checkout.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding BookProduct catalog...")
        count = 0
        for item in BOOKS_DATA:
            slug = item.pop('slug')
            book, created = BookProduct.objects.update_or_create(
                slug=slug,
                defaults=item
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"  [{verb}] {book.title} (slug: {book.slug}) - ₹{book.digital_price}/₹{book.hardcopy_price}")
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} official books!"))
