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
        self.bucket_name = getattr(settings, 'R2_BUCKET_NAME', 'adepteduverse-storage')
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

    def create_multipart_upload(self, object_key: str, content_type: str = 'video/mp4') -> Optional[str]:
        """Initiates an S3 multipart upload for large files on Cloudflare R2."""
        client = self._get_client()
        if not client:
            return None
        try:
            res = client.create_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                ContentType=content_type
            )
            return res.get('UploadId')
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to initiate multipart upload for {object_key}: {e}")
            return None

    def generate_presigned_part_url(
        self, object_key: str, upload_id: str, part_number: int, expiration: int = 3600
    ) -> Optional[str]:
        """Generates a presigned URL allowing the frontend to upload a single chunk/part directly to R2."""
        client = self._get_client()
        if not client:
            return None
        try:
            url = client.generate_presigned_url(
                ClientMethod='upload_part',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_key,
                    'UploadId': upload_id,
                    'PartNumber': part_number
                },
                ExpiresIn=expiration
            )
            return url
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to generate part upload presigned URL (part #{part_number}): {e}")
            return None

    def complete_multipart_upload(self, object_key: str, upload_id: str, parts: list) -> Optional[Dict[str, Any]]:
        """
        Completes the multipart upload by assembling uploaded parts on R2.
        parts is expected to be a list of {'PartNumber': int, 'ETag': str}.
        """
        client = self._get_client()
        if not client:
            return None
        try:
            # S3/R2 requires parts to be strictly sorted by PartNumber
            sorted_parts = sorted(parts, key=lambda p: int(p.get('PartNumber', 0)))
            res = client.complete_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                UploadId=upload_id,
                MultipartUpload={'Parts': sorted_parts}
            )
            return res
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to complete multipart upload for {object_key}: {e}")
            return None

    def abort_multipart_upload(self, object_key: str, upload_id: str) -> bool:
        """Aborts an in-progress multipart upload and purges uploaded parts."""
        client = self._get_client()
        if not client:
            return False
        try:
            client.abort_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                UploadId=upload_id
            )
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to abort multipart upload for {object_key}: {e}")
            return False

    def download_file(self, object_key: str, local_dest_path: str) -> bool:
        """Downloads an object from R2 to a local destination file path."""
        client = self._get_client()
        if not client:
            return False
        try:
            client.download_file(self.bucket_name, object_key, local_dest_path)
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to download {object_key} from R2 to {local_dest_path}: {e}")
            return False

    def upload_file_direct(self, local_src_path: str, object_key: str, content_type: Optional[str] = None) -> bool:
        """Directly uploads a local file to R2 with proper Content-Type headers."""
        client = self._get_client()
        if not client:
            return False
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            client.upload_file(local_src_path, self.bucket_name, object_key, ExtraArgs=extra_args if extra_args else None)
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to upload {local_src_path} to R2 ({object_key}): {e}")
            return False

    def delete_object(self, object_key: str) -> bool:
        """Deletes a single object from R2."""
        client = self._get_client()
        if not client:
            return False
        try:
            client.delete_object(Bucket=self.bucket_name, Key=object_key)
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to delete {object_key} from R2: {e}")
            return False

    def delete_prefix(self, prefix: str) -> int:
        """Deletes all objects with a given key prefix (e.g., 'videos/{id}/')."""
        client = self._get_client()
        if not client:
            return 0
        try:
            paginator = client.get_paginator('list_objects_v2')
            count = 0
            for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
                objects = [{'Key': obj['Key']} for obj in page.get('Contents', [])]
                if objects:
                    client.delete_objects(Bucket=self.bucket_name, Delete={'Objects': objects})
                    count += len(objects)
            return count
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to delete prefix {prefix} from R2: {e}")
            return 0

    def check_connection(self) -> tuple[bool, str]:
        """
        Tests connectivity to Cloudflare R2 bucket.
        Returns (is_connected: bool, status_message: str).
        """
        if not (self.access_key_id and self.secret_access_key and self.endpoint_url):
            return False, "R2 credentials or endpoint not configured in environment"
        client = self._get_client()
        if not client:
            return False, "Failed to initialize boto3 S3 client"
        try:
            client.head_bucket(Bucket=self.bucket_name)
            return True, f"Connected to bucket '{self.bucket_name}'"
        except (BotoCoreError, ClientError) as e:
            return False, f"R2 bucket connection error: {e}"
