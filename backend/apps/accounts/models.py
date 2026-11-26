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
    last_selected_course_id = models.CharField(max_length=100, blank=True, default='')
    is_flagged_bulk_viewing = models.BooleanField(default=False, help_text="Flagged for downloading/scraping excessive pages in short interval")

    # Step 1 – Student details
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=30, blank=True, default='')
    academic_session = models.CharField(max_length=20, default='2026-27', blank=True)
    student_phone = models.CharField(max_length=20, blank=True, default='')

    # Step 2 – School and location
    school_name = models.CharField(max_length=255, blank=True, default='')
    board = models.CharField(max_length=50, blank=True, default='')
    state_board_name = models.CharField(max_length=100, blank=True, default='')
    medium = models.CharField(max_length=50, default='English', blank=True)
    pincode = models.CharField(max_length=10, blank=True, default='')

    # Step 3 – Parent details and consent
    parent_name = models.CharField(max_length=150, blank=True, default='')
    parent_relationship = models.CharField(max_length=50, blank=True, default='')
    parent_phone = models.CharField(max_length=20, blank=True, default='')
    parent_phone_on_whatsapp = models.BooleanField(default=True)
    parent_email = models.EmailField(blank=True, default='')
    has_emergency_contact = models.BooleanField(default=False)
    emergency_contact_name = models.CharField(max_length=150, blank=True, default='')
    emergency_contact_relationship = models.CharField(max_length=50, blank=True, default='')
    emergency_contact_phone = models.CharField(max_length=20, blank=True, default='')
    communication_language = models.CharField(max_length=50, default='English', blank=True)
    consent_email = models.BooleanField(default=False)
    consent_sms = models.BooleanField(default=False)
    consent_whatsapp = models.BooleanField(default=False)

    # Step 4 – Academic details (skippable)
    target_exams = models.JSONField(default=list, blank=True)
    subjects_needed = models.JSONField(default=list, blank=True)
    last_exam_percentage = models.CharField(max_length=50, blank=True, default='')
    current_coaching = models.CharField(max_length=50, blank=True, default='None')
    preferred_batch_mode = models.CharField(max_length=50, blank=True, default='Live online')
    goal_this_year = models.TextField(blank=True, default='')
    hear_about_us = models.CharField(max_length=50, blank=True, default='')
    profile_photo = models.TextField(blank=True, default='')
    profile_completeness = models.IntegerField(default=75)

    class Meta:
        db_table = 'student_profiles'

    def __str__(self):
        return f"Student Profile: {self.user.email}"


class ConsentRecord(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consent_records')
    clerk_id = models.CharField(max_length=255, blank=True, default='')
    policy_version = models.CharField(max_length=50, default='v1.0')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consent_records'


class ProfileChangeRequest(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='change_requests')
    field_name = models.CharField(max_length=50)  # 'student_name', 'date_of_birth', 'academic_class'
    old_value = models.TextField(blank=True, default='')
    new_value = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    review_note = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_change_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'profile_change_requests'


class DeletionRequest(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        REJECTED = 'rejected', 'Rejected'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='deletion_requests')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'deletion_requests'


class ProfileAuditLog(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=100)
    changed_by = models.CharField(max_length=255, blank=True, default='')
    changes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_audit_logs'

