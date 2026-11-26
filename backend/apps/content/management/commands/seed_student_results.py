from django.core.management.base import BaseCommand
from django.db import transaction

from apps.content.models import StudentResult


# (display_order, name, exam/college line, headline, year)
RESULTS = [
    (1, "Ajit Pawar", "JEE Advanced · IIT Madras", "AIR 147", 2026),
    (2, "Gopesh", "BITS Pilani Dubai · Mechanical", "BITS Dubai", 2026),
    (3, "Vincet Joel", "JEE Advanced · IIT Hyderabad, CSE", "AIR 125", 2025),
    (4, "Prankush Singh", "JEE Advanced", "AIR 430", 2025),
    (5, "Md. Nazir", "JEE Advanced · IIT Delhi, Civil", "AIR 1283", 2025),
    (6, "University of Oxford admit", "SAT", "Oxford", 2025),
]


class Command(BaseCommand):
    help = (
        "Idempotently seed the student success list. Entries are created hidden "
        "(consent_flag=False) unless --consent-confirmed is passed, because the public "
        "API only serves results with consent on file."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--consent-confirmed",
            action="store_true",
            help="Pass ONLY after written student/parental consent is on file for every entry.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        consent = options["consent_confirmed"]
        for order, name, exam, rank, year in RESULTS:
            obj, created = StudentResult.objects.update_or_create(
                name=name,
                year=year,
                defaults={
                    "exam": exam,
                    "rank": rank,
                    "display_order": order,
                    "is_published": True,
                    "consent_flag": consent,
                },
            )
            self.stdout.write(f"{'created' if created else 'updated'}: {obj}")

        if consent:
            self.stdout.write(self.style.SUCCESS("Done. Results are now public on the landing page."))
        else:
            self.stdout.write(self.style.WARNING(
                "Done, but consent_flag=False so nothing is public yet. Re-run with "
                "--consent-confirmed once consent is on file, or tick 'consent flag' per "
                "student in the Django admin."
            ))
