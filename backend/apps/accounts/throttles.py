import hashlib
import logging
from rest_framework.throttling import SimpleRateThrottle

logger = logging.getLogger(__name__)


class LoginFailedIdentifierRateThrottle(SimpleRateThrottle):
    """
    Throttles repeated login failures for a specific identifier (email, username, or phone).
    Enforces a strict threshold (default 5 failures per 15 minutes) to protect against
    credential stuffing and brute force attacks on targeted accounts.

    Only failed login attempts are recorded. Successful logins or checks do not count
    toward the limit and do not reveal account existence.
    """
    scope = 'login_failed_identifier'

    def get_rate(self):
        rate = super().get_rate()
        return rate if rate is not None else '5/15min'

    def parse_rate(self, rate):
        """
        Parses rate strings including multi-digit periods (e.g. '5/15min', '5/15m', '5/900s').
        """
        if rate is None:
            return (None, None)
        num, period = rate.split('/')
        num_requests = int(num)
        period = period.strip().lower()
        if period.endswith('min') and period[:-3].isdigit():
            duration = int(period[:-3]) * 60
        elif period.endswith('m') and period[:-1].isdigit():
            duration = int(period[:-1]) * 60
        elif period.endswith('s') and period[:-1].isdigit():
            duration = int(period[:-1])
        elif period.endswith('h') and period[:-1].isdigit():
            duration = int(period[:-1]) * 3600
        else:
            duration = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}[period[0]]
        return (num_requests, duration)

    def get_identifier(self, request):
        data = getattr(request, 'data', {}) or {}
        raw = data.get('identifier') or data.get('email') or ''
        return str(raw).strip().lower()

    def get_cache_key(self, request, view):
        identifier = self.get_identifier(request)
        if not identifier:
            return None
        ident_hash = hashlib.sha256(identifier.encode('utf-8')).hexdigest()
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident_hash
        }

    def allow_request(self, request, view):
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        self.history = self.cache.get(self.key, [])
        self.now = self.timer()

        # Evict timestamps older than the throttle duration
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()

        if len(self.history) >= self.num_requests:
            return self.throttle_failure()

        # Save reference on request so view can record failure if login fails
        request._login_identifier_throttle = self
        return True

    def record_failure(self):
        if not self.key:
            return
        self.now = self.timer()
        self.history = self.cache.get(self.key, [])
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        self.history.insert(0, self.now)
        self.cache.set(self.key, self.history, self.duration)

    def clear_failures(self):
        if self.key:
            self.cache.delete(self.key)

    @classmethod
    def record_login_failure(cls, request):
        throttle = getattr(request, '_login_identifier_throttle', None)
        if throttle and throttle.key:
            throttle.record_failure()
        else:
            inst = cls()
            inst.key = inst.get_cache_key(request, None)
            if inst.key:
                inst.record_failure()

    @classmethod
    def clear_login_failures(cls, request):
        throttle = getattr(request, '_login_identifier_throttle', None)
        if throttle and throttle.key:
            throttle.clear_failures()
        else:
            inst = cls()
            inst.key = inst.get_cache_key(request, None)
            if inst.key:
                inst.clear_failures()


class AdminLoginThrottle(LoginFailedIdentifierRateThrottle):
    """
    Dedicated rate limit & lockout for administrator login attempts.
    Limits repeated login attempts to 5 attempts per 15 minutes per IP.
    """
    scope = 'admin_login'

    def get_rate(self):
        rate = super().get_rate()
        return rate if rate is not None else '5/15min'

    def get_cache_key(self, request, view):
        portal = (getattr(request, 'data', {}) or {}).get('portal', '')
        if str(portal).lower() != 'admin':
            return None
        ident = self.get_ident(request)
        ident_hash = hashlib.sha256(ident.encode('utf-8')).hexdigest()
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident_hash
        }

