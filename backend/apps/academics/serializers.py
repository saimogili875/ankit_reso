from rest_framework import serializers
from .models import Exam, AcademicClass, Subject, Course, Category, Chapter, Topic, Lecture, Enrollment

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

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'description', 
            'price', 'original_price', 'discount_badge', 'is_free', 
            'is_published', 'classes', 'subjects'
        ]

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
