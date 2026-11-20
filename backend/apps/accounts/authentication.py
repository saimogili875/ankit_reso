from rest_framework.authentication import SessionAuthentication

class Session401Authentication(SessionAuthentication):
    """
    Session authentication that returns 401 Unauthorized instead of 403 Forbidden
    when an unauthenticated request attempts to access a protected view.
    By providing an authenticate_header, DRF attaches WWW-Authenticate: Session
    and correctly sets status_code = 401.
    """
    def authenticate_header(self, request):
        return 'Session'
