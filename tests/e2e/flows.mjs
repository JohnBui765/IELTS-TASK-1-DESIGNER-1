// End-to-end flows on an iPhone-sized screen: every task type, the language
// panel, chart editing, practice, the knowledge import, writing and the
// checker, and offline start. Needs the dev server (node tools/serve.mjs 8080).
// Usage: node tests/e2e/flows.mjs [--dark]
import assert from 'node:assert/strict';
import { launch } from './helpers.mjs';

const dark = process.argv.includes('--dark');
const { browser, page, errors } = await launch({ dark, serviceWorkers: 'allow' });
const wait = (ms) => page.waitForTimeout(ms);
const top = '.screen:not(.covered)';
const step = (name) => console.log('·', name);

try {
  await page.waitForSelector('.review');
  await wait(400);

  for (const [i, type] of ['line', 'bar', 'pie', 'table', 'map', 'process', 'mixed'].entries()) {
    step(`new ${type} task`);
    await page.click(`.type-tile:nth-child(${i + 1})`);
    await page.waitForSelector(`${top}.task-screen .visual-card svg, ${top}.task-screen .ch-table`, { timeout: 8000 });
    const lines = await page.$$eval(`${top} .lang-line`, (els) => els.length);
    assert.ok(lines >= 1, `${type}: no model language`);
    for (const tab of [2, 3]) {
      await page.click(`${top} .segmented button:nth-child(${tab + 1})`);
      assert.ok((await page.$$eval(`${top} .lang-line`, (els) => els.length)) >= 1, `${type}: empty tab ${tab}`);
    }
    await page.click(`${top} .nav-back`);
    await wait(500);
  }

  step('edit a chart and keep the change');
  await page.click('.type-tile:nth-child(1)');
  await page.waitForSelector(`${top} .ch-svg`);
  await page.click(`${top} .visual-tools .btn`);
  const hit = await page.$(`${top} .ch-hit`);
  const b = await hit.boundingBox();
  const before = await hit.getAttribute('aria-valuenow');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  await wait(700);
  assert.notEqual(await (await page.$(`${top} .ch-hit`)).getAttribute('aria-valuenow'), before, 'drag did not change the value');

  step('practise the task');
  await page.click(`${top} .footer .btn:first-child`);
  await page.waitForSelector('.practice .practice-card');
  const field = await page.$('.practice-card input.cz-field');
  if (field) await field.fill('anything');
  else await page.click('.practice-card .chip, .practice-card .dr-option');
  await page.click('.pf-actions > .btn');
  await page.waitForSelector('.practice-footer[data-state="wrong"], .practice-footer[data-state="right"], .practice-footer[data-state="close"], .practice-footer[data-state="grade"]');
  await page.click('.practice-top .icon-btn');
  await wait(400);
  await page.click('.alert-actions button.destructive');
  await page.waitForSelector('.results');
  await page.click('.results .footer .btn:last-child');
  await wait(600);

  step('write and check');
  await page.click(`${top} .footer .btn:last-child`);
  await page.waitForSelector('.w-area');
  await page.fill('.w-area', 'Overall, we can see that the figures went up a lot.');
  await page.click(`${top}.write-screen .footer .btn:first-child`);
  await page.waitForSelector('.w-issue');
  const titles = await page.$$eval('.w-issue strong', (els) => els.map((e) => e.textContent));
  assert.ok(titles.some((t) => /Personal pronoun/.test(t)) && titles.some((t) => /Informal/.test(t)), titles.join(' | '));
  await page.click(`${top} .nav-back`);
  await wait(500);
  await page.click(`${top} .nav-back`);
  await wait(500);

  step('import knowledge from a Claude reply, then undo it');
  await page.click('.tabbar .tab[data-tab="knowledge"]');
  await page.waitForSelector('.kb-row');
  const count = async () => Number((await page.textContent('.kb-count')).match(/of (\d+)/)[1]);
  const n0 = await count();
  await page.click(`${top} .nav-action`);
  await page.click('.action-sheet button:has-text("Add knowledge from Claude")');
  await page.waitForSelector('.import-screen textarea');
  const ex = (t) => ({ text: t, from: 'claude' });
  await page.fill('.import-screen textarea', '```json\n' + JSON.stringify({ format: 'task1-kb/1', pack: { title: 'Test unit', source: 'Test', more: false }, entries: [{ kind: 'phrase', text: 'Visitor numbers [[edged up]] to 4.2 million.', section: 'trend', level: 'B2', types: ['line'], examples: [ex('Prices [[edged up]] to £4.20 in 2019.'), ex('The rate [[edged up]] from 5% to 6%.'), ex('Exports [[edged up]] slightly in the final year.')] }] }) + '\n```');
  await page.waitForSelector('.imp-item.on');
  await page.click('.import-screen .footer .btn');
  await wait(800);
  assert.equal(await count(), n0 + 1);
  await page.click(`${top} .nav-action`);
  await page.click('.action-sheet button:has-text("Imports")');
  await page.waitForSelector('.packs');
  await page.click('.packs .row.tappable');
  await page.click('.alert-actions button.destructive');
  await wait(600);
  await page.click(`${top} .nav-back`);
  await wait(600);
  assert.equal(await count(), n0);

  step('reload offline');
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForSelector('.screen');
  await page.context().setOffline(false);

  assert.deepEqual(errors.filter((e) => !/Failed to load resource/.test(e)), []);
  console.log('All flows passed.');
} finally {
  await browser.close();
}
