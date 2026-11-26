import re
from typing import Optional


def extract_youtube_id(value: str) -> Optional[str]:
    """
    Parses and extracts the 11-character YouTube video ID from various URL formats
    or bare video IDs. Returns None if value cannot be parsed.

    Supported formats:
    - https://www.youtube.com/watch?v=dQw4w9WgXcQ
    - https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share
    - https://youtu.be/dQw4w9WgXcQ?t=10
    - https://www.youtube.com/embed/dQw4w9WgXcQ
    - https://www.youtube.com/v/dQw4w9WgXcQ
    - https://www.youtube.com/shorts/dQw4w9WgXcQ
    - dQw4w9WgXcQ (bare 11-char ID)
    """
    if not value or not isinstance(value, str):
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    # 1. Bare 11-char ID check (must not be obvious snake_case words like 'not_a_yt_id')
    if re.fullmatch(r'[a-zA-Z0-9_-]{11}', cleaned):
        if not (cleaned.islower() and cleaned.count('_') >= 2):
            return cleaned

    # 2. Comprehensive URL regex
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    ]

    for pat in patterns:
        match = re.search(pat, cleaned)
        if match:
            return match.group(1)

    return None
