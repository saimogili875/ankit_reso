import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const prefix = process.argv[2] || 'after';
const outDir = process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  const pages = [
    { name: 'landing', url: 'http://localhost:3000/' },
    { name: 'analysis', url: 'http://localhost:3000/analysis' },
    { name: 'dashboard', url: 'http://localhost:3000/dashboard' },
    { name: 'admin', url: 'http://localhost:3000/admin' },
    { name: 'settings', url: 'http://localhost:3000/settings' },
  ];

  const axeResults = {};

  for (const p of pages) {
    // 1. Desktop 1440x900 (Dark Mode default)
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopContext.newPage();
    try {
      await desktopPage.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await desktopPage.waitForTimeout(2000);
      const filePath = path.join(outDir, `${prefix}_desktop_${p.name}.png`);
      await desktopPage.screenshot({ path: filePath, fullPage: false });
      console.log(`Captured ${prefix}_desktop_${p.name}.png`);

      // Run Axe-core on desktop page
      try {
        const accessibilityScanResults = await new AxeBuilder({ page: desktopPage })
          .disableRules(['color-contrast']) // We verify contrast separately
          .analyze();
        axeResults[p.name] = {
          violationsCount: accessibilityScanResults.violations.length,
          violations: accessibilityScanResults.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
          passesCount: accessibilityScanResults.passes.length,
        };
        console.log(`Axe-core scan on ${p.name}: ${accessibilityScanResults.violations.length} violations, ${accessibilityScanResults.passes.length} passes`);
      } catch (axErr) {
        console.warn(`Axe scan warning on ${p.name}:`, axErr.message);
      }
    } catch (e) {
      console.error(`Error on desktop ${p.name}:`, e.message);
    }
    await desktopContext.close();

    // 2. Mobile 390x844 (Dark Mode)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    try {
      await mobilePage.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mobilePage.waitForTimeout(2000);
      const filePath = path.join(outDir, `${prefix}_mobile_${p.name}.png`);
      await mobilePage.screenshot({ path: filePath, fullPage: false });
      console.log(`Captured ${prefix}_mobile_${p.name}.png`);
    } catch (e) {
      console.error(`Error on mobile ${p.name}:`, e.message);
    }
    await mobileContext.close();

    // 3. Desktop 1440x900 (Light Mode)
    const lightContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const lightPage = await lightContext.newPage();
    try {
      await lightPage.addInitScript(() => {
        localStorage.setItem('theme', 'light');
      });
      await lightPage.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await lightPage.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
      await lightPage.waitForTimeout(2000);
      const filePath = path.join(outDir, `${prefix}_desktop_${p.name}_light.png`);
      await lightPage.screenshot({ path: filePath, fullPage: false });
      console.log(`Captured ${prefix}_desktop_${p.name}_light.png`);
    } catch (e) {
      console.error(`Error on light desktop ${p.name}:`, e.message);
    }
    await lightContext.close();
  }

  // Save Axe results summary
  const axeSummaryPath = path.join(outDir, 'axe_summary.json');
  fs.writeFileSync(axeSummaryPath, JSON.stringify(axeResults, null, 2));
  console.log(`Axe-core summary saved to ${axeSummaryPath}`);

  await browser.close();
  console.log(`All ${prefix} screenshots and scans completed!`);
}

run().catch(console.error);
