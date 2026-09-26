from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.progress.models import DPPAttempt
from .models import Question, QuestionOption, PYQ, DPP, DPPQuestion
from .serializers import QuestionSerializer, DPPSerializer, DPPQuestionSerializer

class DPPListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = DPPSerializer

    def get_queryset(self):
        queryset = DPP.objects.filter(is_published=True)
        chapter_param = self.request.query_params.get('chapter', None)
        if chapter_param:
            if chapter_param.isdigit():
                queryset = queryset.filter(chapter_id=int(chapter_param))
            else:
                queryset = queryset.filter(chapter__slug=chapter_param)
        return queryset

class DPPQuestionsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            if pk.isdigit():
                dpp = DPP.objects.get(pk=int(pk))
            else:
                dpp = DPP.objects.get(title__icontains=pk)
        except DPP.DoesNotExist:
            return Response({'error': 'DPP not found'}, status=status.HTTP_404_NOT_FOUND)

        dpp_questions = dpp.dpp_questions.all().order_by('order')
        dpp_data = DPPSerializer(dpp).data
        
        # Transform questions format to include options and question details
        questions_list = []
        for dq in dpp_questions:
            q = dq.question
            options_list = []
            correct_ans_id = 'A'
            for idx, opt in enumerate(q.options.all()):
                opt_letter = chr(65 + idx) # A, B, C, D
                if opt.is_correct:
                    correct_ans_id = str(opt.id) if str(opt.id) else opt_letter
                options_list.append({
                    'id': str(opt.id),
                    'text': opt.option_text,
                    'is_correct': opt.is_correct
                })
            
            questions_list.append({
                'id': str(q.id),
                'questionText': q.question_text,
                'options': options_list,
                'correctAnswerId': correct_ans_id,
                'explanation': q.solution_text or 'Detailed step-by-step solution provided.',
                'positive_marks': dq.positive_marks,
                'negative_marks': dq.negative_marks,
            })

        dpp_data['questions'] = questions_list
        return Response(dpp_data)

class DPPSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        try:
            dpp = DPP.objects.get(pk=pk) if pk.isdigit() else DPP.objects.get(title__icontains=pk)
        except DPP.DoesNotExist:
            return Response({'error': 'DPP not found'}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get('answers', {}) # dict of {question_id: option_id}
        dpp_questions = dpp.dpp_questions.all()

        correct = 0
        incorrect = 0
        score = 0
        total = dpp_questions.count()

        for dq in dpp_questions:
            q = dq.question
            user_ans = str(answers.get(str(q.id), '') or answers.get(q.id, ''))
            
            if not user_ans:
                continue

            # Check if user selected correct option
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

        user = request.user if request.user.is_authenticated else None
        if not user:
            from apps.accounts.models import User
            user, _ = User.objects.get_or_create(
                email='demo_student@ankitjee.com',
                defaults={'username': 'demo_student', 'first_name': 'Student', 'last_name': 'Demo'}
            )

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
            'attempt_id': attempt.id,
            'dpp_id': dpp.id,
            'dpp_title': dpp.title,
            'total': total,
            'score': score,
            'correct': correct,
            'incorrect': incorrect,
            'unattempted': unattempted,
            'accuracy': accuracy,
            'completed_at': attempt.completed_at
        }, status=status.HTTP_201_CREATED)
