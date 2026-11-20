import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from celery import shared_task

logger = logging.getLogger(__name__)

PURPOSE_TITLES = {
    "signup_email": "Verify Your Email Address",
    "signup_phone": "Verify Your Phone Number",
    "reset_password": "Reset Your Account Password",
    "change_email": "Confirm Email Change",
    "change_phone": "Confirm Phone Change",
}

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_email_otp_task(self, email: str, otp_code: str, purpose: str = "signup_email"):
    """
    Sends a styled HTML and plaintext OTP verification email via Django's configured email backend.
    """
    title = PURPOSE_TITLES.get(purpose, "Your Verification Code")
    subject = f"{title} - ANKIT JEE"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f1f5f9; margin: 0; padding: 24px; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }}
        .header {{ text-align: center; margin-bottom: 24px; }}
        .brand {{ font-size: 20px; font-weight: 700; color: #3b82f6; letter-spacing: -0.5px; }}
        .title {{ font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 12px; }}
        .sub {{ font-size: 14px; color: #94a3b8; line-height: 1.5; }}
        .otp-box {{ text-align: center; margin: 32px 0; background: #0f172a; border: 1px dashed #3b82f6; border-radius: 8px; padding: 20px; }}
        .otp {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; font-family: monospace; }}
        .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; line-height: 1.5; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="brand">ANKIT JEE | AdeptEduverse</div>
          <div class="title">{title}</div>
          <p class="sub">Use the verification code below to complete your request. This code is valid for 10 minutes.</p>
        </div>
        <div class="otp-box">
          <div class="otp">{otp_code}</div>
        </div>
        <p class="sub" style="text-align: center;">Never share this code with anyone. If you did not request this, please ignore this email.</p>
        <div class="footer">
          &copy; ANKIT JEE EdTech Platform. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
    ANKIT JEE | AdeptEduverse
    {title}
    
    Your verification code is: {otp_code}
    
    This code is valid for 10 minutes.
    Never share this code with anyone. If you did not request this code, you can safely ignore this email.
    """

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'ANKIT JEE <no-reply@adepteduverse.com>')

    try:
        msg = EmailMultiAlternatives(subject, text_content, from_email, [email])
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.error(f"Failed to send OTP email to {email}: {exc}")
        if self:
            raise self.retry(exc=exc)
        return False
