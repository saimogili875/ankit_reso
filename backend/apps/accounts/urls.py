from django.urls import path
from .views import (
    CSRFTokenView,
    CurrentUserView,
    LoginView,
    LogoutView,
    SignupView,
    RegisterView,
    SendSignupEmailOtpView,
    VerifySignupEmailOtpView,
    SendSignupPhoneOtpView,
    VerifySignupPhoneOtpView,
    ForgotPasswordView,
    VerifyResetOtpView,
    ResetPasswordView,
    SendProfileChangeEmailOtpView,
    VerifyProfileChangeEmailOtpView,
    SendProfileChangePhoneOtpView,
    VerifyProfileChangePhoneOtpView,
)

urlpatterns = [
    # System & CSRF
    path('csrf/', CSRFTokenView.as_view(), name='csrf'),

    # Profile & Session
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('me/change-email/send-otp/', SendProfileChangeEmailOtpView.as_view(), name='profile-change-email-send-otp'),
    path('me/change-email/verify-otp/', VerifyProfileChangeEmailOtpView.as_view(), name='profile-change-email-verify-otp'),
    path('me/change-phone/send-otp/', SendProfileChangePhoneOtpView.as_view(), name='profile-change-phone-send-otp'),
    path('me/change-phone/verify-otp/', VerifyProfileChangePhoneOtpView.as_view(), name='profile-change-phone-verify-otp'),

    # Signup OTP & Creation
    path('signup/email/send-otp/', SendSignupEmailOtpView.as_view(), name='signup-email-send-otp'),
    path('signup/email/verify-otp/', VerifySignupEmailOtpView.as_view(), name='signup-email-verify-otp'),
    path('signup/phone/send-otp/', SendSignupPhoneOtpView.as_view(), name='signup-phone-send-otp'),
    path('signup/phone/verify-otp/', VerifySignupPhoneOtpView.as_view(), name='signup-phone-verify-otp'),
    path('signup/', SignupView.as_view(), name='signup'),

    # Legacy / Backward compatibility
    path('register/', RegisterView.as_view(), name='register'),

    # Login & Logout
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),

    # Password Recovery (OTP-based)
    path('password/forgot/', ForgotPasswordView.as_view(), name='password-forgot'),
    path('password/reset/verify-otp/', VerifyResetOtpView.as_view(), name='password-reset-verify-otp'),
    path('password/reset/', ResetPasswordView.as_view(), name='password-reset'),
]
