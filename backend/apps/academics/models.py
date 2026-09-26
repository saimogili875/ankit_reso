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
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='chapters')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.category.name} -> {self.name}"

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
