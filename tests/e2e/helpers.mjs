// Helpers for the Playwright scripts. Needs the dev server: node tools/serve.mjs 8080
import { createRequire } from 'node:module';

// require() also finds a globally installed Playwright (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

export const BASE = process.env.BASE_URL || 'http://localhost:8080';

export const DEVICES = {
  se: { width: 375, height: 667 }, // iPhone SE (smallest supported)
  iphone: { width: 390, height: 844 }, // iPhone 13/14/15
  max: { width: 430, height: 932 }, // iPhone Pro Max
};

// Opens the app in a phone-sized, touch-enabled context and collects errors.
export async function launch({ device = 'iphone', dark = false, serviceWorkers = 'block', headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: DEVICES[device] || DEVICES.iphone,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: dark ? 'dark' : 'light',
    serviceWorkers,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(BASE + '/');
  await page.waitForSelector('.screen');
  return { browser, context, page, errors };
}
