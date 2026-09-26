import logging
from typing import Optional, Dict, Any
from django.conf import settings
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

class R2StorageClient:
    """
    Low-level Cloudflare R2 client using boto3 S3 compatible interface.
    Handles authentication, bucket interaction, signed URLs, and object metadata.
    """

    def __init__(self):
        self.account_id = getattr(settings, 'R2_ACCOUNT_ID', '')
        self.access_key_id = getattr(settings, 'R2_ACCESS_KEY_ID', '')
        self.secret_access_key = getattr(settings, 'R2_SECRET_ACCESS_KEY', '')
        self.bucket_name = getattr(settings, 'R2_BUCKET_NAME', 'ankit-jee-storage')
        self.endpoint_url = getattr(settings, 'R2_ENDPOINT', '') or (
            f"https://{self.account_id}.r2.cloudflarestorage.com" if self.account_id else ""
        )

    def _get_client(self):
        """Initializes and returns the boto3 S3 client for Cloudflare R2."""
        if not (self.access_key_id and self.secret_access_key and self.endpoint_url):
            logger.warning("R2 storage credentials or endpoint missing in environment configuration.")
            return None

        return boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name='auto'  # R2 requires region_name='auto'
        )

    def generate_presigned_url(
        self, object_key: str, expiration: int = 3600, client_method: str = 'get_object'
    ) -> Optional[str]:
        """Generates a presigned URL for secure, temporary upload or download access."""
        client = self._get_client()
        if not client:
            return None
        try:
            url = client.generate_presigned_url(
                ClientMethod=client_method,
                Params={'Bucket': self.bucket_name, 'Key': object_key},
                ExpiresIn=expiration
            )
            return url
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to generate presigned URL for {object_key}: {e}")
            return None

    def head_object(self, object_key: str) -> Optional[Dict[str, Any]]:
        """Retrieves object metadata from R2 bucket."""
        client = self._get_client()
        if not client:
            return None
        try:
            return client.head_object(Bucket=self.bucket_name, Key=object_key)
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to fetch metadata for object {object_key}: {e}")
            return None
