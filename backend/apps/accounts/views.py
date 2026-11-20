import logging
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
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
)

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

            user_data = UserSerializer(user).data
            return Response({
                'message': 'Login successful',
                'user': user_data
            }, status=status.HTTP_200_OK)
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
        serializer = UserSerializer(request.user)
        return Response({'authenticated': True, 'user': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        data = serializer.validated_data

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
        profile.save()

        user_data = UserSerializer(user).data
        return Response({
            'message': 'Profile updated successfully.',
            'user': user_data
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
            user_data = UserSerializer(user).data
            return Response({'message': 'Registration successful', 'user': user_data}, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
