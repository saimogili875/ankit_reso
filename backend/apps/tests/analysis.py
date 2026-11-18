from decimal import Decimal
from django.db import models
from django.db.models import Avg, Count, Q
from django.utils import timezone
from .models import (
    Test,
    TestQuestion,
    TestAttempt,
    QuestionAttemptLog,
    TestAttemptAnalysis,
)
from apps.questions.models import Question
from apps.academics.models import Chapter, Lecture
from apps.questions.models import DPP
from apps.materials.models import StudyMaterial


def recompute_test_ranks_and_percentiles(test: Test):
    """
    Recomputes rank and percentile for all submitted attempts of a test.
    Rank = 1-based index based on score (higher score = better rank, ties resolved by less time).
    Percentile = (students with score < student_score) / total_participants * 100.
    If fewer than 2 participants, percentile is None ("not enough attempts yet").
    """
    submitted_attempts = list(
        TestAttempt.objects.filter(
            test=test,
            status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).order_by('-score', 'time_taken_seconds')
    )

    total_count = len(submitted_attempts)
    if total_count == 0:
        return

    # Assign ranks and percentiles
    for idx, att in enumerate(submitted_attempts):
        # Rank: count how many students scored strictly higher than this student + 1
        rank = sum(1 for other in submitted_attempts if other.score > att.score) + 1
        att.rank = rank

        if total_count >= 2:
            strictly_lower = sum(1 for other in submitted_attempts if other.score < att.score)
            percentile = round((strictly_lower / total_count) * 100, 2)
            att.percentile = Decimal(str(percentile))
        else:
            att.percentile = None

        att.save(update_fields=['rank', 'percentile'])


def compute_test_attempt_analysis(attempt: TestAttempt) -> TestAttemptAnalysis:
    """
    Computes a comprehensive analysis snapshot for a completed TestAttempt
    and persists it in TestAttemptAnalysis for instant retrieval.
    """
    test = attempt.test
    test_questions = list(
        test.test_questions.select_related(
            'question', 'question__chapter', 'question__subject', 'section', 'section__subject'
        ).prefetch_related('question__options').order_by('order')
    )

    # 1. Update/Recalculate ranks and percentiles across the test
    recompute_test_ranks_and_percentiles(test)
    attempt.refresh_from_db()

    # Query all submitted attempts for class averages and topper comparisons
    all_submitted = list(
        TestAttempt.objects.filter(
            test=test,
            status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).order_by('-score', 'time_taken_seconds')
    )
    total_participants = len(all_submitted)
    topper = all_submitted[0] if all_submitted else attempt
    avg_score = round(float(sum(float(a.score) for a in all_submitted) / total_participants), 2) if total_participants > 0 else float(attempt.score)
    avg_time = round(float(sum(a.time_taken_seconds for a in all_submitted) / total_participants), 1) if total_participants > 0 else float(attempt.time_taken_seconds)

    # Build question logs lookup
    logs = list(
        QuestionAttemptLog.objects.filter(attempt=attempt).select_related(
            'question', 'question__chapter', 'question__subject', 'test_question', 'test_question__section'
        )
    )
    logs_by_q = {log.question_id: log for log in logs}

    # Global question stats (across all students who attempted this test)
    all_logs = QuestionAttemptLog.objects.filter(
        attempt__test=test,
        attempt__status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
    )
    q_stats_raw = all_logs.values('question_id').annotate(
        total_attempts=Count('id'),
        correct_count=Count('id', filter=Q(is_correct=True)),
        avg_time=Avg('time_spent_seconds')
    )
    global_q_stats = {
        item['question_id']: {
            'accuracy': round((item['correct_count'] / item['total_attempts'] * 100), 1) if item['total_attempts'] > 0 else 0.0,
            'avg_time': round(float(item['avg_time'] or 0.0), 1)
        }
        for item in q_stats_raw
    }

    # Calculate metrics
    total_q = len(test_questions)
    total_duration_seconds = test.duration_minutes * 60
    ideal_time_per_q = round(total_duration_seconds / total_q, 1) if total_q > 0 else 120.0

    score = float(attempt.score)
    max_marks = float(test.total_marks)
    score_percentage = round((score / max_marks * 100), 2) if max_marks > 0 else 0.0

    correct_count = attempt.correct_count
    incorrect_count = attempt.incorrect_count
    unattempted_count = attempt.unattempted_count
    accuracy = float(attempt.accuracy_percentage)

    negative_marks_lost = 0.0
    time_on_correct = 0
    time_on_wrong = 0
    time_on_skipped = 0
    guess_count = 0
    questions_over_2x_ideal = []
    unattempted_easy_count = 0
    marks_lost_easy = 0.0

    # Sections & Chapters aggregators
    sections_map = {}
    chapters_map = {}

    for tq in test_questions:
        q = tq.question
        log = logs_by_q.get(q.id)

        # Determine section
        sec = tq.section
        sec_id = str(sec.id) if sec else 'general'
        sec_name = sec.name if sec else (q.subject.name if q.subject else 'General')
        subj_name = q.subject.name if q.subject else (sec.subject.name if sec and sec.subject else 'General')

        if sec_id not in sections_map:
            sections_map[sec_id] = {
                'id': sec_id,
                'name': sec_name,
                'subject_name': subj_name,
                'total_questions': 0,
                'attempted': 0,
                'correct': 0,
                'incorrect': 0,
                'skipped': 0,
                'score': 0.0,
                'max_marks': 0.0,
                'time_spent': 0,
            }

        sections_map[sec_id]['total_questions'] += 1
        sections_map[sec_id]['max_marks'] += float(tq.positive_marks)

        # Determine chapter
        chap = q.chapter
        chap_id = str(chap.id) if chap else 'unknown'
        chap_name = chap.name if chap else 'Unassigned Chapter'

        if chap_id not in chapters_map:
            chapters_map[chap_id] = {
                'id': chap_id,
                'name': chap_name,
                'subject_name': subj_name,
                'total_questions': 0,
                'correct': 0,
                'incorrect': 0,
                'skipped': 0,
                'time_spent': 0,
            }

        chapters_map[chap_id]['total_questions'] += 1

        if log:
            time_spent = log.time_spent_seconds
            sections_map[sec_id]['time_spent'] += time_spent
            chapters_map[chap_id]['time_spent'] += time_spent

            if log.is_correct:
                time_on_correct += time_spent
                sections_map[sec_id]['correct'] += 1
                sections_map[sec_id]['attempted'] += 1
                sections_map[sec_id]['score'] += float(tq.positive_marks)
                chapters_map[chap_id]['correct'] += 1
            elif log.selected_answer:
                time_on_wrong += time_spent
                sections_map[sec_id]['incorrect'] += 1
                sections_map[sec_id]['attempted'] += 1
                neg_lost = float(tq.negative_marks)
                sections_map[sec_id]['score'] -= neg_lost
                negative_marks_lost += neg_lost
                chapters_map[chap_id]['incorrect'] += 1

                if q.difficulty == Question.Difficulty.EASY:
                    marks_lost_easy += float(tq.positive_marks) + neg_lost
            else:
                time_on_skipped += time_spent
                sections_map[sec_id]['skipped'] += 1
                chapters_map[chap_id]['skipped'] += 1

                if q.difficulty == Question.Difficulty.EASY:
                    unattempted_easy_count += 1
                    marks_lost_easy += float(tq.positive_marks)

            if log.selected_answer and time_spent < 10:
                guess_count += 1

            if time_spent > (2 * ideal_time_per_q):
                questions_over_2x_ideal.append({
                    'id': str(q.id),
                    'question_text': q.question_text[:80] + '...',
                    'time_spent': time_spent,
                    'ideal_time': ideal_time_per_q,
                    'is_correct': log.is_correct,
                })
        else:
            time_on_skipped += 0
            sections_map[sec_id]['skipped'] += 1
            chapters_map[chap_id]['skipped'] += 1
            if q.difficulty == Question.Difficulty.EASY:
                unattempted_easy_count += 1
                marks_lost_easy += float(tq.positive_marks)

    # Finalize sections data list
    sections_data = []
    for s in sections_map.values():
        att_cnt = s['attempted']
        s_acc = round((s['correct'] / att_cnt * 100), 1) if att_cnt > 0 else 0.0
        s_rate = round((att_cnt / s['total_questions'] * 100), 1) if s['total_questions'] > 0 else 0.0
        s['accuracy'] = s_acc
        s['attempt_rate'] = s_rate
        s['score'] = round(s['score'], 2)
        sections_data.append(s)

    # Finalize chapters data list
    chapters_data = []
    for c in chapters_map.values():
        total = c['total_questions']
        corr = c['correct']
        c_acc = round((corr / total * 100), 1) if total > 0 else 0.0
        avg_t = round((c['time_spent'] / total), 1) if total > 0 else 0.0

        if c_acc >= 70.0:
            tag = 'Strong'
        elif c_acc >= 40.0:
            tag = 'Average'
        else:
            tag = 'Weak'

        chapters_data.append({
            'id': c['id'],
            'name': c['name'],
            'subject_name': c['subject_name'],
            'total_questions': total,
            'correct': corr,
            'incorrect': c['incorrect'],
            'skipped': c['skipped'],
            'accuracy': c_acc,
            'avg_time_seconds': avg_t,
            'tag': tag,
        })

    # Sort chapters: weakest first (ascending accuracy)
    chapters_data.sort(key=lambda x: (x['accuracy'], -x['incorrect']))

    # Pacing analysis (first-half vs second-half of total duration)
    half_time = total_duration_seconds / 2
    actual_spent = attempt.time_taken_seconds
    pacing_assessment = 'Balanced'
    if actual_spent > half_time * 1.5:
        pacing_assessment = 'Pacing is slow; risk of time pressure'
    elif actual_spent < half_time * 0.5:
        pacing_assessment = 'Rushed through test; verify careless mistakes'

    # Score distribution histogram (6 buckets)
    bucket_step = max_marks / 6.0 if max_marks > 0 else 50.0
    distribution = []
    student_bucket_idx = -1
    for b_idx in range(6):
        b_min = round(b_idx * bucket_step)
        b_max = round((b_idx + 1) * bucket_step)
        count_in_bucket = sum(
            1 for a in all_submitted
            if (b_min <= float(a.score) <= b_max if b_idx == 5 else b_min <= float(a.score) < b_max)
        )
        is_user_here = (b_min <= score <= b_max if b_idx == 5 else b_min <= score < b_max)
        if is_user_here:
            student_bucket_idx = b_idx
        distribution.append({
            'range': f"{b_min}-{b_max}",
            'count': count_in_bucket,
            'is_student_bucket': is_user_here,
        })

    # Recommendations: collect study resources for top weak chapters
    recommendations = []
    weak_chaps = [c for c in chapters_data if c['tag'] == 'Weak'][:5]
    for wc in weak_chaps:
        chap_obj = Chapter.objects.filter(id=wc['id']).first()
        if not chap_obj:
            continue

        lectures = [
            {'id': str(l['id']), 'title': l['title'], 'order': l['order']}
            for l in Lecture.objects.filter(chapter=chap_obj, is_published=True).values('id', 'title', 'order')[:3]
        ]
        dpps = [
            {'id': str(d['id']), 'title': d['title'], 'dpp_number': d['dpp_number']}
            for d in DPP.objects.filter(chapter=chap_obj, is_published=True).values('id', 'title', 'dpp_number')[:3]
        ]
        materials = [
            {'id': str(m['id']), 'title': m['title'], 'material_type': m['material_type']}
            for m in StudyMaterial.objects.filter(chapter=chap_obj).values('id', 'title', 'material_type')[:3]
        ]

        recommendations.append({
            'chapter_id': wc['id'],
            'chapter_name': wc['name'],
            'subject_name': wc['subject_name'],
            'accuracy': wc['accuracy'],
            'lectures': lectures,
            'dpps': dpps,
            'materials': materials,
        })

    # Potential marks calculations
    potential_no_negatives = round(score + negative_marks_lost, 2)
    potential_easy_solved = round(potential_no_negatives + (unattempted_easy_count * 4.0), 2)

    # Assemble snapshots
    overview_data = {
        'score': score,
        'total_marks': max_marks,
        'percentage': score_percentage,
        'rank': attempt.rank,
        'total_participants': total_participants,
        'percentile': float(attempt.percentile) if attempt.percentile is not None else None,
        'has_enough_attempts': total_participants >= 2,
        'accuracy': accuracy,
        'attempted_count': correct_count + incorrect_count,
        'correct_count': correct_count,
        'incorrect_count': incorrect_count,
        'skipped_count': unattempted_count,
        'negative_marks_lost': round(negative_marks_lost, 2),
        'time_taken_seconds': attempt.time_taken_seconds,
        'total_duration_seconds': total_duration_seconds,
        'cutoff_score': float(test.cutoff_score),
        'is_cleared_cutoff': score >= float(test.cutoff_score) if test.cutoff_score > 0 else True,
        'topper_score': float(topper.score) if topper else score,
        'average_score': avg_score,
        'topper_time_taken': topper.time_taken_seconds if topper else attempt.time_taken_seconds,
        'average_time_taken': avg_time,
    }

    time_data = {
        'total_time_spent': attempt.time_taken_seconds,
        'total_duration': total_duration_seconds,
        'ideal_time_per_question': ideal_time_per_q,
        'average_time_per_question': round(attempt.time_taken_seconds / max(1, (correct_count + incorrect_count)), 1),
        'time_on_correct': time_on_correct,
        'time_on_wrong': time_on_wrong,
        'time_on_skipped': time_on_skipped,
        'time_wasted_total': time_on_wrong + time_on_skipped,
        'questions_over_2x_ideal': questions_over_2x_ideal,
        'pacing_assessment': pacing_assessment,
    }

    strategy_data = {
        'guess_count': guess_count,
        'unattempted_easy_count': unattempted_easy_count,
        'marked_for_review_count': sum(1 for l in logs if l.status in ['MARKED_REVIEW', 'ANSWERED_AND_MARKED']),
        'total_answer_changes': sum(l.answer_change_count for l in logs),
    }

    marks_data = {
        'actual_score': score,
        'negative_marks_lost': round(negative_marks_lost, 2),
        'marks_lost_easy': round(marks_lost_easy, 2),
        'potential_no_negatives': potential_no_negatives,
        'potential_easy_solved': potential_easy_solved,
        'efficiency_ratio': round((score / potential_easy_solved * 100), 1) if potential_easy_solved > 0 else 0.0,
    }

    comparison_data = {
        'student': {
            'score': score,
            'accuracy': accuracy,
            'time_taken': attempt.time_taken_seconds,
        },
        'topper': {
            'score': float(topper.score) if topper else score,
            'accuracy': float(topper.accuracy_percentage) if topper else accuracy,
            'time_taken': topper.time_taken_seconds if topper else attempt.time_taken_seconds,
        },
        'average': {
            'score': avg_score,
            'accuracy': round(float(sum(float(a.accuracy_percentage) for a in all_submitted) / total_participants), 1) if total_participants > 0 else accuracy,
            'time_taken': avg_time,
        },
        'sections_comparison': [
            {
                'name': s['name'],
                'student_score': s['score'],
                'max_marks': s['max_marks'],
                'student_accuracy': s['accuracy'],
            }
            for s in sections_data
        ]
    }

    # Save or update snapshot
    analysis, _ = TestAttemptAnalysis.objects.update_or_create(
        attempt=attempt,
        defaults={
            'overview_data': overview_data,
            'sections_data': sections_data,
            'chapters_data': chapters_data,
            'time_data': time_data,
            'strategy_data': strategy_data,
            'marks_data': marks_data,
            'comparison_data': comparison_data,
            'recommendations_data': recommendations,
            'score_distribution': distribution,
        }
    )

    return analysis
