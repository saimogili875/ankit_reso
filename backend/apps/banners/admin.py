from django.contrib import admin
from .models import BannerSlide

@admin.register(BannerSlide)
class BannerSlideAdmin(admin.ModelAdmin):
    list_display = (
        'title_preview',
        'placement',
        'duration_seconds',
        'order',
        'is_active',
        'created_at',
    )
    list_filter = ('placement', 'is_active', 'created_at')
    search_fields = ('title', 'caption', 'alt_text')
    list_editable = ('order', 'is_active', 'duration_seconds')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering = ('order', 'created_at')

    def title_preview(self, obj):
        return obj.title or f"Slide ({obj.id.hex[:8]})"
    title_preview.short_description = "Slide Title"
