import hashlib
from rest_framework.throttling import SimpleRateThrottle
from apps.books.services import get_client_ip, normalize_indian_phone


class BookOrderCreateIPMinThrottle(SimpleRateThrottle):
    """5 orders per minute per IP."""
    scope = 'book_order_create_ip_min'
    rate = '5/min'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        ident = get_client_ip(request)
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class BookOrderCreateIPHourThrottle(SimpleRateThrottle):
    """20 orders per hour per IP."""
    scope = 'book_order_create_ip_hour'
    rate = '20/hour'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        ident = get_client_ip(request)
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class BookOrderCreatePhoneThrottle(SimpleRateThrottle):
    """3 orders per hour per buyer_phone."""
    scope = 'book_order_create_phone'
    rate = '3/hour'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        data = getattr(request, 'data', {}) or {}
        raw_phone = data.get('buyer_phone')
        if not raw_phone:
            return None
        try:
            norm_phone = normalize_indian_phone(str(raw_phone))
        except Exception:
            norm_phone = str(raw_phone).strip()
        ident_hash = hashlib.sha256(norm_phone.encode('utf-8')).hexdigest()
        return self.cache_format % {'scope': self.scope, 'ident': ident_hash}


class BookOrderVerifyIPThrottle(SimpleRateThrottle):
    """20 verification attempts per minute per IP."""
    scope = 'book_order_verify_ip'
    rate = '20/min'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        ident = get_client_ip(request)
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class BookOrderDownloadIPThrottle(SimpleRateThrottle):
    """30 downloads per minute per IP."""
    scope = 'book_order_download_ip'
    rate = '30/min'

    def get_rate(self):
        if hasattr(self, 'THROTTLE_RATES') and self.scope in self.THROTTLE_RATES:
            return self.THROTTLE_RATES[self.scope]
        return self.rate

    def get_cache_key(self, request, view):
        ident = get_client_ip(request)
        if not ident:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}
