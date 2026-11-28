import logging
import traceback
from django.db import DatabaseError
from django.db.models import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """
    Custom exception handler for Django REST Framework.
    - Handles ProtectedError and RestrictedError: returns HTTP 409 Conflict with details on blocking objects.
    - Handles DatabaseError: logs traceback and returns error detail to staff/admin users.
    - Captures other unhandled exceptions and formats a clean response.
    """
    response = drf_exception_handler(exc, context)

    request = context.get('request') if context else None
    user = getattr(request, 'user', None) if request else None
    is_admin = bool(
        user and user.is_authenticated and (
            getattr(user, 'is_staff', False) or
            getattr(user, 'is_superuser', False) or
            getattr(user, 'role', None) in ['ADMIN', 'SUPERADMIN']
        )
    )

    if isinstance(exc, (ProtectedError, RestrictedError)):
        protected_objects = list(getattr(exc, 'protected_objects', []))
        blocking_models = sorted(list(set(
            type(obj)._meta.verbose_name.title() for obj in protected_objects
        ))) if protected_objects else []
        count = len(protected_objects) if protected_objects else 1
        model_names = ", ".join(blocking_models) or "related"
        detail = (
            f"Cannot delete this record because it is referenced by {count} {model_names} record(s). "
            f"Please remove or reassign them first, or unpublish/archive this item."
        )
        return Response(
            {
                'detail': detail,
                'blocking_models': blocking_models,
                'count': count,
            },
            status=status.HTTP_409_CONFLICT
        )

    if isinstance(exc, DatabaseError):
        logger.error("DatabaseError in API request: %s\n%s", exc, traceback.format_exc())
        detail = f"{type(exc).__name__}: {str(exc)}" if is_admin else "A database error occurred while processing your request."
        return Response({'detail': detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if response is None and isinstance(exc, Exception):
        logger.error("Unhandled API exception: %s\n%s", exc, traceback.format_exc())
        detail = f"{type(exc).__name__}: {str(exc)}" if is_admin else "An unexpected server error occurred."
        return Response({'detail': detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response
