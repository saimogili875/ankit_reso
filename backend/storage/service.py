from typing import Optional
from .r2 import R2StorageClient

class StorageService:
    """
    High-level Storage Service abstraction for ANKIT JEE application.
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

# Singleton instance for easy import across backend apps
storage_service = StorageService()
