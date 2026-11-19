from typing import Optional
from .r2 import R2StorageClient

class StorageService:
    """
    High-level Storage Service abstraction for AdeptEduverse application.
    Encapsulates cloud file path conventions (/videos/, /thumbnails/, /materials/, /images/)
    and abstracts the underlying storage provider (Cloudflare R2).
    """

    PREFIX_VIDEOS = "videos/"
    PREFIX_THUMBNAILS = "thumbnails/"
    PREFIX_MATERIALS = "materials/"
    PREFIX_IMAGES = "images/"

    def __init__(self, provider: Optional[R2StorageClient] = None):
        self.provider = provider or R2StorageClient()

    def get_secure_video_url(self, file_key: str, expiration_seconds: int = 3600) -> Optional[str]:
        """Generates a secure presigned URL for private video playback."""
        full_key = file_key if file_key.startswith(self.PREFIX_VIDEOS) else f"{self.PREFIX_VIDEOS}{file_key}"
        return self.provider.generate_presigned_url(full_key, expiration=expiration_seconds)

    def get_material_download_url(self, file_key: str, expiration_seconds: int = 1800) -> Optional[str]:
        """Generates a secure presigned URL for downloading PDF study materials."""
        full_key = file_key if file_key.startswith(self.PREFIX_MATERIALS) else f"{self.PREFIX_MATERIALS}{file_key}"
        return self.provider.generate_presigned_url(full_key, expiration=expiration_seconds)

    def get_upload_presigned_url(self, category: str, filename: str, expiration_seconds: int = 900) -> Optional[str]:
        """Generates a presigned URL allowing the frontend/admin to upload media directly to R2."""
        category_map = {
            'video': self.PREFIX_VIDEOS,
            'thumbnail': self.PREFIX_THUMBNAILS,
            'material': self.PREFIX_MATERIALS,
            'image': self.PREFIX_IMAGES,
        }
        prefix = category_map.get(category, f"{category}/")
        object_key = f"{prefix}{filename}"
        return self.provider.generate_presigned_url(object_key, expiration=expiration_seconds, client_method='put_object')

    def initiate_multipart_upload(self, category: str, filename: str, content_type: str = 'video/mp4') -> tuple[Optional[str], str]:
        """Initiates multipart upload for large video files directly on R2."""
        prefix = "originals/" if category == 'originals' else (self.PREFIX_VIDEOS if category == 'video' else f"{category}/")
        object_key = f"{prefix}{filename}"
        upload_id = self.provider.create_multipart_upload(object_key, content_type=content_type)
        return upload_id, object_key

    def get_multipart_part_presigned_url(self, object_key: str, upload_id: str, part_number: int, expiration_seconds: int = 3600) -> Optional[str]:
        """Generates a presigned URL for uploading a specific part chunk in a multipart upload."""
        return self.provider.generate_presigned_part_url(object_key, upload_id, part_number, expiration=expiration_seconds)

    def complete_multipart_upload(self, object_key: str, upload_id: str, parts: list) -> Optional[dict]:
        """Completes the multipart upload assembly on Cloudflare R2."""
        return self.provider.complete_multipart_upload(object_key, upload_id, parts)

    def abort_multipart_upload(self, object_key: str, upload_id: str) -> bool:
        """Aborts and cancels the multipart upload, purging uploaded parts."""
        return self.provider.abort_multipart_upload(object_key, upload_id)

    def download_file(self, object_key: str, local_dest: str) -> bool:
        """Downloads an object from R2 to local filesystem."""
        return self.provider.download_file(object_key, local_dest)

    def upload_file_direct(self, local_src: str, object_key: str, content_type: Optional[str] = None) -> bool:
        """Uploads a local file to R2."""
        return self.provider.upload_file_direct(local_src, object_key, content_type=content_type)

    def delete_object(self, object_key: str) -> bool:
        """Deletes a file object from R2."""
        return self.provider.delete_object(object_key)

    def delete_prefix(self, prefix: str) -> int:
        """Deletes all files within a directory prefix in R2."""
        return self.provider.delete_prefix(prefix)

# Singleton instance for easy import across backend apps
storage_service = StorageService()
