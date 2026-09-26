from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend, database, and system status.
    """
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_ok = True
    except Exception:
        db_ok = False

    return Response({
        'status': 'healthy' if db_ok else 'degraded',
        'service': 'ANKIT JEE Backend API',
        'database_connected': db_ok,
        'environment': 'production' if not request.is_secure() else 'development'
    })
