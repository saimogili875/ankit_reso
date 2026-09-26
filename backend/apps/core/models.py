import uuid
from django.db import models

class TimeStampedModel(models.Model):
    """
    Abstract base model providing self-updating created_at and updated_at fields
    along with UUID primary key for secure URL references.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
