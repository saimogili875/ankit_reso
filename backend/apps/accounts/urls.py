from django.urls import path, re_path
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
    ClerkWebhookView,
    StudentOnboardingView,
)

urlpatterns = [
    # System & CSRF
    re_path(r'^csrf/?$', CSRFTokenView.as_view(), name='csrf'),

    # Profile & Session
    re_path(r'^me/?$', CurrentUserView.as_view(), name='current-user'),
    re_path(r'^me/change-email/send-otp/?$', SendProfileChangeEmailOtpView.as_view(), name='profile-change-email-send-otp'),
    re_path(r'^me/change-email/verify-otp/?$', VerifyProfileChangeEmailOtpView.as_view(), name='profile-change-email-verify-otp'),
    re_path(r'^me/change-phone/send-otp/?$', SendProfileChangePhoneOtpView.as_view(), name='profile-change-phone-send-otp'),
    re_path(r'^me/change-phone/verify-otp/?$', VerifyProfileChangePhoneOtpView.as_view(), name='profile-change-phone-verify-otp'),

    # Signup OTP & Creation
    re_path(r'^signup/email/send-otp/?$', SendSignupEmailOtpView.as_view(), name='signup-email-send-otp'),
    re_path(r'^signup/email/verify-otp/?$', VerifySignupEmailOtpView.as_view(), name='signup-email-verify-otp'),
    re_path(r'^signup/phone/send-otp/?$', SendSignupPhoneOtpView.as_view(), name='signup-phone-send-otp'),
    re_path(r'^signup/phone/verify-otp/?$', VerifySignupPhoneOtpView.as_view(), name='signup-phone-verify-otp'),
    re_path(r'^signup/?$', SignupView.as_view(), name='signup'),

    # Legacy / Backward compatibility
    re_path(r'^register/?$', RegisterView.as_view(), name='register'),

    # Login & Logout (Admin session auth)
    re_path(r'^login/?$', LoginView.as_view(), name='login'),
    re_path(r'^logout/?$', LogoutView.as_view(), name='logout'),

    # Clerk Webhook
    re_path(r'^clerk-webhook/?$', ClerkWebhookView.as_view(), name='clerk-webhook'),

    # Password Recovery (OTP-based)
    re_path(r'^password/forgot/?$', ForgotPasswordView.as_view(), name='password-forgot'),
    re_path(r'^password/reset/verify-otp/?$', VerifyResetOtpView.as_view(), name='password-reset-verify-otp'),
    re_path(r'^password/reset/?$', ResetPasswordView.as_view(), name='password-reset'),
]
