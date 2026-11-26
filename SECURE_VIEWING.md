# Secure Viewing & Anti-Leak Architecture

This document describes the security and DRM controls implemented for protected study materials, PDF modules, solutions, and lecture videos on the AdeptEduverse / ANKIT JEE platform.

---

## 1. Threat Model & Security Posture

### Honest Assessment of Client-Side Constraints
Operating system-level screenshot tools (e.g. macOS Cmd+Shift+4, Windows Snipping Tool, Android screenshot keys), screen recording software (OBS, QuickTime), and physical camera recordings cannot be physically blocked by standard web standards (HTML5 / ECMAScript). 

Any system that claims "100% screenshot proof" in a browser without proprietary OS kernel drivers or hardware-enforced HDCP/Widevine L1 DRM is inaccurate.

### Our Strategy: Prevent Casual Leakage + Guarantee Traceability
1. **Never Send Original PDF Files**: The browser is never given the underlying PDF file key, download link, or byte stream.
2. **Server-Side Rendered Page Images**: Pages are rendered on the server into in-memory images and served as single-page JPEGs.
3. **Indelible Moving Watermarks**: Every rendered page image has the student's name, email/phone, timestamp, and unique student ID burned directly into the pixels before leaving the server.
4. **Moving Position (Anti-Cropping)**: Watermark badges dynamically shift position across pages (top, middle, bottom, diagonal grid) so cropping cannot remove the student's identity.
5. **Short-Lived Signed Tokens**: Image URLs require a cryptographic `TimestampSigner` signature valid for only 300 seconds (5 minutes), tied strictly to the student's user ID and session.
6. **No Download / Print / Right-Click / Text Drag**: Browser context menus, text selection, image dragging, and print stylesheets are blocked.
7. **Anomaly Detection**: Access logs track view velocity. Requesting >100 pages within 10 minutes automatically flags the student profile for administrative review and suspension.

---

## 2. Technical Implementation

### A. Server-Side Page Rendering & Watermarking (`apps/coursecontent/security.py`)
- **Engine**: `pypdfium2` (PDFium bindings) + `Pillow` (PIL).
- **Resolution**: Rendered at $1.5\times$ scale for crisp retina and mobile reading (360px to 412px viewports).
- **Watermark Layers**:
  1. *Faint Background Grid*: Diagonal repetitions of `{student_email} • AdeptEduverse` across the canvas.
  2. *High-Visibility Deterrent Badge*: Semi-transparent badge with red/white text containing `CONFIDENTIAL • {student_name} • {student_phone} • {timestamp} • Page {N}`.
- **Cache Control**: Served with `Content-Disposition: inline`, `Cache-Control: private, no-store, max-age=300`, and `X-Content-Type-Options: nosniff`.

### B. Video Protection (`components/video/hls-player.tsx`)
- **YouTube Lectures**: Embedded via YouTube's unlisted embed player with modest branding and related videos disabled.
- **Premium Solution Videos**: Streamed over Cloudflare R2 using signed, time-expiring HLS playlists (`.m3u8` and `.ts` segments).
- **Dynamic Video Watermark**: Semi-transparent floating pill overlay containing the student's verified email/phone that shifts coordinates every 10 seconds across the video canvas.
- **Context Menu & Selection Disabled**: Native right-click menu blocked (`onContextMenu={(e) => e.preventDefault()}`).

### C. Access Control & Bulk-Viewing Detection (`apps/coursecontent/models.py`)
- **`ContentItemAccessLog`**: Every page view request logs `user_id`, `item_id`, `page_number`, `ip_address`, `user_agent`, and `accessed_at`.
- **Automated Flagging**: A sliding window query flags `StudentProfile.is_flagged_bulk_viewing = True` if an account exceeds 100 page fetches within a 10-minute window, notifying the administrative console.

---

## 3. Verification & Testing

To verify enrollment gating and secure viewing:
```bash
# Run coursecontent tests (token verification, moving watermark, enrollment gating)
python manage.py test apps.coursecontent

# Run accounts tests (DPDP, session, course selection)
python manage.py test apps.accounts
```
