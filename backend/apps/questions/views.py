from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.progress.models import DPPAttempt
from .models import Question, QuestionOption, PYQ, DPP, DPPQuestion
from .serializers import QuestionSerializer, DPPSerializer, DPPQuestionSerializer

class DPPListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DPPSerializer

    def get_queryset(self):
        queryset = DPP.objects.filter(is_published=True)
        chapter_param = self.request.query_params.get('chapter', None)
        subject_param = self.request.query_params.get('subject', None)

        if chapter_param:
            try:
                queryset = queryset.filter(
                    models.Q(chapter_id=chapter_param) |
                    models.Q(chapter__slug=chapter_param)
                )
            except Exception:
                queryset = queryset.filter(chapter__slug=chapter_param)

        if subject_param:
            try:
                queryset = queryset.filter(
                    models.Q(chapter__category__subject_id=subject_param) |
                    models.Q(chapter__category__subject__slug=subject_param)
                )
            except Exception:
                queryset = queryset.filter(chapter__category__subject__slug=subject_param)

        return queryset.order_by('dpp_number', 'title')

class DPPQuestionsView(APIView):
    """
    Returns DPP question metadata for practice quiz execution.
    Answers and explanations are intentionally stripped to prevent client-side inspection leakage.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        dpp = get_object_or_404(DPP, id=pk)

        dpp_questions = dpp.dpp_questions.all().order_by('order')
        dpp_data = DPPSerializer(dpp).data
        
        questions_list = []
        for dq in dpp_questions:
            q = dq.question
            options_list = []
            for opt in q.options.all():
                options_list.append({
                    'id': str(opt.id),
                    'text': opt.option_text,
                })
            
            questions_list.append({
                'id': str(q.id),
                'questionText': q.question_text,
                'options': options_list,
                'positive_marks': dq.positive_marks,
                'negative_marks': dq.negative_marks,
            })

        dpp_data['questions'] = questions_list
        return Response(dpp_data)

class DPPSubmitView(APIView):
    """
    Submits student responses for grading. Returns attempt metrics alongside
    the full solutions and explanations map.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        dpp = get_object_or_404(DPP, id=pk)

        answers = request.data.get('answers', {})
        dpp_questions = dpp.dpp_questions.all()

        correct = 0
        incorrect = 0
        score = 0
        total = dpp_questions.count()
        solutions = {}

        for dq in dpp_questions:
            q = dq.question
            user_ans = str(answers.get(str(q.id), '') or answers.get(q.id, ''))
            
            correct_opts = [str(opt.id) for opt in q.options.all() if opt.is_correct]
            correct_ans_id = correct_opts[0] if correct_opts else ''
            solutions[str(q.id)] = {
                'correctAnswerId': correct_ans_id,
                'correctOptions': correct_opts,
                'explanation': q.solution_text or 'Detailed step-by-step solution provided.',
            }

            if not user_ans:
                continue

            is_correct = False
            for opt in q.options.all():
                if opt.is_correct and (str(opt.id) == user_ans or opt.option_text == user_ans):
                    is_correct = True
                    break
            
            if is_correct:
                correct += 1
                score += dq.positive_marks
            else:
                incorrect += 1
                score -= dq.negative_marks

        unattempted = max(0, total - (correct + incorrect))
        accuracy = round((correct / (correct + incorrect)) * 100, 2) if (correct + incorrect) > 0 else 0.0

        user = request.user
        attempt = DPPAttempt.objects.create(
            user=user,
            dpp=dpp,
            score=score,
            total_questions=total,
            correct_count=correct,
            incorrect_count=incorrect,
            unattempted_count=unattempted,
            accuracy_percentage=accuracy,
            answers=answers
        )

        return Response({
            'attempt_id': str(attempt.id),
            'dpp_id': str(dpp.id),
            'dpp_title': dpp.title,
            'total': total,
            'score': score,
            'correct': correct,
            'incorrect': incorrect,
            'unattempted': unattempted,
            'accuracy': accuracy,
            'completed_at': attempt.completed_at,
            'solutions': solutions,
        }, status=status.HTTP_201_CREATED)
