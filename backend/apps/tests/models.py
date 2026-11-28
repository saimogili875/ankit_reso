from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.questions.models import Question
from apps.academics.models import Exam, Course, Subject


class TestSeries(TimeStampedModel):
    """
    Test series bundle within a Course.
    Can be included in the general course enrollment or sold as a CourseAddon (TEST_SERIES).
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='test_series')
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Standalone price if sold separately")
    course_addon = models.ForeignKey(
        'academics.CourseAddon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='linked_test_series',
        help_text="Optional link to a CourseAddon when sold as a standalone add-on."
    )

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['course', 'is_published']),
            models.Index(fields=['course', 'order']),
        ]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


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
    test_series = models.ForeignKey(
        TestSeries,
        on_delete=models.SET_NULL,
        related_name='tests',
        null=True,
        blank=True,
        help_text="Optional test series bundle this test belongs to."
    )
    test_type = models.CharField(max_length=20, choices=TestType.choices, default=TestType.MOCK)
    duration_minutes = models.IntegerField(default=180)
    total_marks = models.IntegerField(default=300)
    cutoff_score = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    instructions = models.TextField(blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    publish_results_immediately = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)
    priority = models.IntegerField(default=0, help_text="Priority ordering for exams listing")
    rank_board_enabled = models.BooleanField(default=True, help_text="Whether students can view the rank board / leaderboard")
    rank_publish_time = models.DateTimeField(null=True, blank=True, help_text="When rank board unlocks for students")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['start_time']),
            models.Index(fields=['end_time']),
            models.Index(fields=['course']),
            models.Index(fields=['course', 'is_published']),
            models.Index(fields=['test_series', 'is_published']),
        ]

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
    notes = models.JSONField(default=list, blank=True)
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

    class Evaluation(models.TextChoices):
        PERFECT = 'PERFECT', 'Perfect Attempt'
        WASTED = 'WASTED', 'Wasted Attempt'
        OVERTIME = 'OVERTIME', 'Overtime Attempt'
        CONFUSED = 'CONFUSED', 'Confused Attempt'
        NORMAL = 'NORMAL', 'Normal'

    attempt = models.ForeignKey(TestAttempt, on_delete=models.CASCADE, related_name='question_logs')
    test_question = models.ForeignKey(TestQuestion, on_delete=models.SET_NULL, null=True, blank=True, related_name='attempt_logs')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='attempt_logs')
    selected_answer = models.TextField(blank=True, default='')
    is_correct = models.BooleanField(default=False)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.NOT_VISITED)
    evaluation = models.CharField(max_length=30, choices=Evaluation.choices, default=Evaluation.NORMAL)
    time_spent_seconds = models.IntegerField(default=0)
    visit_count = models.IntegerField(default=0)
    answer_change_count = models.IntegerField(default=0)
    first_answer_time = models.IntegerField(null=True, blank=True)
    final_answer_time = models.IntegerField(null=True, blank=True)
    first_visit_at = models.IntegerField(null=True, blank=True)
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


class AnalysisSettings(TimeStampedModel):
    """
    Global analysis settings:
    - ideal time per difficulty (Easy/Moderate/Tough in seconds)
    - quick/wasted threshold (percentage of ideal time, default 25%)
    - time-slot size (default 30 mins: 0-30, 30-60, 60-90, etc.)
    - percentile bands (default 10 and 25)
    - comparative minimum attempts threshold (default 10)
    """
    name = models.CharField(max_length=100, default='Default Analysis Settings')
    easy_ideal_time = models.IntegerField(default=60)
    moderate_ideal_time = models.IntegerField(default=120)
    tough_ideal_time = models.IntegerField(default=180)
    quick_wasted_threshold_percent = models.IntegerField(default=25)
    time_slot_minutes = models.IntegerField(default=30)
    percentile_band_1 = models.IntegerField(default=10) # Top 10%
    percentile_band_2 = models.IntegerField(default=25) # Top 25%
    comparative_min_attempts = models.IntegerField(default=10)
    show_solutions_after_window = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Analysis Settings'
        verbose_name_plural = 'Analysis Settings'

    def __str__(self):
        return self.name

    @classmethod
    def get_settings(cls):
        settings, _ = cls.objects.get_or_create(id=1, defaults={'name': 'Default Settings'})
        return settings


class TestCohortStats(TimeStampedModel):
    """
    Cache model storing computed cohort aggregates (You, Top 10%, Top 25%, Average)
    across subjects, attempts, time, and difficulty for fast Comparative tab rendering.
    """
    test = models.OneToOneField(Test, on_delete=models.CASCADE, related_name='cohort_stats')
    total_attempts = models.IntegerField(default=0)
    cached_data = models.JSONField(default=dict, blank=True)
    last_computed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cohort stats for {self.test.title} ({self.total_attempts} attempts)"


# Specification alias
AttemptQuestionLog = QuestionAttemptLog
