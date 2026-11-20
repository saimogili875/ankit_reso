import os
import json
import logging
import urllib.request
import urllib.error
from decouple import config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Swecha, the friendly and knowledgeable AI academic assistant for Adept Eduverse.
Adept Eduverse provides premier JEE Mains & Advanced Mathematics mentorship by Ankit Kumar (B.Tech, IIT Kharagpur alumnus).

Key institutional knowledge:
- Faculty: Ankit Kumar, B.Tech from IIT Kharagpur. Over a decade of experience mentoring top JEE rankers (including AIR 125).
- Batches & Timings:
  * Class 11 and Class 12 Live Evening Batch: Monday through Saturday, 6:30 PM to 8:30 PM.
  * Droppers Immersion Batch (Morning Accelerated): Monday through Saturday, 9:00 AM to 12:00 Noon.
  * Sunday Mornings: All-India computer-based mock tests (CBT) with percentile benchmarking and personalized error analysis.
- Lectures & Recordings: High-definition video recordings are processed and uploaded to the student portal within 2 hours of every live session, accessible 24/7. Over 2,700 video lectures available.
- Doubts & Mentorship: Direct audio and chat interaction with Ankit Sir during live classes, weekly live doubt sessions, and a dedicated WhatsApp Academic Desk (+91 93825 57693).
- Study Materials: Chapter-wise DPPs with complete step-by-step solutions, formula sheets, revision mind maps, and Sunday CBT test series.
- STRICT FEE POLICY: Do NOT invent, assume, or quote specific fee numbers. Always direct fee inquiries to the WhatsApp Academic Desk at +91 93825 57693 or advise clicking 'Get Fee Details on WhatsApp'.
- Login / Account Guidance:
  * Student Portal Login: Students log in on the Student tab with their registered email or phone number.
  * If login fails: Verify you are on the Student tab (not Admin).
  * Forgot password: Use the 'Forgot password?' link on the login page to receive a reset link, or contact WhatsApp support (+91 93825 57693).
  * New students can click 'Create account' to register.

Keep responses concise, welcoming, accurate, and encouraging.
"""

def get_keyword_faq_response(user_message: str) -> str:
    """
    Keyword-based FAQ fallback built from Adept Eduverse landing page and admissions FAQ.
    """
    msg = (user_message or '').lower().strip()

    if any(k in msg for k in ['fee', 'fees', 'cost', 'price', 'pricing', 'discount', 'scholarship', 'payment', 'installment', 'pay']):
        return (
            "For official batch fee structures, installment options, and scholarship discounts, "
            "please connect directly with our Admissions Desk on WhatsApp at +91 93825 57693. "
            "We offer transparent pricing with UPI, Net Banking, and card support."
        )

    if any(k in msg for k in ['batch', 'timing', 'schedule', 'time', 'hours', 'dropper', 'evening', 'morning', 'class 11', 'class 12']):
        return (
            "Our live batch schedules are:\n"
            "• Class 11 & 12 Evening Batch: Mon–Sat, 6:30 PM – 8:30 PM\n"
            "• Droppers Accelerated Immersion: Mon–Sat, 9:00 AM – 12:00 Noon\n"
            "• Sunday: All-India CBT Mock Tests\n\n"
            "All sessions include 2-hour HD recording uploads to your student vault."
        )

    if any(k in msg for k in ['demo', 'trial', 'free class', 'sample', 'youtube']):
        return (
            "You can experience Ankit Sir's teaching by watching free full-length masterclasses on our "
            "YouTube channel (@adepteduverse) or request an invite to a live interactive demo by messaging "
            "+91 93825 57693 on WhatsApp."
        )

    if any(k in msg for k in ['miss', 'recording', 'missed', 'vault', 'catch up', 'absent']):
        return (
            "Never worry about missing a session! High-definition recordings of every live lecture are "
            "processed and uploaded to your student portal within 2 hours, accessible 24/7 with playback speed controls."
        )

    if any(k in msg for k in ['forgot', 'reset password', 'change password', 'recover', 'forgot password']):
        return (
            "Click 'Forgot password?' on the login screen and enter your registered email address to receive a secure "
            "password reset link. You can also contact our WhatsApp support at +91 93825 57693 if you need immediate assistance."
        )

    if any(k in msg for k in ['login', 'sign in', 'log in', 'portal', 'account', 'register', 'signup']):
        return (
            "To log in, make sure the 'Student Portal' tab is selected on the login page, then enter your registered "
            "email or mobile number and password. If you don't have an account yet, click 'Create account' to get started."
        )

    if any(k in msg for k in ['doubt', 'doubts', 'question', 'solve', 'faculty', 'teacher', 'ankit', 'sir']):
        return (
            "You can ask doubts live during classes via audio and chat with Ankit Sir (B.Tech, IIT Kharagpur), "
            "submit doubts in your student portal Doubt Solver, or message our dedicated WhatsApp Academic Desk "
            "at +91 93825 57693."
        )

    if any(k in msg for k in ['material', 'notes', 'dpp', 'test', 'tests', 'pyq', 'formula', 'syllabus', 'curriculum', 'mains', 'advanced']):
        return (
            "Our curriculum covers comprehensive JEE Mains and JEE Advanced Mathematics from first-principles NCERT "
            "foundation to Olympiad level. Students receive chapter-wise DPPs with full solutions, revision mind maps, "
            "and All-India Sunday CBT mock tests benchmarking your national percentile."
        )

    return (
        "Hello! I am Swecha, your Adept Eduverse assistant. I can assist you with batch timings, demo classes, "
        "admissions, login issues, and study materials. For specific fee or batch enrollment assistance, connect "
        "directly with Ankit Sir's team on WhatsApp at +91 93825 57693."
    )


def generate_chatbot_response(message: str, history: list = None) -> str:
    """
    Generates response using Anthropic API if ANTHROPIC_API_KEY is configured.
    Falls back gracefully to keyword-based FAQ.
    """
    api_key = config('ANTHROPIC_API_KEY', default=os.environ.get('ANTHROPIC_API_KEY', '')).strip()
    model = config('CHATBOT_MODEL', default=os.environ.get('CHATBOT_MODEL', 'claude-3-5-sonnet-20241022')).strip()

    if not api_key:
        logger.info("ANTHROPIC_API_KEY not configured. Using keyword FAQ fallback.")
        return get_keyword_faq_response(message)

    try:
        # Build message history for Anthropic Messages API
        formatted_messages = []
        if history and isinstance(history, list):
            for item in history[-6:]:  # Keep recent context
                role = item.get('role')
                content = item.get('content')
                if role in ('user', 'assistant') and content:
                    formatted_messages.append({'role': role, 'content': str(content)})

        # Append current user message
        formatted_messages.append({'role': 'user', 'content': message})

        payload = {
            'model': model,
            'max_tokens': 1024,
            'system': SYSTEM_PROMPT,
            'messages': formatted_messages,
        }

        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'User-Agent': 'AdeptEduverse-SwechaChatbot/1.0',
            },
            method='POST',
        )

        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            content_list = res_data.get('content', [])
            if content_list and isinstance(content_list, list):
                text_parts = [part.get('text', '') for part in content_list if part.get('type') == 'text']
                reply = ''.join(text_parts).strip()
                if reply:
                    return reply

        # If empty response, fallback
        return get_keyword_faq_response(message)

    except Exception as e:
        logger.warning(f"Error calling Anthropic API for chatbot: {e}. Falling back to FAQ.")
        return get_keyword_faq_response(message)
