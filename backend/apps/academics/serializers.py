from rest_framework import serializers
from .models import (
    Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment,
    CourseCategory, CourseFeature, CourseAddon
)

class AcademicClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicClass
        fields = ['id', 'name', 'slug', 'code', 'order']

class SubjectSerializer(serializers.ModelSerializer):
    academic_class_id = serializers.UUIDField(source='academic_class.id', read_only=True, allow_null=True)
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')
    class_id = serializers.UUIDField(source='academic_class.id', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')
    exam_id = serializers.UUIDField(source='academic_class.exam.id', read_only=True, allow_null=True)
    exam_name = serializers.CharField(source='academic_class.exam.name', read_only=True, default='')
    subject_label = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'slug', 'icon', 'color_hex', 'order',
            'academic_class_id', 'academic_class_name',
            'class_id', 'class_name', 'exam_id', 'exam_name',
            'subject_label',
        ]

    def get_subject_label(self, obj):
        if obj.academic_class:
            return f"{obj.academic_class.name} · {obj.name}"
        return obj.name

class CourseFeaturePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseFeature
        fields = ['id', 'text', 'order']

class CourseAddonPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseAddon
        fields = ['id', 'title', 'addon_type', 'price', 'description', 'order', 'is_published']

class CourseSerializer(serializers.ModelSerializer):
    classes = AcademicClassSerializer(many=True, read_only=True)
    subjects = SubjectSerializer(many=True, read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True, default='')
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')
    academic_class_slug = serializers.CharField(source='academic_class.slug', read_only=True, default='')
    features_list = serializers.SerializerMethodField()
    addons = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'tagline', 'description',
            'image', 'thumbnail_url', 'exam_type', 'price', 'original_price',
            'discount_badge', 'is_free', 'features', 'features_list', 'addons',
            'has_live_classes', 'display_order', 'start_date', 'end_date',
            'status', 'is_published', 'allow_self_enrollment',
            'category', 'category_slug', 'category_name',
            'academic_class', 'academic_class_name', 'academic_class_slug',
            'classes', 'subjects', 'is_enrolled', 'created_at'
        ]

    def get_features_list(self, obj):
        feats = obj.course_features.all().order_by('order')
        if not feats.exists() and obj.category:
            feats = obj.category.features.all().order_by('order')
        return CourseFeaturePublicSerializer(feats, many=True).data

    def get_addons(self, obj):
        return CourseAddonPublicSerializer(obj.addons.filter(is_published=True).order_by('order', 'price'), many=True).data

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


class CourseCategoryPublicSerializer(serializers.ModelSerializer):
    courses = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = CourseCategory
        fields = [
            'id', 'slug', 'name', 'tagline', 'badge',
            'rotate_seconds', 'cta_label', 'cta_url', 'order',
            'courses', 'features'
        ]

    def get_courses(self, obj):
        qs = obj.courses.filter(is_published=True).order_by('display_order', 'created_at')
        return CourseSerializer(qs, many=True, context=self.context).data

    def get_features(self, obj):
        return CourseFeaturePublicSerializer(obj.features.all().order_by('order'), many=True).data


class CourseCategoryAdminSerializer(serializers.ModelSerializer):
    courses_count = serializers.IntegerField(source='courses.count', read_only=True)
    features = CourseFeaturePublicSerializer(many=True, read_only=True)

    class Meta:
        model = CourseCategory
        fields = '__all__'


class CourseFeatureAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseFeature
        fields = '__all__'


class CourseAddonAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseAddon
        fields = '__all__'


