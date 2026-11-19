from django.db import models
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.content.models import Video
from apps.academics.models import Lecture
from apps.questions.models import Question, DPP

class VideoProgress(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_progress')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='progress_records', null=True, blank=True)
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='progress_records', null=True, blank=True)
    watched_seconds = models.IntegerField(default=0)
    last_position_seconds = models.IntegerField(default=0)
    completion_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    completed = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'lecture']),
            models.Index(fields=['user', 'updated_at']),
        ]

    def save(self, *args, **kwargs):
        # Auto-calculate completion_percent if duration is available
        total_duration = 0
        if self.video and self.video.duration_seconds > 0:
            total_duration = self.video.duration_seconds
        elif self.lecture and getattr(self.lecture, 'duration_seconds', 0) > 0:
            total_duration = self.lecture.duration_seconds

        if total_duration > 0 and self.watched_seconds > 0:
            calculated_pct = min(100.0, (self.watched_seconds / total_duration) * 100)
            if self.completion_percent == 0 or calculated_pct > float(self.completion_percent):
                self.completion_percent = round(calculated_pct, 2)

        # Auto-mark completed at 90%
        if float(self.completion_percent) >= 90.0:
            self.completed = True

        super().save(*args, **kwargs)

    def __str__(self):
        target = self.lecture.title if self.lecture else (self.video.title if self.video else 'Video')
        return f"Progress for {self.user.email} on {target}: {self.completion_percent}% ({'Completed' if self.completed else 'In Progress'})"

class QuestionAttempt(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='question_attempts')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    is_correct = models.BooleanField(default=False)
    time_taken_seconds = models.IntegerField(default=0)

class Bookmark(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, null=True, blank=True)
    video = models.ForeignKey(Video, on_delete=models.CASCADE, null=True, blank=True)

class StudentProgress(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='overall_progress')
    videos_watched_count = models.IntegerField(default=0)
    questions_solved_count = models.IntegerField(default=0)
    tests_attempted_count = models.IntegerField(default=0)
    overall_accuracy_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)

class DPPAttempt(TimeStampedModel):
    """
    Tracks a student's execution, submitted answers, and calculated score/accuracy for a DPP.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dpp_attempts')
    dpp = models.ForeignKey(DPP, on_delete=models.CASCADE, related_name='attempts')
    score = models.IntegerField(default=0)
    total_questions = models.IntegerField(default=0)
    correct_count = models.IntegerField(default=0)
    incorrect_count = models.IntegerField(default=0)
    unattempted_count = models.IntegerField(default=0)
    accuracy_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    answers = models.JSONField(default=dict)
    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"DPPAttempt #{self.id}: {self.user.email} -> DPP {self.dpp.title} ({self.score} pts)"
