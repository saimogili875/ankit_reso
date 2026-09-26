from django.db import models
from apps.core.models import TimeStampedModel
from apps.academics.models import Topic, Subject, Exam, Chapter

class Question(TimeStampedModel):
    class Difficulty(models.TextChoices):
        EASY = 'EASY', 'Easy'
        MEDIUM = 'MEDIUM', 'Medium'
        HARD = 'HARD', 'Hard'

    class QuestionType(models.TextChoices):
        SINGLE_CHOICE = 'SINGLE', 'Single Choice MCQ'
        MULTIPLE_CHOICE = 'MULTIPLE', 'Multiple Choice MCQ'
        NUMERICAL = 'NUMERICAL', 'Numerical / Integer'

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    question_text = models.TextField()
    solution_text = models.TextField(blank=True)
    solution_video_url = models.URLField(blank=True, null=True)
    difficulty = models.CharField(max_length=20, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    question_type = models.CharField(max_length=20, choices=QuestionType.choices, default=QuestionType.SINGLE_CHOICE)

    def __str__(self):
        return f"Question #{self.id} ({self.difficulty})"

class QuestionOption(TimeStampedModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"Option for #{self.question_id}"

class PYQ(TimeStampedModel):
    """
    Previous Year Question metadata (e.g., JEE Main 2024 Shift 1, JEE Advanced 2023 Paper 1).
    """
    question = models.OneToOneField(Question, on_delete=models.CASCADE, related_name='pyq_meta')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='pyqs')
    year = models.IntegerField()
    shift_or_paper = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.exam.name} {self.year} {self.shift_or_paper}"

class DPP(TimeStampedModel):
    """
    Daily Practice Problem set attached to a Chapter.
    """
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='dpps')
    dpp_number = models.IntegerField(default=1)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    duration_minutes = models.IntegerField(default=20)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['dpp_number', 'title']

    def __str__(self):
        return f"DPP {self.dpp_number}: {self.title} ({self.chapter.name})"

class DPPQuestion(TimeStampedModel):
    """
    Junction model mapping Questions to a DPP with order and scoring rules.
    """
    dpp = models.ForeignKey(DPP, on_delete=models.CASCADE, related_name='dpp_questions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='dpp_entries')
    order = models.IntegerField(default=1)
    positive_marks = models.IntegerField(default=4)
    negative_marks = models.IntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"DPP #{self.dpp_id} - Q #{self.question_id}"
