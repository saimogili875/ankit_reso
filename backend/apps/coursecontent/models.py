from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel


class CourseSection(TimeStampedModel):
    """
    Sections within an academic Course (Modules, Practice, Short Notes, Test Series, Advanced Test Series).
    """
    class SectionType(models.TextChoices):
        MODULES = 'MODULES', 'Modules & Practice Books'
        PRACTICE = 'PRACTICE', 'Practice Tests & PYQs'
        SHORT_NOTES = 'SHORT_NOTES', 'Revision Short Notes'
        TEST_SERIES = 'TEST_SERIES', 'Test Series'
        ADVANCED_TEST_SERIES = 'ADVANCED_TEST_SERIES', 'Advanced Test Series'

    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.CASCADE,
        related_name='course_sections'
    )
    section_type = models.CharField(
        max_length=50,
        choices=SectionType.choices,
        default=SectionType.MODULES,
        db_index=True
    )
    title = models.CharField(max_length=255)
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['course', 'is_published']),
            models.Index(fields=['course', 'section_type']),
        ]

    def __str__(self):
        return f"{self.course.title} - {self.get_section_type_display()}: {self.title}"


class ContentItem(TimeStampedModel):
    """
    Individual content item belonging to a CourseSection:
    - PDF modules / view-only documents
    - Solution PDFs
    - Lecture / solution videos (YouTube or Cloudflare R2 HLS)
    - CBT Mock Exams / Online Tests
    """
    section = models.ForeignKey(
        CourseSection,
        on_delete=models.CASCADE,
        related_name='items'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)
    is_free_preview = models.BooleanField(default=False, db_index=True)

    # Optional taxonomy bindings
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_items'
    )
    chapter = models.ForeignKey(
        'academics.Chapter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_items'
    )
    year = models.IntegerField(null=True, blank=True, help_text="Exam year for PYQ papers (e.g. 2007-2026)")
    group_label = models.CharField(
        max_length=100,
        blank=True,
        help_text="Grouping label e.g. 'JEE Mains', 'JEE Advanced', 'Olympiad', 'Week 1', 'Month 2'"
    )

    # Protected Cloudflare R2 keys
    pdf = models.CharField(max_length=500, blank=True, help_text="Cloudflare R2 key for primary view-only PDF")
    solution_pdf = models.CharField(max_length=500, blank=True, help_text="Cloudflare R2 key for solution PDF")

    # Associated media / test entities
    video = models.ForeignKey(
        'content.Video',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='course_content_items'
    )
    exam = models.ForeignKey(
        'tests.Test',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='course_content_items'
    )
    is_exam = models.BooleanField(default=False)

    # Schedule / Release Gates
    release_at = models.DateTimeField(null=True, blank=True, help_text="When this item becomes visible to students")
    solution_release_at = models.DateTimeField(null=True, blank=True, help_text="When solutions unlock for students")

    # Viewer Mode (Phase 3 Secure Viewing)
    class ViewerMode(models.TextChoices):
        STRONG = 'STRONG', 'Strong (Server-Rendered Watermarked Page Images)'
        BASIC = 'BASIC', 'Basic (Protected Embedded Viewer with Toolbar Hidden)'

    viewer_mode = models.CharField(
        max_length=20,
        choices=ViewerMode.choices,
        default=ViewerMode.STRONG,
        help_text="Viewer mode: STRONG renders server-side watermarked images; BASIC uses protected embedded viewer."
    )

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['section', 'is_published']),
            models.Index(fields=['group_label']),
            models.Index(fields=['year']),
        ]

    def __str__(self):
        return f"{self.section.title} -> {self.title}"


class ContentItemAccessLog(models.Model):
    """
    Audit log for document page views and anti-leak monitoring.
    Tracks user, item, page viewed, IP, and detects bulk viewing patterns.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_access_logs'
    )
    item = models.ForeignKey(
        ContentItem,
        on_delete=models.CASCADE,
        related_name='access_logs'
    )
    page_number = models.IntegerField(default=1)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default='')
    accessed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-accessed_at']
        indexes = [
            models.Index(fields=['user', 'accessed_at']),
            models.Index(fields=['item', 'accessed_at']),
        ]

    def __str__(self):
        return f"User {self.user_id} viewed item {self.item_id} p.{self.page_number} at {self.accessed_at}"
