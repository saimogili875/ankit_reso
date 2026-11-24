from django.db import models
from apps.core.models import TimeStampedModel

class Exam(TimeStampedModel):
    """
    JEE Main, JEE Advanced, etc.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class AcademicClass(TimeStampedModel):
    """
    Represents Class 11, Class 12, etc.
    """
    name = models.CharField(max_length=50, unique=True) # e.g. "Class 11", "Class 12"
    slug = models.SlugField(max_length=50, unique=True) # e.g. "class-11", "class-12"
    code = models.CharField(max_length=20, unique=True) # e.g. "class11", "class12"
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Academic Classes"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

class Subject(TimeStampedModel):
    """
    Physics, Chemistry, Mathematics.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)
    color_hex = models.CharField(max_length=10, default='#3B82F6')
    topics = models.JSONField(default=list, blank=True)
    order = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

class Course(TimeStampedModel):
    """
    Central Course product (e.g. JEE Main + Advanced Complete Preparation Course).
    Aggregates AcademicClasses and Subjects.
    """
    class ExamType(models.TextChoices):
        JEE_MAIN = 'JEE_MAIN', 'JEE Main'
        JEE_ADVANCED = 'JEE_ADVANCED', 'JEE Advanced'
        BOTH = 'BOTH', 'JEE Main & Advanced'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PUBLISHED = 'PUBLISHED', 'Published'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    subtitle = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    thumbnail_url = models.CharField(max_length=500, blank=True, default='/images/hero/slide-1.jpg')
    exam_type = models.CharField(max_length=50, choices=ExamType.choices, default=ExamType.BOTH)
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

    def __str__(self):
        return f"{self.subject.name} - {self.name}"

class Chapter(TimeStampedModel):
    """
    Specific chapters (e.g. Kinematics, Chemical Bonding, Vectors).
    Optionally associated with an AcademicClass (Class 11 / Class 12).
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='chapters')
    academic_class = models.ForeignKey(AcademicClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='chapters')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    order = models.IntegerField(default=0)
    description = models.TextField(blank=True)

    def __str__(self):
        class_label = f"[{self.academic_class.name}] " if self.academic_class else ""
        return f"{class_label}{self.category.subject.name} -> {self.name}"

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


class PricingCard(TimeStampedModel):
    """
    Top-level pricing category cards displayed on the landing page (school, senior, dropper).
    """
    class CardKey(models.TextChoices):
        SCHOOL = 'school', 'School Batches (Class VI-X)'
        SENIOR = 'senior', 'Senior Batches (Class XI & XII)'
        DROPPER = 'dropper', 'Dropper Batch'

    key = models.CharField(max_length=50, choices=CardKey.choices, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    tagline = models.CharField(max_length=500, blank=True)
    badge = models.CharField(max_length=100, blank=True)
    rotate_seconds = models.IntegerField(default=5, help_text="Carousel auto-advance speed in seconds")
    cta_label = models.CharField(max_length=100, default='Explore Batches')
    cta_url = models.CharField(max_length=255, default='/batches/school')
    is_published = models.BooleanField(default=True, db_index=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.title} [{self.key}]"


class Batch(TimeStampedModel):
    """
    Individual batch product (e.g. Foundation Star Batch, JEE Mains + Advanced).
    Tied to a pricing category card, optional academic class, and optional Course.
    """
    card = models.ForeignKey(PricingCard, on_delete=models.CASCADE, related_name='batches')
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    course = models.OneToOneField(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='batch')
    academic_class = models.ForeignKey(AcademicClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='batches')
    tagline = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    image = models.CharField(max_length=1000, blank=True, help_text="Cloudflare R2 image URL or static image path")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    has_live_classes = models.BooleanField(default=False, help_text="Set to True only if batch conducts live classes")
    display_order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['display_order', 'created_at']
        verbose_name_plural = "Batches"

    def __str__(self):
        return f"{self.name} (₹{self.price})"


class BatchFeature(TimeStampedModel):
    """
    Checkmark bullet points attached to a PricingCard or directly to an individual Batch.
    """
    card = models.ForeignKey(PricingCard, on_delete=models.CASCADE, null=True, blank=True, related_name='features')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, null=True, blank=True, related_name='features')
    text = models.CharField(max_length=500)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        parent = self.batch.name if self.batch else (self.card.title if self.card else 'Unattached')
        return f"{parent} -> {self.text[:40]}"


class BatchItem(TimeStampedModel):
    """
    Itemized curriculum components and add-ons that make up a Batch.
    """
    class ItemType(models.TextChoices):
        SP = 'SP', 'Subject Practice / Sheet Practice'
        PP = 'PP', 'Problem Practice'
        PYQ = 'PYQ', 'Previous Years Questions'
        MENTAL_ABILITY = 'MENTAL_ABILITY', 'Mental Ability & Reasoning'
        OLYMPIAD = 'OLYMPIAD', 'Olympiad Material'
        TEST_SERIES = 'TEST_SERIES', 'Test Series'
        ADVANCED_BOOK_DIGITAL = 'ADVANCED_BOOK_DIGITAL', 'Digital Advanced Problem Book'
        MODULE = 'MODULE', 'Complete Module'
        JEE_MAINS_TEST = 'JEE_MAINS_TEST', 'JEE Mains Mock Tests'
        JEE_ADVANCED_TEST = 'JEE_ADVANCED_TEST', 'JEE Advanced Mock Tests'
        SHORT_NOTES = 'SHORT_NOTES', 'Revision Short Notes'
        COACHING_TEST_SERIES = 'COACHING_TEST_SERIES', 'National Coaching Test Series'

    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=50, choices=ItemType.choices)
    title = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_addon = models.BooleanField(default=False)

    class Meta:
        ordering = ['is_addon', 'price', 'created_at']

    def __str__(self):
        addon_flag = " [ADDON]" if self.is_addon else ""
        return f"{self.batch.name}: {self.title} - ₹{self.price}{addon_flag}"

