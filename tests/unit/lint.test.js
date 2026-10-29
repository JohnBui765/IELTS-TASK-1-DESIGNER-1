import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkEssay, countWords, lintSentence } from '../../js/core/lint.js';
import { CORE_ENTRIES } from '../../js/data/core-pack.js';

const ids = (r) => r.issues.map((i) => i.id);
const filler = ' The figures are shown for each country.'.repeat(30);

describe('checkEssay', () => {
  test('counts words as IELTS does', () => {
    assert.equal(countWords('It rose to 2,000 tonnes (18–24 age group), up 50%.'), 10);
    assert.equal(countWords('  '), 0);
  });

  test('a clean answer has no errors and earns credits', () => {
    const text = 'The line graph sets out the amount of coal exported by two countries between 2000 and 2025. Overall, exports from both countries rose, and what stands out is that Indonesia overtook Australia.' + filler;
    const r = checkEssay(text, { entries: CORE_ENTRIES });
    assert.deepEqual(r.issues.filter((i) => i.severity === 'error').map((i) => i.id), []);
    assert.ok(r.credits.some((c) => c.phrase.toLowerCase() === 'sets out'));
    assert.ok(r.credits.some((c) => /what stands out is that/i.test(c.phrase)));
  });

  test('flags the rules from CLAUDE-task1.md', () => {
    const text = "Overall, we can see that sales went up a lot. Surprisingly, prices were risen in 2010 and it didn't stop. The process comprises of six stages. Why did this happen? Bycontrast, exports has been increased by 20% because demand grew." + filler;
    const r = checkEssay(text, { entries: CORE_ENTRIES });
    for (const id of ['person', 'informal', 'subjective', 'passive-never', 'contraction', 'comprise-of', 'question', 'bycontrast', 'passive-check', 'speculation']) {
      assert.ok(ids(r).includes(id), `missing ${id}: ${ids(r)}`);
    }
  });

  test('length, overview and a copied introduction', () => {
    const rubric = 'The graph below shows coal exports from four countries between 2000 and 2025.';
    const r = checkEssay('The graph below shows coal exports from four countries between 2000 and 2025. Exports rose in every country, and Australia stayed ahead. ' + 'Figures rose. '.repeat(30), { rubric });
    assert.ok(ids(r).includes('copied'));
    assert.ok(ids(r).includes('overview'));
    assert.ok(checkEssay('Overall, it rose.').issues.some((i) => i.id === 'length'));
  });

  test('a legitimate passive with an agent is not flagged', () => {
    const r = checkEssay('Overall, the car park was expanded by the council.' + filler);
    assert.ok(!ids(r).includes('passive-check'));
  });

  test('"US" is a country, not a pronoun', () => {
    const r = checkEssay('Overall, the figure for the US rose.' + filler);
    assert.ok(!ids(r).includes('person'));
  });

  test('bank wrong forms are flagged once, not twice with a built-in rule', () => {
    const r = checkEssay('Overall, North America can boast 19% of production, and the area changed a lot.' + filler, { entries: CORE_ENTRIES });
    assert.ok(r.issues.some((i) => i.title === '“can boast”'));
    assert.equal(r.issues.filter((i) => /a lot/.test(i.matches?.map((m) => m.text).join(' ') || '')).length, 1);
  });

  test('more than one dramatic verb', () => {
    const r = checkEssay('Overall, sales soared and then plummeted.' + filler);
    assert.ok(ids(r).includes('dramatic'));
  });
});

test('lintSentence lists the rules an example breaks', () => {
  assert.deepEqual(lintSentence('Sales rose sharply in 2010.'), []);
  assert.ok(lintSentence("We can see that it didn't rise a lot.").length >= 3);
});
