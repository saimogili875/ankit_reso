import json
import logging
import urllib.request
import urllib.error
from django.conf import settings
from decouple import config

logger = logging.getLogger(__name__)

TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/gateway/send-sms"

def send_sms(phone: str, message: str) -> bool:
    """
    Sends an SMS message to a phone number using TextBee Gateway API.
    In DEBUG mode (or when TEXTBEE_API_KEY is not configured), logs a mock message
    to stdout so local development and automated testing work without external SMS costs.
    """
    api_key = config('TEXTBEE_API_KEY', default='').strip()
    device_id = config('TEXTBEE_DEVICE_ID', default='').strip()

    # Fallback to mock / console SMS in DEBUG or if credentials missing
    if settings.DEBUG or not api_key:
        masked_phone = phone[:3] + "****" + phone[-3:] if len(phone) >= 7 else phone
        logger.info(f"[SMS MOCK] To: {masked_phone} | Message: {message}")
        print(f"\n==================== [SMS MOCK] ====================")
        print(f"Recipient: {phone}")
        print(f"Message  : {message}")
        print(f"====================================================\n")
        return True

    payload = {
        "recipients": [phone],
        "message": message,
    }

    if device_id:
        payload["deviceId"] = device_id

    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        TEXTBEE_API_URL,
        data=data_bytes,
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "ANKITJEE-TextBee/1.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                return True
            logger.error(f"TextBee SMS API returned status {resp.status}")
            return False
    except urllib.error.HTTPError as exc:
        logger.error(f"TextBee SMS HTTP error: status {exc.code}")
        return False
    except urllib.error.URLError as exc:
        logger.error(f"TextBee SMS network error: {exc.reason}")
        return False
    except Exception as exc:
        logger.error(f"TextBee SMS failed: {exc.__class__.__name__}")
        return False
