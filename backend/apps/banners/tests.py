import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User
from .models import BannerSlide
from .services import process_and_upload_banner_image

def create_test_image(format='PNG', size=(400, 300), color=(255, 0, 0)) -> SimpleUploadedFile:
    file_io = io.BytesIO()
    img = Image.new('RGB', size, color=color)
    img.save(file_io, format=format)
    file_io.seek(0)
    ext = format.lower()
    return SimpleUploadedFile(f"test_image.{ext}", file_io.getvalue(), content_type=f"image/{ext}")


class BannerBackendUnitTests(APITestCase):
    def setUp(self):
        # Create student user
        self.student = User.objects.create_user(
            email='student@example.com',
            username='student_test',
            password='testpassword123',
            role='STUDENT',
            is_verified=True,
            is_staff=False,
            is_superuser=False
        )
        # Create admin user
        self.admin = User.objects.create_user(
            email='admin@example.com',
            username='admin_test',
            password='testpassword123',
            role='ADMIN',
            is_verified=True,
            is_staff=True,
            is_superuser=True
        )

    def test_upload_validation_valid_formats(self):
        """Verifies JPG, PNG, and WebP valid uploads resize and convert to WebP."""
        for fmt in ['JPEG', 'PNG', 'WEBP']:
            img_file = create_test_image(format=fmt, size=(1800, 1000))
            url, key = process_and_upload_banner_image(img_file)
            self.assertTrue(key.startswith('images/banners/'))
            self.assertTrue(key.endswith('.webp'))
            self.assertTrue(len(url) > 0)

    def test_upload_validation_rejects_invalid_file(self):
        """Rejects non-image files."""
        fake_file = SimpleUploadedFile("fake.txt", b"this is not an image", content_type="text/plain")
        with self.assertRaises(Exception):
            process_and_upload_banner_image(fake_file)

    def test_upload_validation_rejects_oversized_file(self):
        """Rejects files larger than 5 MB."""
        large_bytes = b"0" * (6 * 1024 * 1024)  # 6 MB
        oversized_file = SimpleUploadedFile("large.png", large_bytes, content_type="image/png")
        with self.assertRaises(Exception):
            process_and_upload_banner_image(oversized_file)

    def test_slide_limit_ten_active_per_placement(self):
        """Rejects creating more than 10 active slides for homepage placement."""
        # Create 10 active homepage slides
        for i in range(10):
            BannerSlide.objects.create(
                image=f"https://example.com/slide_{i}.webp",
                image_key=f"images/banners/slide_{i}.webp",
                title=f"Slide {i}",
                placement=BannerSlide.Placement.HOME,
                duration_seconds=5,
                order=i,
                is_active=True
            )

        # 11th active slide on HOME must fail validation
        with self.assertRaises(DjangoValidationError):
            BannerSlide.objects.create(
                image="https://example.com/slide_11.webp",
                image_key="images/banners/slide_11.webp",
                title="Slide 11",
                placement=BannerSlide.Placement.HOME,
                duration_seconds=5,
                order=11,
                is_active=True
            )

        # 11th slide should succeed if is_active=False
        inactive_slide = BannerSlide.objects.create(
            image="https://example.com/slide_inactive.webp",
            image_key="images/banners/slide_inactive.webp",
            title="Inactive Slide",
            placement=BannerSlide.Placement.HOME,
            duration_seconds=5,
            order=12,
            is_active=False
        )
        self.assertFalse(inactive_slide.is_active)

    def test_admin_only_permissions(self):
        """Verifies anonymous and students cannot access admin endpoints."""
        # Anonymous POST
        resp = self.client.post('/api/banners/manage/', {'title': 'Hack'})
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Student POST
        self.client.force_authenticate(user=self.student)
        resp = self.client.post('/api/banners/manage/', {'title': 'Hack'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # Admin POST with valid image file
        self.client.force_authenticate(user=self.admin)
        img_file = create_test_image('PNG')
        resp = self.client.post(
            '/api/banners/manage/',
            {
                'image_file': img_file,
                'title': 'Admin Banner',
                'duration_seconds': 6,
                'placement': 'home',
                'order': 0,
                'is_active': True,
                'alt_text': 'Hero Banner'
            },
            format='multipart'
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['title'], 'Admin Banner')
        self.assertEqual(resp.data['duration_seconds'], 6)

    def test_public_endpoint_returns_only_active_slides_ordered(self):
        """Verifies GET /api/banners/?placement=home returns only active slides ordered by order."""
        # Create slides
        BannerSlide.objects.create(
            image="https://example.com/s2.webp",
            title="Slide 2",
            placement=BannerSlide.Placement.HOME,
            duration_seconds=7,
            order=2,
            is_active=True
        )
        BannerSlide.objects.create(
            image="https://example.com/s1.webp",
            title="Slide 1",
            placement=BannerSlide.Placement.HOME,
            duration_seconds=4,
            order=1,
            is_active=True
        )
        BannerSlide.objects.create(
            image="https://example.com/s_hidden.webp",
            title="Hidden Slide",
            placement=BannerSlide.Placement.HOME,
            duration_seconds=5,
            order=0,
            is_active=False
        )
        BannerSlide.objects.create(
            image="https://example.com/s_login.webp",
            title="Login Slide",
            placement=BannerSlide.Placement.LOGIN,
            duration_seconds=5,
            order=0,
            is_active=True
        )

        resp = self.client.get('/api/banners/?placement=home')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        titles = [s['title'] for s in resp.data]

        # Only active slides for home (ordered by order: 1, then 2)
        self.assertEqual(titles, ["Slide 1", "Slide 2"])
        self.assertNotIn("Hidden Slide", titles)
        self.assertNotIn("Login Slide", titles)
