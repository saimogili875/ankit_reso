from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class BooksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.books'
    verbose_name = 'Books & Publications'

    def ready(self):
        from django.conf import settings
        frontend_url = getattr(settings, 'FRONTEND_URL', '') or ''
        is_prod = not getattr(settings, 'DEBUG', True) or getattr(settings, 'ENVIRONMENT', '') == 'production'
        if is_prod and 'vercel.app' in frontend_url.lower():
            logger.warning(
                "STARTUP WARNING: FRONTEND_URL '%s' contains 'vercel.app' in production. "
                "Customer emails and download links should use the canonical domain (e.g. https://adepteduverse.com).",
                frontend_url
            )
