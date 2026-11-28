import io
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient
from PIL import Image

from apps.accounts.models import User
from apps.books.models import BookProduct
from apps.academics.models import Course, Exam, AcademicClass
from apps.banners.models import BannerSlide
from apps.content.models import HeroSlide
from apps.core.exceptions import R2StorageNotConfiguredError
from apps.books.services import (
    process_and_upload_book_cover,
    upload_book_pdf_private,
    get_book_download_url,
)
from apps.academics.services import process_and_upload_course_image
from apps.banners.services import process_and_upload_banner_image
from storage.service import storage_service


def _create_sample_image(format='PNG'):
    buf = io.BytesIO()
    img = Image.new('RGB', (100, 100), color=(255, 0, 0))
    img.save(buf, format=format)
    return SimpleUploadedFile(f"test_image.{format.lower()}", buf.getvalue(), content_type=f"image/{format.lower()}")


class R2StorageSafetyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin_storage@example.com',
            username='admin_storage',
            password='Password123!',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.student = User.objects.create_user(
            email='student_storage@example.com',
            username='student_storage',
            password='Password123!',
            role=User.Role.STUDENT,
        )
        self.academic_class = AcademicClass.objects.create(name='Class 10', slug='class-10', code='class10')
        self.course = Course.objects.create(
            title='Sample Course',
            slug='sample-course',
            academic_class=self.academic_class,
            price=999,
        )
        self.book = BookProduct.objects.create(
            title='Sample Book',
            slug='sample-book',
            digital_price=299,
            hardcopy_price=399,
            pdf_key='books/pdfs/sample_secret.pdf',
        )

    # --------------------------------------------------------------------------
    # 1. PRODUCTION BEHAVIOR WITH R2 MISSING (DEBUG=False)
    # --------------------------------------------------------------------------

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
        R2_PUBLIC_URL='',
        R2_PUBLIC_BUCKET_NAME='',
    )
    def test_production_upload_cover_raises_503_when_r2_missing(self):
        """In production (DEBUG=False), missing R2 configuration raises R2StorageNotConfiguredError."""
        image_file = _create_sample_image('PNG')
        with self.assertRaises(R2StorageNotConfiguredError):
            process_and_upload_book_cover(image_file, filename_hint='test-book')

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
        R2_PUBLIC_URL='',
        R2_PUBLIC_BUCKET_NAME='',
    )
    def test_production_upload_pdf_raises_503_when_r2_missing(self):
        """In production (DEBUG=False), uploading private PDF without R2 raises R2StorageNotConfiguredError."""
        fake_pdf = SimpleUploadedFile("sample.pdf", b"%PDF-1.4 test content", content_type="application/pdf")
        with self.assertRaises(R2StorageNotConfiguredError):
            upload_book_pdf_private(fake_pdf, "sample.pdf")

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
        R2_PUBLIC_URL='',
        R2_PUBLIC_BUCKET_NAME='',
    )
    def test_production_course_image_raises_503_when_r2_missing(self):
        """In production (DEBUG=False), course image upload without R2 raises R2StorageNotConfiguredError."""
        image_file = _create_sample_image('PNG')
        with self.assertRaises(R2StorageNotConfiguredError):
            process_and_upload_course_image(image_file, filename_hint='test-course')

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
        R2_PUBLIC_URL='',
        R2_PUBLIC_BUCKET_NAME='',
    )
    def test_production_banner_image_raises_503_when_r2_missing(self):
        """In production (DEBUG=False), banner image upload without R2 raises R2StorageNotConfiguredError."""
        image_file = _create_sample_image('PNG')
        with self.assertRaises(R2StorageNotConfiguredError):
            process_and_upload_banner_image(image_file, filename_hint='test-banner')

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
        R2_PUBLIC_URL='',
        R2_PUBLIC_BUCKET_NAME='',
    )
    def test_admin_endpoints_return_503_with_clear_error_message(self):
        """Admin endpoints return 503 'File storage (R2) is not configured. Add the R2_* environment variables.'"""
        self.client.force_authenticate(user=self.admin)
        image_file = _create_sample_image('PNG')

        # Test book upload-cover endpoint
        res_cover = self.client.post(
            f'/api/admin/books/products/{self.book.id}/upload-cover/',
            {'cover': image_file},
            format='multipart'
        )
        self.assertEqual(res_cover.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        expected_msg = "File storage (R2) is not configured. Add the R2_* environment variables."
        self.assertIn(expected_msg, str(res_cover.data))

        # Test book upload-pdf endpoint
        fake_pdf = SimpleUploadedFile("sample.pdf", b"%PDF-1.4 test content", content_type="application/pdf")
        res_pdf = self.client.post(
            f'/api/admin/books/products/{self.book.id}/upload-pdf/',
            {'pdf': fake_pdf},
            format='multipart'
        )
        self.assertEqual(res_pdf.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn(expected_msg, str(res_pdf.data))

        # Test course upload-image endpoint
        image_file_2 = _create_sample_image('PNG')
        res_course = self.client.post(
            f'/api/admin/courses/{self.course.id}/upload-image/',
            {'image': image_file_2},
            format='multipart'
        )
        self.assertEqual(res_course.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn(expected_msg, str(res_course.data))

    @override_settings(
        DEBUG=False,
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
    )
    def test_production_pdf_download_does_not_use_local_media(self):
        """In production (DEBUG=False), get_book_download_url returns None if R2 fails (no local disk fallback)."""
        url = get_book_download_url(self.book.pdf_key)
        self.assertIsNone(url)

    # --------------------------------------------------------------------------
    # 2. SUCCESSFUL UPLOADS & PUBLIC URL BUILDING WITH MOCKED BOTO3
    # --------------------------------------------------------------------------

    @override_settings(
        DEBUG=False,
        R2_ACCOUNT_ID='mock_account_123',
        R2_ACCESS_KEY_ID='mock_access_key',
        R2_SECRET_ACCESS_KEY='mock_secret_key',
        R2_ENDPOINT='https://mock.r2.cloudflarestorage.com',
        R2_BUCKET_NAME='adepteduverse-private-storage',
        R2_PUBLIC_BUCKET_NAME='adepteduverse-public-assets',
        R2_PUBLIC_URL='https://cdn.adepteduverse.com',
    )
    @patch('boto3.client')
    def test_successful_public_image_upload_and_permanent_url(self, mock_boto_client):
        """
        Public images upload to R2_PUBLIC_BUCKET_NAME and return permanent R2_PUBLIC_URL/<key>.
        Never returns or saves a presigned URL.
        """
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        image_file = _create_sample_image('PNG')
        image_url, object_key = process_and_upload_book_cover(image_file, filename_hint='algebra')

        self.assertTrue(object_key.startswith('images/books/'))
        self.assertTrue(object_key.endswith('.webp'))
        self.assertEqual(image_url, f"https://cdn.adepteduverse.com/{object_key}")
        self.assertNotIn('X-Amz-Signature', image_url)
        self.assertNotIn('/media/', image_url)

        # Verify upload_file was called with the public bucket
        mock_s3.upload_file.assert_called_once()
        args, kwargs = mock_s3.upload_file.call_args
        # args: (src_path, bucket, key)
        self.assertEqual(args[1], 'adepteduverse-public-assets')
        self.assertEqual(args[2], object_key)
        self.assertEqual(kwargs.get('ExtraArgs', {}).get('ContentType'), 'image/webp')

    @override_settings(
        DEBUG=False,
        R2_ACCOUNT_ID='mock_account_123',
        R2_ACCESS_KEY_ID='mock_access_key',
        R2_SECRET_ACCESS_KEY='mock_secret_key',
        R2_ENDPOINT='https://mock.r2.cloudflarestorage.com',
        R2_BUCKET_NAME='adepteduverse-private-storage',
        R2_PUBLIC_BUCKET_NAME='adepteduverse-public-assets',
        R2_PUBLIC_URL='https://cdn.adepteduverse.com',
    )
    @patch('boto3.client')
    def test_successful_private_pdf_upload(self, mock_boto_client):
        """Private PDFs upload strictly to R2_BUCKET_NAME (private bucket)."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3

        fake_pdf = SimpleUploadedFile("Calculus_Volume_1.pdf", b"%PDF-1.4 sample content", content_type="application/pdf")
        key = upload_book_pdf_private(fake_pdf, "Calculus_Volume_1.pdf")

        self.assertIsNotNone(key)
        self.assertTrue(key.startswith('books/pdfs/'))
        self.assertIn('Calculus_Volume_1.pdf', key)

        # Verify upload_file was called with the private bucket
        mock_s3.upload_file.assert_called_once()
        args, kwargs = mock_s3.upload_file.call_args
        self.assertEqual(args[1], 'adepteduverse-private-storage')
        self.assertEqual(args[2], key)
        self.assertEqual(kwargs.get('ExtraArgs', {}).get('ContentType'), 'application/pdf')

    # --------------------------------------------------------------------------
    # 3. SHORT-LIVED PRESIGNED DOWNLOAD LINKS FOR PRIVATE PDFS
    # --------------------------------------------------------------------------

    @override_settings(
        R2_ACCOUNT_ID='mock_account_123',
        R2_ACCESS_KEY_ID='mock_access_key',
        R2_SECRET_ACCESS_KEY='mock_secret_key',
        R2_ENDPOINT='https://mock.r2.cloudflarestorage.com',
        R2_BUCKET_NAME='adepteduverse-private-storage',
    )
    @patch('boto3.client')
    def test_presigned_download_url_generation(self, mock_boto_client):
        """Serving private PDF uses short-lived presigned URL (10 minutes = 600s) on private bucket."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.generate_presigned_url.return_value = (
            "https://mock.r2.cloudflarestorage.com/adepteduverse-private-storage/books/pdfs/sample.pdf?X-Amz-Signature=test123"
        )

        presigned_url = get_book_download_url("books/pdfs/sample.pdf", expiration_seconds=600)
        self.assertIsNotNone(presigned_url)
        self.assertIn('X-Amz-Signature=test123', presigned_url)

        mock_s3.generate_presigned_url.assert_called_once_with(
            ClientMethod='get_object',
            Params={'Bucket': 'adepteduverse-private-storage', 'Key': 'books/pdfs/sample.pdf'},
            ExpiresIn=600
        )

    # --------------------------------------------------------------------------
    # 4. STORAGE STATUS API (GET /api/admin-panel/storage-status/)
    # --------------------------------------------------------------------------

    def test_storage_status_requires_admin(self):
        """Storage status endpoint requires authentication and admin privileges."""
        res_anon = self.client.get('/api/admin-panel/storage-status/')
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(user=self.student)
        res_student = self.client.get('/api/admin-panel/storage-status/')
        self.assertEqual(res_student.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(
        R2_ACCESS_KEY_ID='',
        R2_SECRET_ACCESS_KEY='',
        R2_ENDPOINT='',
    )
    def test_storage_status_reports_unhealthy_when_unconfigured(self):
        """Storage status reports credentials_set=False and all_healthy=False when unconfigured."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/storage-status/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['credentials_set'])
        self.assertFalse(res.data['all_healthy'])
        self.assertIn("File storage (R2) is not configured", res.data['message'])

    @override_settings(
        R2_ACCOUNT_ID='mock_account_123',
        R2_ACCESS_KEY_ID='mock_access_key',
        R2_SECRET_ACCESS_KEY='mock_secret_key',
        R2_ENDPOINT='https://mock.r2.cloudflarestorage.com',
        R2_BUCKET_NAME='adepteduverse-private',
        R2_PUBLIC_BUCKET_NAME='adepteduverse-public',
        R2_PUBLIC_URL='https://cdn.adepteduverse.com',
    )
    @patch('boto3.client')
    def test_storage_status_reports_healthy_when_buckets_reachable(self, mock_boto_client):
        """Storage status reports all_healthy=True when both buckets respond to head_bucket."""
        mock_s3 = MagicMock()
        mock_boto_client.return_value = mock_s3
        mock_s3.head_bucket.return_value = {}

        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin/storage-status/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['credentials_set'])
        self.assertTrue(res.data['private_bucket']['reachable'])
        self.assertTrue(res.data['public_bucket']['reachable'])
        self.assertTrue(res.data['all_healthy'])

    # --------------------------------------------------------------------------
    # 5. AUDIT MANAGEMENT COMMAND
    # --------------------------------------------------------------------------

    def test_audit_storage_urls_detects_expiring_and_local_urls(self):
        """Management command correctly identifies items with X-Amz-Signature or /media/."""
        # Create books, course, and banner with problematic URLs
        bad_book = BookProduct.objects.create(
            title='Bad Book',
            slug='bad-book',
            digital_price=100,
            hardcopy_price=200,
            cover_image='https://r2.cloudflarestorage.com/cover.webp?X-Amz-Signature=expired_sig_123',
        )
        bad_course = Course.objects.create(
            title='Bad Course',
            slug='bad-course',
            academic_class=self.academic_class,
            price=500,
            image='/media/courses/local_course.webp',
        )
        bad_banner = BannerSlide.objects.create(
            title='Bad Banner',
            image='https://r2.cloudflarestorage.com/banner.webp?X-Amz-Signature=banner_sig_456',
        )

        out = io.StringIO()
        call_command('audit_storage_urls', stdout=out)
        output = out.getvalue()

        self.assertIn('STORAGE URL AUDIT REPORT', output)
        self.assertIn('Bad Book', output)
        self.assertIn('Bad Course', output)
        self.assertIn('Bad Banner', output)
        self.assertIn('X-Amz-Signature', output)
        self.assertIn('/media/', output)

        # Also test --json option
        out_json = io.StringIO()
        call_command('audit_storage_urls', json=True, stdout=out_json)
        json_output = out_json.getvalue()
        self.assertIn('Bad Book', json_output)
        self.assertIn('cover_image', json_output)
