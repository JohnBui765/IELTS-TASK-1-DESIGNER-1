// The guide must carry the exact instructions the app copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { knowledgeDoc } from '../../tools/build-docs.mjs';

test('docs/knowledge-format.md is up to date', async () => {
  const doc = await readFile(new URL('../../docs/knowledge-format.md', import.meta.url), 'utf8');
  assert.equal(doc, knowledgeDoc(), 'run: node tools/build-docs.mjs');
});
