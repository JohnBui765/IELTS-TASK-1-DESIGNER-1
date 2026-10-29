// Renders generated maps into screenshots for a visual check (not shipped):
//   node tests/e2e/map-preview.mjs [outDir]
// Serves the repo itself, so no dev server is needed. Also sweeps many seeds
// for label overlaps, clipping, overflow and small text, and reports render
// time and DOM size.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));
const out = process.argv[2] || '/tmp/claude-0/-home-user/aef5b6cb-45b7-5816-95e3-30ece895bee6/scratchpad/maps';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/tests/e2e/map-preview.html`;
mkdirSync(out, { recursive: true });

const SHOTS = [
  ['village', 'past', 3], ['town', 'present', 5], ['campus', 'future', 8], ['island', 'past', 11],
  ['park', 'present', 12], ['coast', 'future', 13], ['industrial', 'past', 14], ['school', 'present', 15],
  ['hospital', 'future', 16],
];

const browser = await chromium.launch();
let failed = false;
for (const dark of [false, true]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const page = await context.newPage();
  page.on('pageerror', (e) => {
    failed = true;
    console.error('page error:', e.message);
  });
  for (const [setting, frame, seed] of SHOTS) {
    await page.goto(`${base}?setting=${setting}&frame=${frame}&seed=${seed}&hl=${seed % 2}`);
    await page.waitForFunction(() => window.__ready);
    const r = await page.evaluate(() => window.__report);
    const name = `${setting}-${frame}-${seed}-${dark ? 'dark' : 'light'}`;
    await page.locator('.card').first().screenshot({ path: join(out, `${name}.png`) });
    console.log(`${name}: ${r.ms.toFixed(1)} ms, ${r.nodes} nodes${r.problems.length ? ` — ${r.problems.join('; ')}` : ''}`);
  }
  await context.close();
}

// Wide container: the two maps side by side.
const wide = await browser.newContext({ viewport: { width: 1024, height: 700 }, deviceScaleFactor: 1 });
const wp = await wide.newPage();
await wp.goto(`${base}?setting=village&frame=present&seed=21&theme=light`);
await wp.waitForFunction(() => window.__ready);
await wp.locator('.card').first().screenshot({ path: join(out, 'wide-village.png') });
await wide.close();

// Many seeds: automated label checks.
const sweep = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const sp = await sweep.newPage();
await sp.goto(`${base}?batch=270`);
await sp.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const rep = await sp.evaluate(() => window.__report);
console.log(`sweep: ${rep.maps} maps, first (cold) render ${rep.firstMs.toFixed(1)} ms, then max ${rep.maxMs.toFixed(1)} ms, max ${rep.maxNodes} elements, ${rep.problems.length} label problems`);
for (const p of rep.problems.slice(0, 30)) console.log('  ', p);
await browser.close();
server.close();
if (failed || rep.problems.length) process.exitCode = 1;
