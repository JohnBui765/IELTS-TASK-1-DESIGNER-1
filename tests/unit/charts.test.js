import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CHART_KINDS, chartRubric, generateChart, niceAxis, splitHundred } from '../../js/core/charts.js';
import { describeChart, fmtValue, fractionPhrase } from '../../js/core/describe.js';
import { makeRng } from '../../js/core/rng.js';
import { countMarks, stripMarks } from '../../js/core/marked.js';
import { TOPICS } from '../../js/core/topics.js';

const NOW = Date.UTC(2026, 9, 28);
const SEEDS = 150;

function* allCharts() {
  for (const kind of CHART_KINDS) for (let s = 1; s <= SEEDS; s++) yield [kind, s, generateChart(makeRng(s * 7919 + kind.length), { kind, now: NOW })];
  for (const t of TOPICS) for (let s = 1; s <= 6; s++) {
    const kind = t.shape === 'parts' ? (s % 2 ? 'pie' : 'table') : t.shape === 'groups' ? (s % 2 ? 'bar' : 'table') : ['line', 'bar', 'table'][s % 3];
    yield [kind, s, generateChart(makeRng(s * 104729), { kind, now: NOW, topicId: t.id })];
  }
}

describe('generateChart', () => {
  test('is deterministic for a seed', () => {
    for (const kind of CHART_KINDS) {
      assert.deepEqual(generateChart(makeRng(42), { kind, now: NOW }), generateChart(makeRng(42), { kind, now: NOW }));
    }
  });

  test('produces well-formed visuals', () => {
    for (const [kind, seed, v] of allCharts()) {
      const where = `${kind} #${seed} ${v.topicId}`;
      assert.match(chartRubric(v), /^The .+ below shows? .+\.$/, where);
      assert.doesNotMatch(chartRubric(v), /undefined|NaN|null|\s\s/, where);
      if (v.kind === 'pie') {
        assert.ok(v.pies.length >= 1 && v.pies.length <= 3, where);
        for (const p of v.pies) {
          assert.equal(p.slices.reduce((s, x) => s + x.value, 0), 100, where);
          assert.ok(p.slices.length <= 6 && p.slices.every((x) => x.value >= 2), where);
        }
        continue;
      }
      assert.ok(v.series.length >= 1 && v.series.length <= 6, where);
      for (const s of v.series) {
        assert.equal(s.values.length, v.x.values.length, where);
        assert.ok(s.values.every((x) => Number.isFinite(x) && x >= 0 && x <= v.axis.max), `${where} ${s.values} > ${v.axis.max}`);
      }
      if (v.unit.kind === 'percent') assert.ok(v.axis.max <= 100, where);
      if (v.x.kind === 'year' && v.frame === 'past') assert.ok(Number(v.x.values.at(-1)) < 2026, where);
      if (v.frame === 'future') assert.ok(Number(v.x.values[0]) > 2026, where);
      if (v.frame === 'mixed') assert.ok(Number(v.x.values[v.x.projectedFrom]) >= 2028, where);
    }
  });

  test('splitHundred sums to 100 without ties', () => {
    for (let s = 1; s < 300; s++) {
      const rng = makeRng(s);
      const w = Array.from({ length: 3 + (s % 4) }, () => rng() * 10);
      const parts = splitHundred(w);
      assert.equal(parts.reduce((a, b) => a + b, 0), 100);
      assert.equal(new Set(parts).size, parts.length, String(parts));
    }
  });

  test('niceAxis gives 3–6 clean ticks above the top value', () => {
    for (const top of [0.9, 7.3, 48, 99, 352, 1980, 519000]) {
      const { max, step } = niceAxis(top);
      assert.ok(max >= top && max / step >= 3 && max / step <= 6, `${top} → ${max}/${step}`);
    }
    assert.deepEqual(niceAxis(83, { percent: true }), { max: 100, step: 20 });
  });
});

describe('describeChart', () => {
  const PAST = /\b(rose|fell|was|were|stood|peaked|declined|increased|decreased|had)\b/;
  const FUTURE = /\b(will|expected|projected)\b/;

  test('every line is one clean sentence with exactly one [[ ]]', () => {
    for (const [kind, seed, v] of allCharts()) {
      const d = describeChart(v, { seed });
      assert.ok(d.intro.length >= 1 && d.overview.length >= 1 && d.body.length >= 2, `${kind} #${seed} ${v.topicId}: ${JSON.stringify(d).slice(0, 300)}`);
      for (const l of [...d.intro, ...d.overview, ...d.body]) {
        const where = `${kind} #${seed} ${v.topicId}: ${l.text}`;
        assert.equal(countMarks(l.text), 1, where);
        assert.match(stripMarks(l.text), /^[A-Z].*\.$/, where);
        assert.doesNotMatch(l.text, /undefined|NaN|null|\s\s|\s[,.]|\[\[\s|\s\]\]/, where);
      }
    }
  });

  test('tense follows the time frame', () => {
    for (const [kind, seed, v] of allCharts()) {
      const d = describeChart(v, { seed });
      for (const l of [...d.overview, ...d.body]) {
        const t = stripMarks(l.text);
        const where = `${v.frame} ${kind} #${seed}: ${t}`;
        if (v.frame === 'typical' || v.frame === 'undated') assert.doesNotMatch(t, PAST, where);
        if (v.frame === 'past' || v.frame === 'dated') assert.doesNotMatch(t, FUTURE, where);
        if (v.frame === 'future') assert.doesNotMatch(t, /\b(rose|fell|stood|was|were)\b/, where);
      }
    }
  });

  test('the opening figure matches the data', () => {
    for (const [, seed, v] of allCharts()) {
      if (v.kind === 'pie' || v.x.kind === 'category' || v.partsOf) continue;
      const first = describeChart(v, { seed }).body[0].text;
      if (/close to zero/.test(first)) continue;
      assert.ok(stripMarks(first).includes(fmtValue(v.series[0].values[0], v.unit)), first);
    }
  });

  test('"other" is never ranked', () => {
    for (const [, seed, v] of allCharts()) {
      if (v.kind !== 'pie') continue;
      for (const l of describeChart(v, { seed }).body) assert.doesNotMatch(stripMarks(l.text), /^Other\b|followed by other/, l.text);
    }
  });

  test('"By <year>, … had risen to" ends at the series high (or low), and every task has an overview', () => {
    for (const [, seed, v] of allCharts()) {
      const text = describeChart(v, { seed });
      assert.ok(text.overview.length >= 1, `${v.kind} #${seed} ${v.topicId}: no overview`);
      if (v.kind === 'pie') continue;
      for (const l of text.body) {
        const m = stripMarks(l.text).match(/^By \d{4}, (.+) (?:had|will have) (risen|fallen) to (.+)\.$/);
        if (!m) continue;
        const series = v.series.find((s) => m[1].includes(s.name) || m[1].includes(v.prose?.[s.name]));
        const vals = series.values;
        const end = vals.at(-1);
        assert.equal(end, m[2] === 'risen' ? Math.max(...vals) : Math.min(...vals), l.text);
        assert.ok(m[3].startsWith(fmtValue(end, v.unit)), l.text);
      }
    }
  });

  test('a tie is never "the most noticeable change"', () => {
    for (const [, seed, v] of allCharts()) {
      if (v.kind !== 'pie' || v.pies.length < 2) continue;
      const l = describeChart(v, { seed }).overview.find((x) => /most noticeable change was/.test(stripMarks(x.text)));
      if (!l) continue;
      const [a, b] = [v.pies[0], v.pies.at(-1)];
      const d = a.slices.filter((s) => !/^other/i.test(s.name)).map((s, i) => Math.abs(b.slices[a.slices.indexOf(s)].value - s.value)).sort((x, y) => y - x);
      assert.ok(d[0] > d[1], l.text);
    }
  });
});

describe('number language', () => {
  test('fractionPhrase', () => {
    assert.equal(fractionPhrase(34), 'just over a third');
    assert.equal(fractionPhrase(31), 'just under a third');
    assert.equal(fractionPhrase(49), 'almost half');
    assert.equal(fractionPhrase(50), 'exactly half');
    assert.equal(fractionPhrase(25), 'roughly a quarter');
    assert.equal(fractionPhrase(4), 'a very small proportion');
    assert.equal(fractionPhrase(44), null);
  });

  test('fmtValue', () => {
    assert.equal(fmtValue(330, { kind: 'number', label: 'thousand visits' }), '330,000 visits');
    assert.equal(fmtValue(3.5, { kind: 'number', label: 'million visitors', decimals: 1 }), '3.5 million visitors');
    assert.equal(fmtValue(4.2, { kind: 'currency', symbol: '£', decimals: 2 }), '£4.20');
    assert.equal(fmtValue(250000, { kind: 'currency', symbol: '£' }), '£250,000');
    assert.equal(fmtValue(17, { kind: 'percent' }), '17%');
  });
});
