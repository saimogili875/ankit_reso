from rest_framework import generics
from .models import StudyMaterial
from .serializers import StudyMaterialSerializer

class MaterialListView(generics.ListAPIView):
    serializer_class = StudyMaterialSerializer

    def get_queryset(self):
        queryset = StudyMaterial.objects.filter(is_published=True)
        subject_param = self.request.query_params.get('subject')
        chapter_param = self.request.query_params.get('chapter')
        type_param = self.request.query_params.get('type')

        if subject_param:
            queryset = queryset.filter(subject_id=subject_param)
        if chapter_param:
            queryset = queryset.filter(chapter_id=chapter_param)
        if type_param:
            queryset = queryset.filter(material_type=type_param)

        return queryset.order_by('-created_at')
