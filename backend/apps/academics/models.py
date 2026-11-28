from django.db import models
from django.db.models.functions import Lower
from apps.core.models import TimeStampedModel


class Exam(TimeStampedModel):
    """
    Top-level Exam (e.g. JEE Main, NEET, CBSE Board).
    Admin-driven hierarchy root.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class AcademicClass(TimeStampedModel):
    """
    Class under a specific Exam (e.g. Class 11 under JEE Main).
    Unique per Exam.
    """
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='classes')
    name = models.CharField(max_length=50) # e.g. "Class 11", "Class 12"
    slug = models.SlugField(max_length=50) # e.g. "class-11", "class-12"
    code = models.CharField(max_length=20) # e.g. "class11", "class12"
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Academic Classes"
        ordering = ['order', 'name']
        constraints = [
            models.UniqueConstraint(fields=['exam', 'slug'], name='unique_exam_class_slug'),
            models.UniqueConstraint(fields=['exam', 'code'], name='unique_exam_class_code'),
            models.UniqueConstraint(Lower('name'), 'exam', name='unique_exam_class_name'),
        ]

    def __str__(self):
        exam_name = self.exam.name if hasattr(self, 'exam') and self.exam else "Unassigned"
        return f"{self.name} ({exam_name})"


class Subject(TimeStampedModel):
    """
    Subject under a specific AcademicClass (e.g. Physics under Class 11).
    A Subject belongs to exactly ONE AcademicClass.
    """
    academic_class = models.ForeignKey(AcademicClass, on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)
    color_hex = models.CharField(max_length=10, default='#3B82F6')
    topics = models.JSONField(default=list, blank=True)
    order = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        constraints = [
            models.UniqueConstraint(fields=['academic_class', 'slug'], name='unique_class_subject_slug'),
            models.UniqueConstraint(Lower('name'), 'academic_class', name='unique_class_subject_name'),
        ]

    def __str__(self):
        class_str = self.academic_class.name if hasattr(self, 'academic_class') and self.academic_class else "Unassigned"
        return f"{class_str} · {self.name}"


class Course(TimeStampedModel):
    """
    Central Course product (e.g. JEE Main + Advanced Complete Preparation Course).
    Aggregates an Exam, AcademicClasses and Subjects.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PUBLISHED = 'PUBLISHED', 'Published'

    exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    subtitle = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    thumbnail_url = models.CharField(max_length=500, blank=True, default='/images/hero/slide-1.jpg')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, default=7999.00)
    discount_badge = models.CharField(max_length=50, default='100% OFF (FREE)')
    is_free = models.BooleanField(default=True)
    features = models.JSONField(default=list, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    is_published = models.BooleanField(default=True)
    allow_self_enrollment = models.BooleanField(default=True)
    classes = models.ManyToManyField(AcademicClass, related_name='courses', blank=True)
    subjects = models.ManyToManyField(Subject, related_name='courses', blank=True)
    category = models.ForeignKey('CourseCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    academic_class = models.ForeignKey(AcademicClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_courses')
    tagline = models.CharField(max_length=500, blank=True)
    image = models.CharField(max_length=1000, blank=True, help_text="Cloudflare R2 image URL or static image path")
    has_live_classes = models.BooleanField(default=False, help_text="Set to True only if course conducts live classes")
    display_order = models.IntegerField(default=0)

    @property
    def exam_type(self) -> str:
        """Backward-compatible read-only string for legacy callers during rollout."""
        if self.exam:
            return self.exam.name
        return "JEE"

    def __str__(self):
        return self.title


class Category(TimeStampedModel):
    """
    Sub-groupings within subjects (e.g., Mechanics, Organic Chemistry, Calculus).
    """
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150)

    class Meta:
        verbose_name_plural = "Categories"
        constraints = [
            models.UniqueConstraint(fields=['subject', 'slug'], name='unique_subject_category_slug')
        ]

    def __str__(self):
        return f"{self.subject} -> {self.name}"


class Chapter(TimeStampedModel):
    """
    Specific chapters (e.g. Kinematics, Chemical Bonding, Vectors).
    Belongs directly to a Subject.
    """
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='chapters')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='chapters')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    order = models.IntegerField(default=0)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['order', 'name']
        constraints = [
            models.UniqueConstraint(fields=['subject', 'slug'], name='unique_subject_chapter_slug'),
            models.UniqueConstraint(fields=['subject', 'name'], name='unique_subject_chapter_name'),
        ]

    @property
    def academic_class(self):
        """Derived from subject for backward compatibility."""
        return self.subject.academic_class if self.subject else None

    def __str__(self):
        return f"{self.subject} -> {self.name}"

class Topic(TimeStampedModel):
    """
    Micro-topics inside a chapter (e.g., Projectile Motion, Relative Velocity).
    """
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='topics')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.chapter.name} -> {self.name}"

class Lecture(TimeStampedModel):
    """
    Educational video lecture belonging to a Chapter.
    """
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='lectures')
    lecture_number = models.IntegerField(default=1)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    duration_seconds = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'lecture_number']

    def __str__(self):
        return f"Lec {self.lecture_number}: {self.title}"

class Enrollment(TimeStampedModel):
    """
    Central Course Enrollment linking a Student User to a Course.
    Enforces student + course = unique at the database level.
    """
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='ACTIVE')

    class Meta:
        unique_together = ('user', 'course')

    def __str__(self):
        return f"{self.user.email} -> {self.course.title} ({self.status})"


class CourseCategory(TimeStampedModel):
    """
    Admin-editable Course Categories (e.g. school, senior, dropper)
    displayed on landing and catalog pages, replacing PricingCard.
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    tagline = models.CharField(max_length=500, blank=True)
    badge = models.CharField(max_length=100, blank=True)
    rotate_seconds = models.IntegerField(default=5, help_text="Carousel auto-advance speed in seconds")
    cta_label = models.CharField(max_length=100, default='Explore Courses')
    cta_url = models.CharField(max_length=255, default='/courses/school')
    is_published = models.BooleanField(default=True, db_index=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name_plural = "Course Categories"

    def __str__(self):
        return f"{self.name} [{self.slug}]"


class CourseFeature(TimeStampedModel):
    """
    Bullet points / highlights attached to a Course or CourseCategory.
    """
    category = models.ForeignKey(CourseCategory, on_delete=models.CASCADE, null=True, blank=True, related_name='features')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='course_features')
    text = models.CharField(max_length=500)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        parent = self.course.title if self.course else (self.category.name if self.category else 'Unattached')
        return f"{parent} -> {self.text[:40]}"


class CourseAddon(TimeStampedModel):
    """
    Optional add-ons on a Course (Modules, Test Series, Digital Books, etc.).
    Kept isolated so it is easy to drop if required.
    """
    class AddonType(models.TextChoices):
        MODULE = 'MODULE', 'Complete Module'
        TEST_SERIES = 'TEST_SERIES', 'Test Series'
        ADVANCED_BOOK_DIGITAL = 'ADVANCED_BOOK_DIGITAL', 'Digital Advanced Problem Book'
        SP = 'SP', 'Subject Practice / Sheet Practice'
        PP = 'PP', 'Problem Practice'
        PYQ = 'PYQ', 'Previous Years Questions'
        MENTAL_ABILITY = 'MENTAL_ABILITY', 'Mental Ability & Reasoning'
        OLYMPIAD = 'OLYMPIAD', 'Olympiad Material'
        JEE_MAINS_TEST = 'JEE_MAINS_TEST', 'JEE Mains Mock Tests'
        JEE_ADVANCED_TEST = 'JEE_ADVANCED_TEST', 'JEE Advanced Mock Tests'
        SHORT_NOTES = 'SHORT_NOTES', 'Revision Short Notes'
        COACHING_TEST_SERIES = 'COACHING_TEST_SERIES', 'National Coaching Test Series'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='addons')
    title = models.CharField(max_length=255)
    addon_type = models.CharField(max_length=50, choices=AddonType.choices, default=AddonType.MODULE)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'price', 'created_at']

    def __str__(self):
        return f"{self.course.title}: {self.title} - ₹{self.price}"

