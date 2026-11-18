import logging
from celery import shared_task
from .models import TestAttempt
from .analysis import compute_test_attempt_analysis

logger = logging.getLogger(__name__)


@shared_task
def compute_test_attempt_analysis_task(attempt_id):
    """
    Asynchronous Celery task to compute full 8-dimensional test performance analysis,
    percentile calculations, score distribution, and cohort statistics without
    blocking the student's submission HTTP response thread.
    """
    try:
        attempt = TestAttempt.objects.select_related('test', 'user').get(id=attempt_id)
        logger.info(f"Starting async analysis computation for TestAttempt {attempt_id}")
        analysis = compute_test_attempt_analysis(attempt)
        logger.info(f"Finished async analysis computation for TestAttempt {attempt_id} (score: {attempt.score})")
        return f"Analysis complete for attempt {attempt_id}"
    except TestAttempt.DoesNotExist:
        logger.error(f"TestAttempt {attempt_id} does not exist for async analysis.")
        return f"Attempt {attempt_id} not found."
    except Exception as e:
        logger.exception(f"Error computing async analysis for TestAttempt {attempt_id}: {e}")
        raise
