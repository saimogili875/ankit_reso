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
    icon = models.CharField(max_length=50, blank=True)
    color_hex = models.CharField(max_length=10, default='#3B82F6')

    def __str__(self):
        return self.name

class Course(TimeStampedModel):
    """
    Central Course product (e.g. JEE Main + Advanced Complete Preparation Course).
    Aggregates AcademicClasses and Subjects.
    """
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    subtitle = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    original_price = models.DecimalField(max_digits=10, decimal_places=2, default=7999.00)
    discount_badge = models.CharField(max_length=50, default='100% OFF (FREE)')
    is_free = models.BooleanField(default=True)
    is_published = models.BooleanField(default=True)
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
