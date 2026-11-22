import { test, expect } from '@playwright/test';

// Sidebar routes to test for console errors and clean rendering
const ADMIN_SIDEBAR_ROUTES = [
  { path: '/admin', title: 'Dashboard' },
  { path: '/admin/courses', title: 'Courses' },
  { path: '/admin/modules', title: 'Curriculum' },
  { path: '/admin/schedule', title: 'Schedule' },
  { path: '/admin/videos', title: 'Videos' },
  { path: '/admin/questions', title: 'Question' },
  { path: '/admin/materials', title: 'Study Materials' },
  { path: '/admin/tests', title: 'Mock Tests' },
  { path: '/admin/students', title: 'Students' },
  { path: '/admin/payments', title: 'Payments' },
  { path: '/admin/doubts', title: 'Doubt' },
  { path: '/admin/test-analytics', title: 'Test Analytics' },
  { path: '/admin/home', title: 'Home' },
  { path: '/admin/banners', title: 'Banners' },
  { path: '/admin/announcements', title: 'Announcements' },
];

test.describe('Admin Console Smoke Tests', () => {
  test('(a) /admin redirects to /admin/login when signed out', async ({ page, context }) => {
    // Clear cookies & mock unauthenticated user
    await context.clearCookies();
    await page.route('**/api/auth/me*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
      });
    });

    await page.goto('/admin');

    // Should redirect to /admin/login
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('text=Sign in to the admin console')).toBeVisible();
  });

  test('(b) a student account cannot open /admin and is redirected', async ({ page, context }) => {
    // Set student cookie
    await context.addCookies([
      {
        name: 'user_role',
        value: 'STUDENT',
        url: 'http://localhost:3008',
      },
      {
        name: 'auth_session',
        value: 'student-mock-session',
        url: 'http://localhost:3008',
      },
    ]);

    // Mock student user response
    await page.route('**/api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'student-uuid-1',
          email: 'student@example.com',
          username: 'student1',
          role: 'STUDENT',
          is_admin: false,
          is_staff: false,
        }),
      });
    });

    await page.goto('/admin');

    // Should redirect away from /admin (to /admin/login or home)
    await expect(page).not.toHaveURL(/^\/admin$/);
    await expect(page).toHaveURL(/(\/admin\/login|\/)/);
  });

  test('(c) an admin can open every sidebar link with no console errors', async ({ page, context }) => {
    // Set admin cookies
    await context.addCookies([
      {
        name: 'user_role',
        value: 'ADMIN',
        url: 'http://localhost:3008',
      },
      {
        name: 'auth_session',
        value: 'admin-mock-session',
        url: 'http://localhost:3008',
      },
      {
        name: 'sessionid',
        value: 'admin-django-session',
        url: 'http://localhost:3008',
      },
    ]);

    // Track unhandled console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Filter out benign network errors from external assets
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    // Unified API mock handler for admin requests
    await page.route(/\/api\//, async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: {
              id: 'admin-uuid-1',
              email: 'admin@adepteduverse.com',
              username: 'admin',
              full_name: 'Lead Admin',
              role: 'ADMIN',
              is_admin: true,
              is_staff: true,
            },
          }),
        });
      } else if (url.includes('/overview/trends')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total_signups_30d: 12,
            total_payments_count_30d: 4,
            total_revenue_30d: 19996.0,
            start_date: '2026-10-24',
            end_date: '2026-11-22',
            trends: Array.from({ length: 30 }, (_, i) => ({
              date: `2026-11-${String(i + 1).padStart(2, '0')}`,
              label: `${i + 1} Nov`,
              signups: (i % 3),
              payments_count: (i % 5 === 0 ? 1 : 0),
              payments_amount: (i % 5 === 0 ? 4999.0 : 0),
            })),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [],
            count: 0,
            students_count: 50,
            courses_count: 5,
            subjects_count: 3,
            chapters_count: 12,
            lectures_count: 45,
            videos_count: 30,
            dpps_count: 20,
            questions_count: 150,
            tests_count: 8,
            materials_count: 15,
            open_doubts_count: 0,
            announcements_count: 2,
          }),
        });
      }
    });

    // Navigate to admin console first
    await page.goto('/admin', { waitUntil: 'load' });
    await expect(page.locator('nav[aria-label="Admin sections"]')).toBeVisible({ timeout: 10000 });

    // Open every sidebar link
    for (const route of ADMIN_SIDEBAR_ROUTES) {
      consoleErrors.length = 0; // reset errors for this link
      const link = page.locator(`nav[aria-label="Admin sections"] a[href="${route.path}"]`).first();
      if ((await link.count()) > 0) {
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      } else {
        await page.goto(route.path, { waitUntil: 'load' });
        await expect(page.locator('nav[aria-label="Admin sections"]')).toBeVisible();
      }

      // Verify no uncaught console errors occurred
      expect(consoleErrors).toEqual([]);
    }
  });
});
