import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRng } from '../../js/core/rng.js';
import { countMarks, markedParts } from '../../js/core/marked.js';
import {
  MAP_SETTINGS, MAP_TYPES, MAX_FEATURES, generateMap, mapRubric, mapChanges, describeMap, validateMap,
  fitLabel, textWidth, overlapProblems, isLinear,
} from '../../js/core/maps.js';

const NOW = Date.UTC(2026, 9, 28);
const FRAMES = ['past', 'present', 'future'];
const FOCUS = new Set(['intro', 'overview', 'change', 'location', 'unchanged']);
const SEEDS = 300; // per setting, spread over the three frames

const allLines = (d) => [...d.intro, ...d.overview, ...d.body];
const plain = (t) => t.replace(/\[\[|\]\]/g, '');
const labelFits = (f) => ['sea', 'island', 'bridge', 'pier'].includes(f.type) ||
  (isLinear(f) ? textWidth(f.label) + 16 <= Math.max(f.w, f.h) * 30 : !!fitLabel(f.label, f.w, f.h));

// Every generated map, once, for the sweeping tests below.
const SWEEP = [];
for (const { id } of MAP_SETTINGS) {
  for (let i = 0; i < SEEDS; i++) {
    const frame = FRAMES[i % 3];
    const map = generateMap(makeRng(i + 1), { now: NOW, setting: id, frame });
    SWEEP.push({ id, frame, seed: i + 1, map, changes: mapChanges(map), text: describeMap(map) });
  }
}

describe('generateMap', () => {
  test('is deterministic: the same seed gives the same map', () => {
    for (const { id } of MAP_SETTINGS) {
      const a = generateMap(makeRng(42), { now: NOW, setting: id });
      const b = generateMap(makeRng(42), { now: NOW, setting: id });
      assert.deepEqual(a, b);
      assert.deepEqual(describeMap(a), describeMap(b));
    }
    const maps = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(generateMap(makeRng(s), { now: NOW, setting: 'village' }))));
    assert.ok(maps.size >= 4, 'different seeds give different maps');
  });

  test('picks a setting and frame when none is given', () => {
    const seen = new Set();
    for (let s = 1; s <= 60; s++) {
      const m = generateMap(makeRng(s), { now: NOW });
      assert.ok(MAP_SETTINGS.some((x) => x.id === m.setting));
      assert.ok(FRAMES.includes(m.frame));
      seen.add(m.setting);
    }
    assert.ok(seen.size >= 6);
  });

  test(`every setting × frame gives valid maps (${MAP_SETTINGS.length * SEEDS} maps)`, () => {
    for (const { id, frame, seed, map } of SWEEP) {
      const where = `${id}/${frame}/${seed}`;
      assert.equal(map.kind, 'map');
      assert.equal(map.setting, id);
      assert.equal(map.frame, frame);
      assert.ok(map.place && typeof map.place === 'string', where);
      assert.ok(Number.isInteger(map.cols) && Number.isInteger(map.rows), where);
      for (const side of [map.before, map.after]) {
        assert.ok(side.label, where);
        assert.ok(side.features.length <= MAX_FEATURES, where);
        assert.equal(new Set(side.features.map((f) => f.id)).size, side.features.length, `${where}: unique ids`);
        for (const f of side.features) {
          assert.ok(MAP_TYPES.includes(f.type), `${where}: type ${f.type}`);
          for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(f[k]), `${where}: ${f.id}.${k}`);
          assert.ok(f.w >= 1 && f.h >= 1 && f.x >= 0 && f.y >= 0 && f.x + f.w <= map.cols && f.y + f.h <= map.rows, `${where}: ${f.id} inside the grid`);
          assert.ok(f.type === 'island' || f.label, `${where}: ${f.id} has a label`);
          assert.ok(labelFits(f), `${where}: label "${f.label}" fits ${f.w}×${f.h}`);
        }
        assert.deepEqual(overlapProblems(side.features), [], `${where}: no overlaps`);
      }
    }
  });

  test('years follow the frame and the current year', () => {
    for (const { map, frame } of SWEEP.slice(0, 600)) {
      const by = Number((/\d{4}/.exec(map.before.label) || [])[0]);
      const ay = Number((/\d{4}/.exec(map.after.label) || [])[0]);
      if (frame === 'past') assert.ok(by < ay && ay < 2026, `${map.before.label} → ${map.after.label}`);
      if (frame === 'present') {
        assert.ok(by < 2026);
        assert.match(map.after.label, /^(Today|Now|Present day)$/);
      }
      if (frame === 'future') assert.match(map.after.label, /^(\d{4} \(planned\)|Proposed)$/);
      if (frame === 'future' && ay) assert.ok(ay > 2026);
    }
  });
});

describe('mapChanges', () => {
  test('generated maps have 4–7 changes and at least 2 unchanged features', () => {
    for (const { id, seed, changes } of SWEEP) {
      const changed = changes.filter((c) => c.kind !== 'unchanged').length;
      const kept = changes.filter((c) => c.kind === 'unchanged').reduce((n, c) => n + c.ids.length, 0);
      assert.ok(changed >= 4 && changed <= 7, `${id}/${seed}: ${changed} changes`);
      assert.ok(kept >= 2, `${id}/${seed}: ${kept} unchanged`);
    }
  });

  test('classifies every kind of change', () => {
    const F = (id, type, label, x, y, w, h) => ({ id, type, label, x, y, w, h });
    const map = {
      kind: 'map', place: 'the village of Testby', setting: 'village', frame: 'past', cols: 12, rows: 8,
      before: { label: '1990', features: [
        F('church', 'building', 'Church', 0, 0, 2, 2), F('farm', 'farmland', 'Farmland', 4, 0, 4, 2),
        F('mill', 'building', 'Windmill', 9, 0, 3, 2), F('bank', 'building', 'Bank', 0, 4, 2, 2),
        F('school', 'building', 'School', 3, 4, 2, 2), F('woods', 'woodland', 'Woods', 6, 4, 4, 2),
        F('shop', 'building', 'Shop', 0, 6, 2, 2),
      ] },
      after: { label: '2010', features: [
        F('church', 'building', 'Church', 0, 0, 2, 2), F('estate', 'houses', 'Housing estate', 4, 0, 4, 2),
        F('bank', 'building', 'Café', 0, 4, 2, 2), F('school', 'building', 'School', 3, 4, 3, 2),
        F('woods', 'woodland', 'Woods', 7, 4, 3, 2), F('shop', 'building', 'Shop', 10, 6, 2, 2),
        F('carpark', 'carpark', 'Car park', 4, 6, 2, 2),
      ] },
    };
    const kinds = Object.fromEntries(mapChanges(map).map((c) => [c.ids.join('+'), c.kind]));
    assert.deepEqual(kinds, {
      'farm+estate': 'replaced', carpark: 'added', mill: 'removed', bank: 'converted',
      school: 'extended', woods: 'reduced', shop: 'relocated', church: 'unchanged',
    });
    const school = mapChanges(map).find((c) => c.kind === 'extended');
    assert.equal(school.ratio, 1.5);
  });

  test('ignores sea and island and counts a two-part road once', () => {
    const map = {
      kind: 'map', place: 'an island', setting: 'island', frame: 'past', cols: 12, rows: 8,
      before: { label: '1990', features: [{ id: 'sea', type: 'sea', label: 'Sea', x: 0, y: 0, w: 12, h: 8 }] },
      after: { label: '2000', features: [
        { id: 'sea', type: 'sea', label: 'Sea', x: 0, y: 0, w: 12, h: 8 },
        { id: 'r1', type: 'road', label: 'New road', x: 0, y: 3, w: 6, h: 1 },
        { id: 'r2', type: 'road', label: 'New road', x: 5, y: 0, w: 1, h: 3 },
      ] },
    };
    const changes = mapChanges(map);
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].ids, ['r1', 'r2']);
  });
});

describe('describeMap', () => {
  test('every line has text, one [[ ]] chunk, a known focus and real feature ids', () => {
    for (const { id, seed, map, text } of SWEEP) {
      const ids = new Set([...map.before.features, ...map.after.features].map((f) => f.id));
      assert.equal(text.intro.length, 1);
      assert.equal(text.overview.length, 2);
      assert.ok(text.body.length >= 4, `${id}/${seed}: body`);
      for (const l of allLines(text)) {
        const where = `${id}/${seed}: ${l.text}`;
        assert.equal(countMarks(l.text), 1, where);
        assert.ok(markedParts(l.text).answer.length > 0, where);
        assert.ok(FOCUS.has(l.focus), where);
        assert.match(plain(l.text), /^[A-Z].*[\p{L}\d)]\.$/u, where);
        assert.doesNotMatch(plain(l.text), /\s[,.]|\s{2}|\b(undefined|null|NaN)\b|\b(the|a|an) (the|a|an)\b/i, where);
        for (const fid of l.featureIds) assert.ok(ids.has(fid), where);
      }
      for (const l of text.body.filter((x) => x.focus !== 'unchanged')) assert.ok(l.featureIds.length > 0);
    }
  });

  test('tense follows the frame', () => {
    for (const { frame, seed, text } of SWEEP) {
      const lines = allLines(text).map((l) => plain(l.text));
      const changes = text.body.filter((l) => l.focus === 'change' || l.focus === 'location').map((l) => plain(l.text));
      if (frame === 'past') {
        for (const t of lines) assert.doesNotMatch(t, /\b(has|have|will)\b|\bgoing to\b/, `past ${seed}: ${t}`);
      }
      if (frame === 'present') {
        assert.ok(changes.some((t) => /\b(has|have) been\b/.test(t)), `present ${seed}: some present perfect passive`);
        for (const t of changes) assert.match(t, /\b(has|have|now|no longer|still)\b/, `present ${seed}: ${t}`);
        for (const t of lines) assert.doesNotMatch(t, /\b(will|had)\b/, `present ${seed}: ${t}`);
      }
      if (frame === 'future') {
        const plan = /\b(will|is to|are to|going to)\b|\b(plans|proposals) also (include|involve)\b|\banother planned change is\b/;
        for (const t of changes) assert.match(t, plan, `future ${seed}: ${t}`);
        assert.ok(changes.filter((t) => /\b(will|is to|are to|going to)\b/.test(t)).length * 2 >= changes.length);
        for (const t of lines) assert.doesNotMatch(t, /\b(had|has been|have been)\b/, `future ${seed}: ${t}`);
      }
    }
  });

  test('a change verb is not used more than twice in one description', () => {
    const verbs = /\b(built|constructed|erected|demolished|replaced|converted|extended|relocated|cleared|developed)\b/g;
    for (const { seed, text } of SWEEP) {
      const counts = {};
      for (const l of text.body) for (const v of plain(l.text).match(verbs) || []) counts[v] = (counts[v] || 0) + 1;
      for (const [v, n] of Object.entries(counts)) assert.ok(n <= 2, `${seed}: "${v}" ${n} times`);
    }
  });

  test('the intro paraphrases the rubric instead of copying it', () => {
    for (const { map, text } of SWEEP.slice(0, 300)) {
      const intro = plain(text.intro[0].text);
      assert.match(intro, /\b(illustrate|depict|compare)\b/);
      assert.doesNotMatch(intro, /below show/);
      assert.ok(intro.includes(map.place));
    }
  });

  test('a description is a full answer: roughly 120–230 words', () => {
    const words = SWEEP.map(({ text }) => allLines(text).map((l) => plain(l.text)).join(' ').split(/\s+/).length);
    const avg = words.reduce((a, b) => a + b, 0) / words.length;
    assert.ok(avg >= 140 && avg <= 200, `average ${avg}`);
    assert.ok(Math.min(...words) >= 80 && Math.max(...words) <= 260);
  });

  test('says where things are using the drawing', () => {
    const F = (id, type, label, x, y, w, h) => ({ id, type, label, x, y, w, h });
    const road = F('road', 'road', 'Main Road', 0, 3, 12, 1);
    const church = F('church', 'building', 'Church', 4, 1, 2, 2);
    const map = {
      kind: 'map', place: 'the village of Testby', setting: 'village', frame: 'present', cols: 12, rows: 8,
      before: { label: '2000', features: [road, church, F('pond', 'lake', 'Pond', 0, 0, 2, 2), F('farm', 'farmland', 'Farmland', 8, 4, 4, 4)] },
      after: { label: 'Today', features: [road, church, F('pond', 'lake', 'Pond', 0, 0, 2, 2), F('estate', 'houses', 'Housing estate', 8, 4, 4, 4), F('school', 'building', 'School', 4, 4, 2, 2), F('shop', 'shops', 'Shops', 0, 6, 2, 2)] },
    };
    const text = describeMap(map).body.map((l) => plain(l.text)).join(' ');
    assert.doesNotMatch(text, /school[^.]*\b(north of|next to|adjacent to|beside) the church/i, text);
    assert.doesNotMatch(text, /south-east corner[^.]*school/i, text);
    if (/school/i.test(text)) assert.match(text, /school[^.]*(opposite the church|across Main Road from the church|on the southern side of Main Road|south of|centre|middle|south)/i, text);
  });
});

describe('mapRubric', () => {
  test('one IELTS-style sentence naming the place and the times', () => {
    for (const { map, frame } of SWEEP.slice(0, 900)) {
      const r = mapRubric(map);
      assert.match(r, /^The maps below show .+\.$/);
      assert.equal(r.split('.').length, 2, r);
      assert.ok(r.includes(map.place));
      if (frame === 'past') assert.ok(r.includes(map.before.label) && r.includes(map.after.label));
      if (frame === 'present') assert.match(r, /\b(today|now|at present)\.$/);
      if (frame === 'future') assert.match(r, /planned changes for \d{4}\.|proposed changes to it\./);
    }
  });
});

describe('validateMap', () => {
  test('junk never throws and gives null with a reason', () => {
    for (const junk of [null, undefined, 42, 'abc', '{"before": [', [], {}, { before: 'x' }, { before: { features: 'x' } }, { map: null }, true]) {
      const r = validateMap(junk);
      assert.equal(r.map, null);
      assert.ok(r.problems.length > 0);
    }
  });

  test('round-trips every generated map unchanged', () => {
    for (const { map } of SWEEP.slice(0, 900)) {
      const r = validateMap(JSON.parse(JSON.stringify(map)));
      assert.deepEqual(r.problems, []);
      assert.deepEqual(r.map, map);
    }
  });

  test('coerces, clips, drops and fills in what an LLM gets wrong', () => {
    const r = validateMap(JSON.stringify({
      place: 'the town of Exton.',
      frame: 'sometime',
      before: { label: 1990, features: [
        { type: 'Car Park', label: 'Car park', x: '1', y: '2', w: '2', h: 2 },
        { type: 'church', label: 'Church', x: 5, y: 0, w: 2, h: 2 },
        { type: 'factory', label: 'Factory', x: 9, y: 5, w: 6, h: 6 },
        { id: 'woods', type: 'trees', x: 0, y: 5, w: 3, h: 3 },
        { type: 'road', label: 'Main Road', x: -2, y: 4, w: 20, h: 1 },
        { type: 'house', label: 'Lost', x: 40, y: 40, w: 1, h: 1 },
        { label: 'No position' },
        'not a feature',
      ] },
      after: { label: '2010', features: [
        { type: 'shops', label: 'Shopping centre', x: 1, y: 2, w: 3, h: 2 },
        { type: 'church', label: 'Church', x: 5, y: 0, w: 2, h: 2 },
        { type: 'houses', label: 'Flats', x: 9, y: 5, w: 3, h: 3 },
        { id: 'woods', type: 'woodland', label: 'Woods', x: 0, y: 6, w: 3, h: 2 },
        { type: 'road', label: 'Main Road', x: 0, y: 4, w: 12, h: 1 },
        { type: 'spaceport', label: 'School', x: 5, y: 6, w: 2, h: 2 },
      ] },
    }));
    const m = r.map;
    assert.ok(m, r.problems.join('; '));
    assert.equal(m.place, 'the town of Exton');
    assert.equal(m.frame, 'past');
    assert.equal(m.setting, 'town');
    assert.equal(m.before.label, '1990');
    const car = m.before.features.find((f) => f.type === 'carpark');
    assert.deepEqual([car.x, car.y, car.w, car.h, car.id], [1, 2, 2, 2, 'car-park']);
    assert.deepEqual(m.before.features.find((f) => f.label === 'Factory'), { id: 'factory', type: 'industry', label: 'Factory', x: 9, y: 5, w: 3, h: 3 });
    assert.equal(m.before.features.find((f) => f.id === 'woods').label, 'Woodland');
    assert.deepEqual(m.before.features.find((f) => f.type === 'road'), { id: 'main-road', type: 'road', label: 'Main Road', x: 0, y: 4, w: 12, h: 1 });
    assert.ok(!m.before.features.some((f) => f.label === 'Lost' || f.label === 'No position'));
    assert.equal(m.after.features.find((f) => f.label === 'School').type, 'building');
    assert.equal(m.before.features.find((f) => f.label === 'Church').id, m.after.features.find((f) => f.label === 'Church').id);
    for (const p of ['clipped', 'outside the grid', 'no usable position', 'not a feature object', 'unknown type']) {
      assert.ok(r.problems.some((x) => x.includes(p)), `problem mentioning "${p}"`);
    }
    const d = describeMap(m);
    for (const l of allLines(d)) assert.equal(countMarks(l.text), 1, l.text);
    assert.ok(mapRubric(m).includes('1990'));
  });

  test('keeps at most 25 features and needs at least 3 changes', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ type: 'building', label: `Block ${i}`, x: i % 12, y: Math.floor(i / 12), w: 1, h: 1 }));
    const r = validateMap({ place: 'a site', before: { label: '1990', features: many }, after: { label: '2000', features: many.slice(0, 20) } });
    assert.equal(r.map.before.features.length, MAX_FEATURES);
    assert.ok(r.problems.some((p) => p.includes(`first ${MAX_FEATURES}`)));
    const same = [{ type: 'building', label: 'Church', x: 1, y: 1, w: 2, h: 2 }, { type: 'lake', label: 'Pond', x: 5, y: 1, w: 2, h: 2 }];
    const few = validateMap({ before: { features: same }, after: { features: [...same, { type: 'shops', label: 'Shop', x: 8, y: 5, w: 2, h: 2 }] } });
    assert.equal(few.map, null);
    assert.match(few.problems.at(-1), /only 1 change/);
  });
});

describe('fitLabel', () => {
  test('wraps labels into the feature and refuses what cannot fit', () => {
    assert.deepEqual(fitLabel('Car park', 2, 2).lines, ['Car', 'park']);
    assert.equal(fitLabel('Shopping centre', 2, 2), null);
    assert.deepEqual(fitLabel('Shopping centre', 3, 2).lines, ['Shopping', 'centre']);
    assert.equal(fitLabel('Church', 1, 1), null);
  });
});

describe('purity and speed', () => {
  test('js/core/maps.js uses no DOM, clock or Math.random', () => {
    const src = readFileSync(new URL('../../js/core/maps.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\b(window|document|localStorage|Math\.random|Date\.now|performance)\b/);
  });

  test('generateMap + describeMap take well under 5 ms', () => {
    const t0 = performance.now();
    for (let s = 0; s < 300; s++) describeMap(generateMap(makeRng(9000 + s), { now: NOW }));
    const avg = (performance.now() - t0) / 300;
    assert.ok(avg < 5, `${avg.toFixed(2)} ms per map`);
  });
});
