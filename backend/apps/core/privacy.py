import re

def mask_email(email: str) -> str:
    """
    Masks an email address for privacy in logs (e.g., j***e@example.com).
    """
    if not email or '@' not in email:
        return '***'
    parts = email.split('@')
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def mask_phone(phone: str) -> str:
    """
    Masks a phone number for privacy in logs (e.g., +91******4356).
    """
    if not phone or len(phone) < 4:
        return '***'
    return phone[:3] + '*' * (len(phone) - 5) + phone[-2:]


def mask_otp(otp: str) -> str:
    """
    Never logs real OTPs.
    """
    return '******'
