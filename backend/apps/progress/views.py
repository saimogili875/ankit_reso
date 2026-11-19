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
        vps = VideoProgress.objects.filter(user=user).select_related(
            'video', 'lecture', 'video__lecture', 'lecture__chapter', 'lecture__chapter__category__subject'
        ).order_by('-updated_at')[:6]
        for vp in vps:
            lecture = vp.lecture or (vp.video.lecture if vp.video else None)
            video = vp.video
            chap = lecture.chapter if lecture else None
            subject_name = chap.category.subject.name if (chap and chap.category and chap.category.subject) else 'JEE Prep'
            chapter_name = chap.name if chap else 'Lecture Series'
            duration = (video.duration_seconds if video else (lecture.duration_seconds if lecture else 1800)) or 1800
            max_seen = max(vp.watched_seconds, vp.last_position_seconds)
            percent = 100 if vp.completed else min(99, int((max_seen / duration) * 100))
            mins_left = max(1, (duration - max_seen) // 60)
            target_lecture_id = str(lecture.id) if lecture else (str(video.id) if video else '')

            topic_title = lecture.title if lecture else (video.title if video else 'Lecture Video')
            sub_meta = f"{subject_name} • {chapter_name}"

            activities.append({
                'id': str(vp.id),
                'type': 'video',
                'title': topic_title,
                'subtitle': sub_meta,
                'progress_percent': percent,
                'topicName': topic_title,
                'subjectMeta': sub_meta,
                'progressPercent': percent,
                'durationLeft': 'Completed ✓' if vp.completed else f"{mins_left} mins left",
                'lastPositionSeconds': vp.last_position_seconds,
                'timestamp': vp.updated_at,
                'href': f"/learn?lecture={target_lecture_id}",
                'badgeVariant': 'blue',
            })

        # Recent DPP attempts
        attempts = DPPAttempt.objects.filter(user=user).select_related('dpp', 'dpp__chapter', 'dpp__chapter__category__subject').order_by('-completed_at')[:4]
        for att in attempts:
            chapter_name = att.dpp.chapter.name if att.dpp.chapter else 'Practice'
            subject_name = att.dpp.chapter.category.subject.name if att.dpp.chapter and att.dpp.chapter.category and att.dpp.chapter.category.subject else 'JEE'
            dpp_title = att.dpp.title
            dpp_sub = f"{subject_name} • {chapter_name}"

            activities.append({
                'id': str(att.id),
                'type': 'dpp',
                'title': dpp_title,
                'subtitle': dpp_sub,
                'progress_percent': int(att.accuracy_percentage),
                'topicName': dpp_title,
                'subjectMeta': dpp_sub,
                'progressPercent': int(att.accuracy_percentage),
                'durationLeft': f"Score: {att.score}",
                'timestamp': att.completed_at,
                'href': f"/practice?dpp={att.dpp.id}",
                'badgeVariant': 'purple',
            })

        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return Response(activities[:6])


class VideoProgressUpdateView(APIView):
    """
    Updates or creates VideoProgress for a student viewing a lecture.
    Captures last_position_seconds (for instant resume), watched_seconds, and completion_percent.
    Marks completed at >= 90%.
    """
    def post(self, request):
        user = request.user
        video_id = request.data.get('video_id') or request.data.get('videoId')
        lecture_id = request.data.get('lecture_id') or request.data.get('lectureId')
        last_position_seconds = int(request.data.get('last_position_seconds', request.data.get('lastPositionSeconds', 0)))
        watched_seconds = int(request.data.get('watched_seconds', request.data.get('watchedSeconds', 0)))
        completion_percent = float(request.data.get('completion_percent', request.data.get('completionPercent', 0.0)))
        completed = bool(request.data.get('completed', False))

        video = None
        lecture = None

        if video_id:
            video = Video.objects.filter(id=video_id).first()
            if video and video.lecture:
                lecture = video.lecture
        if not video and lecture_id:
            lecture = Lecture.objects.filter(id=lecture_id).first()
            if lecture:
                video = Video.objects.filter(lecture=lecture).first()

        if not video and not lecture:
            return Response({'error': 'Video or Lecture not found'}, status=status.HTTP_404_NOT_FOUND)

        duration = (video.duration_seconds if video else (lecture.duration_seconds if lecture else 0)) or 1

        if completion_percent <= 0.0 and duration > 0 and (watched_seconds > 0 or last_position_seconds > 0):
            max_seen = max(watched_seconds, last_position_seconds)
            completion_percent = round((max_seen / duration) * 100, 2)

        is_completed = completed or (completion_percent >= 90.0)

        # Upsert single progress record
        lookup = {'user': user}
        if video:
            lookup['video'] = video
        elif lecture:
            lookup['lecture'] = lecture

        vp, created = VideoProgress.objects.get_or_create(
            **lookup,
            defaults={
                'lecture': lecture,
                'video': video,
                'last_position_seconds': last_position_seconds,
                'watched_seconds': watched_seconds,
                'completion_percent': completion_percent,
                'completed': is_completed,
            }
        )
        if not created:
            if lecture and not vp.lecture:
                vp.lecture = lecture
            if video and not vp.video:
                vp.video = video
            vp.last_position_seconds = last_position_seconds
            vp.watched_seconds = max(vp.watched_seconds, watched_seconds)
            vp.completion_percent = max(float(vp.completion_percent), completion_percent)
            if is_completed or vp.completion_percent >= 90.0:
                vp.completed = True
            vp.save()

        return Response({
            'message': 'Progress saved',
            'video_id': str(video.id) if video else None,
            'lecture_id': str(lecture.id) if lecture else None,
            'last_position_seconds': vp.last_position_seconds,
            'watched_seconds': vp.watched_seconds,
            'completion_percent': float(vp.completion_percent),
            'completed': vp.completed,
        }, status=status.HTTP_200_OK)
