import json
import logging
import asyncio
from asgiref.sync import async_to_sync
from django.conf import settings
from django.utils import timezone
import livekit.api as lk
from livekit.protocol.models import TrackSource, ParticipantPermission
from livekit.protocol.room import (
    RoomParticipantIdentity,
    UpdateParticipantRequest,
    DeleteRoomRequest,
    MuteRoomTrackRequest,
    ListParticipantsRequest
)
from livekit.protocol import egress

logger = logging.getLogger(__name__)


def get_livekit_credentials():
    url = getattr(settings, 'LIVEKIT_URL', 'wss://livekit.local.demo')
    api_key = getattr(settings, 'LIVEKIT_API_KEY', 'devkey')
    api_secret = getattr(settings, 'LIVEKIT_API_SECRET', 'secret_32_characters_minimum_length_key_for_security!')
    return url, api_key, api_secret


def generate_livekit_token(user, live_class, is_teacher=False):
    """
    Generates a cryptographically signed, short-lived LiveKit AccessToken.
    Enforces role-based publish permissions at the server level:
    - Teacher: CAMERA, MICROPHONE, SCREEN_SHARE, SCREEN_SHARE_AUDIO, roomAdmin=True
    - Student: MICROPHONE ONLY, roomAdmin=False. Camera and screen share are impossible.
    """
    url, api_key, api_secret = get_livekit_credentials()

    identity = f"teacher_{user.id}" if is_teacher else f"student_{user.id}"
    name = user.get_full_name() or user.email

    token = lk.AccessToken(api_key, api_secret)
    token.with_identity(identity)
    token.with_name(name)

    metadata = {
        'user_id': str(user.id),
        'email': user.email,
        'role': 'TEACHER' if is_teacher else 'STUDENT',
        'name': name,
        'is_mic_allowed': True if is_teacher else (live_class.student_mic_policy == 'OPEN')
    }
    token.with_metadata(json.dumps(metadata))

    if is_teacher:
        grants = lk.VideoGrants(
            room_join=True,
            room=live_class.room_name,
            room_admin=True,
            can_publish=True,
            can_subscribe=True,
            can_publish_sources=[
                TrackSource.CAMERA,
                TrackSource.MICROPHONE,
                TrackSource.SCREEN_SHARE,
                TrackSource.SCREEN_SHARE_AUDIO,
            ]
        )
    else:
        # Student: canPublishSources = [MICROPHONE] ONLY
        grants = lk.VideoGrants(
            room_join=True,
            room=live_class.room_name,
            room_admin=False,
            can_publish=True,
            can_subscribe=True,
            can_publish_sources=[TrackSource.MICROPHONE]
        )

    token.with_grants(grants)
    jwt_str = token.to_jwt()

    return {
        'token': jwt_str,
        'server_url': url,
        'room_name': live_class.room_name,
        'identity': identity,
        'role': 'TEACHER' if is_teacher else 'STUDENT',
        'is_teacher': is_teacher
    }


class LiveKitManager:
    """
    Manages live room operations: muting, participant removal, mic permission toggling,
    and room termination using LiveKit Server APIs.
    """
    @staticmethod
    def _get_api_client():
        url, api_key, api_secret = get_livekit_credentials()
        # Convert wss:// to https:// or ws:// to http:// for HTTP Twirp APIs
        http_url = url.replace('wss://', 'https://').replace('ws://', 'http://')
        return lk.LiveKitAPI(http_url, api_key, api_secret)

    @classmethod
    def allow_student_mic(cls, room_name, student_identity):
        """Allows a student participant to publish microphone audio."""
        async def _exec():
            api = cls._get_api_client()
            try:
                perm = ParticipantPermission(
                    can_publish=True,
                    can_publish_sources=[TrackSource.MICROPHONE],
                    can_subscribe=True
                )
                req = UpdateParticipantRequest(
                    room=room_name,
                    identity=student_identity,
                    permission=perm
                )
                await api.room.update_participant(req)
                logger.info(f"Allowed mic for {student_identity} in {room_name}")
                return True
            except Exception as e:
                logger.warning(f"LiveKit allow_student_mic failed (offline or error): {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def deny_student_mic(cls, room_name, student_identity):
        """Revokes microphone publishing permission for a student."""
        async def _exec():
            api = cls._get_api_client()
            try:
                perm = ParticipantPermission(
                    can_publish=False,
                    can_publish_sources=[],
                    can_subscribe=True
                )
                req = UpdateParticipantRequest(
                    room=room_name,
                    identity=student_identity,
                    permission=perm
                )
                await api.room.update_participant(req)
                logger.info(f"Revoked mic for {student_identity} in {room_name}")
                return True
            except Exception as e:
                logger.warning(f"LiveKit deny_student_mic failed: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def mute_participant(cls, room_name, identity, track_sid=None):
        """Mutes a participant's published track or revokes publish permission."""
        async def _exec():
            api = cls._get_api_client()
            try:
                if track_sid:
                    req = MuteRoomTrackRequest(
                        room=room_name,
                        identity=identity,
                        track_sid=track_sid,
                        muted=True
                    )
                    await api.room.mute_published_track(req)
                else:
                    perm = ParticipantPermission(can_publish=False, can_publish_sources=[])
                    req = UpdateParticipantRequest(room=room_name, identity=identity, permission=perm)
                    await api.room.update_participant(req)
                return True
            except Exception as e:
                logger.warning(f"LiveKit mute_participant failed: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def mute_all_students(cls, room_name):
        """Mutes all student participants in the room."""
        async def _exec():
            api = cls._get_api_client()
            try:
                res = await api.room.list_participants(ListParticipantsRequest(room=room_name))
                for p in res.participants:
                    if p.identity.startswith('student_'):
                        perm = ParticipantPermission(can_publish=False, can_publish_sources=[])
                        await api.room.update_participant(
                            UpdateParticipantRequest(room=room_name, identity=p.identity, permission=perm)
                        )
                return True
            except Exception as e:
                logger.warning(f"LiveKit mute_all_students failed: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def remove_participant(cls, room_name, identity):
        """Disconnects and removes a participant from the room."""
        async def _exec():
            api = cls._get_api_client()
            try:
                req = RoomParticipantIdentity(room=room_name, identity=identity)
                await api.room.remove_participant(req)
                logger.info(f"Removed participant {identity} from {room_name}")
                return True
            except Exception as e:
                logger.warning(f"LiveKit remove_participant failed: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def end_room(cls, room_name):
        """Ends the room on LiveKit server and disconnects all participants."""
        async def _exec():
            api = cls._get_api_client()
            try:
                req = DeleteRoomRequest(room=room_name)
                await api.room.delete_room(req)
                logger.info(f"Deleted room {room_name} on LiveKit")
                return True
            except Exception as e:
                logger.warning(f"LiveKit end_room failed: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def start_room_egress(cls, room_name, filepath=None):
        """
        Initiates a server-side RoomCompositeEgress recording in LiveKit Cloud
        that outputs an MP4 file directly into the configured Cloudflare R2 bucket.
        Returns the egress_id string or None if unconfigured/failed.
        """
        async def _exec():
            api = cls._get_api_client()
            try:
                r2_endpoint = getattr(settings, 'R2_ENDPOINT', '')
                r2_access_key = getattr(settings, 'R2_ACCESS_KEY_ID', '')
                r2_secret = getattr(settings, 'R2_SECRET_ACCESS_KEY', '')
                r2_bucket = getattr(settings, 'R2_BUCKET_NAME', 'adepteduverse-storage')

                if not (r2_endpoint and r2_access_key and r2_secret):
                    logger.warning(f"R2 credentials not set; skipping live class egress for {room_name}.")
                    return None

                if not filepath:
                    ts = int(timezone.now().timestamp())
                    filepath = f"recordings/{room_name}_{ts}.mp4"

                s3_upload = egress.S3Upload(
                    endpoint=r2_endpoint,
                    access_key=r2_access_key,
                    secret=r2_secret,
                    bucket=r2_bucket,
                    region='auto',
                    force_path_style=True
                )

                file_output = egress.EncodedFileOutput(
                    file_type=egress.EncodedFileType.MP4,
                    filepath=filepath,
                    s3=s3_upload
                )

                req = egress.RoomCompositeEgressRequest(
                    room_name=room_name,
                    file=file_output
                )

                res = await api.egress.start_room_composite_egress(req)
                egress_id = getattr(res, 'egress_id', str(res))
                logger.info(f"Started room egress for {room_name}: egress_id={egress_id}")
                return egress_id
            except Exception as e:
                logger.error(f"LiveKit start_room_egress error: {e}")
                return None
            finally:
                await api.aclose()

        return async_to_sync(_exec)()

    @classmethod
    def stop_room_egress(cls, egress_id):
        """
        Stops an active LiveKit room composite egress recording.
        """
        async def _exec():
            api = cls._get_api_client()
            try:
                req = egress.StopEgressRequest(egress_id=egress_id)
                res = await api.egress.stop_egress(req)
                logger.info(f"Stopped room egress: {egress_id}")
                return True
            except Exception as e:
                logger.error(f"LiveKit stop_room_egress error: {e}")
                return False
            finally:
                await api.aclose()

        return async_to_sync(_exec)()


def verify_livekit_webhook(body_str, auth_header):
    """
    Verifies LiveKit webhook cryptographic signature and parses the event.
    Returns lk.WebhookEvent or raises Exception.
    """
    _, api_key, api_secret = get_livekit_credentials()
    verifier = lk.TokenVerifier(api_key, api_secret)
    receiver = lk.WebhookReceiver(verifier)
    return receiver.receive(body_str, auth_header)
