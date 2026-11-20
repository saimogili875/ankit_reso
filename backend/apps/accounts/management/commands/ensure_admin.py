from django.core.management.base import BaseCommand
from decouple import config
from apps.accounts.models import User

class Command(BaseCommand):
    help = "Ensures an admin user exists with active credentials."

    def handle(self, *args, **options):
        email = config('SEED_ADMIN_EMAIL', default='ankit@adepteduverse.com').strip().lower()
        password = config('SEED_ADMIN_PASSWORD', default='Ank@247shbm')
        username = email.split('@')[0]

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.filter(username__iexact=username).first()

        if user:
            user.email = email
            user.username = username
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.is_verified = True
            user.is_email_verified = True
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Successfully updated admin user: {email}"))
        else:
            User.objects.create_superuser(
                email=email,
                username=username,
                password=password,
                role=User.Role.ADMIN,
                first_name='Ankit',
                last_name='Admin',
                is_staff=True,
                is_superuser=True,
                is_active=True,
                is_verified=True,
                is_email_verified=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Successfully created admin superuser: {email}"))
