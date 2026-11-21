from rest_framework import serializers
from .models import StudyMaterial

class StudyMaterialSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = StudyMaterial
        fields = [
            'id', 'title', 'description', 'material_type',
            'subject', 'subject_name', 'chapter', 'chapter_name',
            'r2_object_key', 'file_size_bytes', 'download_url', 'created_at'
        ]

    def get_download_url(self, obj):
        if obj.r2_object_key:
            try:
                from storage.service import storage_service
                return storage_service.get_material_download_url(obj.r2_object_key)
            except Exception:
                return f"/api/content/download/?key={obj.r2_object_key}"
        return ""
