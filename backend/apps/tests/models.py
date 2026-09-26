from django.db import models
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.questions.models import Question
from apps.academics.models import Exam

class Test(TimeStampedModel):
    class TestType(models.TextChoices):
        FULL_LENGTH = 'FULL', 'Full Length Mock Test'
        CHAPTER_WISE = 'CHAPTER', 'Chapter Wise Test'
        SUBJECT_WISE = 'SUBJECT', 'Subject Wise Test'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='tests', null=True, blank=True)
    test_type = models.CharField(max_length=20, choices=TestType.choices, default=TestType.FULL_LENGTH)
    duration_minutes = models.IntegerField(default=180)
    total_marks = models.IntegerField(default=300)
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return self.title

class TestQuestion(TimeStampedModel):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='test_questions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    positive_marks = models.DecimalField(max_digits=4, decimal_places=1, default=4.0)
    negative_marks = models.DecimalField(max_digits=4, decimal_places=1, default=1.0)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

class TestAttempt(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_attempts')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    score = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    time_taken_seconds = models.IntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Attempt by {self.user.email} on {self.test.title}"
