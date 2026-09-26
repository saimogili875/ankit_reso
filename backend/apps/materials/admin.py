from django.contrib import admin
from .models import StudyMaterial

@admin.register(StudyMaterial)
class StudyMaterialAdmin(admin.ModelAdmin):
    list_display = ['title', 'material_type', 'subject', 'chapter', 'r2_object_key']
    list_filter = ['material_type', 'subject']
    search_fields = ['title', 'r2_object_key']
