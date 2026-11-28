import json
from django.core.management.base import BaseCommand
from apps.books.models import BookProduct
from apps.academics.models import Course
from apps.banners.models import BannerSlide
from apps.content.models import HeroSlide


class Command(BaseCommand):
    help = (
        "Audits image URLs across Books, Courses, Banners, and Hero Slides. "
        "Lists all records whose image URL contains temporary 'X-Amz-Signature' or points to local '/media/', "
        "so they can be safely re-uploaded to permanent Cloudflare R2 storage."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results as a JSON array.',
        )

    def handle(self, *args, **options):
        output_json = options.get('json', False)
        findings = []

        def check_field(model_name, obj_id, title, field_name, url):
            if not url or not isinstance(url, str):
                return
            issues = []
            if 'X-Amz-Signature' in url:
                issues.append('Presigned URL (contains X-Amz-Signature)')
            if '/media/' in url:
                issues.append('Local disk URL (points to /media/)')

            if issues:
                findings.append({
                    'model': model_name,
                    'id': str(obj_id),
                    'title': str(title),
                    'field': field_name,
                    'issues': issues,
                    'url': url,
                })

        # 1. Audit BookProduct
        for book in BookProduct.objects.all():
            check_field('BookProduct', book.id, book.title, 'cover_image', book.cover_image)

        # 2. Audit Course
        for course in Course.objects.all():
            check_field('Course', course.id, course.title, 'image', course.image)
            check_field('Course', course.id, course.title, 'thumbnail_url', course.thumbnail_url)

        # 3. Audit BannerSlide
        for banner in BannerSlide.objects.all():
            check_field('BannerSlide', banner.id, banner.title or f"Slide #{banner.id}", 'image', banner.image)

        # 4. Audit HeroSlide
        for hero in HeroSlide.objects.all():
            check_field('HeroSlide', hero.id, hero.title, 'image_url', hero.image_url)

        if output_json:
            self.stdout.write(json.dumps(findings, indent=2))
            return

        self.stdout.write("=" * 90)
        self.stdout.write("  STORAGE URL AUDIT REPORT: Expiring Presigned & Local Disk Media URLs")
        self.stdout.write("=" * 90)

        if not findings:
            self.stdout.write(self.style.SUCCESS(
                "✓ All Books, Courses, Banners, and Hero Slides are cleanly hosted!\n"
                "  0 records with expiring presigned links or local disk /media/ URLs found."
            ))
            return

        self.stdout.write(self.style.WARNING(
            f"Found {len(findings)} media URL(s) requiring re-upload to permanent R2 public storage:\n"
        ))

        by_model = {}
        for item in findings:
            by_model[item['model']] = by_model.get(item['model'], 0) + 1
            self.stdout.write(
                f"[{item['model']}] ID: {item['id']} | Title: \"{item['title']}\"\n"
                f"  Field:  {item['field']}\n"
                f"  Issue:  {', '.join(item['issues'])}\n"
                f"  URL:    {item['url']}\n"
            )

        self.stdout.write("-" * 90)
        self.stdout.write("SUMMARY BY MODEL:")
        for model_name, count in sorted(by_model.items()):
            self.stdout.write(f"  - {model_name}: {count} issue(s)")
        self.stdout.write(f"Total: {len(findings)} URL(s) to re-upload.")
        self.stdout.write("=" * 90)
