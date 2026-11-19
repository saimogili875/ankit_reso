import time
import hmac
import hashlib
import logging
from typing import Optional, Dict, Any
from django.conf import settings
from apps.accounts.models import User
from .models import Video

logger = logging.getLogger(__name__)


def generate_playback_token(video_id: str, user_id: str, expires_in_seconds: int = 21600) -> str:
    """
    Generates a cryptographically signed, short-lived HMAC-SHA256 playback token.
    Token structure: {expires_timestamp}_{user_id}_{signature}
    Default validity: 6 hours (21,600 seconds).
    """
    expires_at = int(time.time()) + expires_in_seconds
    secret = getattr(settings, 'VIDEO_STREAMING_SECRET', settings.SECRET_KEY).encode('utf-8')
    payload = f"{video_id}:{user_id}:{expires_at}".encode('utf-8')
    signature = hmac.new(secret, payload, hashlib.sha256).hexdigest()[:32]
    return f"{expires_at}_{user_id}_{signature}"


def verify_playback_token(token: str, video_id: str) -> bool:
    """
    Server-side verification of playback token (used for testing or fallback).
    """
    try:
        parts = token.split('_')
        if len(parts) != 3:
            return False
        expires_at_str, user_id, provided_sig = parts
        expires_at = int(expires_at_str)

        if time.time() > expires_at:
            return False

        secret = getattr(settings, 'VIDEO_STREAMING_SECRET', settings.SECRET_KEY).encode('utf-8')
        payload = f"{video_id}:{user_id}:{expires_at}".encode('utf-8')
        expected_sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()[:32]

        return hmac.compare_digest(provided_sig, expected_sig)
    except Exception as e:
        logger.warning(f"Playback token verification failed: {e}")
        return False


def build_playback_urls(video: Video, user: User) -> Dict[str, Any]:
    """
    Constructs secure HLS playback URLs, thumbnail WebVTT preview URLs,
    and poster URLs routed through the Cloudflare Worker streaming domain.
    """
    token = generate_playback_token(str(video.id), str(user.id))
    streaming_domain = getattr(settings, 'VIDEO_STREAMING_DOMAIN', '').strip()

    if streaming_domain:
        domain = streaming_domain.replace('https://', '').replace('http://', '').strip('/')
        base_prefix = f"https://{domain}/{token}/videos/{video.id}"
        manifest_url = f"{base_prefix}/master.m3u8"
        vtt_url = f"{base_prefix}/thumbnails.vtt" if video.vtt_key else None
        poster_url = f"{base_prefix}/poster.jpg" if video.poster_key else None
    else:
        # Fallback for dev / direct presigned when streaming domain is not yet configured
        from storage.service import storage_service
        manifest_url = storage_service.get_secure_video_url(video.hls_manifest_key or video.r2_object_key or '')
        vtt_url = storage_service.get_secure_video_url(video.vtt_key) if video.vtt_key else None
        poster_url = storage_service.get_secure_video_url(video.poster_key) if video.poster_key else None

    return {
        'token': token,
        'manifest_url': manifest_url,
        'vtt_url': vtt_url,
        'poster_url': poster_url,
        'expires_in_seconds': 21600,
    }
