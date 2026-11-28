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

    def __init__(
        self,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        public_bucket_name: Optional[str] = None,
        public_url: Optional[str] = None,
        endpoint_url: Optional[str] = None,
    ):
        self._account_id = account_id
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._bucket_name = bucket_name
        self._public_bucket_name = public_bucket_name
        self._public_url = public_url
        self._endpoint_url = endpoint_url

    @property
    def account_id(self) -> str:
        return self._account_id if self._account_id is not None else getattr(settings, 'R2_ACCOUNT_ID', '')

    @property
    def access_key_id(self) -> str:
        return self._access_key_id if self._access_key_id is not None else getattr(settings, 'R2_ACCESS_KEY_ID', '')

    @property
    def secret_access_key(self) -> str:
        return self._secret_access_key if self._secret_access_key is not None else getattr(settings, 'R2_SECRET_ACCESS_KEY', '')

    @property
    def bucket_name(self) -> str:
        return self._bucket_name if self._bucket_name is not None else getattr(settings, 'R2_BUCKET_NAME', 'adepteduverse-storage')

    @property
    def public_bucket_name(self) -> str:
        return self._public_bucket_name if self._public_bucket_name is not None else getattr(settings, 'R2_PUBLIC_BUCKET_NAME', '')

    @property
    def public_url(self) -> str:
        raw = self._public_url if self._public_url is not None else getattr(settings, 'R2_PUBLIC_URL', '')
        return (raw or '').rstrip('/')

    @property
    def endpoint_url(self) -> str:
        if self._endpoint_url is not None:
            return self._endpoint_url
        return getattr(settings, 'R2_ENDPOINT', '') or (
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
        self, object_key: str, expiration: int = 3600, client_method: str = 'get_object', bucket: Optional[str] = None
    ) -> Optional[str]:
        """Generates a presigned URL for secure, temporary upload or download access."""
        client = self._get_client()
        if not client:
            return None
        target_bucket = bucket or self.bucket_name
        try:
            url = client.generate_presigned_url(
                ClientMethod=client_method,
                Params={'Bucket': target_bucket, 'Key': object_key},
                ExpiresIn=expiration
            )
            return url
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to generate presigned URL for {object_key} in {target_bucket}: {e}")
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

    def upload_file_direct(
        self,
        local_src_path: str,
        object_key: str,
        content_type: Optional[str] = None,
        bucket: Optional[str] = None
    ) -> bool:
        """Directly uploads a local file to R2 with proper Content-Type headers."""
        client = self._get_client()
        if not client:
            return False
        target_bucket = bucket or self.bucket_name
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            client.upload_file(local_src_path, target_bucket, object_key, ExtraArgs=extra_args if extra_args else None)
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to upload {local_src_path} to R2 bucket '{target_bucket}' ({object_key}): {e}")
            return False

    def upload_public_file(
        self, local_src_path: str, object_key: str, content_type: Optional[str] = None
    ) -> bool:
        """Uploads a public asset to R2_PUBLIC_BUCKET_NAME (falling back to R2_BUCKET_NAME in dev)."""
        target_bucket = (
            getattr(settings, 'R2_PUBLIC_BUCKET_NAME', '') or
            self.public_bucket_name or
            getattr(settings, 'R2_BUCKET_NAME', self.bucket_name)
        )
        return self.upload_file_direct(local_src_path, object_key, content_type=content_type, bucket=target_bucket)

    def get_public_url(self, object_key: str) -> str:
        """
        Builds the permanent public URL: R2_PUBLIC_URL/<object_key>.
        Never uses or returns a presigned URL.
        """
        base = (getattr(settings, 'R2_PUBLIC_URL', '') or self.public_url or '').rstrip('/')
        clean_key = object_key.lstrip('/')
        if base:
            return f"{base}/{clean_key}"
        public_bucket = (
            getattr(settings, 'R2_PUBLIC_BUCKET_NAME', '') or
            self.public_bucket_name or
            getattr(settings, 'R2_BUCKET_NAME', self.bucket_name)
        )
        return f"https://{public_bucket}.r2.cloudflarestorage.com/{clean_key}"

    def normalize_public_url(self, raw_url: Optional[str]) -> str:
        """
        Normalizes internal or fallback R2 S3 API URLs to the permanent public URL
        base (R2_PUBLIC_URL), e.g.:
        https://bucket.r2.cloudflarestorage.com/images/books/x.webp -> https://pub-xxx.r2.dev/images/books/x.webp
        """
        if not raw_url:
            return ""
        url = str(raw_url).strip()
        public_base = (getattr(settings, 'R2_PUBLIC_URL', '') or self.public_url or '').rstrip('/')
        if not public_base:
            return url
        if "r2.cloudflarestorage.com/" in url:
            parts = url.split("r2.cloudflarestorage.com/", 1)
            if len(parts) == 2:
                key = parts[1].lstrip('/')
                # If key begins with the bucket name (e.g. "bucket/images/books/..."), strip it
                for b_name in (
                    getattr(settings, 'R2_PUBLIC_BUCKET_NAME', ''),
                    self.public_bucket_name,
                    getattr(settings, 'R2_BUCKET_NAME', ''),
                    self.bucket_name,
                ):
                    if b_name and key.startswith(f"{b_name}/"):
                        key = key[len(b_name) + 1:]
                        break
                return f"{public_base}/{key}"
        return url

    def delete_object(self, object_key: str, bucket: Optional[str] = None) -> bool:
        """Deletes a single object from R2."""
        client = self._get_client()
        if not client:
            return False
        target_bucket = bucket or self.bucket_name
        try:
            client.delete_object(Bucket=target_bucket, Key=object_key)
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(f"Failed to delete {object_key} from R2 bucket '{target_bucket}': {e}")
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
        status_data = self.get_storage_status()
        return status_data.get('all_healthy', False), status_data.get('message', '')

    def get_storage_status(self) -> dict:
        """
        Reports whether credentials are set and whether both buckets (private & public) are reachable.
        """
        access_key = getattr(settings, 'R2_ACCESS_KEY_ID', self.access_key_id)
        secret_key = getattr(settings, 'R2_SECRET_ACCESS_KEY', self.secret_access_key)
        endpoint = getattr(settings, 'R2_ENDPOINT', self.endpoint_url) or (
            f"https://{getattr(settings, 'R2_ACCOUNT_ID', self.account_id)}.r2.cloudflarestorage.com"
            if getattr(settings, 'R2_ACCOUNT_ID', self.account_id) else ""
        )

        credentials_set = bool(access_key and secret_key and endpoint)
        private_bucket_name = getattr(settings, 'R2_BUCKET_NAME', self.bucket_name)
        public_bucket_name = getattr(settings, 'R2_PUBLIC_BUCKET_NAME', self.public_bucket_name)
        public_url = getattr(settings, 'R2_PUBLIC_URL', self.public_url).rstrip('/')

        private_status = {
            'bucket_name': private_bucket_name,
            'configured': bool(private_bucket_name),
            'reachable': False,
            'error': None
        }

        public_status = {
            'bucket_name': public_bucket_name,
            'configured': bool(public_bucket_name),
            'reachable': False,
            'public_url': public_url,
            'public_url_configured': bool(public_url),
            'error': None
        }

        if not credentials_set:
            err = "R2 credentials or endpoint missing in environment"
            private_status['error'] = err
            public_status['error'] = err
            return {
                'credentials_set': False,
                'private_bucket': private_status,
                'public_bucket': public_status,
                'all_healthy': False,
                'message': "File storage (R2) is not configured. Add the R2_* environment variables."
            }

        client = self._get_client()
        if not client:
            err = "Failed to initialize boto3 S3 client"
            private_status['error'] = err
            public_status['error'] = err
            return {
                'credentials_set': True,
                'private_bucket': private_status,
                'public_bucket': public_status,
                'all_healthy': False,
                'message': "Failed to initialize boto3 S3 client for R2."
            }

        # Check private bucket
        if private_bucket_name:
            try:
                client.head_bucket(Bucket=private_bucket_name)
                private_status['reachable'] = True
            except Exception as e:
                private_status['error'] = str(e)
        else:
            private_status['error'] = "R2_BUCKET_NAME is not set"

        # Check public bucket
        if public_bucket_name:
            try:
                client.head_bucket(Bucket=public_bucket_name)
                public_status['reachable'] = True
            except Exception as e:
                public_status['error'] = str(e)
        else:
            public_status['error'] = "R2_PUBLIC_BUCKET_NAME is not set"

        all_healthy = (
            credentials_set and
            private_status['reachable'] and
            public_status['reachable'] and
            bool(public_url)
        )

        return {
            'credentials_set': credentials_set,
            'private_bucket': private_status,
            'public_bucket': public_status,
            'all_healthy': all_healthy,
            'message': (
                "R2 storage is fully operational."
                if all_healthy else
                "File storage (R2) is not configured or buckets are unreachable. Add or verify the R2_* environment variables."
            )
        }
