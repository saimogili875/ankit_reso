from datetime import timedelta
from django.utils import timezone
from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.academics.models import Subject, Chapter, Lecture
from apps.content.models import Video
from apps.questions.models import DPP
from apps.tests.models import TestAttempt
from .models import VideoProgress, QuestionAttempt, StudentProgress, DPPAttempt

class ProgressOverviewView(APIView):
    def get(self, request):
        user = request.user

        # 1. DPP Attempts by this user
        dpp_attempts = DPPAttempt.objects.filter(user=user)
        total_correct = sum(a.correct_count for a in dpp_attempts)
        total_incorrect = sum(a.incorrect_count for a in dpp_attempts)
        total_answered = total_correct + total_incorrect

        overall_accuracy = (
            round((total_correct / total_answered) * 100, 1)
            if total_answered > 0 else 0.0
        )

        # 2. Syllabus coverage from VideoProgress
        total_lectures = Lecture.objects.filter(is_published=True).count()
        completed_lectures = VideoProgress.objects.filter(user=user, completed=True).count()
        syllabus_covered = (
            round((completed_lectures / total_lectures) * 100, 1)
            if total_lectures > 0 else 0.0
        )

        # 3. Active Streak calculation
        active_dates = set()
        for attempt in dpp_attempts:
            active_dates.add(attempt.completed_at.date())
        for vp in VideoProgress.objects.filter(user=user):
            active_dates.add(vp.updated_at.date())
        for ta in TestAttempt.objects.filter(user=user):
            if ta.completed_at:
                active_dates.add(ta.completed_at.date())

        streak_days = 0
        today = timezone.now().date()

        if today in active_dates:
            current_check = today
        elif (today - timedelta(days=1)) in active_dates:
            current_check = today - timedelta(days=1)
        else:
            current_check = None

        if current_check:
            while current_check in active_dates:
                streak_days += 1
                current_check = current_check - timedelta(days=1)

        # 4. Subject Accuracy Breakdown
        subjects = Subject.objects.filter(is_visible=True).order_by('order', 'name')
        subject_breakdown = []

        for subj in subjects:
            subj_attempts = dpp_attempts.filter(dpp__chapter__category__subject=subj)
            s_correct = sum(a.correct_count for a in subj_attempts)
            s_incorrect = sum(a.incorrect_count for a in subj_attempts)
            s_total = s_correct + s_incorrect
            s_acc = round((s_correct / s_total) * 100, 1) if s_total > 0 else 0.0

            subject_breakdown.append({
                'id': str(subj.id),
                'name': subj.name,
                'slug': subj.slug,
                'accuracy': s_acc,
                'questions_attempted': s_total,
                'questions_correct': s_correct,
            })

        # 5. Weak Chapters (< 60% accuracy on attempted questions)
        weak_chapters = []
        for chap in Chapter.objects.select_related('category__subject').all():
            chap_attempts = dpp_attempts.filter(dpp__chapter=chap)
            c_correct = sum(a.correct_count for a in chap_attempts)
            c_incorrect = sum(a.incorrect_count for a in chap_attempts)
            c_total = c_correct + c_incorrect
            if c_total > 0:
                c_acc = round((c_correct / c_total) * 100, 1)
                if c_acc < 60.0:
                    weak_chapters.append({
                        'id': str(chap.id),
                        'name': chap.name,
                        'subject_name': chap.category.subject.name if chap.category and chap.category.subject else '',
                        'accuracy': c_acc,
                        'total_attempted': c_total,
                    })

        # 6. Study Time (video watch seconds + test attempt seconds)
        video_seconds = sum(v.watched_seconds for v in VideoProgress.objects.filter(user=user))
        test_seconds = sum(t.time_taken_seconds for t in TestAttempt.objects.filter(user=user))
        total_study_minutes = round((video_seconds + test_seconds) / 60)

        return Response({
            'streak_days': streak_days,
            'accuracy_rate': overall_accuracy,
            'syllabus_covered': syllabus_covered,
            'questions_solved': total_correct,
            'total_attempts': dpp_attempts.count(),
            'completed_lectures': completed_lectures,
            'total_lectures': total_lectures,
            'study_time_minutes': total_study_minutes,
            'subject_breakdown': subject_breakdown,
            'weak_chapters': weak_chapters,
        })

class RecentActivityView(APIView):
    def get(self, request):
        user = request.user
        activities = []

        # Recent video progress
        vps = VideoProgress.objects.filter(user=user).select_related('video', 'video__lecture', 'video__lecture__chapter', 'video__lecture__chapter__category__subject').order_by('-updated_at')[:6]
        for vp in vps:
            lecture = vp.video.lecture if hasattr(vp.video, 'lecture') else None
            chapter_name = lecture.chapter.name if lecture and lecture.chapter else 'General'
            subject_name = lecture.chapter.category.subject.name if lecture and lecture.chapter and lecture.chapter.category and lecture.chapter.category.subject else 'JEE'
            duration = max(60, vp.video.duration_seconds or 1800)
            percent = 100 if vp.completed else min(99, int((vp.watched_seconds / duration) * 100))
            mins_left = max(1, (duration - vp.watched_seconds) // 60)

            activities.append({
                'id': str(vp.id),
                'type': 'video',
                'topicName': lecture.title if lecture else vp.video.title,
                'subjectMeta': f"{subject_name} • {chapter_name}",
                'progressPercent': percent,
                'durationLeft': 'Completed' if vp.completed else f"{mins_left} mins left",
                'timestamp': vp.updated_at,
                'href': f"/learn?lecture={vp.video.id}",
                'badgeVariant': 'blue',
            })

        # Recent DPP attempts
        attempts = DPPAttempt.objects.filter(user=user).select_related('dpp', 'dpp__chapter', 'dpp__chapter__category__subject').order_by('-completed_at')[:4]
        for att in attempts:
            chapter_name = att.dpp.chapter.name if att.dpp.chapter else 'Practice'
            subject_name = att.dpp.chapter.category.subject.name if att.dpp.chapter and att.dpp.chapter.category and att.dpp.chapter.category.subject else 'JEE'

            activities.append({
                'id': str(att.id),
                'type': 'dpp',
                'topicName': att.dpp.title,
                'subjectMeta': f"{subject_name} • {chapter_name}",
                'progressPercent': int(att.accuracy_percentage),
                'durationLeft': f"Score: {att.score}",
                'timestamp': att.completed_at,
                'href': f"/practice?dpp={att.dpp.id}",
                'badgeVariant': 'purple',
            })

        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return Response(activities[:6])


class VideoProgressUpdateView(APIView):
    def post(self, request):
        user = request.user
        video_id = request.data.get('video_id') or request.data.get('videoId')
        lecture_id = request.data.get('lecture_id') or request.data.get('lectureId')
        watched_seconds = int(request.data.get('watched_seconds', 0))
        completed = bool(request.data.get('completed', False))

        video = None
        if video_id:
            video = Video.objects.filter(id=video_id).first()
        elif lecture_id:
            video = Video.objects.filter(lecture_id=lecture_id).first()

        if not video:
            return Response({'error': 'Video not found'}, status=status.HTTP_404_NOT_FOUND)

        vp, created = VideoProgress.objects.get_or_create(
            user=user,
            video=video,
            defaults={
                'watched_seconds': watched_seconds,
                'completed': completed,
            }
        )
        if not created:
            vp.watched_seconds = max(vp.watched_seconds, watched_seconds)
            if completed:
                vp.completed = True
            vp.save()

        return Response({
            'message': 'Progress saved',
            'video_id': str(video.id),
            'watched_seconds': vp.watched_seconds,
            'completed': vp.completed,
        }, status=status.HTTP_200_OK)
