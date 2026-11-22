import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

VIEWPORTS = [
    {"name": "mobile_360", "width": 360, "height": 640},
    {"name": "mobile_390", "width": 390, "height": 844},
    {"name": "tablet_768", "width": 768, "height": 1024},
    {"name": "desktop_1280", "width": 1280, "height": 800},
]

PAGES = [
    {"route": "/", "name": "home"},
    {"route": "/dashboard", "name": "dashboard"},
    {"route": "/courses", "name": "courses"},
    {"route": "/learn", "name": "learn"},
    {"route": "/practice", "name": "practice"},
    {"route": "/schedule", "name": "schedule"},
    {"route": "/progress", "name": "progress"},
    {"route": "/analysis", "name": "analysis"},
    {"route": "/analysis/notebook", "name": "notebook"},
    {"route": "/doubt-solver", "name": "doubt_solver"},
    {"route": "/materials", "name": "materials"},
    {"route": "/profile", "name": "profile"},
    {"route": "/tests", "name": "tests"},
    {"route": "/tests/8a34de49-e2ce-41bd-8582-cb289b04bb73/attempt", "name": "test_attempt"},
    {"route": "/tests/0075ef34-08c3-49bf-8558-e8a71a0a25fc/result", "name": "test_result"},
    {"route": "/payment-test", "name": "payment_test"},
]

def load_credentials():
    env_file = "e2e/.env.e2e"
    creds = {}
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    creds[k.strip()] = v.strip().strip("'\"")
    return creds

AUDIT_JS = """
() => {
    const report = {
        url: window.location.pathname,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: window.innerWidth,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
        horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        overflowingElements: [],
        smallTapTargets: [],
        smallFontInputs: [],
        viewportMeta: null,
        fixedBars: [],
    };

    // Check viewport meta
    const vMeta = document.querySelector('meta[name="viewport"]');
    if (vMeta) {
        report.viewportMeta = vMeta.getAttribute('content');
    }

    // Check overflowing elements
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 1 && rect.width > 0 && rect.height > 0) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '';
            report.overflowingElements.push({
                tag,
                cls,
                right: Math.round(rect.right),
                width: Math.round(rect.width)
            });
            if (report.overflowingElements.length >= 10) break;
        }
    }

    // Check tap targets (< 44x44px)
    const interactives = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    for (const el of interactives) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(el).display === 'none' || window.getComputedStyle(el).visibility === 'hidden') {
            continue;
        }
        if (rect.width < 44 || rect.height < 44) {
            const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim().slice(0, 35);
            report.smallTapTargets.push({
                tag: el.tagName.toLowerCase(),
                text: text.replace(/\\n/g, ' '),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            });
            if (report.smallTapTargets.length >= 20) break;
        }
    }

    // Check inputs font size (< 16px triggers iOS zoom)
    const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea');
    for (const inp of inputs) {
        const comp = window.getComputedStyle(inp);
        const fSize = parseFloat(comp.fontSize);
        if (fSize < 16) {
            report.smallFontInputs.push({
                tag: inp.tagName.toLowerCase(),
                placeholder: inp.getAttribute('placeholder') || inp.getAttribute('name') || '',
                fontSize: comp.fontSize
            });
            if (report.smallFontInputs.length >= 15) break;
        }
    }

    // Check fixed / sticky elements (e.g., bottom bar, headers)
    for (const el of allEls) {
        const s = window.getComputedStyle(el);
        if (s.position === 'fixed' || s.position === 'sticky') {
            const rect = el.getBoundingClientRect();
            if (rect.height > 0 && rect.width > 0) {
                report.fixedBars.push({
                    tag: el.tagName.toLowerCase(),
                    position: s.position,
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                    height: Math.round(rect.height),
                    cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : ''
                });
            }
        }
    }

    return report;
}
"""

def main():
    creds = load_credentials()
    email = creds.get("E2E_STUDENT_EMAIL")
    password = creds.get("E2E_STUDENT_PASSWORD")

    if not email or not password:
        print("ERROR: Missing student credentials in e2e/.env.e2e", file=sys.stderr)
        sys.exit(1)

    os.makedirs("e2e/mobile-screenshots/before", exist_ok=True)
    all_audit_results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp in VIEWPORTS:
            vp_name = vp["name"]
            width = vp["width"]
            height = vp["height"]
            print(f"\n==========================================")
            print(f"Auditing Viewport: {vp_name} ({width}x{height})")
            print(f"==========================================")

            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2 if width < 768 else 1,
                has_touch=width < 768,
                is_mobile=width < 768,
            )
            page = context.new_page()

            # 1. Log in as student
            try:
                page.goto("http://localhost:3000/login", wait_until="networkidle", timeout=15000)
                student_tab = page.query_selector("#student-tab")
                if student_tab:
                    student_tab.click()
                    page.wait_for_timeout(200)

                # Fill student credentials
                ident_input = page.locator('input[type="text"], input[name="identifier"], input[placeholder*="Username" i]')
                pass_input = page.locator('input[type="password"]')
                submit_btn = page.locator('button[type="submit"]')

                if ident_input.count() > 0:
                    ident_input.first.fill(email)
                    pass_input.first.fill(password)
                    submit_btn.first.click()
                    page.wait_for_timeout(3500)
                    page.wait_for_load_state("networkidle")
                
                print(f"  Post-login URL: {page.url}")
            except Exception as e:
                print(f"Login failed on {vp_name}: {e}")

            all_audit_results[vp_name] = {}

            for target in PAGES:
                route = target["route"]
                pname = target["name"]
                url = f"http://localhost:3000{route}"

                try:
                    page.goto(url, wait_until="networkidle", timeout=12000)
                    page.wait_for_timeout(1000)
                except Exception as ex:
                    print(f"  Timeout or navigation issue on {route}: {ex}")

                # Take screenshot
                screenshot_path = f"e2e/mobile-screenshots/before/{vp_name}_{pname}.png"
                try:
                    page.screenshot(path=screenshot_path, full_page=False)
                except Exception as ex:
                    print(f"  Screenshot failed for {pname}: {ex}")

                # Run DOM analysis
                try:
                    res = page.evaluate(AUDIT_JS)
                    all_audit_results[vp_name][pname] = res
                    cur_url = res.get("url")
                    h_scroll = res.get("hasHorizontalScroll")
                    overflow_px = res.get("horizontalOverflowPx", 0)
                    small_targets = len(res.get("smallTapTargets", []))
                    small_fonts = len(res.get("smallFontInputs", []))
                    print(f"[{vp_name}] {pname} ({cur_url}) -> H-Scroll: {h_scroll} (+{overflow_px}px) | Small targets: {small_targets} | <16px inputs: {small_fonts}")
                except Exception as ex:
                    print(f"  DOM eval error on {route}: {ex}")

            # Specific tests for modals/dropdowns/special components on mobile_360
            if vp_name == "mobile_360":
                print("\n[mobile_360] Testing dropdowns & modal interactions...")
                try:
                    # Open Notification dropdown in Header
                    page.goto("http://localhost:3000/", wait_until="networkidle", timeout=10000)
                    bell_btn = page.locator('button[aria-label="Notifications"]')
                    if bell_btn.count() > 0:
                        bell_btn.first.click()
                        page.wait_for_timeout(500)
                        page.screenshot(path="e2e/mobile-screenshots/before/mobile_360_header_bell_dropdown.png")
                        res = page.evaluate(AUDIT_JS)
                        all_audit_results[vp_name]["header_bell_dropdown"] = res
                        print(f"  Header Bell Dropdown: H-Scroll: {res.get('hasHorizontalScroll')} (+{res.get('horizontalOverflowPx')}px)")

                    # Open Profile dropdown in Header
                    profile_btn = page.locator('header button:has-text("Student"), header button:has-text("Mogili"), header button:has(.w-8.h-8)')
                    if profile_btn.count() > 0:
                        profile_btn.first.click()
                        page.wait_for_timeout(500)
                        page.screenshot(path="e2e/mobile-screenshots/before/mobile_360_header_profile_dropdown.png")

                    # Open Enrollment modal on courses page
                    page.goto("http://localhost:3000/courses", wait_until="networkidle", timeout=10000)
                    enroll_btn = page.locator('button:has-text("Enroll Now"), button:has-text("Buy Course")')
                    if enroll_btn.count() > 0:
                        enroll_btn.first.click()
                        page.wait_for_timeout(500)
                        page.screenshot(path="e2e/mobile-screenshots/before/mobile_360_courses_enroll_modal.png")
                        res = page.evaluate(AUDIT_JS)
                        all_audit_results[vp_name]["courses_enroll_modal"] = res
                        print(f"  Enroll Modal: H-Scroll: {res.get('hasHorizontalScroll')} (+{res.get('horizontalOverflowPx')}px)")

                    # Test Submit confirmation modal on Test Attempt
                    page.goto("http://localhost:3000/tests/8a34de49-e2ce-41bd-8582-cb289b04bb73/attempt", wait_until="networkidle", timeout=10000)
                    submit_hdr_btn = page.locator('header button:has-text("Submit")')
                    if submit_hdr_btn.count() > 0:
                        submit_hdr_btn.first.click()
                        page.wait_for_timeout(500)
                        page.screenshot(path="e2e/mobile-screenshots/before/mobile_360_test_submit_modal.png")
                        res = page.evaluate(AUDIT_JS)
                        all_audit_results[vp_name]["test_submit_modal"] = res
                        print(f"  Test Submit Modal: H-Scroll: {res.get('hasHorizontalScroll')} (+{res.get('horizontalOverflowPx')}px)")
                except Exception as ex:
                    print(f"  Modal test error: {ex}")

            context.close()

        browser.close()

    # Save complete audit json
    with open("e2e/mobile_audit_results.json", "w") as f:
        json.dump(all_audit_results, f, indent=2)

    print("\nAudit completed! Results saved to e2e/mobile_audit_results.json and screenshots in e2e/mobile-screenshots/before/")

if __name__ == "__main__":
    main()
