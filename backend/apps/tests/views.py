from decimal import Decimal
from django.utils import timezone
from django.db import models
from django.db.models import Avg, Count, Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import (
    Test,
    TestSection,
    TestQuestion,
    TestAttempt,
    QuestionAttemptLog,
    TestAttemptAnalysis,
)
from .serializers import (
    TestListSerializer,
    QuestionReviewSerializer,
)
from .analysis import compute_test_attempt_analysis
from apps.questions.models import Question, QuestionOption


class TestListView(generics.ListAPIView):
    """
    List published tests with tabs: all | upcoming | available | attempted
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TestListSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Test.objects.filter(is_published=True).select_related('exam', 'course').prefetch_related('test_questions')
        now = timezone.now()

        test_type = self.request.query_params.get('type')
        if test_type:
            queryset = queryset.filter(test_type=test_type)

        tab = self.request.query_params.get('status', 'all')
        if tab == 'upcoming':
            queryset = queryset.filter(start_time__gt=now)
        elif tab == 'available':
            queryset = queryset.filter(
                Q(start_time__isnull=True) | Q(start_time__lte=now),
                Q(end_time__isnull=True) | Q(end_time__gte=now)
            )
            # Exclude already submitted
            completed_test_ids = TestAttempt.objects.filter(
                user=user,
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            ).values_list('test_id', flat=True)
            queryset = queryset.exclude(id__in=completed_test_ids)
        elif tab == 'attempted':
            attempted_test_ids = TestAttempt.objects.filter(
                user=user,
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            ).values_list('test_id', flat=True)
            queryset = queryset.filter(id__in=attempted_test_ids)

        return queryset.order_by('-created_at')


class TestStartView(APIView):
    """
    Initializes or resumes a test attempt on the CBT exam runner.
    Sanitizes question data: Never leaks is_correct or solution_text to the browser during the exam!
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        test = Test.objects.filter(id=pk, is_published=True).first()
        if not test:
            return Response({'error': 'Test not found or not published.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user

        # Check existing in-progress attempt
        attempt = TestAttempt.objects.filter(
            test=test,
            user=user,
            status=TestAttempt.Status.IN_PROGRESS
        ).first()

        if not attempt:
            # Check if user already submitted and test does not allow retakes
            completed = TestAttempt.objects.filter(
                test=test,
                user=user,
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            ).first()

            if completed:
                return Response({
                    'message': 'Test already completed.',
                    'already_submitted': True,
                    'attempt_id': str(completed.id)
                }, status=status.HTTP_200_OK)

            # Create new attempt
            attempt = TestAttempt.objects.create(
                user=user,
                test=test,
                status=TestAttempt.Status.IN_PROGRESS,
                started_at=timezone.now(),
                answers={},
                question_states={}
            )

        # Build CBT layout (sections + sanitized questions)
        sections = list(test.sections.select_related('subject').order_by('order'))
        sections_data = [
            {
                'id': str(s.id),
                'name': s.name,
                'subject_id': str(s.subject_id),
                'subject_name': s.subject.name,
                'order': s.order,
                'instructions': s.instructions,
            }
            for s in sections
        ]

        test_questions = list(
            test.test_questions.select_related('question', 'section', 'question__subject')
            .prefetch_related('question__options')
            .order_by('order')
        )

        questions_data = []
        for tq in test_questions:
            q = tq.question
            # Secure options payload: never expose is_correct
            options = [
                {
                    'id': str(opt.id),
                    'text': opt.option_text,
                }
                for opt in q.options.all()
            ]

            questions_data.append({
                'id': str(q.id),
                'test_question_id': str(tq.id),
                'section_id': str(tq.section_id) if tq.section_id else (sections_data[0]['id'] if sections_data else None),
                'order': tq.order,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'difficulty': q.difficulty,
                'positive_marks': float(tq.positive_marks),
                'negative_marks': float(tq.negative_marks),
                'options': options,
            })

        # Calculate time elapsed and remaining
        duration_seconds = test.duration_minutes * 60
        elapsed_seconds = max(0, int((timezone.now() - attempt.started_at).total_seconds()))
        if attempt.time_taken_seconds > elapsed_seconds:
            elapsed_seconds = attempt.time_taken_seconds

        time_remaining_seconds = max(0, duration_seconds - elapsed_seconds)

        return Response({
            'attempt_id': str(attempt.id),
            'test_id': str(test.id),
            'title': test.title,
            'duration_minutes': test.duration_minutes,
            'total_marks': test.total_marks,
            'instructions': test.instructions,
            'time_elapsed_seconds': elapsed_seconds,
            'time_remaining_seconds': time_remaining_seconds,
            'sections': sections_data,
            'questions': questions_data,
            'saved_answers': attempt.answers or {},
            'question_states': attempt.question_states or {},
        }, status=status.HTTP_200_OK)


class TestEventLogView(APIView):
    """
    Real-time interaction logger for the CBT interface:
    Captures per-question time spent, visits, answers, changes, and review marks.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = TestAttempt.objects.filter(id=pk, user=request.user).first()
        if not attempt:
            return Response({'error': 'Attempt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if attempt.status != TestAttempt.Status.IN_PROGRESS:
            return Response({'error': 'Attempt is already submitted.'}, status=status.HTTP_400_BAD_REQUEST)

        question_id = request.data.get('question_id')
        event_type = request.data.get('event_type') # 'visit', 'answer', 'clear', 'mark_review'
        selected_answer = str(request.data.get('selected_answer', '') or '').strip()
        time_delta = max(0, int(request.data.get('time_spent_delta', 0)))

        if not question_id:
            return Response({'error': 'question_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        question = Question.objects.filter(id=question_id).first()
        if not question:
            return Response({'error': 'Question not found.'}, status=status.HTTP_404_NOT_FOUND)

        tq = TestQuestion.objects.filter(test=attempt.test, question=question).first()

        # Update or create log
        log, _ = QuestionAttemptLog.objects.get_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'test_question': tq,
                'status': QuestionAttemptLog.Status.NOT_VISITED,
            }
        )

        if time_delta > 0:
            log.time_spent_seconds += time_delta
            attempt.time_taken_seconds += time_delta

        if event_type == 'visit':
            log.visit_count += 1
            if log.status == QuestionAttemptLog.Status.NOT_VISITED:
                log.status = QuestionAttemptLog.Status.SKIPPED

        elif event_type == 'answer':
            if selected_answer and selected_answer != log.selected_answer:
                if log.selected_answer:
                    log.answer_change_count += 1
                log.selected_answer = selected_answer
                if log.first_answer_time is None:
                    log.first_answer_time = attempt.time_taken_seconds
                log.final_answer_time = attempt.time_taken_seconds

                # State
                current_state = (attempt.question_states or {}).get(str(question_id))
                if current_state == 'MARKED_REVIEW' or request.data.get('mark_review'):
                    log.status = QuestionAttemptLog.Status.ANSWERED_AND_MARKED
                else:
                    log.status = QuestionAttemptLog.Status.CORRECT # provisional answered status

            # Save in attempt answers dictionary
            answers = attempt.answers or {}
            answers[str(question_id)] = selected_answer
            attempt.answers = answers

        elif event_type == 'clear':
            log.selected_answer = ''
            log.status = QuestionAttemptLog.Status.SKIPPED
            answers = attempt.answers or {}
            if str(question_id) in answers:
                del answers[str(question_id)]
            attempt.answers = answers

        elif event_type == 'mark_review':
            is_answered = bool(log.selected_answer)
            log.status = (
                QuestionAttemptLog.Status.ANSWERED_AND_MARKED
                if is_answered
                else QuestionAttemptLog.Status.MARKED_REVIEW
            )

        log.save()

        # Update palette state in attempt
        states = attempt.question_states or {}
        new_state = request.data.get('new_state')
        if new_state:
            states[str(question_id)] = new_state
            attempt.question_states = states

        attempt.save(update_fields=['answers', 'question_states', 'time_taken_seconds'])

        return Response({'status': 'ok', 'saved_state': new_state}, status=status.HTTP_200_OK)


class TestSubmitView(APIView):
    """
    Submits a test attempt (manually or auto-submit), scores all answers against the answer key,
    updates QuestionAttemptLogs, computes full TestAttemptAnalysis, and refreshes test ranks.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = TestAttempt.objects.filter(id=pk, user=request.user).first()
        if not attempt:
            return Response({'error': 'Attempt not found.'}, status=status.HTTP_404_NOT_FOUND)

        if attempt.status in [TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]:
            return Response({
                'message': 'Attempt already submitted.',
                'attempt_id': str(attempt.id),
                'score': float(attempt.score),
            }, status=status.HTTP_200_OK)

        is_auto = bool(request.data.get('is_auto', False))
        final_answers = request.data.get('answers') or attempt.answers or {}
        time_taken = int(request.data.get('time_taken_seconds', attempt.time_taken_seconds or 0))

        test = attempt.test
        test_questions = test.test_questions.select_related('question').prefetch_related('question__options')

        score = 0.0
        correct_count = 0
        incorrect_count = 0
        total_q = test_questions.count()

        for tq in test_questions:
            q = tq.question
            ans_val = final_answers.get(str(q.id), '') or final_answers.get(q.id, '')
            if isinstance(ans_val, dict):
                sel_opts = ans_val.get('selected_options', [])
                user_ans = str(sel_opts[0]) if sel_opts else str(ans_val.get('text_answer', '')).strip()
            else:
                user_ans = str(ans_val).strip()

            log, _ = QuestionAttemptLog.objects.get_or_create(
                attempt=attempt,
                question=q,
                defaults={'test_question': tq}
            )
            log.test_question = tq
            log.selected_answer = user_ans

            if not user_ans:
                log.is_correct = False
                log.marks_awarded = Decimal('0.0')
                log.status = QuestionAttemptLog.Status.SKIPPED
                log.save()
                continue

            # Evaluate correct answer
            is_correct = False
            if q.question_type == Question.QuestionType.NUMERICAL:
                # Compare numerical answer from solution or option
                correct_opt = q.options.filter(is_correct=True).first()
                if correct_opt and correct_opt.option_text.strip().lower() == user_ans.lower():
                    is_correct = True
            else:
                for opt in q.options.all():
                    if opt.is_correct and (str(opt.id) == user_ans or opt.option_text.strip() == user_ans):
                        is_correct = True
                        break

            log.is_correct = is_correct
            if is_correct:
                correct_count += 1
                pos_m = float(tq.positive_marks)
                score += pos_m
                log.marks_awarded = Decimal(str(pos_m))
                log.status = QuestionAttemptLog.Status.CORRECT
            else:
                incorrect_count += 1
                neg_m = float(tq.negative_marks)
                score -= neg_m
                log.marks_awarded = Decimal(str(-neg_m))
                log.status = QuestionAttemptLog.Status.WRONG

            log.save()

        unattempted = max(0, total_q - (correct_count + incorrect_count))
        total_attempted = correct_count + incorrect_count
        accuracy = round((correct_count / total_attempted * 100), 2) if total_attempted > 0 else 0.0

        attempt.status = TestAttempt.Status.AUTO_SUBMITTED if is_auto else TestAttempt.Status.SUBMITTED
        attempt.is_completed = True
        attempt.score = Decimal(str(max(0, score)))
        attempt.time_taken_seconds = time_taken
        attempt.correct_count = correct_count
        attempt.incorrect_count = incorrect_count
        attempt.unattempted_count = unattempted
        attempt.accuracy_percentage = Decimal(str(accuracy))
        attempt.submitted_at = timezone.now()
        attempt.completed_at = timezone.now()
        attempt.answers = final_answers
        attempt.save()

        # Compute full analysis snapshot & update ranks/percentiles
        analysis = compute_test_attempt_analysis(attempt)

        return Response({
            'message': 'Test submitted successfully.',
            'attempt_id': str(attempt.id),
            'test_id': str(test.id),
            'score': float(attempt.score),
            'total_marks': test.total_marks,
            'accuracy': float(accuracy),
            'correct_count': correct_count,
            'incorrect_count': incorrect_count,
            'unattempted_count': unattempted,
            'rank': attempt.rank,
            'percentile': float(attempt.percentile) if attempt.percentile is not None else None,
            'overview': analysis.overview_data,
        }, status=status.HTTP_201_CREATED)


class TestResultView(APIView):
    """
    Returns full comprehensive result snapshot across all 8 tabs.
    Enforces authorization (student can only access their own results).
    Respects test schedule: if solutions are gated until test window closes, returns lock message.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        attempt = TestAttempt.objects.filter(id=pk).select_related('test').first()
        if not attempt:
            return Response({'error': 'Attempt not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if attempt.user != user and not (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            return Response({'error': 'You do not have permission to view this test attempt.'}, status=status.HTTP_403_FORBIDDEN)

        test = attempt.test
        now = timezone.now()

        # Check if solutions/results are locked until test window ends
        if not test.publish_results_immediately and test.end_time and now < test.end_time:
            return Response({
                'results_locked': True,
                'message': f"Detailed solutions and answer reviews will be unlocked after the test window closes on {test.end_time.strftime('%b %d, %Y at %I:%M %p')}.",
                'attempt_id': str(attempt.id),
                'test_title': test.title,
                'score': float(attempt.score),
                'total_marks': test.total_marks,
                'submitted_at': attempt.submitted_at,
            }, status=status.HTTP_200_OK)

        # Retrieve or compute snapshot
        analysis = getattr(attempt, 'analysis', None)
        if not analysis:
            analysis = compute_test_attempt_analysis(attempt)

        return Response({
            'results_locked': False,
            'attempt_id': str(attempt.id),
            'test_id': str(test.id),
            'test_title': test.title,
            'test_type': test.test_type,
            'overview': analysis.overview_data,
            'sections': analysis.sections_data,
            'chapters': analysis.chapters_data,
            'time_analysis': analysis.time_data,
            'attempt_strategy': analysis.strategy_data,
            'marks_analysis': analysis.marks_data,
            'comparison': analysis.comparison_data,
            'recommendations': analysis.recommendations_data,
            'score_distribution': analysis.score_distribution,
        }, status=status.HTTP_200_OK)


class TestQuestionsReviewView(APIView):
    """
    Returns detailed question-by-question review with student's answer, correct answer,
    LaTeX solution, difficulty, time spent, class statistics, and student reason tag.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        attempt = TestAttempt.objects.filter(id=pk).select_related('test').first()
        if not attempt:
            return Response({'error': 'Attempt not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if attempt.user != user and not (user.is_staff or getattr(user, 'role', '') == 'ADMIN'):
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        logs = list(
            QuestionAttemptLog.objects.filter(attempt=attempt)
            .select_related('question', 'question__subject', 'question__chapter', 'test_question')
            .prefetch_related('question__options')
            .order_by('test_question__order', 'id')
        )

        # Class stats per question for this test
        all_logs = QuestionAttemptLog.objects.filter(
            attempt__test=attempt.test,
            attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).values('question_id').annotate(
            total=Count('id'),
            correct=Count('id', filter=Q(is_correct=True)),
            avg_time=Avg('time_spent_seconds')
        )
        stats_map = {
            item['question_id']: {
                'accuracy': round((item['correct'] / item['total'] * 100), 1) if item['total'] > 0 else 0.0,
                'avg_time': round(float(item['avg_time'] or 0.0), 1)
            }
            for item in all_logs
        }

        serialized = []
        for log in logs:
            q = log.question
            options = [
                {
                    'id': str(opt.id),
                    'option_text': opt.option_text,
                    'is_correct': opt.is_correct,
                }
                for opt in q.options.all()
            ]
            correct_opts = [str(opt.id) for opt in q.options.all() if opt.is_correct]
            correct_ans = correct_opts[0] if correct_opts else ''

            st = stats_map.get(q.id, {'accuracy': 0.0, 'avg_time': 0.0})

            serialized.append({
                'log_id': str(log.id),
                'question_id': str(q.id),
                'order': log.test_question.order if log.test_question else 0,
                'section_id': str(log.test_question.section_id) if log.test_question and log.test_question.section_id else None,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'difficulty': q.difficulty,
                'subject_name': q.subject.name if q.subject else '',
                'chapter_name': q.chapter.name if q.chapter else '',
                'selected_answer': log.selected_answer,
                'correct_answer': correct_ans,
                'is_correct': log.is_correct,
                'status': log.status,
                'time_spent_seconds': log.time_spent_seconds,
                'class_avg_time_seconds': st['avg_time'],
                'class_accuracy_percentage': st['accuracy'],
                'visit_count': log.visit_count,
                'answer_change_count': log.answer_change_count,
                'marks_awarded': float(log.marks_awarded),
                'student_reason_tag': log.student_reason_tag,
                'is_bookmarked': log.is_bookmarked,
                'is_revised': log.is_revised,
                'solution_text': q.solution_text,
                'options': options,
            })

        return Response({'questions': serialized}, status=status.HTTP_200_OK)


class QuestionTagUpdateView(APIView):
    """
    Saves student reason tag (CONCEPT_GAP, SILLY, GUESS, etc.) and bookmark status.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        attempt = TestAttempt.objects.filter(id=pk, user=request.user).first()
        if not attempt:
            return Response({'error': 'Attempt not found.'}, status=status.HTTP_404_NOT_FOUND)

        question_id = request.data.get('question_id')
        log = QuestionAttemptLog.objects.filter(attempt=attempt, question_id=question_id).first()
        if not log:
            return Response({'error': 'Question attempt log not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason_tag = request.data.get('student_reason_tag')
        if reason_tag and reason_tag in QuestionAttemptLog.ReasonTag.values:
            log.student_reason_tag = reason_tag

        if 'is_bookmarked' in request.data:
            log.is_bookmarked = bool(request.data['is_bookmarked'])

        if 'is_revised' in request.data:
            log.is_revised = bool(request.data['is_revised'])

        log.save()
        return Response({
            'message': 'Updated successfully.',
            'log_id': str(log.id),
            'student_reason_tag': log.student_reason_tag,
            'is_bookmarked': log.is_bookmarked,
            'is_revised': log.is_revised,
        }, status=status.HTTP_200_OK)
