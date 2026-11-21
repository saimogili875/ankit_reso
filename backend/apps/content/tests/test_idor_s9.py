from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.content.models import Notification

User = get_user_model()

class NotificationIDORSecurityTests(TestCase):
    """
    Audit Finding S9:
    Verify that an authenticated student cannot mark another user's notifications as read (IDOR prevention).
    """

    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()

        self.user_a = User.objects.create_user(
            email='alice@adepteduverse.com',
            username='alice',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )
        self.user_b = User.objects.create_user(
            email='bob@adepteduverse.com',
            username='bob',
            password='TestPassword123!',
            role=User.Role.STUDENT,
        )

        self.client_a.force_authenticate(user=self.user_a)
        self.client_b.force_authenticate(user=self.user_b)

        # Alice's private notification
        self.notification_alice = Notification.objects.create(
            user=self.user_a,
            title='Alice Exam Alert',
            message='Your physics test is ready.',
            is_read=False
        )

        # Broadcast/General notification (user=None)
        self.notification_broadcast = Notification.objects.create(
            user=None,
            title='Campus Announcement',
            message='Platform maintenance scheduled.',
            is_read=False
        )

    def test_bob_cannot_mark_alice_notification_as_read(self):
        # Bob tries to mark Alice's notification as read
        url = f'/api/notifications/{self.notification_alice.id}/read/'
        response = self.client_b.post(url)

        # Should return 404 Not Found to prevent leaking existence or unauthorized mutation
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Refresh from DB and verify is_read remains False
        self.notification_alice.refresh_from_db()
        self.assertFalse(self.notification_alice.is_read)

    def test_alice_can_mark_own_notification_as_read(self):
        url = f'/api/notifications/{self.notification_alice.id}/read/'
        response = self.client_a.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notification_alice.refresh_from_db()
        self.assertTrue(self.notification_alice.is_read)

    def test_student_can_mark_broadcast_notification_as_read(self):
        url = f'/api/notifications/{self.notification_broadcast.id}/read/'
        response = self.client_b.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.notification_broadcast.refresh_from_db()
        self.assertTrue(self.notification_broadcast.is_read)
