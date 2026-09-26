from django.db import models
from apps.core.models import TimeStampedModel
from apps.academics.models import Chapter, Subject

class StudyMaterial(TimeStampedModel):
    class MaterialType(models.TextChoices):
        PDF_NOTES = 'PDF_NOTES', 'PDF Formula & Revision Notes'
        FORMULA_SHEET = 'FORMULA', 'Formula Sheet'
        ASSIGNMENT = 'ASSIGNMENT', 'Practice Assignment PDF'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    material_type = models.CharField(max_length=30, choices=MaterialType.choices, default=MaterialType.PDF_NOTES)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='materials', null=True, blank=True)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='materials', null=True, blank=True)

    # Cloudflare R2 object reference key for stored PDF/document
    r2_object_key = models.CharField(max_length=500)
    file_size_bytes = models.BigIntegerField(default=0)

    def __str__(self):
        return f"[{self.material_type}] {self.title}"
