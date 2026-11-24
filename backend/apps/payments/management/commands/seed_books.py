import os
import shutil
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.payments.models import Book
from apps.payments.book_services import generate_cover_from_pdf, upload_book_pdf_file

class Command(BaseCommand):
    help = "Seeds the two official Class 10th books and generates covers from PDF page 1."

    def handle(self, *args, **options):
        self.stdout.write("Seeding official Class 10th study books...")

        frontend_books_dir = os.path.join(settings.BASE_DIR.parent, 'frontend', 'public', 'books')

        book_definitions = [
            {
                'id': 'adv-qb-10',
                'title': 'Advanced Question Bank — Class 10th',
                'subtitle': 'Comprehensive Chapterwise Problem Solving, High-Yield Mastery & Foundation Extensions',
                'badge': 'CBSE 10th & JEE Foundation',
                'digital_price': Decimal('299.00'),
                'hardcopy_price': Decimal('399.00'),
                'mrp': Decimal('599.00'),
                'gst_percent': Decimal('18.00'),
                'order': 1,
                'is_published': True,
                'pdf_filename': 'Advanced Question Bank 10th.pdf',
                'highlights': [
                    '1,500+ Curated high-yield objective & subjective problems',
                    'Step-by-step rigorous solutions with first-principles theory',
                    'Class 10 CBSE Board & JEE Foundation bridge topics included',
                    'Exam-tested practice drills designed by IIT Kharagpur faculty',
                ],
            },
            {
                'id': 'pyq-cbse-10',
                'title': 'PYQ CBSE Class 10th — Previous Years Solved',
                'subtitle': '10 Years Complete Chapterwise Solved Papers, Marking Schemes & Examiner Insights',
                'badge': '10 Years Board Papers',
                'digital_price': Decimal('299.00'),
                'hardcopy_price': Decimal('399.00'),
                'mrp': Decimal('599.00'),
                'gst_percent': Decimal('18.00'),
                'order': 2,
                'is_published': True,
                'pdf_filename': 'PYQ Cbse 10th.pdf',
                'highlights': [
                    'Complete 10-year authentic CBSE Board solved question archive',
                    'Official CBSE marking scheme breakdowns and point distribution',
                    'Common student pitfalls & high-scoring presentation tips',
                    'Quick-revision mindmaps & key formula cheat sheets',
                ],
            },
        ]

        for b_data in book_definitions:
            pdf_filename = b_data.pop('pdf_filename')
            book_id = b_data['id']
            pdf_path = os.path.join(frontend_books_dir, pdf_filename)

            cover_image_url = ''
            pdf_key = ''

            if os.path.exists(pdf_path):
                self.stdout.write(f"Processing PDF for {book_id}: {pdf_filename}...")
                with open(pdf_path, 'rb') as f:
                    # Generate cover from page 1
                    cover_url, _ = generate_cover_from_pdf(f)
                    if cover_url:
                        cover_image_url = cover_url
                        self.stdout.write(f"  Generated cover URL: {cover_url}")

                    # Upload PDF
                    f.seek(0)
                    key = upload_book_pdf_file(f, f"{book_id}.pdf")
                    if key:
                        pdf_key = key
                        self.stdout.write(f"  Uploaded PDF key: {key}")
            else:
                self.stdout.write(self.style.WARNING(f"PDF not found at {pdf_path}. Skipping file upload."))

            book, created = Book.objects.update_or_create(
                id=book_id,
                defaults={
                    **b_data,
                    'cover_image_url': cover_image_url,
                    'pdf_key': pdf_key,
                }
            )
            action_name = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action_name} book: {book.title} (ID: {book.id})"))

        self.stdout.write(self.style.SUCCESS("Book seeding completed successfully!"))
