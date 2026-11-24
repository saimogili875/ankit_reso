from rest_framework import serializers
from .models import (
    Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment,
    PricingCard, Batch, BatchFeature, BatchItem
)

class AcademicClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicClass
        fields = ['id', 'name', 'slug', 'code', 'order']

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'slug', 'icon', 'color_hex']

class CourseSerializer(serializers.ModelSerializer):
    classes = AcademicClassSerializer(many=True, read_only=True)
    subjects = SubjectSerializer(many=True, read_only=True)
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'description',
            'thumbnail_url', 'exam_type', 'price', 'original_price',
            'discount_badge', 'is_free', 'features', 'start_date', 'end_date',
            'status', 'is_published', 'allow_self_enrollment',
            'classes', 'subjects', 'is_enrolled', 'created_at'
        ]

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return Enrollment.objects.filter(user=request.user, course=obj, status='ACTIVE').exists()

class LectureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = [
            'id', 'lecture_number', 'title', 'slug', 'description', 
            'duration_seconds', 'is_published', 'order'
        ]

class ChapterSerializer(serializers.ModelSerializer):
    lectures = LectureSerializer(many=True, read_only=True)
    academic_class_code = serializers.CharField(source='academic_class.code', read_only=True, default='')

    class Meta:
        model = Chapter
        fields = ['id', 'name', 'slug', 'order', 'description', 'academic_class_code', 'lectures']

class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'user', 'course', 'enrolled_at', 'status']


class BatchItemPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchItem
        fields = ['id', 'item_type', 'title', 'price', 'is_addon']


class BatchFeaturePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchFeature
        fields = ['id', 'text', 'order']


class BatchPublicSerializer(serializers.ModelSerializer):
    card_key = serializers.CharField(source='card.key', read_only=True)
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')
    academic_class_slug = serializers.CharField(source='academic_class.slug', read_only=True, default='')
    items = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            'id', 'name', 'slug', 'card_key', 'academic_class_name', 'academic_class_slug',
            'tagline', 'description', 'image', 'price', 'original_price', 'has_live_classes',
            'display_order', 'is_published', 'items', 'features'
        ]

    def get_items(self, obj):
        return BatchItemPublicSerializer(obj.items.all().order_by('is_addon', 'price'), many=True).data

    def get_features(self, obj):
        features = obj.features.all().order_by('order')
        if not features.exists() and obj.card:
            features = obj.card.features.all().order_by('order')
        return BatchFeaturePublicSerializer(features, many=True).data


class PricingCardPublicSerializer(serializers.ModelSerializer):
    batches = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = PricingCard
        fields = [
            'id', 'key', 'title', 'tagline', 'badge',
            'rotate_seconds', 'cta_label', 'cta_url', 'order',
            'batches', 'features'
        ]

    def get_batches(self, obj):
        qs = obj.batches.filter(is_published=True).order_by('display_order', 'created_at')
        return BatchPublicSerializer(qs, many=True).data

    def get_features(self, obj):
        return BatchFeaturePublicSerializer(obj.features.all().order_by('order'), many=True).data


class BatchItemAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchItem
        fields = '__all__'


class BatchFeatureAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchFeature
        fields = '__all__'


class BatchAdminSerializer(serializers.ModelSerializer):
    card_key = serializers.CharField(source='card.key', read_only=True)
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')
    items = BatchItemAdminSerializer(many=True, read_only=True)
    features = BatchFeatureAdminSerializer(many=True, read_only=True)

    class Meta:
        model = Batch
        fields = '__all__'


class PricingCardAdminSerializer(serializers.ModelSerializer):
    batches_count = serializers.IntegerField(source='batches.count', read_only=True)
    features = BatchFeatureAdminSerializer(many=True, read_only=True)

    class Meta:
        model = PricingCard
        fields = '__all__'

