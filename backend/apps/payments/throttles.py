from rest_framework.throttling import SimpleRateThrottle
from apps.books.services import get_client_ip


class CheckoutRateThrottle(SimpleRateThrottle):
    """
    Keys checkout limit by user ID when authenticated (IP for guests),
    ensuring shared institutional, school, or mobile carrier IPs are not falsely blocked.
    """
    scope = 'checkout'
    rate = '20/minute'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user_{request.user.pk}"
        else:
            ident = f"ip_{get_client_ip(request) or self.get_ident(request)}"
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}
