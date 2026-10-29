// The starter set must pass the same checks as an imported pack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_ENTRIES, CORE_VERSION } from '../../js/data/core-pack.js';
import { checkEntry } from '../../js/core/knowledge.js';
import { MIN_EXAMPLES } from '../../js/core/kb-schema.js';
import { countMarks, stripMarks } from '../../js/core/marked.js';

test('every starter entry is valid, with at least three marked examples', () => {
  assert.ok(CORE_VERSION);
  const ids = new Set();
  for (const e of CORE_ENTRIES) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    const { entry, problems } = checkEntry(e);
    assert.ok(entry, `${e.id}: ${problems}`);
    assert.deepEqual(problems, [], `${e.id}: ${problems}`);
    assert.equal(countMarks(e.text), 1, e.id);
    assert.ok(e.examples.length >= MIN_EXAMPLES, e.id);
    for (const x of e.examples) {
      assert.equal(countMarks(x.text), 1, `${e.id}: ${x.text}`);
      assert.match(stripMarks(x.text), /[.!?)]$/, `${e.id}: ${x.text}`);
      assert.doesNotMatch(stripMarks(x.text), /\b(I|we|you)\b|n't\b/, `${e.id}: ${x.text}`);
    }
  }
  assert.ok(CORE_ENTRIES.length >= 100, `${CORE_ENTRIES.length} entries`);
});
