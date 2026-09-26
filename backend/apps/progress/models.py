from django.db import models
from apps.core.models import TimeStampedModel
from apps.accounts.models import User
from apps.content.models import Video
from apps.questions.models import Question

class VideoProgress(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_progress')
    video = models.ForeignKey(Video, on_delete=models.CASCADE)
    watched_seconds = models.IntegerField(default=0)
    completed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'video')

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
