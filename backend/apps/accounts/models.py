import re
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from apps.core.models import TimeStampedModel

def normalize_phone(phone: str) -> str:
    """Normalizes phone numbers to standard +91XXXXXXXXXX format."""
    if not phone:
        return ""
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('91') and len(digits) == 12:
        return f"+{digits}"
    elif digits.startswith('0') and len(digits) == 11:
        return f"+91{digits[1:]}"
    elif len(digits) == 10:
        return f"+91{digits}"
    elif phone.startswith('+'):
        return f"+{digits}"
    return f"+91{digits}" if len(digits) == 10 else f"+{digits}"

class User(AbstractUser):
    """
    Custom User model for AdeptEduverse Platform.
    Supports Roles: STUDENT, ADMIN, INSTRUCTOR.
    """
    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        ADMIN = 'ADMIN', 'Admin / Content Manager'
        INSTRUCTOR = 'INSTRUCTOR', 'Instructor'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clerk_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.email} ({self.role})"

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()
        if self.phone:
            self.phone = normalize_phone(self.phone)

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        if self.phone:
            self.phone = normalize_phone(self.phone)
            self.phone_number = self.phone
        elif self.phone_number and not self.phone:
            self.phone = normalize_phone(self.phone_number)
            self.phone_number = self.phone

        if not self.full_name:
            name_parts = f"{self.first_name} {self.last_name}".strip()
            self.full_name = name_parts or self.username
        elif not self.first_name and not self.last_name:
            parts = self.full_name.split(' ', 1)
            self.first_name = parts[0]
            self.last_name = parts[1] if len(parts) > 1 else ''

        if self.is_superuser and self.role != self.Role.ADMIN:
            self.role = self.Role.ADMIN

        if self.is_verified:
            if not self.is_email_verified:
                self.is_email_verified = True

        super().save(*args, **kwargs)


class StudentProfile(TimeStampedModel):
    """
    Student profile storing JEE target year, target exam (Main / Advanced), and progress metrics.
    """
    class TargetExam(models.TextChoices):
        JEE_MAIN = 'JEE_MAIN', 'JEE Main'
        JEE_ADVANCED = 'JEE_ADVANCED', 'JEE Advanced'
        BOTH = 'BOTH', 'JEE Main & Advanced'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    academic_class = models.CharField(max_length=20, default='12', blank=True)
    target_exam = models.CharField(max_length=20, choices=TargetExam.choices, default=TargetExam.BOTH)
    target_year = models.IntegerField(default=2025)
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    school_or_coaching = models.CharField(max_length=255, blank=True, default='')
    preferred_language = models.CharField(max_length=50, default='English', blank=True)
    contact_phone = models.CharField(max_length=20, blank=True, default='', help_text="Unverified 10-digit mobile contact number")
    is_onboarded = models.BooleanField(default=False)
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Student Profile: {self.user.email}"
