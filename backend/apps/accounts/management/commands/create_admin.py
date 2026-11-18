import getpass
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User

class Command(BaseCommand):
    help = "Creates or updates an administrator user with role=ADMIN and superuser permissions."

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help="Admin user's email address")
        parser.add_argument('--password', type=str, required=False, help="Admin user's password (will prompt if omitted)")
        parser.add_argument('--first-name', type=str, default="Admin", help="First name")
        parser.add_argument('--last-name', type=str, default="User", help="Last name")
        parser.add_argument('--phone', type=str, default="", help="Optional phone number")

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options.get('password')
        first_name = options.get('first_name', 'Admin').strip()
        last_name = options.get('last_name', 'User').strip()
        phone = options.get('phone', '').strip()

        if not email or '@' not in email:
            raise CommandError("Please provide a valid email address.")

        if not password:
            password = getpass.getpass("Enter password for admin: ")
            password_confirm = getpass.getpass("Confirm password: ")
            if password != password_confirm:
                raise CommandError("Passwords do not match.")

        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters long.")

        username = email.split('@')[0]
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': username,
                'first_name': first_name,
                'last_name': last_name,
                'phone_number': phone,
                'role': User.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'is_verified': True,
            }
        )

        if not created:
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.is_verified = True
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            if phone:
                user.phone_number = phone

        user.set_password(password)
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"Successfully {action} admin account: {email} (role={user.role}, is_superuser={user.is_superuser})"
        ))
