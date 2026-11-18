from rest_framework import serializers
from .models import (
    Test,
    TestSection,
    TestQuestion,
    TestAttempt,
    QuestionAttemptLog,
    TestAttemptAnalysis,
)
from apps.questions.models import Question, QuestionOption


class TestSectionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = TestSection
        fields = ['id', 'subject', 'subject_name', 'name', 'order', 'instructions']


class TestListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    user_attempt = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            'id', 'title', 'description', 'test_type',
            'duration_minutes', 'total_marks', 'cutoff_score',
            'start_time', 'end_time', 'publish_results_immediately',
            'is_published', 'exam', 'exam_name', 'course', 'course_title',
            'question_count', 'user_attempt', 'created_at'
        ]

    def get_question_count(self, obj):
        return obj.test_questions.count()

    def get_user_attempt(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None

        attempt = TestAttempt.objects.filter(test=obj, user=request.user).order_by('-created_at').first()
        if not attempt:
            return None

        return {
            'id': str(attempt.id),
            'status': attempt.status,
            'is_completed': attempt.is_completed,
            'score': float(attempt.score),
            'total_marks': float(obj.total_marks),
            'rank': attempt.rank,
            'percentile': float(attempt.percentile) if attempt.percentile is not None else None,
            'accuracy': float(attempt.accuracy_percentage),
            'time_taken_seconds': attempt.time_taken_seconds,
            'submitted_at': attempt.submitted_at or attempt.completed_at,
        }


class CBTQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['id', 'option_text']


class CBTQuestionSerializer(serializers.ModelSerializer):
    options = CBTQuestionOptionSerializer(many=True, read_only=True)
    section_id = serializers.CharField(source='section.id', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    subject_name = serializers.CharField(source='question.subject.name', read_only=True)
    positive_marks = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    negative_marks = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    difficulty = serializers.CharField(source='question.difficulty', read_only=True)

    class Meta:
        model = TestQuestion
        fields = [
            'id', 'order', 'section_id', 'section_name', 'subject_name',
            'positive_marks', 'negative_marks', 'question_id',
            'question_text', 'question_type', 'difficulty', 'options'
        ]


class QuestionReviewSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    difficulty = serializers.CharField(source='question.difficulty', read_only=True)
    solution_text = serializers.CharField(source='question.solution_text', read_only=True)
    subject_name = serializers.CharField(source='question.subject.name', read_only=True)
    chapter_name = serializers.CharField(source='question.chapter.name', read_only=True)
    options = serializers.SerializerMethodField()
    correct_answer = serializers.SerializerMethodField()

    class Meta:
        model = QuestionAttemptLog
        fields = [
            'id', 'question_id', 'question_text', 'question_type', 'difficulty',
            'subject_name', 'chapter_name', 'selected_answer', 'is_correct',
            'status', 'time_spent_seconds', 'visit_count', 'answer_change_count',
            'marks_awarded', 'student_reason_tag', 'is_bookmarked', 'is_revised',
            'options', 'correct_answer', 'solution_text'
        ]

    def get_options(self, obj):
        return [
            {
                'id': str(opt.id),
                'option_text': opt.option_text,
                'is_correct': opt.is_correct,
            }
            for opt in obj.question.options.all()
        ]

    def get_correct_answer(self, obj):
        correct_opts = [str(opt.id) for opt in obj.question.options.all() if opt.is_correct]
        return correct_opts[0] if correct_opts else ''


class TestAttemptAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttemptAnalysis
        fields = '__all__'
