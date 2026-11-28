import logging
import hashlib
import uuid
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle, BaseThrottle
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.decorators import method_decorator
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

from .models import User, StudentProfile, normalize_phone
from .otp import OTPService, TOKEN_MAX_AGE_SECONDS
from .sms import send_sms
from .tasks import send_email_otp_task
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    SignupSerializer,
    SendEmailOtpSerializer,
    VerifyEmailOtpSerializer,
    SendPhoneOtpSerializer,
    VerifyPhoneOtpSerializer,
    ForgotPasswordSerializer,
    VerifyResetOtpSerializer,
    ResetPasswordSerializer,
    UpdateProfileSerializer,
    StudentOnboardingSerializer,
)
from .throttles import LoginFailedIdentifierRateThrottle, LoginFailedIPRateThrottle, AdminLoginThrottle

logger = logging.getLogger(__name__)

def _dispatch_email_otp(email: str, otp: str, purpose: str):
    """Safely dispatches email OTP via Celery task or falls back to synchronous send."""
    try:
        send_email_otp_task.delay(email, otp, purpose)
    except Exception as exc:
        logger.warning(f"Celery broker unavailable, sending email OTP synchronously: {exc}")
        send_email_otp_task(email, otp, purpose)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenView(APIView):
    """
    Returns the CSRF token in JSON and sets the CSRF cookie on the client response.
    Supports GET and HEAD requests.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)}, status=status.HTTP_200_OK)

    def head(self, request):
        # Generates/refreshes CSRF cookie and returns 200 OK headers
        get_token(request)
        return Response(status=status.HTTP_200_OK)


# ==========================================
# Signup OTP Endpoints
# ==========================================

class SendSignupEmailOtpView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_send'

    def post(self, request):
        serializer = SendEmailOtpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        can_send, error_msg, cooldown = OTPService.can_send(email, 'signup_email')
        if not can_send:
            return Response({'error': error_msg, 'cooldown': cooldown}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = OTPService.generate_and_store(email, 'signup_email')
        _dispatch_email_otp(email, otp, 'signup_email')

        return Response({
            'message': 'Verification code sent to your email address.',
            'cooldown': 60
        }, status=status.HTTP_200_OK)


class VerifySignupEmailOtpView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = VerifyEmailOtpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']

        is_valid, msg, token = OTPService.verify_otp(email, 'signup_email', otp)
        if not is_valid:
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'verified': True,
            'email_token': token,
            'message': 'Email verified successfully.'
        }, status=status.HTTP_200_OK)


class SendSignupPhoneOtpView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_send'

    def post(self, request):
        serializer = SendPhoneOtpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        phone = serializer.validated_data['phone']
        can_send, error_msg, cooldown = OTPService.can_send(phone, 'signup_phone')
        if not can_send:
            return Response({'error': error_msg, 'cooldown': cooldown}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = OTPService.generate_and_store(phone, 'signup_phone')
        send_sms(phone, f"Your ANKIT JEE verification code is: {otp}. Valid for 10 minutes.")

        return Response({
            'message': 'Verification code sent to your mobile number via SMS.',
            'cooldown': 60
        }, status=status.HTTP_200_OK)


class VerifySignupPhoneOtpView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = VerifyPhoneOtpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        phone = serializer.validated_data['phone']
        otp = serializer.validated_data['otp']

        is_valid, msg, token = OTPService.verify_otp(phone, 'signup_phone', otp)
        if not is_valid:
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'verified': True,
            'phone_token': token,
            'message': 'Mobile number verified successfully.'
        }, status=status.HTTP_200_OK)


class SignupView(APIView):
    """
    Creates a new student account after validating email_token and phone_token.
    Enforces uniqueness, hashes passwords, sets both verification flags to True.
    Does NOT log the user in.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'signup'

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Account created successfully! Please log in with your credentials.',
                'user_id': str(user.id),
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# Login & Authentication
# ==========================================

class LoginView(APIView):
    """
    Universal login supporting identifier (email, phone, or username) and password.
    Returns generic 'Invalid credentials' on failure. Throttled by IP and identifier.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [
        ScopedRateThrottle,
        LoginFailedIdentifierRateThrottle,
        LoginFailedIPRateThrottle,
        AdminLoginThrottle,
    ]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            login(request, user)

            remember_me = serializer.validated_data.get('remember_me', False)
            if remember_me:
                request.session.set_expiry(1209600) # 2 weeks
            else:
                request.session.set_expiry(0)       # browser session

            # Reset failure count for this identifier and IP upon successful login
            LoginFailedIdentifierRateThrottle.clear_login_failures(request)
            LoginFailedIPRateThrottle.clear_login_failures(request)

            user_data = UserSerializer(user, context={'request': request}).data
            return Response({
                'message': 'Login successful',
                'user': user_data
            }, status=status.HTTP_200_OK)

        # Login failed: record failure against identifier and IP, then log warning without sensitive data
        LoginFailedIdentifierRateThrottle.record_login_failure(request)
        LoginFailedIPRateThrottle.record_login_failure(request)

        raw_identifier = (request.data.get('identifier') or request.data.get('email') or '').strip().lower()
        ident_hash = hashlib.sha256(raw_identifier.encode('utf-8')).hexdigest()[:16] if raw_identifier else 'anonymous'
        client_ip = BaseThrottle().get_ident(request)
        portal = request.data.get('portal', 'student')
        xff = request.META.get('HTTP_X_FORWARDED_FOR', 'none')

        logger.warning(
            "Failed login attempt: identifier_hash=%s, ip=%s, portal=%s, xff=%s",
            ident_hash,
            client_ip,
            portal,
            xff,
        )

        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        response = Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        response.delete_cookie('user_role')
        response.delete_cookie('auth_session')
        response.delete_cookie('sessionid')
        return response


# ==========================================
# Password Reset Endpoints (Enumeration Safe)
# ==========================================

class ForgotPasswordView(APIView):
    """
    Initiates password recovery. Always returns a generic success message
    to prevent user account enumeration.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        GENERIC_RESPONSE = {
            'message': 'If an account exists with this email address, a verification code has been sent.'
        }

        if not serializer.is_valid():
            return Response(GENERIC_RESPONSE, status=status.HTTP_200_OK)

        email = serializer.validated_data['email']
        user = User.objects.filter(email__iexact=email).first()

        if user and user.is_active:
            can_send, _, _ = OTPService.can_send(email, 'reset_password')
            if can_send:
                otp = OTPService.generate_and_store(email, 'reset_password')
                _dispatch_email_otp(email, otp, 'reset_password')

        return Response(GENERIC_RESPONSE, status=status.HTTP_200_OK)


class VerifyResetOtpView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = VerifyResetOtpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']

        is_valid, msg, token = OTPService.verify_otp(email, 'reset_password', otp)
        if not is_valid:
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'verified': True,
            'reset_token': token,
            'message': 'Verification code confirmed. You may now set a new password.'
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        reset_token = serializer.validated_data['reset_token']
        new_password = serializer.validated_data['new_password']

        # Unsign token to retrieve verified email
        signer = TimestampSigner(salt="otp-verify-reset_password")
        try:
            val = signer.unsign(reset_token, max_age=TOKEN_MAX_AGE_SECONDS)
            email, purpose = val.split(':', 1)
            if purpose != 'reset_password':
                raise BadSignature()
        except (BadSignature, SignatureExpired):
            return Response({
                'error': 'Reset token is invalid or has expired. Please request a new password reset.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({
                'error': 'User account not found.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({
            'message': 'Password has been reset successfully. Please log in with your new password.'
        }, status=status.HTTP_200_OK)


# ==========================================
# Profile Endpoints (GET / PATCH with Re-verification)
# ==========================================

class CurrentUserView(APIView):
    """
    Returns current user profile. AllowAny for GET so client can inspect session
    status without triggering 401/403 loops. Mutating operations (PATCH) require authentication.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False, 'user': None}, status=status.HTTP_200_OK)
        serializer = UserSerializer(request.user, context={'request': request})
        return Response({'authenticated': True, 'user': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        data = serializer.validated_data

        if 'theme' in data and hasattr(request, 'session'):
            request.session['theme'] = data['theme']
            request.session.modified = True

        if 'full_name' in data:
            user.full_name = data['full_name']
            parts = user.full_name.split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''

        if 'username' in data:
            user.username = data['username']

        if 'email' in data and data.get('email_token'):
            user.email = data['email'].strip().lower()
            user.is_email_verified = True

        if 'phone' in data and data.get('phone_token'):
            user.phone = normalize_phone(data['phone'])
            user.phone_number = user.phone
            user.is_phone_verified = True

        user.save()

        profile, _ = StudentProfile.objects.get_or_create(user=user)
        if 'target_exam' in data:
            profile.target_exam = data['target_exam']
        if 'target_year' in data:
            profile.target_year = data['target_year']
        if 'bio' in data:
            profile.bio = data['bio']
        if 'last_selected_course_id' in request.data:
            profile.last_selected_course_id = str(request.data['last_selected_course_id'])[:100]
        profile.save()

        user_data = UserSerializer(user, context={'request': request}).data
        return Response({
            'message': 'Profile updated successfully.',
            'user': user_data
        }, status=status.HTTP_200_OK)


class SelectCourseView(APIView):
    """
    POST /api/auth/select-course/
    Persists student's active course selection to server profile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        course_id = request.data.get('course_id') or request.data.get('course')
        if not course_id:
            return Response({'error': 'course_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        profile, _ = StudentProfile.objects.get_or_create(user=request.user)
        profile.last_selected_course_id = str(course_id).strip()
        profile.save(update_fields=['last_selected_course_id'])

        return Response({
            'success': True,
            'last_selected_course_id': profile.last_selected_course_id
        }, status=status.HTTP_200_OK)


class SendProfileChangeEmailOtpView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'otp_send'

    def post(self, request):
        new_email = request.data.get('email', '').strip().lower()
        if not new_email or '@' not in new_email:
            return Response({'error': 'Please provide a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response({'error': 'This email address is already in use by another account.'}, status=status.HTTP_400_BAD_REQUEST)

        can_send, error_msg, cooldown = OTPService.can_send(new_email, 'change_email')
        if not can_send:
            return Response({'error': error_msg, 'cooldown': cooldown}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = OTPService.generate_and_store(new_email, 'change_email')
        _dispatch_email_otp(new_email, otp, 'change_email')

        return Response({
            'message': 'Verification code sent to your new email address.',
            'cooldown': 60
        }, status=status.HTTP_200_OK)


class VerifyProfileChangeEmailOtpView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'otp_verify'

    def post(self, request):
        new_email = request.data.get('email', '').strip().lower()
        otp = request.data.get('otp', '').strip()

        is_valid, msg, token = OTPService.verify_otp(new_email, 'change_email', otp)
        if not is_valid:
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'verified': True,
            'email_token': token,
            'message': 'New email address verified.'
        }, status=status.HTTP_200_OK)


class SendProfileChangePhoneOtpView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'otp_send'

    def post(self, request):
        raw_phone = request.data.get('phone', '').strip()
        new_phone = normalize_phone(raw_phone)
        digits = re.sub(r'\D', '', new_phone) if 're' in globals() else "".join(filter(str.isdigit, new_phone))

        if len(digits) < 10:
            return Response({'error': 'Please provide a valid 10-digit mobile number.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(phone=new_phone).exclude(id=request.user.id).exists():
            return Response({'error': 'This mobile number is already registered to another account.'}, status=status.HTTP_400_BAD_REQUEST)

        can_send, error_msg, cooldown = OTPService.can_send(new_phone, 'change_phone')
        if not can_send:
            return Response({'error': error_msg, 'cooldown': cooldown}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        otp = OTPService.generate_and_store(new_phone, 'change_phone')
        send_sms(new_phone, f"Your ANKIT JEE verification code is: {otp}. Valid for 10 minutes.")

        return Response({
            'message': 'Verification code sent to your new mobile number via SMS.',
            'cooldown': 60
        }, status=status.HTTP_200_OK)


class VerifyProfileChangePhoneOtpView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'otp_verify'

    def post(self, request):
        new_phone = normalize_phone(request.data.get('phone', '').strip())
        otp = request.data.get('otp', '').strip()

        is_valid, msg, token = OTPService.verify_otp(new_phone, 'change_phone', otp)
        if not is_valid:
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'verified': True,
            'phone_token': token,
            'message': 'New mobile number verified.'
        }, status=status.HTTP_200_OK)


# Backward compatible alias for register
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            login(request, user)
            user_data = UserSerializer(user, context={'request': request}).data
            return Response({'message': 'Registration successful', 'user': user_data}, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# Clerk Authentication & Student Onboarding
# ==========================================

@method_decorator(csrf_exempt, name='dispatch')
class ClerkWebhookView(APIView):
    """
    POST /api/auth/clerk-webhook/
    Receives events from Clerk (user.created, user.updated, user.deleted).
    Verifies Svix signature using CLERK_WEBHOOK_SECRET on RAW request body.
    Idempotent. Does not sync phone numbers (per student privacy override).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'CLERK_WEBHOOK_SECRET', '')
        if not webhook_secret:
            logger.error("CLERK_WEBHOOK_SECRET not configured.")
            return Response({'error': 'Webhook secret unconfigured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        svix_id = request.headers.get('svix-id') or request.META.get('HTTP_SVIX_ID', '')
        svix_timestamp = request.headers.get('svix-timestamp') or request.META.get('HTTP_SVIX_TIMESTAMP', '')
        svix_signature = request.headers.get('svix-signature') or request.META.get('HTTP_SVIX_SIGNATURE', '')

        if not svix_id or not svix_timestamp or not svix_signature:
            logger.warning("Clerk webhook missing required svix headers.")
            return Response({'error': 'Missing svix headers'}, status=status.HTTP_400_BAD_REQUEST)

        headers = {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }

        try:
            from svix.webhooks import Webhook, WebhookVerificationError
            wh = Webhook(webhook_secret)
            payload = wh.verify(request.body.decode('utf-8'), headers)
        except WebhookVerificationError as exc:
            logger.warning("Clerk webhook Svix verification failed: %s", exc)
            return Response({'error': 'Invalid webhook signature'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Clerk webhook processing error: %s", exc)
            return Response({'error': 'Invalid webhook payload'}, status=status.HTTP_400_BAD_REQUEST)

        event_type = payload.get('type')
        data = payload.get('data', {})
        clerk_id = data.get('id')

        if not clerk_id:
            return Response({'error': 'Missing clerk_id in data'}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("Processing Clerk webhook event: %s for clerk_id=%s", event_type, clerk_id)

        if event_type == 'user.created' or event_type == 'user.updated':
            email_addresses = data.get('email_addresses', [])
            primary_id = data.get('primary_email_address_id')
            email = ''
            for ea in email_addresses:
                if ea.get('id') == primary_id or not email:
                    email = ea.get('email_address', '').strip().lower()

            first_name = data.get('first_name') or ''
            last_name = data.get('last_name') or ''
            username = data.get('username') or ''

            user = User.objects.filter(clerk_id=clerk_id).first()
            if not user and email:
                user = User.objects.filter(email__iexact=email).first()

            if user:
                # Update existing user
                user.clerk_id = clerk_id
                if first_name or last_name:
                    user.first_name = first_name
                    user.last_name = last_name
                    user.full_name = f"{first_name} {last_name}".strip()
                if username and not User.objects.filter(username__iexact=username).exclude(id=user.id).exists():
                    user.username = username
                user.save()
            elif email:
                # Create student user
                base_username = username or email.split('@')[0]
                final_username = base_username
                counter = 1
                while User.objects.filter(username__iexact=final_username).exists():
                    final_username = f"{base_username}{counter}"
                    counter += 1

                user = User.objects.create_user(
                    username=final_username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    full_name=f"{first_name} {last_name}".strip() or final_username,
                    role=User.Role.STUDENT,
                    clerk_id=clerk_id,
                    is_email_verified=True,
                    is_verified=True,
                )
                StudentProfile.objects.get_or_create(user=user)

        elif event_type == 'user.deleted':
            # Deactivate student without deleting historical test / payment data
            user = User.objects.filter(clerk_id=clerk_id).first()
            if user:
                user.is_active = False
                user.save(update_fields=['is_active'])
                logger.info("Deactivated user %s upon Clerk deletion.", user.email)

        return Response({'received': True, 'event': event_type}, status=status.HTTP_200_OK)


class StudentOnboardingView(APIView):
    """
    GET /api/students/onboarding/ - Returns current onboarding state for logged-in student.
    POST /api/students/onboarding/ - Validates choices and stores them on StudentProfile.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) != User.Role.STUDENT:
            return Response({'error': 'Students only'}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = StudentProfile.objects.get_or_create(user=request.user)
        return Response({
            'is_onboarded': profile.is_onboarded,
            'academic_class': profile.academic_class,
            'target_exam': profile.target_exam,
            'target_year': profile.target_year,
            'city': profile.city,
            'state': profile.state,
            'school_or_coaching': profile.school_or_coaching,
            'preferred_language': profile.preferred_language,
            'contact_phone': profile.contact_phone,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if getattr(request.user, 'role', None) != User.Role.STUDENT:
            return Response({'error': 'Students only'}, status=status.HTTP_403_FORBIDDEN)

        serializer = StudentOnboardingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        profile, _ = StudentProfile.objects.get_or_create(user=request.user)

        profile.academic_class = data.get('academic_class', profile.academic_class)
        profile.target_exam = data.get('target_exam', profile.target_exam)
        profile.target_year = data.get('target_year', profile.target_year)
        profile.city = data.get('city', profile.city)
        profile.state = data.get('state', profile.state)
        profile.school_or_coaching = data.get('school_or_coaching', profile.school_or_coaching)
        profile.preferred_language = data.get('preferred_language', profile.preferred_language)
        profile.contact_phone = data.get('contact_phone', profile.contact_phone)
        profile.is_onboarded = True
        profile.save()

        return Response({
            'message': 'Onboarding completed successfully',
            'is_onboarded': True,
            'profile': {
                'academic_class': profile.academic_class,
                'target_exam': profile.target_exam,
                'target_year': profile.target_year,
                'city': profile.city,
                'state': profile.state,
                'school_or_coaching': profile.school_or_coaching,
                'preferred_language': profile.preferred_language,
                'contact_phone': profile.contact_phone,
            }
        }, status=status.HTTP_200_OK)


class AccountDataExportView(APIView):
    """
    GET /api/auth/me/export-data/
    Data Portability under DPDP: Returns all stored personal, academic, test, and purchase records
    belonging to the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, 'student_profile', None)

        profile_data = {
            'username': user.username,
            'email': user.email,
            'phone': getattr(user, 'phone', None) or getattr(user, 'phone_number', None) or '',
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': getattr(user, 'full_name', '') or f"{user.first_name} {user.last_name}".strip(),
            'role': user.role,
            'date_joined': user.date_joined.isoformat() if getattr(user, 'date_joined', None) else None,
            'is_verified': getattr(user, 'is_verified', False),
            'academic_class': profile.academic_class if profile else None,
            'target_exam': profile.target_exam if profile else None,
            'target_year': profile.target_year if profile else None,
            'bio': profile.bio if profile else '',
        }

        from apps.academics.models import Enrollment
        enrollments = [
            {
                'course_id': str(e.course_id),
                'course_title': e.course.title if e.course else '',
                'enrolled_at': e.enrolled_at.isoformat() if e.enrolled_at else None,
                'status': e.status,
            }
            for e in Enrollment.objects.filter(user=user).select_related('course')
        ]

        from apps.tests.models import TestAttempt
        test_attempts = [
            {
                'test_id': str(a.test_id),
                'test_title': a.test.title if a.test else '',
                'score': a.score,
                'total_marks': a.total_marks,
                'percentage': a.percentage,
                'accuracy': a.accuracy,
                'status': a.status,
                'completed_at': a.completed_at.isoformat() if a.completed_at else None,
            }
            for a in TestAttempt.objects.filter(user=user).select_related('test')
        ]

        from apps.payments.models import Payment
        payments = [
            {
                'order_id': p.razorpay_order_id,
                'payment_id': p.razorpay_payment_id,
                'amount_paise': p.amount_paise,
                'currency': p.currency,
                'status': p.status,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'paid_at': p.paid_at.isoformat() if p.paid_at else None,
                'items_snapshot': p.items_snapshot,
            }
            for p in Payment.objects.filter(user=user)
        ]

        return Response({
            'export_timestamp': timezone.now().isoformat(),
            'compliance': 'Digital Personal Data Protection Act (DPDP)',
            'profile': profile_data,
            'enrollments': enrollments,
            'test_attempts': test_attempts,
            'payments': payments,
        }, status=status.HTTP_200_OK)


class AccountDeleteView(APIView):
    """
    POST /api/auth/me/delete-account/
    Right to Erasure under DPDP:
    Anonymizes all user PII, disables active authentication, and preserves statutory financial logs.
    Payload: { "confirmation": "DELETE" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        confirmation = request.data.get('confirmation')
        if confirmation != 'DELETE':
            return Response(
                {'error': 'To permanently delete your account, confirmation must equal "DELETE".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        with transaction.atomic():
            user_id = user.id
            user.is_active = False
            user.first_name = "Deleted"
            user.last_name = "User"
            user.username = f"deleted_{uuid.uuid4().hex[:10]}"
            user.email = f"deleted_{uuid.uuid4().hex[:10]}@anonymized.invalid"
            if hasattr(user, 'phone'):
                user.phone = None
            if hasattr(user, 'phone_number'):
                user.phone_number = None
            if hasattr(user, 'full_name'):
                user.full_name = "Deleted User"
            user.set_unusable_password()
            user.save()

            profile = getattr(user, 'student_profile', None)
            if profile:
                profile.bio = ''
                profile.city = ''
                profile.state = ''
                profile.contact_phone = ''
                profile.save()

        logger.info("Account deleted and anonymized under DPDP: user_id=%s", user_id)
        return Response({
            'message': 'Your account has been deleted and personal data permanently anonymized.',
        }, status=status.HTTP_200_OK)

