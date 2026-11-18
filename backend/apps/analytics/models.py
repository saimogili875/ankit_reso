from django.db import models
from apps.core.models import TimeStampedModel

class RankPredictor(TimeStampedModel):
    """
    Admin-entered marks-to-rank / percentile calibration table.
    Used for JEE Main / Advanced rank forecasting.
    """
    exam_type = models.CharField(max_length=50, default='JEE_MAIN')
    min_marks = models.DecimalField(max_digits=6, decimal_places=2)
    max_marks = models.DecimalField(max_digits=6, decimal_places=2)
    predicted_rank_min = models.IntegerField()
    predicted_rank_max = models.IntegerField()
    percentile_min = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    percentile_max = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-min_marks']

    def __str__(self):
        return f"{self.exam_type}: {self.min_marks}-{self.max_marks} marks -> Rank {self.predicted_rank_min}-{self.predicted_rank_max}"
