import time
import logging
import requests
import jwt
from jwt.algorithms import RSAAlgorithm
from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication, SessionAuthentication, get_authorization_header
from rest_framework import exceptions

from apps.accounts.models import User, StudentProfile

logger = logging.getLogger(__name__)

JWKS_CACHE_KEY = 'clerk_jwks_cache_key'
JWKS_CACHE_TIMEOUT = 3600  # 1 hour


class Session401Authentication(SessionAuthentication):
    """
    Session authentication that returns 401 Unauthorized instead of 403 Forbidden
    when an unauthenticated request attempts to access a protected view.
    By providing an authenticate_header, DRF attaches WWW-Authenticate: Session
    and correctly sets status_code = 401.
    """
    def authenticate_header(self, request):
        return 'Session'


class ClerkJWTAuthentication(BaseAuthentication):
    """
    Verifies Clerk Session JWT (RS256) passed via Authorization: Bearer <token>.
    Matches or auto-provisions a Django student account (role=STUDENT).
    Enforces role isolation: Admin/Staff accounts attempting Clerk login receive 403 'Use Admin login'.
    """

    def authenticate_header(self, request):
        return 'Bearer realm="Clerk"'

    def get_jwks(self):
        cached = cache.get(JWKS_CACHE_KEY)
        if cached:
            return cached

        jwks_url = getattr(settings, 'CLERK_JWKS_URL', None)
        if not jwks_url:
            issuer = getattr(settings, 'CLERK_ISSUER', 'https://clerk.adepteduverse.com')
            jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"

        try:
            resp = requests.get(jwks_url, timeout=5)
            if resp.status_code == 200:
                jwks = resp.json()
                cache.set(JWKS_CACHE_KEY, jwks, timeout=JWKS_CACHE_TIMEOUT)
                return jwks
        except Exception as e:
            logger.warning("Failed to fetch Clerk JWKS from %s: %s", jwks_url, e)

        return None

    def fetch_user_from_clerk_api(self, clerk_id):
        secret_key = getattr(settings, 'CLERK_SECRET_KEY', None)
        if not secret_key:
            return {}

        url = f"https://api.clerk.com/v1/users/{clerk_id}"
        try:
            resp = requests.get(url, headers={'Authorization': f"Bearer {secret_key}"}, timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.warning("Failed to fetch user %s from Clerk API: %s", clerk_id, e)
        return {}

    @staticmethod
    def _verified_primary_email(clerk_data):
        """Returns the user's primary email only if Clerk reports it as verified."""
        if not clerk_data:
            return ''
        primary_id = clerk_data.get('primary_email_address_id')
        for ea in clerk_data.get('email_addresses') or []:
            if ea.get('id') == primary_id and (ea.get('verification') or {}).get('status') == 'verified':
                return (ea.get('email_address') or '').strip().lower()
        return ''

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth or auth[0].lower() != b'bearer':
            return None

        if len(auth) == 1:
            raise exceptions.AuthenticationFailed('Invalid token header. No credentials provided.')
        elif len(auth) > 2:
            raise exceptions.AuthenticationFailed('Invalid token header. Token string should not contain spaces.')

        raw_token = auth[1].decode('utf-8')

        # Allow test mock token if explicitly injected in testing
        if getattr(settings, 'TESTING', False) and hasattr(request, '_mock_clerk_payload'):
            payload = request._mock_clerk_payload
        else:
            payload = self.verify_token(raw_token)

        clerk_id = payload.get('sub')
        if not clerk_id:
            raise exceptions.AuthenticationFailed('Invalid token: missing subject (sub)')

        # Match or provision Django User
        user = User.objects.filter(clerk_id=clerk_id).first()

        if not user:
            # Never trust an email that Clerk has not verified: linking by an unverified address
            # would let anyone take over an existing student account (enrollments, payments).
            clerk_data = self.fetch_user_from_clerk_api(clerk_id)
            email = self._verified_primary_email(clerk_data)
            username = (clerk_data.get('username') if clerk_data else None) or payload.get('username') or ''
            first_name = (clerk_data.get('first_name') if clerk_data else None) or payload.get('first_name') or ''
            last_name = (clerk_data.get('last_name') if clerk_data else None) or payload.get('last_name') or ''

            if not email:
                raise exceptions.AuthenticationFailed('Could not retrieve a verified email for this Clerk user.')

            existing = User.objects.filter(email__iexact=email).first()
            if existing:
                if existing.clerk_id and existing.clerk_id != clerk_id:
                    raise exceptions.AuthenticationFailed('This email is already linked to a different sign-in.')
                existing.clerk_id = clerk_id
                existing.save(update_fields=['clerk_id'])
                user = existing
            else:
                base_username = username or email.split('@')[0]
                final_username = base_username
                counter = 1
                while User.objects.filter(username__iexact=final_username).exists():
                    final_username = f"{base_username}{counter}"
                    counter += 1

                full_name = f"{first_name} {last_name}".strip() or final_username
                user = User.objects.create_user(
                    username=final_username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    full_name=full_name,
                    role=User.Role.STUDENT,
                    clerk_id=clerk_id,
                    is_email_verified=True,
                    is_verified=True,
                )
                StudentProfile.objects.get_or_create(user=user)

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is disabled. Please contact support.')

        # Role rule: Clerk users are students only.
        is_admin_user = (str(user.role).upper() == User.Role.ADMIN or user.is_superuser or user.is_staff)
        if is_admin_user:
            raise exceptions.PermissionDenied('Use Admin login')

        return (user, payload)

    def verify_token(self, token):
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception as e:
            raise exceptions.AuthenticationFailed(f"Invalid token header: {e}")

        kid = unverified_header.get('kid')
        jwks = self.get_jwks()

        public_key = None
        if jwks and 'keys' in jwks:
            for key_dict in jwks['keys']:
                if key_dict.get('kid') == kid:
                    public_key = RSAAlgorithm.from_jwk(key_dict)
                    break

        if not public_key:
            # Try to fetch fresh JWKS once in case of key rotation
            cache.delete(JWKS_CACHE_KEY)
            jwks = self.get_jwks()
            if jwks and 'keys' in jwks:
                for key_dict in jwks['keys']:
                    if key_dict.get('kid') == kid:
                        public_key = RSAAlgorithm.from_jwk(key_dict)
                        break

        if not public_key:
            raise exceptions.AuthenticationFailed("Unable to verify token: key not found in JWKS.")

        expected_issuer = getattr(settings, 'CLERK_ISSUER', None)
        authorized_parties = getattr(settings, 'CLERK_AUTHORIZED_PARTIES', [])

        decode_options = {
            'verify_signature': True,
            'verify_exp': True,
        }

        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                options=decode_options,
                issuer=expected_issuer if expected_issuer else None,
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Clerk session token has expired.")
        except jwt.InvalidIssuerError:
            raise exceptions.AuthenticationFailed("Clerk session token has invalid issuer.")
        except Exception as e:
            raise exceptions.AuthenticationFailed(f"Invalid Clerk token: {e}")

        if authorized_parties:
            azp = payload.get('azp')
            if azp:
                clean_azp = azp.rstrip('/').lower()
                clean_allowed = {p.rstrip('/').lower() for p in authorized_parties}
                matched = (
                    clean_azp in clean_allowed or
                    clean_azp.replace('https://www.', 'https://') in clean_allowed or
                    clean_azp.replace('https://', 'https://www.') in clean_allowed or
                    clean_azp.endswith('.vercel.app')
                )
                if not matched:
                    logger.warning("Clerk azp mismatch: azp=%s, allowed=%s", azp, authorized_parties)
                    raise exceptions.AuthenticationFailed("Clerk session token authorized party mismatch.")

        return payload
