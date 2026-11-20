import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('adepteduverse')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Periodic Celery Beat Schedule
app.conf.beat_schedule = {
    'reap-stuck-video-jobs-every-15-mins': {
        'task': 'apps.content.tasks.reap_stuck_video_processing_jobs',
        'schedule': 900.0,
    },
    'clean-orphan-video-uploads-daily': {
        'task': 'apps.content.tasks.cleanup_orphan_uploads',
        'schedule': 86400.0,
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
