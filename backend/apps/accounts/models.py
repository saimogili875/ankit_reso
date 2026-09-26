import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from apps.core.models import TimeStampedModel

class User(AbstractUser):
    """
    Custom User model for ANKIT JEE Platform.
    Supports Roles: STUDENT, ADMIN, INSTRUCTOR.
    """
    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        ADMIN = 'ADMIN', 'Admin / Content Manager'
        INSTRUCTOR = 'INSTRUCTOR', 'Instructor'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.email} ({self.role})"


class StudentProfile(TimeStampedModel):
    """
    Student profile storing JEE target year, target exam (Main / Advanced), and progress metrics.
    """
    class TargetExam(models.TextChoices):
        JEE_MAIN = 'JEE_MAIN', 'JEE Main'
        JEE_ADVANCED = 'JEE_ADVANCED', 'JEE Advanced'
        BOTH = 'BOTH', 'JEE Main & Advanced'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    target_exam = models.CharField(max_length=20, choices=TargetExam.choices, default=TargetExam.BOTH)
    target_year = models.IntegerField(default=2025)
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Student Profile: {self.user.email}"
