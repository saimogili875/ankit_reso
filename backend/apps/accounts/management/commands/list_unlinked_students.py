from django.core.management.base import BaseCommand
from apps.accounts.models import User

class Command(BaseCommand):
    help = 'Lists all existing student accounts that do not have a clerk_id linked yet.'

    def handle(self, *args, **options):
        unlinked_students = User.objects.filter(
            role=User.Role.STUDENT,
            clerk_id__isnull=True
        ).order_by('date_joined')

        count = unlinked_students.count()
        self.stdout.write(self.style.NOTICE(f"Found {count} student(s) with no clerk_id."))

        if count > 0:
            self.stdout.write("-" * 80)
            self.stdout.write(f"{'ID':<38} | {'Email':<30} | {'Username':<15}")
            self.stdout.write("-" * 80)
            for student in unlinked_students:
                self.stdout.write(f"{str(student.id):<38} | {student.email:<30} | {student.username:<15}")
            self.stdout.write("-" * 80)
            self.stdout.write(self.style.SUCCESS(
                "When these students sign in via Clerk with their verified email address, "
                "their accounts will automatically link to their clerk_id, preserving all existing "
                "enrollments, payments, test attempts, and learning progress."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("All students have clerk_id linked."))
