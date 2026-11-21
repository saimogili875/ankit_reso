import hmac
import hashlib
import json
import logging
import secrets
from typing import Tuple, Optional
from django.conf import settings
from django.core.cache import cache
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600       # 10 minutes
COOLDOWN_SECONDS = 60       # 60s resend cooldown
HOURLY_LIMIT = 5            # max 5 sends per target per hour
MAX_WRONG_ATTEMPTS = 5      # max 5 wrong attempts then invalidate
TOKEN_MAX_AGE_SECONDS = 900 # 15 minutes validity for signed verification token

class OTPService:
    """
    Cryptographically secure, Redis-backed OTP generation, hashing, rate-limiting,
    and verification service with HMAC-SHA256 and constant-time comparisons.
    """

    @staticmethod
    def _hash_otp(otp: str, target: str, purpose: str) -> str:
        key = str(settings.SECRET_KEY).encode('utf-8')
        msg = f"{purpose}:{target}:{otp}".encode('utf-8')
        return hmac.new(key, msg, hashlib.sha256).hexdigest()

    @staticmethod
    def _otp_key(purpose: str, target: str) -> str:
        return f"otp:{purpose}:{target.strip().lower()}"

    @staticmethod
    def _cooldown_key(purpose: str, target: str) -> str:
        return f"otp_cooldown:{purpose}:{target.strip().lower()}"

    @staticmethod
    def _hourly_key(purpose: str, target: str) -> str:
        return f"otp_rate:{purpose}:{target.strip().lower()}"

    @classmethod
    def can_send(cls, target: str, purpose: str) -> Tuple[bool, str, int]:
        """
        Checks if an OTP can be sent to the target for the given purpose.
        Returns: (can_send, error_message, cooldown_remaining)
        """
        target_norm = target.strip().lower()

        # 1. Check cooldown (60s)
        cooldown_active = cache.get(cls._cooldown_key(purpose, target_norm))
        if cooldown_active is not None:
            return False, f"Please wait before requesting another OTP.", COOLDOWN_SECONDS

        # 2. Check hourly limit (5 per hour)
        hourly_count = cache.get(cls._hourly_key(purpose, target_norm)) or 0
        if hourly_count >= HOURLY_LIMIT:
            return False, "Maximum OTP requests exceeded for this hour. Please try again later.", 0

        return True, "", 0

    @classmethod
    def generate_and_store(cls, target: str, purpose: str) -> str:
        """
        Generates a 6-digit secure OTP, hashes it with HMAC-SHA256,
        stores in Redis with a 10 min TTL, and updates cooldown and rate limiting.
        """
        target_norm = target.strip().lower()
        otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = cls._hash_otp(otp, target_norm, purpose)

        # Store hashed OTP and attempt counter
        data = {
            "hash": otp_hash,
            "attempts": 0,
        }
        cache.set(cls._otp_key(purpose, target_norm), json.dumps(data), timeout=OTP_TTL_SECONDS)

        # Set 60s cooldown
        cache.set(cls._cooldown_key(purpose, target_norm), 1, timeout=COOLDOWN_SECONDS)

        # Increment hourly counter
        hourly_key = cls._hourly_key(purpose, target_norm)
        current_rate = cache.get(hourly_key)
        if current_rate is None:
            cache.set(hourly_key, 1, timeout=3600)
        else:
            try:
                cache.incr(hourly_key)
            except Exception as e:
                logger.warning(f"Cache incr failed on {hourly_key}, resetting count: {e}")
                cache.set(hourly_key, current_rate + 1, timeout=3600)

        return otp

    @classmethod
    def verify_otp(cls, target: str, purpose: str, candidate_otp: str) -> Tuple[bool, str, Optional[str]]:
        """
        Verifies the candidate OTP against the stored HMAC hash using constant-time comparison.
        Returns: (is_valid, message, verification_token)
        """
        target_norm = target.strip().lower()
        candidate = candidate_otp.strip()
        key = cls._otp_key(purpose, target_norm)
        raw_data = cache.get(key)

        if not raw_data:
            return False, "OTP has expired or was not requested. Please request a new code.", None

        try:
            data = json.loads(raw_data)
        except (json.JSONDecodeError, TypeError):
            cache.delete(key)
            return False, "Invalid OTP session. Please request a new code.", None

        stored_hash = data.get("hash", "")
        attempts = data.get("attempts", 0)

        # Compute candidate hash
        candidate_hash = cls._hash_otp(candidate, target_norm, purpose)

        # Constant-time comparison
        if hmac.compare_digest(stored_hash, candidate_hash):
            # Invalidate OTP on successful use
            cache.delete(key)
            # Generate signed verification token
            token = cls.generate_verification_token(target_norm, purpose)
            return True, "Verification successful.", token
        else:
            attempts += 1
            if attempts >= MAX_WRONG_ATTEMPTS:
                cache.delete(key)
                return False, "Too many incorrect attempts. This OTP has been invalidated.", None
            else:
                data["attempts"] = attempts
                cache.set(key, json.dumps(data), timeout=OTP_TTL_SECONDS)
                remaining = MAX_WRONG_ATTEMPTS - attempts
                return False, f"Incorrect OTP. {remaining} attempt(s) remaining.", None

    @classmethod
    def generate_verification_token(cls, target: str, purpose: str) -> str:
        """Generates a short-lived cryptographically signed token proving target verification."""
        signer = TimestampSigner(salt=f"otp-verify-{purpose}")
        payload = f"{target.strip().lower()}:{purpose}"
        return signer.sign(payload)

    @classmethod
    def validate_verification_token(cls, token: str, expected_target: str, expected_purpose: str) -> bool:
        """Validates that a verification token is authentic, unexpired, and matches target and purpose."""
        if not token:
            return False
        signer = TimestampSigner(salt=f"otp-verify-{expected_purpose}")
        try:
            val = signer.unsign(token, max_age=TOKEN_MAX_AGE_SECONDS)
            expected = f"{expected_target.strip().lower()}:{expected_purpose}"
            return hmac.compare_digest(val, expected)
        except (BadSignature, SignatureExpired):
            return False
