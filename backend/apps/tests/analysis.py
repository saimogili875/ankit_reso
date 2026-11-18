import math
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
    AnalysisSettings,
    TestCohortStats,
)
from apps.questions.models import Question, DPP
from apps.academics.models import Chapter, Lecture
from apps.materials.models import StudyMaterial


def recompute_test_ranks_and_percentiles(test: Test):
    """
    Recomputes rank and percentile for all submitted attempts of a test.
    Rank = 1-based index based on score (higher score = better rank, ties resolved by less time).
    Percentile = (students with score < student_score) / total_participants * 100.
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
        rank = sum(1 for other in submitted_attempts if other.score > att.score) + 1
        att.rank = rank

        strictly_lower = sum(1 for other in submitted_attempts if other.score < att.score)
        percentile = round((strictly_lower / total_count) * 100, 2)
        att.percentile = Decimal(str(percentile))
        att.save(update_fields=['rank', 'percentile'])


def compute_test_attempt_analysis(attempt: TestAttempt) -> TestAttemptAnalysis:
    """
    Computes a comprehensive analysis snapshot for a completed TestAttempt
    covering all 9 dimensions of the Personal Tab and saves it to TestAttemptAnalysis.
    """
    test = attempt.test
    settings = AnalysisSettings.get_settings()

    test_questions = list(
        test.test_questions.select_related(
            'question', 'question__chapter', 'question__subject', 'question__topic',
            'section', 'section__subject'
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

    # Question logs lookup
    logs = list(
        QuestionAttemptLog.objects.filter(attempt=attempt).select_related(
            'question', 'question__chapter', 'question__subject', 'question__topic',
            'test_question', 'test_question__section'
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

    # High-level metrics
    score = float(attempt.score)
    max_marks = float(test.total_marks)
    score_percentage = round((score / max_marks * 100), 2) if max_marks > 0 else 0.0
    total_q = len(test_questions)
    total_duration_seconds = test.duration_minutes * 60

    # -------------------------------------------------------------
    # 2. Process each question: Evaluation & Aggregations
    # -------------------------------------------------------------
    sections_map = {}
    chapters_map = {}
    time_journey_slots = {
        '0-30': {'slot': '0 - 30 min', 'correct': 0, 'incorrect': 0, 'overall': 0},
        '30-60': {'slot': '30 - 60 min', 'correct': 0, 'incorrect': 0, 'overall': 0},
        '60-90': {'slot': '60 - 90 min', 'correct': 0, 'incorrect': 0, 'overall': 0},
        '90-120': {'slot': '90 - 120 min', 'correct': 0, 'incorrect': 0, 'overall': 0},
        '120+': {'slot': '120+ min', 'correct': 0, 'incorrect': 0, 'overall': 0},
    }

    # Difficulty breakdown map: subject -> difficulty -> {correct, wrong, skipped, total}
    difficulty_map = {}

    positive_score = 0.0
    negative_marks_lost = 0.0
    time_on_correct = 0
    time_on_wrong = 0
    time_on_skipped = 0

    wasted_count = 0
    overtime_count = 0
    perfect_count = 0
    confused_count = 0

    painful_questions = []
    complete_breakdown = []
    question_journey_boxes = []

    # Map question types for grids
    single_choice_grid = []
    numerical_grid = []

    cumulative_test_time = 0

    for idx, tq in enumerate(test_questions):
        q = tq.question
        q_no = tq.order if tq.order else (idx + 1)
        log = logs_by_q.get(q.id)

        # Subject & Section
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
                'not_attempted': 0,
                'not_visited': 0,
                'score': 0.0,
                'max_marks': 0.0,
                'time_spent': 0,
                'positive_score': 0.0,
                'negative_lost': 0.0,
                'perfect': 0,
                'wasted': 0,
                'overtime': 0,
                'confused': 0,
            }

        sections_map[sec_id]['total_questions'] += 1
        sections_map[sec_id]['max_marks'] += float(tq.positive_marks)

        # Difficulty mapping initialization
        diff_label = q.difficulty or 'MEDIUM'
        if diff_label not in difficulty_map:
            difficulty_map[diff_label] = {}
        if subj_name not in difficulty_map[diff_label]:
            difficulty_map[diff_label][subj_name] = {'correct': 0, 'wrong': 0, 'skipped': 0, 'total': 0}
        difficulty_map[diff_label][subj_name]['total'] += 1

        # Chapter
        chap = q.chapter
        chap_id = str(chap.id) if chap else 'unknown'
        chap_name = chap.name if chap else 'General Topic'
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
                'painful_count': 0,
            }
        chapters_map[chap_id]['total_questions'] += 1

        # Determine Ideal Time for this question
        if q.ideal_time_seconds and q.ideal_time_seconds > 0:
            ideal_time = q.ideal_time_seconds
        else:
            if diff_label == 'EASY':
                ideal_time = settings.easy_ideal_time
            elif diff_label == 'HARD':
                ideal_time = settings.tough_ideal_time
            else:
                ideal_time = settings.moderate_ideal_time

        quick_threshold = ideal_time * (settings.quick_wasted_threshold_percent / 100.0)

        # Evaluate Question
        time_spent = log.time_spent_seconds if log else 0
        is_visited = (log.visit_count > 0 or time_spent > 0 or (log and log.status != QuestionAttemptLog.Status.NOT_VISITED)) if log else False
        is_answered = bool(log and log.selected_answer)
        is_correct = bool(log and log.is_correct)
        status_str = log.status if log else QuestionAttemptLog.Status.NOT_VISITED

        if log:
            sections_map[sec_id]['time_spent'] += time_spent
            chapters_map[chap_id]['time_spent'] += time_spent

        # Evaluation classification
        if is_correct and time_spent <= ideal_time:
            evaluation = QuestionAttemptLog.Evaluation.PERFECT
            sections_map[sec_id]['perfect'] += 1
            perfect_count += 1
        elif (not is_correct) and is_answered and time_spent < quick_threshold:
            evaluation = QuestionAttemptLog.Evaluation.WASTED
            sections_map[sec_id]['wasted'] += 1
            wasted_count += 1
        elif time_spent > ideal_time:
            if not is_answered:
                evaluation = QuestionAttemptLog.Evaluation.CONFUSED
                sections_map[sec_id]['confused'] += 1
                confused_count += 1
            else:
                evaluation = QuestionAttemptLog.Evaluation.OVERTIME
                sections_map[sec_id]['overtime'] += 1
                overtime_count += 1
        else:
            evaluation = QuestionAttemptLog.Evaluation.NORMAL

        if log and log.evaluation != evaluation:
            log.evaluation = evaluation
            log.save(update_fields=['evaluation'])

        # Marking & Score accumulation
        if is_correct:
            time_on_correct += time_spent
            pos_m = float(tq.positive_marks)
            positive_score += pos_m
            sections_map[sec_id]['correct'] += 1
            sections_map[sec_id]['attempted'] += 1
            sections_map[sec_id]['score'] += pos_m
            sections_map[sec_id]['positive_score'] += pos_m
            chapters_map[chap_id]['correct'] += 1
            difficulty_map[diff_label][subj_name]['correct'] += 1
        elif is_answered:
            time_on_wrong += time_spent
            neg_m = float(tq.negative_marks)
            negative_marks_lost += neg_m
            sections_map[sec_id]['incorrect'] += 1
            sections_map[sec_id]['attempted'] += 1
            sections_map[sec_id]['score'] -= neg_m
            sections_map[sec_id]['negative_lost'] += neg_m
            chapters_map[chap_id]['incorrect'] += 1
            difficulty_map[diff_label][subj_name]['wrong'] += 1
        else:
            time_on_skipped += time_spent
            if is_visited:
                sections_map[sec_id]['not_attempted'] += 1
            else:
                sections_map[sec_id]['not_visited'] += 1
            chapters_map[chap_id]['skipped'] += 1
            difficulty_map[diff_label][subj_name]['skipped'] += 1

        # Slot assignment for Time Journey (based on cumulative elapsed exam time or first answer time)
        cumulative_test_time += time_spent
        slot_min = cumulative_test_time / 60.0
        if slot_min <= 30:
            s_key = '0-30'
        elif slot_min <= 60:
            s_key = '30-60'
        elif slot_min <= 90:
            s_key = '60-90'
        elif slot_min <= 120:
            s_key = '90-120'
        else:
            s_key = '120+'

        if is_answered:
            time_journey_slots[s_key]['overall'] += 1
            if is_correct:
                time_journey_slots[s_key]['correct'] += 1
            else:
                time_journey_slots[s_key]['incorrect'] += 1

        # Painful questions: wrong, wasted, overtime, or confused
        if (not is_correct and is_answered) or evaluation in [
            QuestionAttemptLog.Evaluation.WASTED,
            QuestionAttemptLog.Evaluation.OVERTIME,
            QuestionAttemptLog.Evaluation.CONFUSED
        ]:
            chapters_map[chap_id]['painful_count'] += 1
            painful_questions.append({
                'q_no': q_no,
                'question_id': str(q.id),
                'subject': subj_name,
                'topic': q.topic.name if q.topic else (q.chapter.name if q.chapter else 'General'),
                'difficulty': diff_label,
                'time_spent': time_spent,
                'ideal_time': ideal_time,
                'status': 'CORRECT' if is_correct else ('WRONG' if is_answered else 'SKIPPED'),
                'issue': 'Wasted' if evaluation == QuestionAttemptLog.Evaluation.WASTED else (
                    'Overtime' if evaluation == QuestionAttemptLog.Evaluation.OVERTIME else (
                        'Confused' if evaluation == QuestionAttemptLog.Evaluation.CONFUSED else 'Wrong Answer'
                    )
                ),
            })

        # Global cohort stats for this question
        gst = global_q_stats.get(q.id, {'accuracy': 0.0, 'avg_time': 0.0})

        # Breakdown item
        breakdown_item = {
            'q_no': q_no,
            'question_id': str(q.id),
            'subject': subj_name,
            'chapter': chap_name,
            'topic': q.topic.name if q.topic else chap_name,
            'difficulty': diff_label,
            'time_spent_seconds': time_spent,
            'ideal_time_seconds': ideal_time,
            'status': status_str,
            'is_correct': is_correct,
            'is_answered': is_answered,
            'evaluation': evaluation,
            'marks_awarded': float(log.marks_awarded) if log else 0.0,
            'is_bookmarked': log.is_bookmarked if log else False,
            'student_reason_tag': log.student_reason_tag if log else 'NONE',
            'visit_count': log.visit_count if log else 0,
            'selected_answer': log.selected_answer if log else '',
            'cohort_accuracy': gst['accuracy'],
            'cohort_avg_time': gst['avg_time'],
        }
        complete_breakdown.append(breakdown_item)

        # Question Grids (Single Choice vs Numerical)
        grid_entry = {
            'q_no': q_no,
            'question_id': str(q.id),
            'subject': subj_name,
            'is_correct': is_correct,
            'is_answered': is_answered,
            'status': 'CORRECT' if is_correct else ('WRONG' if is_answered else 'SKIPPED'),
        }
        if q.question_type == Question.QuestionType.NUMERICAL:
            numerical_grid.append(grid_entry)
        else:
            single_choice_grid.append(grid_entry)

        # Question Journey Box
        question_journey_boxes.append({
            'q_no': q_no,
            'question_id': str(q.id),
            'subject': subj_name,
            'status': 'CORRECT' if is_correct else ('WRONG' if is_answered else 'SKIPPED'),
            'revisits': log.visit_count if log else 1,
            'has_revisit': (log.visit_count > 1) if log else False,
            'time_spent': time_spent,
        })

    # -------------------------------------------------------------
    # 3. Finalize Sections, Performance Table & Subject Cards
    # -------------------------------------------------------------
    sections_data = []
    subject_cards = []
    test_breakdown_table = []

    total_row = {
        'subject': 'Total',
        'total_score': 0.0,
        'attempted_correct': 0,
        'attempted_wrong': 0,
        'not_attempted': 0,
        'not_visited': 0,
    }

    for s in sections_map.values():
        att_cnt = s['attempted']
        s_acc = round((s['correct'] / att_cnt * 100), 1) if att_cnt > 0 else 0.0
        s_rate = round((att_cnt / s['total_questions'] * 100), 1) if s['total_questions'] > 0 else 0.0
        s_score = round(s['score'], 2)
        s['accuracy'] = s_acc
        s['attempt_rate'] = s_rate
        s['score'] = s_score
        sections_data.append(s)

        # Subject card
        subject_cards.append({
            'subject_name': s['subject_name'],
            'score': s_score,
            'max_marks': s['max_marks'],
            'percentage': round((s_score / s['max_marks'] * 100), 1) if s['max_marks'] > 0 else 0.0,
            'attempted': att_cnt,
            'correct': s['correct'],
            'wrong': s['incorrect'],
            'accuracy': s_acc,
            'time_spent': s['time_spent'],
        })

        # Test breakdown row
        tb_row = {
            'subject': s['subject_name'],
            'total_score': s_score,
            'attempted_correct': s['correct'],
            'attempted_wrong': s['incorrect'],
            'not_attempted': s['not_attempted'],
            'not_visited': s['not_visited'],
        }
        test_breakdown_table.append(tb_row)

        total_row['total_score'] += s_score
        total_row['attempted_correct'] += s['correct']
        total_row['attempted_wrong'] += s['incorrect']
        total_row['not_attempted'] += s['not_attempted']
        total_row['not_visited'] += s['not_visited']

    total_row['total_score'] = round(total_row['total_score'], 2)
    test_breakdown_table.append(total_row)

    # -------------------------------------------------------------
    # 4. Score Potential Calculation
    # Formula: potential = actual + marks recoverable from Wasted & Overtime wrong answers + negative marks lost
    # -------------------------------------------------------------
    recoverable_marks = (wasted_count + overtime_count) * 4.0
    overall_potential = round(score + recoverable_marks + negative_marks_lost, 2)
    overall_potential = min(overall_potential, max_marks)

    score_potential_data = {
        'actual': score,
        'potential': overall_potential,
        'gain': round(overall_potential - score, 2),
        'formula_tooltip': "Potential = Actual Score + Marks recoverable from Wasted & Overtime wrong answers + Negative marks lost",
        'subject_potentials': [
            {
                'subject': s['subject_name'],
                'actual': s['score'],
                'potential': min(s['max_marks'], round(s['score'] + ((s['wasted'] + s['overtime']) * 4.0) + s['negative_lost'], 2)),
                'gain': round(((s['wasted'] + s['overtime']) * 4.0) + s['negative_lost'], 2),
            }
            for s in sections_data
        ]
    }

    # -------------------------------------------------------------
    # 5. Attempt Analysis (Summary Table & Grouped Bar Chart)
    # -------------------------------------------------------------
    attempt_analysis_data = {
        'summary': {
            'perfect': perfect_count,
            'wasted': wasted_count,
            'overtime': overtime_count,
            'confused': confused_count,
        },
        'subject_table': [
            {
                'subject': s['subject_name'],
                'perfect': s['perfect'],
                'wasted': s['wasted'],
                'overtime': s['overtime'],
                'confused': s['confused'],
                'total': s['perfect'] + s['wasted'] + s['overtime'] + s['confused'],
            }
            for s in sections_data
        ]
    }

    # -------------------------------------------------------------
    # 6. Time Analysis (Breakdown, Quality of Time, Time Journey)
    # -------------------------------------------------------------
    time_analysis_data = {
        'total_time_spent': attempt.time_taken_seconds,
        'total_duration': total_duration_seconds,
        'time_breakdown': [
            {
                'subject': s['subject_name'],
                'time_spent': s['time_spent'],
                'attempted': s['attempted'],
                'total_questions': s['total_questions'],
                'accuracy': s['accuracy'],
            }
            for s in sections_data
        ],
        'quality_of_time': {
            'time_on_correct': time_on_correct,
            'time_on_incorrect': time_on_wrong,
            'time_on_unattempted': time_on_skipped,
            'total_time': attempt.time_taken_seconds,
        },
        'time_journey': list(time_journey_slots.values()),
    }

    # -------------------------------------------------------------
    # 7. Difficulty Analysis
    # -------------------------------------------------------------
    difficulty_analysis_data = {
        'by_subject': [],
        'overall': [],
    }
    for diff in ['EASY', 'MEDIUM', 'HARD']:
        diff_display = 'Easy' if diff == 'EASY' else ('Moderate' if diff == 'MEDIUM' else 'Tough')
        diff_subjects = difficulty_map.get(diff, {})
        tot_c = sum(v['correct'] for v in diff_subjects.values())
        tot_w = sum(v['wrong'] for v in diff_subjects.values())
        tot_s = sum(v['skipped'] for v in diff_subjects.values())
        tot_q = sum(v['total'] for v in diff_subjects.values())

        difficulty_analysis_data['overall'].append({
            'difficulty': diff_display,
            'correct': tot_c,
            'wrong': tot_w,
            'skipped': tot_s,
            'total': tot_q,
        })

        for s_name, counts in diff_subjects.items():
            difficulty_analysis_data['by_subject'].append({
                'difficulty': diff_display,
                'subject': s_name,
                'correct': counts['correct'],
                'wrong': counts['wrong'],
                'skipped': counts['skipped'],
                'total': counts['total'],
            })

    # -------------------------------------------------------------
    # 8. Chapters & Recommendations
    # -------------------------------------------------------------
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
            'painful_count': c['painful_count'],
            'tag': tag,
        })

    # Sort chapters: weakest first (ascending accuracy, highest painful count)
    chapters_data.sort(key=lambda x: (x['accuracy'], -x['painful_count']))

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
            'painful_count': wc['painful_count'],
            'lectures': lectures,
            'dpps': dpps,
            'materials': materials,
        })

    # -------------------------------------------------------------
    # 9. Score Distribution Histogram (6 buckets)
    # -------------------------------------------------------------
    bucket_step = max_marks / 6.0 if max_marks > 0 else 50.0
    distribution = []
    for b_idx in range(6):
        b_min = round(b_idx * bucket_step)
        b_max = round((b_idx + 1) * bucket_step)
        count_in_bucket = sum(
            1 for a in all_submitted
            if (b_min <= float(a.score) <= b_max if b_idx == 5 else b_min <= float(a.score) < b_max)
        )
        is_user_here = (b_min <= score <= b_max if b_idx == 5 else b_min <= score < b_max)
        distribution.append({
            'range': f"{b_min}-{b_max}",
            'count': count_in_bucket,
            'is_student_bucket': is_user_here,
        })

    # -------------------------------------------------------------
    # 10. Assemble Overview Data (Personal Tab 1)
    # -------------------------------------------------------------
    overview_data = {
        'score': score,
        'total_marks': max_marks,
        'percentage': score_percentage,
        'subject_cards': subject_cards,
        'rank': attempt.rank,
        'total_participants': total_participants,
        'percentile': float(attempt.percentile) if attempt.percentile is not None else None,
        'qs_attempted': attempt.correct_count + attempt.incorrect_count,
        'total_questions': total_q,
        'accuracy': float(attempt.accuracy_percentage),
        'positive_score': positive_score,
        'negative_lost': round(negative_marks_lost, 2),
        'time_taken_seconds': attempt.time_taken_seconds,
        'total_duration_seconds': total_duration_seconds,
        'cutoff_score': float(test.cutoff_score),
        'is_cleared_cutoff': score >= float(test.cutoff_score) if test.cutoff_score > 0 else True,
        'notes': attempt.notes or [],
        'topper_score': float(topper.score) if topper else score,
        'average_score': avg_score,
    }

    # -------------------------------------------------------------
    # 11. Save or Update TestAttemptAnalysis Snapshot
    # -------------------------------------------------------------
    analysis, _ = TestAttemptAnalysis.objects.update_or_create(
        attempt=attempt,
        defaults={
            'overview_data': overview_data,
            'sections_data': {
                'sections': sections_data,
                'test_breakdown': test_breakdown_table,
            },
            'chapters_data': chapters_data,
            'time_data': time_analysis_data,
            'strategy_data': attempt_analysis_data,
            'marks_data': score_potential_data,
            'comparison_data': {
                'difficulty_analysis': difficulty_analysis_data,
                'question_journey': question_journey_boxes,
                'single_choice_grid': single_choice_grid,
                'numerical_grid': numerical_grid,
                'painful_questions': painful_questions,
            },
            'recommendations_data': recommendations,
            'score_distribution': distribution,
        }
    )

    return analysis


def compute_test_cohort_comparison(test: Test, current_attempt: TestAttempt) -> dict:
    """
    Computes the Comparative Tab analytics across the 4 cohort rows:
    You, Top 10%ile, Top 25%ile, and Average.
    Caches result in TestCohortStats.
    """
    settings = AnalysisSettings.get_settings()
    submitted = list(
        TestAttempt.objects.filter(
            test=test,
            status__in=[TestAttempt.Status.SUBMITTED, TestAttempt.Status.AUTO_SUBMITTED]
        ).order_by('-score', 'time_taken_seconds')
    )

    total_count = len(submitted)
    if total_count < settings.comparative_min_attempts:
        return {
            'has_enough_cohort_data': False,
            'current_attempts': total_count,
            'min_required': settings.comparative_min_attempts,
            'message': f"Not enough attempts yet (minimum {settings.comparative_min_attempts} attempts needed for cohort comparison). Current attempts: {total_count}."
        }

    # Slices for Top 10% and Top 25%
    top_10_count = max(1, math.ceil(total_count * 0.10))
    top_25_count = max(1, math.ceil(total_count * 0.25))

    top_10_attempts = submitted[:top_10_count]
    top_25_attempts = submitted[:top_25_count]

    # Pre-fetch analyses snapshots
    analyses_map = {
        ana.attempt_id: ana for ana in TestAttemptAnalysis.objects.filter(attempt__test=test)
    }

    # Helper function to compute cohort row averages
    def aggregate_cohort(name: str, cohort_attempts: list):
        if not cohort_attempts:
            return None
        c_count = len(cohort_attempts)
        avg_score = round(sum(float(a.score) for a in cohort_attempts) / c_count, 1)
        avg_acc = round(sum(float(a.accuracy_percentage) for a in cohort_attempts) / c_count, 1)
        avg_time = round(sum(a.time_taken_seconds for a in cohort_attempts) / c_count, 1)
        avg_qs = round(sum(a.correct_count + a.incorrect_count for a in cohort_attempts) / c_count, 1)

        # Subject-level scores & accuracy
        subjects = ['Physics', 'Chemistry', 'Mathematics']
        subj_data = {}
        for s in subjects:
            subj_data[s] = {'score': 0.0, 'accuracy': 0.0, 'time': 0.0, 'count': 0}

        # Attempt classifications
        att_classes = {'perfect': 0.0, 'wasted': 0.0, 'overtime': 0.0, 'confused': 0.0}

        for a in cohort_attempts:
            ana = analyses_map.get(a.id)
            if not ana:
                continue
            ov = ana.overview_data or {}
            for sc in ov.get('subject_cards', []):
                sname = sc.get('subject_name')
                if sname in subj_data:
                    subj_data[sname]['score'] += sc.get('score', 0)
                    subj_data[sname]['accuracy'] += sc.get('accuracy', 0)
                    subj_data[sname]['time'] += sc.get('time_spent', 0)
                    subj_data[sname]['count'] += 1

            strat = ana.strategy_data or {}
            summ = strat.get('summary', {})
            att_classes['perfect'] += summ.get('perfect', 0)
            att_classes['wasted'] += summ.get('wasted', 0)
            att_classes['overtime'] += summ.get('overtime', 0)
            att_classes['confused'] += summ.get('confused', 0)

        # Average out
        final_subj = {}
        for s, vals in subj_data.items():
            cnt = max(1, vals['count'])
            final_subj[s] = {
                'score': round(vals['score'] / cnt, 1),
                'accuracy': round(vals['accuracy'] / cnt, 1),
                'time': round(vals['time'] / cnt, 1),
            }

        return {
            'label': name,
            'score': avg_score,
            'accuracy': avg_acc,
            'time_taken': avg_time,
            'attempted_qs': avg_qs,
            'subjects': final_subj,
            'attempt_classification': {
                'perfect': round(att_classes['perfect'] / c_count, 1),
                'wasted': round(att_classes['wasted'] / c_count, 1),
                'overtime': round(att_classes['overtime'] / c_count, 1),
                'confused': round(att_classes['confused'] / c_count, 1),
            }
        }

    cohort_you = aggregate_cohort('You', [current_attempt])
    cohort_top10 = aggregate_cohort('Top 10%ile', top_10_attempts)
    cohort_top25 = aggregate_cohort('Top 25%ile', top_25_attempts)
    cohort_avg = aggregate_cohort('Average', submitted)

    cohort_data = {
        'has_enough_cohort_data': True,
        'total_participants': total_count,
        'rows': [cohort_you, cohort_top10, cohort_top25, cohort_avg],
    }

    # Cache in TestCohortStats
    TestCohortStats.objects.update_or_create(
        test=test,
        defaults={
            'total_attempts': total_count,
            'cached_data': cohort_data,
        }
    )

    return cohort_data
