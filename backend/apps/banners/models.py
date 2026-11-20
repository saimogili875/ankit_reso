import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from apps.core.models import TimeStampedModel

class BannerSlide(TimeStampedModel):
    """
    Admin-managed promotional/informational banner slide for homepage and/or login page sliders.
    Stores cloud-hosted image URL (Cloudflare R2), per-slide display duration, and placement rules.
    """
    class Placement(models.TextChoices):
        HOME = 'home', 'Homepage'
        LOGIN = 'login', 'Login Page'
        BOTH = 'both', 'Both Homepage & Login Page'

    image = models.CharField(
        max_length=1000,
        help_text="Public or presigned URL to the banner image hosted on Cloudflare R2"
    )
    image_key = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Cloudflare R2 object key (e.g. images/banners/<uuid>.webp) for lifecycle deletion"
    )
    title = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional headline text shown over the slide"
    )
    caption = models.TextField(
        blank=True,
        default="",
        help_text="Optional subtitle or descriptive copy"
    )
    link_url = models.URLField(
        max_length=1000,
        blank=True,
        default="",
        help_text="Optional destination URL when student clicks the slide"
    )
    alt_text = models.CharField(
        max_length=255,
        default="Adept Eduverse Banner",
        help_text="Accessibility alt description for screen readers and SEO"
    )
    duration_seconds = models.PositiveIntegerField(
        default=5,
        validators=[MinValueValidator(2), MaxValueValidator(30)],
        help_text="How many seconds this specific slide remains visible (2 to 30 seconds)"
    )
    placement = models.CharField(
        max_length=10,
        choices=Placement.choices,
        default=Placement.HOME,
        db_index=True,
        help_text="Display placement target: 'home', 'login', or 'both'"
    )
    order = models.IntegerField(
        default=0,
        db_index=True,
        help_text="Sequence index for ordering active slides"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Controls visibility in public slider endpoints"
    )

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Banner Slide'
        verbose_name_plural = 'Banner Slides'

    def __str__(self):
        title_display = self.title or f"Slide {self.order}"
        return f"{title_display} [{self.placement.upper()}] ({self.duration_seconds}s) - {'Active' if self.is_active else 'Inactive'}"

    def clean(self):
        super().clean()
        if self.is_active:
            BannerSlide.validate_active_limit(self.placement, exclude_id=self.pk)

    @classmethod
    def validate_active_limit(cls, placement: str, exclude_id=None):
        """
        Enforce limit of max 10 active slides per placement.
        'both' placement applies to both homepage and login page quotas.
        """
        # Validate homepage quota
        if placement in (cls.Placement.HOME, cls.Placement.BOTH):
            home_qs = cls.objects.filter(
                is_active=True,
                placement__in=[cls.Placement.HOME, cls.Placement.BOTH]
            )
            if exclude_id:
                home_qs = home_qs.exclude(pk=exclude_id)
            if home_qs.count() >= 10:
                raise ValidationError({
                    'placement': 'Maximum limit of 10 active slides reached for Homepage placement. Deactivate or delete an existing slide first.'
                })

        # Validate login page quota
        if placement in (cls.Placement.LOGIN, cls.Placement.BOTH):
            login_qs = cls.objects.filter(
                is_active=True,
                placement__in=[cls.Placement.LOGIN, cls.Placement.BOTH]
            )
            if exclude_id:
                login_qs = login_qs.exclude(pk=exclude_id)
            if login_qs.count() >= 10:
                raise ValidationError({
                    'placement': 'Maximum limit of 10 active slides reached for Login Page placement. Deactivate or delete an existing slide first.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
