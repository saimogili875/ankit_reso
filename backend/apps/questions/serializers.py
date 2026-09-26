from rest_framework import serializers
from .models import Question, QuestionOption, PYQ, DPP, DPPQuestion

class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ['id', 'option_text', 'is_correct']

class QuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'topic', 'subject', 'chapter', 'question_text', 
            'solution_text', 'solution_video_url', 'difficulty', 
            'question_type', 'options'
        ]

class DPPQuestionSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)

    class Meta:
        model = DPPQuestion
        fields = ['id', 'order', 'positive_marks', 'negative_marks', 'question']

class DPPSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = DPP
        fields = [
            'id', 'chapter', 'dpp_number', 'title', 'description', 
            'duration_minutes', 'is_published', 'question_count'
        ]

    def get_question_count(self, obj):
        return obj.dpp_questions.count()
