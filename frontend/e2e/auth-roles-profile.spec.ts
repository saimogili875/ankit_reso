import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Task D: RBAC, Auth Flows, and Profile Card Tests', () => {
  test.beforeAll(async () => {
    const resultsDir = path.resolve(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
  });

  test('1. Header Login button navigates to /sign-in', async ({ page }) => {
    await page.goto('/');
    const loginLink = page.locator('.nav-actions a[href="/sign-in"]').first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('2. /sign-in renders brand heading and student portal indicator', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('text=Student Portal')).toBeVisible();
    await expect(page.locator('text=Are you a faculty member or administrator?')).toBeVisible();
  });

  test('3. Unauthenticated access to /admin redirects to /sign-in', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(url => url.pathname.includes('/sign-in') || url.pathname.includes('/login'));
    expect(page.url()).toMatch(/\/(sign-in|login)/);
  });

  test('4. 403 Forbidden page displays proper error states and options', async ({ page }) => {
    await page.goto('/403');
    await expect(page.locator('text=Access Restricted')).toBeVisible();
    await expect(page.locator('text=403')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Dashboard' })).toBeVisible();
  });

  test('5. Profile Card renders responsively at 360px (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/#teacher');

    const facultyCard = page.locator('#faculty-profile-card');
    await expect(facultyCard).toBeVisible();

    const halo = facultyCard.locator('.portrait-halo').first();
    const badge = facultyCard.locator('.iit-seal-badge').first();
    await expect(halo).toBeVisible();
    await expect(badge).toBeVisible();

    // Verify badge sits below the halo with clean separation (no overlap)
    const haloBox = await halo.boundingBox();
    const badgeBox = await badge.boundingBox();
    expect(haloBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    if (haloBox && badgeBox) {
      expect(badgeBox.y).toBeGreaterThanOrEqual(haloBox.y + haloBox.height - 2);
    }

    await facultyCard.screenshot({ path: 'test-results/profile-card-360px.png' });
  });

  test('6. Profile Card renders responsively at 768px (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/#teacher');

    const facultyCard = page.locator('#faculty-profile-card');
    await expect(facultyCard).toBeVisible();

    const halo = facultyCard.locator('.portrait-halo').first();
    const badge = facultyCard.locator('.iit-seal-badge').first();
    await expect(halo).toBeVisible();
    await expect(badge).toBeVisible();

    const haloBox = await halo.boundingBox();
    const badgeBox = await badge.boundingBox();
    if (haloBox && badgeBox) {
      expect(badgeBox.y).toBeGreaterThanOrEqual(haloBox.y + haloBox.height - 2);
    }

    await facultyCard.screenshot({ path: 'test-results/profile-card-768px.png' });
  });

  test('7. Profile Card renders responsively at 1440px (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#teacher');

    const facultyCard = page.locator('#faculty-profile-card');
    await expect(facultyCard).toBeVisible();

    const halo = facultyCard.locator('.portrait-halo').first();
    const badge = facultyCard.locator('.iit-seal-badge').first();
    await expect(halo).toBeVisible();
    await expect(badge).toBeVisible();

    const haloBox = await halo.boundingBox();
    const badgeBox = await badge.boundingBox();
    if (haloBox && badgeBox) {
      expect(badgeBox.y).toBeGreaterThanOrEqual(haloBox.y + haloBox.height - 2);
    }

    await facultyCard.screenshot({ path: 'test-results/profile-card-1440px.png' });
  });
});
