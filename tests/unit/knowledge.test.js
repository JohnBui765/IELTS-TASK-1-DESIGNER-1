import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyImport, checkEntry, exportPack, findSame, planImport, readPack } from '../../js/core/knowledge.js';
import { PROJECT_INSTRUCTIONS, buildExtractPrompt } from '../../js/core/kb-prompt.js';
import { countMarks } from '../../js/core/marked.js';

const ex = (t, from = 'claude') => ({ text: t, from });
const ENTRY = {
  kind: 'phrase',
  text: 'The line graph [[sets out]] the main reasons people gave for moving.',
  types: ['line', 'bar'],
  section: 'intro',
  level: 'C1',
  note: 'Precise reporting verb.',
  examples: [
    ex('The bar chart [[sets out]] the amount of money spent on leisure in five countries in 2019.', 'book'),
    ex('The table [[sets out]] the number of international students at four universities between 2010 and 2020.'),
    ex('The diagram [[sets out]] the main stages in the production of olive oil, from harvesting to bottling.'),
  ],
};
const reply = (entries, pack = { title: 'Unit 3', source: 'IELTS Expert, Unit 3', more: false }) =>
  'Here you go:\n```json\n' + JSON.stringify({ format: 'task1-kb/1', pack, entries }) + '\n```\nAnything else?';

let n = 0;
const idGen = () => `id${++n}`;

describe('readPack', () => {
  test('reads a fenced reply with prose around it', () => {
    const { meta, rawEntries, problems } = readPack(reply([ENTRY]));
    assert.equal(rawEntries.length, 1);
    assert.equal(meta.title, 'Unit 3');
    assert.equal(meta.more, false);
    assert.deepEqual(problems, []);
  });

  test('flags the instructions pasted instead of a reply', () => {
    for (const text of [PROJECT_INSTRUCTIONS, buildExtractPrompt({ have: ['a [[b]] c'] })]) {
      const { rawEntries, problems } = readPack(text);
      assert.equal(rawEntries.length, 0);
      assert.match(problems[0], /prompt, not/);
    }
  });

  test('rescues complete entries from a reply cut off half-way', () => {
    const full = reply([ENTRY, { ...ENTRY, text: 'X [[accounts for]] a quarter of the total.' }]);
    const cut = full.slice(0, full.indexOf('accounts for') + 40);
    const { rawEntries } = readPack(cut);
    assert.equal(rawEntries.length, 1);
  });

  test('reads a bare array and smart quotes', () => {
    const text = '[{“kind”: “rule”, “text”: “The process [[comprises]] six stages.”, “examples”: []}]';
    assert.equal(readPack(text).rawEntries.length, 1);
  });

  test('nothing readable gives one clear problem', () => {
    const { rawEntries, problems } = readPack('hello');
    assert.equal(rawEntries.length, 0);
    assert.match(problems[0], /Could not read/);
  });

  test('reports "more"', () => {
    assert.equal(readPack(reply([ENTRY], { title: 'U', more: true })).meta.more, true);
  });
});

describe('checkEntry', () => {
  test('keeps a valid entry intact', () => {
    const { entry, problems } = checkEntry(ENTRY);
    assert.deepEqual(problems, []);
    assert.equal(entry.examples.length, 3);
    assert.deepEqual(entry.types, ['line', 'bar']);
  });

  test('marks the text from its examples and examples from the text, with endings', () => {
    const { entry } = checkEntry({
      text: 'Sales peak at a figure.',
      level: 'b2+',
      section: 'Trends',
      examples: ['Sales [[peaked at]] 90,000 in 2015.', 'Visitor numbers peaked at 4 million in 2019, before falling sharply.', 'Imports peaking at 300 tonnes were recorded in 2001 in the table.'],
    });
    assert.equal(entry.text, 'Sales [[peak at]] a figure.');
    assert.equal(entry.level, 'B2+');
    assert.equal(entry.section, 'trend');
    assert.ok(entry.examples.every((x) => countMarks(x.text) === 1));
    assert.match(entry.examples[1].text, /\[\[peaked at\]\]/);
  });

  test('rejects an entry with nothing to drill', () => {
    const { entry, problems } = checkEntry({ text: 'Overall, things changed.', examples: [] });
    assert.equal(entry, null);
    assert.match(problems[0], /No \[\[ \]\]/);
  });

  test('normalises kind, types "all", unknown section, wrong forms', () => {
    const { entry, problems } = checkEntry({
      kind: 'Grammar',
      text: 'The process [[comprises]] six stages.',
      types: 'all',
      section: 'whatever',
      wrong: ['comprises of', 'comprises', 'x'],
      examples: [],
    });
    assert.equal(entry.kind, 'phrase');
    assert.deepEqual(entry.types, []);
    assert.equal(entry.section, 'general');
    assert.deepEqual(entry.wrong, ['comprises of']);
    assert.ok(problems.some((p) => /No usable examples/.test(p)));
  });

  test('keeps only the first of several marks', () => {
    const { entry, problems } = checkEntry({ text: '[[What stands out]] is [[that]] X.', examples: [] });
    assert.equal(entry.text, '[[What stands out]] is that X.');
    assert.ok(problems.includes('Kept the first [[ ]] only.'));
  });
});

describe('planImport / applyImport', () => {
  const existing = [{ id: 'e1', ...checkEntry(ENTRY).entry, examples: checkEntry(ENTRY).entry.examples.slice(0, 2) }];

  test('new, merge (adds examples), duplicate and reject', () => {
    const plan = planImport(
      reply([
        ENTRY,
        { ...ENTRY, text: 'The line graph [[sets out]] the main reasons people gave for moving.', examples: ENTRY.examples.slice(0, 2) },
        { kind: 'rule', text: 'The process [[comprises]] six stages.', wrong: ['comprises of'], level: 'C1', section: 'overview', examples: [] },
        { text: 'no marks here' },
      ]),
      existing,
    );
    const actions = plan.items.map((i) => i.action);
    assert.deepEqual(actions, ['merge', 'new', 'reject']);
    assert.equal(plan.items[0].examples.length, 1);
    const { pack, entries } = applyImport(plan, plan.items.filter((i) => i.action !== 'reject'), { now: 5, idGen });
    assert.equal(pack.counts.new, 1);
    assert.equal(pack.counts.merged, 1);
    assert.equal(entries.length, 2);
    const merged = entries.find((e) => e.id === 'e1');
    assert.equal(merged.examples.length, 3);
    assert.equal(merged.examples[2].packId, pack.id);
    assert.deepEqual(pack.added, [{ entryId: 'e1', exampleIds: [merged.examples[2].id] }]);
    const created = entries.find((e) => e.id !== 'e1');
    assert.equal(created.origin, 'import');
    assert.equal(created.packId, pack.id);
    assert.equal(created.source, 'IELTS Expert, Unit 3');
  });

  test('an entry already complete is a duplicate', () => {
    const full = [{ id: 'e1', ...checkEntry(ENTRY).entry }];
    assert.deepEqual(planImport(reply([ENTRY]), full).items.map((i) => i.action), ['duplicate']);
  });

  test('a near-identical text with the same drilled words is the same item', () => {
    const variant = { ...ENTRY, text: 'The line chart [[sets out]] the main reasons people gave for moving.' };
    assert.equal(findSame(checkEntry(variant).entry, existing)?.id, 'e1');
  });

  test('duplicates inside one reply fold into the first', () => {
    const second = { ...ENTRY, examples: [ex('The pie chart [[sets out]] how household spending was divided among six categories in 2020.')] };
    const plan = planImport(reply([ENTRY, second]), []);
    assert.equal(plan.items.length, 1);
    assert.equal(plan.items[0].entry.examples.length, 4);
  });

  test('an exported pack re-imports as duplicates (ids kept)', () => {
    const plan = planImport(JSON.stringify(exportPack(existing)), existing);
    assert.deepEqual(plan.items.map((i) => i.action), ['duplicate']);
  });

  test('lint issues are attached to new entries', () => {
    const plan = planImport(reply([ENTRY]), [], { lintExample: (t) => (/money/.test(t) ? ['informal'] : []) });
    assert.equal(plan.items[0].issues.length, 1);
  });
});
