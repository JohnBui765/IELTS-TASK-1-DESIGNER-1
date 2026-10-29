// Renders icons/icon.svg into the PNG sizes the manifest and iOS need.
// Usage: node tools/make-icons.mjs   (needs Playwright + Chromium)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// require() also finds a globally installed Playwright (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = new URL('../icons/', import.meta.url);
const svg = await readFile(new URL('icon.svg', root), 'utf8');
const square = svg.replace(/rx="114"/, 'rx="0"'); // iOS and maskable icons must be full-bleed
const targets = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'apple-touch-icon.png', size: 180, src: square },
  { file: 'maskable-512.png', size: 512, src: square },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const html = `<html><body style="margin:0;background:transparent">${t.src.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`;
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(new URL(t.file, root), buf);
  console.log('wrote', t.file);
}
await browser.close();
// Afterwards the PNGs were reduced to a 96-colour palette (Pillow quantize)
// to keep the first download small; re-run that step after re-rendering.
