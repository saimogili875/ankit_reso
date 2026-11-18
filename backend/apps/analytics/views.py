from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import models
from django.db.models import Avg, Count, Q, Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import RankPredictor
from apps.tests.models import TestAttempt, QuestionAttemptLog
from apps.progress.models import DPPAttempt, VideoProgress
from apps.academics.models import Subject, Chapter, Lecture
from apps.questions.models import Question


class AnalyticsOverviewView(APIView):
    """
    Returns aggregated analytics across all tests and DPPs:
    - Overall accuracy, total questions attempted, tests attempted
    - Score and accuracy trends over time
    - Error reason breakdown (from student reason tags)
    - Difficulty-wise accuracy (Easy, Medium, Hard)
    - Syllabus coverage % & Active streak
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 1. Test Attempts
        test_attempts = list(
            TestAttempt.objects.filter(
                user=user,
                status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            ).select_related('test').order_by('completed_at')
        )

        # 2. DPP Attempts
        dpp_attempts = list(DPPAttempt.objects.filter(user=user).order_by('completed_at'))

        # Total counts
        test_q_correct = sum(a.correct_count for a in test_attempts)
        test_q_incorrect = sum(a.incorrect_count for a in test_attempts)
        dpp_q_correct = sum(a.correct_count for a in dpp_attempts)
        dpp_q_incorrect = sum(a.incorrect_count for a in dpp_attempts)

        total_correct = test_q_correct + dpp_q_correct
        total_incorrect = test_q_incorrect + dpp_q_incorrect
        total_answered = total_correct + total_incorrect

        overall_accuracy = (
            round((total_correct / total_answered * 100), 1) if total_answered > 0 else 0.0
        )

        # 3. Test Trends (Chronological)
        trends = []
        for att in test_attempts:
            t_max = float(att.test.total_marks) if att.test else 300.0
            score = float(att.score)
            trends.append({
                'attempt_id': str(att.id),
                'test_title': att.test.title if att.test else 'Test',
                'date': att.completed_at.strftime('%d %b') if att.completed_at else '',
                'score': score,
                'max_marks': t_max,
                'percentage': round((score / t_max * 100), 1) if t_max > 0 else 0.0,
                'accuracy': float(att.accuracy_percentage),
                'rank': att.rank,
                'percentile': float(att.percentile) if att.percentile is not None else None,
                'time_taken_seconds': att.time_taken_seconds,
            })

        # 4. Error-Reason Breakdown from QuestionAttemptLogs
        error_tags = QuestionAttemptLog.objects.filter(
            attempt__user=user,
            is_correct=False
        ).exclude(student_reason_tag=QuestionAttemptLog.ReasonTag.NONE).values('student_reason_tag').annotate(
            count=Count('id')
        )
        reason_map = {item['student_reason_tag']: item['count'] for item in error_tags}

        # 5. Difficulty-wise Accuracy
        diff_logs = QuestionAttemptLog.objects.filter(
            attempt__user=user,
            attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).values('question__difficulty').annotate(
            total=Count('id'),
            correct=Count('id', filter=Q(is_correct=True))
        )
        difficulty_accuracy = {}
        for dl in diff_logs:
            d_key = dl['question__difficulty']
            if d_key:
                d_acc = round((dl['correct'] / dl['total'] * 100), 1) if dl['total'] > 0 else 0.0
                difficulty_accuracy[d_key] = {
                    'total': dl['total'],
                    'correct': dl['correct'],
                    'accuracy': d_acc,
                }

        # 6. Active Streak & Syllabus Coverage
        active_dates = set()
        for da in dpp_attempts:
            if da.completed_at:
                active_dates.add(da.completed_at.date())
        for ta in test_attempts:
            if ta.completed_at:
                active_dates.add(ta.completed_at.date())
        for vp in VideoProgress.objects.filter(user=user):
            active_dates.add(vp.updated_at.date())

        streak_days = 0
        today = timezone.now().date()
        current_check = today if today in active_dates else (today - timedelta(days=1) if (today - timedelta(days=1)) in active_dates else None)
        if current_check:
            while current_check in active_dates:
                streak_days += 1
                current_check = current_check - timedelta(days=1)

        total_lectures = Lecture.objects.filter(is_published=True).count()
        completed_lectures = VideoProgress.objects.filter(user=user, completed=True).count()
        syllabus_percentage = (
            round((completed_lectures / total_lectures * 100), 1) if total_lectures > 0 else 0.0
        )

        return Response({
            'total_tests_attempted': len(test_attempts),
            'total_dpps_attempted': len(dpp_attempts),
            'total_questions_answered': total_answered,
            'total_correct': total_correct,
            'total_incorrect': total_incorrect,
            'overall_accuracy': overall_accuracy,
            'active_streak_days': streak_days,
            'syllabus_coverage_percentage': syllabus_percentage,
            'trends': trends,
            'error_reasons': reason_map,
            'difficulty_accuracy': difficulty_accuracy,
        }, status=status.HTTP_200_OK)


class AnalyticsTrendsView(APIView):
    """
    Detailed time-series performance data for charts (Weekly and Monthly).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Daily test & DPP attempts over last 30 days
        daily_stats = {}
        for day_offset in range(30):
            d = (thirty_days_ago + timedelta(days=day_offset)).date()
            daily_stats[str(d)] = {
                'date': d.strftime('%d %b'),
                'questions_attempted': 0,
                'correct': 0,
                'accuracy': 0.0,
            }

        dpp_logs = DPPAttempt.objects.filter(user=user, completed_at__gte=thirty_days_ago)
        for dl in dpp_logs:
            date_key = str(dl.completed_at.date())
            if date_key in daily_stats:
                daily_stats[date_key]['questions_attempted'] += (dl.correct_count + dl.incorrect_count)
                daily_stats[date_key]['correct'] += dl.correct_count

        test_logs = QuestionAttemptLog.objects.filter(
            attempt__user=user,
            attempt__completed_at__gte=thirty_days_ago
        ).select_related('attempt')

        for tl in test_logs:
            if tl.attempt.completed_at:
                date_key = str(tl.attempt.completed_at.date())
                if date_key in daily_stats and tl.selected_answer:
                    daily_stats[date_key]['questions_attempted'] += 1
                    if tl.is_correct:
                        daily_stats[date_key]['correct'] += 1

        chart_data = []
        for d_key, vals in sorted(daily_stats.items()):
            tot = vals['questions_attempted']
            acc = round((vals['correct'] / tot * 100), 1) if tot > 0 else 0.0
            chart_data.append({
                'date': vals['date'],
                'questions_attempted': tot,
                'accuracy': acc,
            })

        return Response({'thirty_day_trends': chart_data}, status=status.HTTP_200_OK)


class AnalyticsChaptersView(APIView):
    """
    Subject & Chapter strength map based on student's test & DPP question logs.
    Classifies chapters as Strong (>=70%), Average (40-70%), or Weak (<40%).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        chapters = Chapter.objects.select_related('category__subject').all()
        result = []

        for chap in chapters:
            subj_name = chap.category.subject.name if chap.category and chap.category.subject else 'General'

            # 1. From Test Question logs
            test_logs = QuestionAttemptLog.objects.filter(
                attempt__user=user,
                question__chapter=chap,
                attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
            )
            t_total = test_logs.filter(~Q(selected_answer='')).count()
            t_correct = test_logs.filter(is_correct=True).count()
            t_incorrect = t_total - t_correct

            # 2. From DPP Attempts
            dpp_attempts = DPPAttempt.objects.filter(user=user, dpp__chapter=chap)
            d_correct = sum(a.correct_count for a in dpp_attempts)
            d_incorrect = sum(a.incorrect_count for a in dpp_attempts)
            d_total = d_correct + d_incorrect

            total_q = t_total + d_total
            total_corr = t_correct + d_correct
            total_inc = t_incorrect + d_incorrect

            if total_q == 0:
                continue

            acc = round((total_corr / total_q * 100), 1)
            if acc >= 70.0:
                strength = 'Strong'
            elif acc >= 40.0:
                strength = 'Average'
            else:
                strength = 'Weak'

            result.append({
                'chapter_id': str(chap.id),
                'chapter_name': chap.name,
                'subject_name': subj_name,
                'total_attempted': total_q,
                'correct': total_corr,
                'incorrect': total_inc,
                'accuracy': acc,
                'strength': strength,
            })

        # Sort: Weakest first
        result.sort(key=lambda x: (x['accuracy'], -x['incorrect']))

        return Response({
            'chapters': result,
            'weak_chapters': [c for c in result if c['strength'] == 'Weak'],
            'strong_chapters': [c for c in result if c['strength'] == 'Strong'],
        }, status=status.HTTP_200_OK)


class AnalyticsNotebookView(APIView):
    """
    Wrong-Answer Notebook & Bookmarks:
    Aggregates all incorrectly answered or bookmarked questions with filtering,
    re-attempt support, LaTeX solutions, and 'Mark as Revised' toggle.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = QuestionAttemptLog.objects.filter(
            attempt__user=user,
            attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).filter(
            Q(is_correct=False) | Q(is_bookmarked=True)
        ).select_related(
            'question', 'question__subject', 'question__chapter', 'attempt', 'attempt__test'
        ).prefetch_related('question__options')

        # Filter by Subject
        subject_id = request.query_params.get('subject')
        if subject_id:
            queryset = queryset.filter(question__subject_id=subject_id)

        # Filter by Chapter
        chapter_id = request.query_params.get('chapter')
        if chapter_id:
            queryset = queryset.filter(question__chapter_id=chapter_id)

        # Filter by Reason Tag
        reason_tag = request.query_params.get('reason_tag')
        if reason_tag:
            queryset = queryset.filter(student_reason_tag=reason_tag)

        # Filter by Revised status
        filter_status = request.query_params.get('status')
        if filter_status == 'revised':
            queryset = queryset.filter(is_revised=True)
        elif filter_status == 'unrevised':
            queryset = queryset.filter(is_revised=False)
        elif filter_status == 'bookmarked':
            queryset = queryset.filter(is_bookmarked=True)

        items = []
        for log in queryset.order_by('-created_at')[:100]:
            q = log.question
            options = [
                {
                    'id': str(opt.id),
                    'text': opt.option_text,
                    'is_correct': opt.is_correct,
                }
                for opt in q.options.all()
            ]
            correct_opt = q.options.filter(is_correct=True).first()

            items.append({
                'log_id': str(log.id),
                'attempt_id': str(log.attempt_id),
                'test_title': log.attempt.test.title if log.attempt and log.attempt.test else 'Mock Test',
                'question_id': str(q.id),
                'question_text': q.question_text,
                'question_type': q.question_type,
                'difficulty': q.difficulty,
                'subject_id': str(q.subject_id) if q.subject_id else None,
                'subject_name': q.subject.name if q.subject else '',
                'chapter_id': str(q.chapter_id) if q.chapter_id else None,
                'chapter_name': q.chapter.name if q.chapter else '',
                'selected_answer': log.selected_answer,
                'correct_answer': str(correct_opt.id) if correct_opt else '',
                'is_correct': log.is_correct,
                'solution_text': q.solution_text,
                'student_reason_tag': log.student_reason_tag,
                'is_bookmarked': log.is_bookmarked,
                'is_revised': log.is_revised,
                'time_spent_seconds': log.time_spent_seconds,
                'options': options,
                'attempted_at': log.created_at,
            })

        return Response({
            'total_items': len(items),
            'items': items,
        }, status=status.HTTP_200_OK)


class NotebookToggleReviseView(APIView):
    """
    Toggle 'is_revised' on a QuestionAttemptLog.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        log = QuestionAttemptLog.objects.filter(id=pk, attempt__user=request.user).first()
        if not log:
            return Response({'error': 'Item not found in your notebook.'}, status=status.HTTP_404_NOT_FOUND)

        log.is_revised = not log.is_revised
        log.save(update_fields=['is_revised'])

        return Response({
            'message': 'Revision status updated.',
            'log_id': str(log.id),
            'is_revised': log.is_revised,
        }, status=status.HTTP_200_OK)


class RankPredictorForecastView(APIView):
    """
    Computes forecasted JEE Main / Advanced rank based on the student's mock test scores
    using the admin-entered RankPredictor table.
    If the admin table has no entries, returns has_predictor=False so UI hides gracefully.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        predictors = list(RankPredictor.objects.all().order_by('-min_marks'))
        if not predictors:
            return Response({
                'has_predictor': False,
                'message': 'Rank predictor calibration table has not been configured by administration yet.'
            }, status=status.HTTP_200_OK)

        user = request.user
        submitted_attempts = TestAttempt.objects.filter(
            user=user,
            status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        )

        if not submitted_attempts.exists():
            return Response({
                'has_predictor': True,
                'has_attempts': False,
                'message': 'Attempt at least one mock test to forecast your All India Rank.'
            }, status=status.HTTP_200_OK)

        avg_score = float(submitted_attempts.aggregate(Avg('score'))['score__avg'] or 0.0)
        latest_score = float(submitted_attempts.order_by('-submitted_at').first().score)

        # Find matching band
        matched_band = None
        for p in predictors:
            if float(p.min_marks) <= latest_score <= float(p.max_marks):
                matched_band = p
                break

        # Fallback to nearest band
        if not matched_band and predictors:
            if latest_score < float(predictors[-1].min_marks):
                matched_band = predictors[-1]
            else:
                matched_band = predictors[0]

        return Response({
            'has_predictor': True,
            'has_attempts': True,
            'exam_type': matched_band.exam_type if matched_band else 'JEE Main',
            'latest_score': latest_score,
            'average_score': round(avg_score, 1),
            'predicted_rank_min': matched_band.predicted_rank_min if matched_band else None,
            'predicted_rank_max': matched_band.predicted_rank_max if matched_band else None,
            'percentile_min': float(matched_band.percentile_min) if matched_band and matched_band.percentile_min else None,
            'percentile_max': float(matched_band.percentile_max) if matched_band and matched_band.percentile_max else None,
            'notes': matched_band.notes if matched_band else '',
        }, status=status.HTTP_200_OK)
