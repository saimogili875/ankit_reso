from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.questions.models import Question
from apps.academics.models import Exam, Course, Subject

class Test(TimeStampedModel):
    class TestType(models.TextChoices):
        MOCK = 'MOCK', 'Full Length Mock Test'
        PYQ = 'PYQ', 'Previous Year Question Paper'
        CHAPTER = 'CHAPTER', 'Chapter Wise Test'
        SECTIONAL = 'SECTIONAL', 'Sectional Test'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    exam = models.ForeignKey(Exam, on_delete=models.SET_NULL, related_name='tests', null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, related_name='tests', null=True, blank=True)
    test_type = models.CharField(max_length=20, choices=TestType.choices, default=TestType.MOCK)
    duration_minutes = models.IntegerField(default=180)
    total_marks = models.IntegerField(default=300)
    cutoff_score = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    instructions = models.TextField(blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    publish_results_immediately = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.test_type})"


class TestSection(TimeStampedModel):
    """
    Subdivisions of a test (e.g., Physics, Chemistry, Mathematics).
    """
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='sections')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='test_sections')
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)
    instructions = models.TextField(blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.test.title} - {self.name}"


class TestQuestion(TimeStampedModel):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='test_questions')
    section = models.ForeignKey(TestSection, on_delete=models.SET_NULL, related_name='test_questions', null=True, blank=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='test_entries')
    positive_marks = models.DecimalField(max_digits=5, decimal_places=2, default=4.0)
    negative_marks = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Q#{self.question_id} in {self.test.title}"


class TestAttempt(TimeStampedModel):
    class Status(models.TextChoices):
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        AUTO_SUBMITTED = 'AUTO_SUBMITTED', 'Auto Submitted'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_attempts')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    score = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    time_taken_seconds = models.IntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    answers = models.JSONField(default=dict, blank=True)
    question_states = models.JSONField(default=dict, blank=True)
    correct_count = models.IntegerField(default=0)
    incorrect_count = models.IntegerField(default=0)
    unattempted_count = models.IntegerField(default=0)
    accuracy_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    rank = models.IntegerField(null=True, blank=True)
    percentile = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at', '-created_at']
        indexes = [
            models.Index(fields=['user', 'test']),
            models.Index(fields=['test', 'score']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Attempt by {self.user.email} on {self.test.title} ({self.status})"


class QuestionAttemptLog(TimeStampedModel):
    class Status(models.TextChoices):
        CORRECT = 'CORRECT', 'Correct'
        WRONG = 'WRONG', 'Wrong'
        SKIPPED = 'SKIPPED', 'Skipped'
        NOT_VISITED = 'NOT_VISITED', 'Not Visited'
        MARKED_REVIEW = 'MARKED_REVIEW', 'Marked for Review'
        ANSWERED_AND_MARKED = 'ANSWERED_AND_MARKED', 'Answered and Marked for Review'

    class ReasonTag(models.TextChoices):
        NONE = 'NONE', 'None'
        CONCEPT_GAP = 'CONCEPT_GAP', 'Concept Gap'
        CALCULATION = 'CALCULATION', 'Calculation Error'
        SILLY = 'SILLY', 'Silly Mistake'
        GUESS = 'GUESS', 'Fluke / Blind Guess'
        TIME_PRESSURE = 'TIME_PRESSURE', 'Time Pressure'
        DIDNT_KNOW = 'DIDNT_KNOW', 'Did Not Know Formula'

    attempt = models.ForeignKey(TestAttempt, on_delete=models.CASCADE, related_name='question_logs')
    test_question = models.ForeignKey(TestQuestion, on_delete=models.SET_NULL, null=True, blank=True, related_name='attempt_logs')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='attempt_logs')
    selected_answer = models.TextField(blank=True, default='')
    is_correct = models.BooleanField(default=False)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.NOT_VISITED)
    time_spent_seconds = models.IntegerField(default=0)
    visit_count = models.IntegerField(default=0)
    answer_change_count = models.IntegerField(default=0)
    first_answer_time = models.IntegerField(null=True, blank=True)
    final_answer_time = models.IntegerField(null=True, blank=True)
    marks_awarded = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    student_reason_tag = models.CharField(max_length=30, choices=ReasonTag.choices, default=ReasonTag.NONE)
    is_bookmarked = models.BooleanField(default=False)
    is_revised = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['attempt', 'question']),
            models.Index(fields=['student_reason_tag']),
            models.Index(fields=['is_bookmarked']),
            models.Index(fields=['is_revised']),
        ]

    def __str__(self):
        return f"Log for Q#{self.question_id} Attempt#{self.attempt_id} ({self.status})"


class TestAttemptAnalysis(TimeStampedModel):
    attempt = models.OneToOneField(TestAttempt, on_delete=models.CASCADE, related_name='analysis')
    overview_data = models.JSONField(default=dict, blank=True)
    sections_data = models.JSONField(default=dict, blank=True)
    chapters_data = models.JSONField(default=dict, blank=True)
    time_data = models.JSONField(default=dict, blank=True)
    strategy_data = models.JSONField(default=dict, blank=True)
    marks_data = models.JSONField(default=dict, blank=True)
    comparison_data = models.JSONField(default=dict, blank=True)
    recommendations_data = models.JSONField(default=dict, blank=True)
    score_distribution = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Analysis Snapshot for Attempt#{self.attempt_id}"
