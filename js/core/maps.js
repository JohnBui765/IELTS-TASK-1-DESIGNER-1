// Maps and plans (Task 1, type 2): a seeded map generator, change analysis,
// model-answer language and a tolerant reader for maps written by an LLM.
// Pure: no DOM, no clock, no Math.random.
//
// MapVisual — plain JSON:
// {
//   kind: 'map',
//   place: 'the village of Ashford',  // noun phrase used in the rubric and introduction
//   setting: 'village',               // a MAP_SETTINGS id
//   frame: 'past' | 'present' | 'future',
//                                     // past: both maps dated in the past ('1965', '1995')
//                                     // present: the later map is 'Today', 'Now' or 'Present day'
//                                     // future: the later map is a plan ('2035 (planned)', 'Proposed')
//   cols: 12, rows: 8,                // grid size in cells (always 12 × 8 when generated)
//   before: { label: '1995', features: Feature[] },
//   after:  { label: 'Today', features: Feature[] },
// }
// Feature = { id, type, label, x, y, w, h }
//   Integers in grid cells. North is at the top: x counts columns from the west
//   edge (0 … cols-1), y counts rows from the north edge (0 … rows-1); (x, y) is
//   the north-west cell and w × h the size. `label` is the text written on the map
//   ('Car park', 'Main Road', 'River Ash'), at most about 25 characters: sentence
//   case for ordinary features, Title Case for names. A feature w cells wide holds
//   words of up to about 3 × w letters, one line per cell of height (2 × 2 holds
//   'Car park' on two lines; 'Shopping centre' needs 3 × 2); a label that does not
//   fit is drawn beside its feature.
//   At most 25 features per map. ids are short slugs ('church', 'car-park').
//   The same id in both maps is the same feature: a new type or label means it was
//   converted, a bigger or smaller rectangle extended or reduced, a different place
//   relocated. A feature only in `after` was added; one only in `before` was removed;
//   an added feature on the site of a removed one replaced it. A good task has 4–7
//   changes and at least 2 features that stay exactly the same in both maps.
// Types:
//   building  any single building (church, library, hotel, school, café, reception)
//   houses    housing (houses, flats, cottages, student accommodation)
//   shops     shops, a shopping centre, a supermarket, a market
//   industry  factory, warehouses, workshops
//   carpark   car park
//   square    paved open space (market square, plaza); as a strip, a pedestrian street
//   park      park, gardens, playground, village green, picnic area
//   sports    sports field, playing fields, tennis courts
//   pool      swimming pool
//   woodland  woods, trees, forest
//   farmland  fields, farmland, orchard
//   lake      lake, pond, reservoir
//   beach     beach
//   sea       the sea; drawn beneath everything (piers stand on it)
//   island    the land of an island: one rectangle (label '') drawn as an island shape
//             beneath everything else; put a full-grid 'sea' under it and leave a
//             one-cell ring of sea round it
//   road, path, railway, river
//             strips one cell wide: h = 1 runs west–east, w = 1 runs north–south.
//             For a bend, use two features with the same label.
//   bridge    where a road or path crosses a river or railway (overlaps them)
//   pier      pier, jetty (stands on sea, lake, beach or river)
// Features must not overlap, except: anything on sea or island; road, path,
// railway and river crossing each other; bridges on those; piers on water/beach.

import { makeRng, int, chance, pickOne, pickWeighted, sample } from './rng.js';
import { verbPhrase, joinList, article, capitalise, numberWord } from './english.js';

export const MAP_COLS = 12;
export const MAP_ROWS = 8;
export const MAP_CELL = 30; // SVG units per grid cell (the renderer uses the same scale)
export const MAX_FEATURES = 25;

export const MAP_SETTINGS = Object.freeze([
  { id: 'village', label: 'Village' },
  { id: 'town', label: 'Town centre' },
  { id: 'campus', label: 'University campus' },
  { id: 'island', label: 'Island resort' },
  { id: 'park', label: 'Park' },
  { id: 'coast', label: 'Coastal town' },
  { id: 'industrial', label: 'Industrial area' },
  { id: 'school', label: 'School site' },
  { id: 'hospital', label: 'Hospital site' },
]);

// type → group: built (buildings), open (land uses), water, linear, struct, base.
const TYPE_GROUP = {
  building: 'built', houses: 'built', shops: 'built', industry: 'built', pool: 'built',
  carpark: 'open', square: 'open', park: 'open', sports: 'open', woodland: 'open', farmland: 'open', beach: 'open',
  lake: 'water', sea: 'base', island: 'base',
  road: 'linear', path: 'linear', railway: 'linear', river: 'linear',
  bridge: 'struct', pier: 'struct',
};
export const MAP_TYPES = Object.freeze(Object.keys(TYPE_GROUP));

const LINEAR = new Set(['road', 'path', 'railway', 'river']);
const BASE = new Set(['sea', 'island']);
const NATURAL = new Set(['farmland', 'woodland', 'park', 'sports', 'beach', 'lake']);
const WATERY = new Set(['sea', 'lake', 'river', 'beach']);

export const isLinear = (f) => LINEAR.has(f.type) || (f.type === 'square' && Math.min(f.w, f.h) === 1 && Math.max(f.w, f.h) >= 4);
export const isBase = (f) => BASE.has(f.type);

/* ---------- label fitting (shared with the renderer) ---------- */

export const LABEL_SIZE = 14; // SVG units: ≥ 11 CSS px when a map is drawn 300 px wide
const LABEL_INSET = 3; // the renderer insets shapes by this much
const LABEL_PAD = 3;

// Approximate advance widths (em) of a system sans-serif, slightly generous so
// an estimate that fits also fits on screen.
function charEm(c) {
  if ("iljI.,:;'’|!".includes(c)) return 0.27;
  if ('frt()-/ '.includes(c)) return 0.37;
  if ('mwMW'.includes(c)) return 0.9;
  if (c >= 'A' && c <= 'Z') return 0.72;
  return 0.58;
}

export function textWidth(text, size = LABEL_SIZE) {
  let em = 0;
  for (const c of String(text)) em += charEm(c);
  return em * size;
}

// Greedy word wrap; null when a word is too wide or there are too many lines.
export function wrapLabel(text, width, size = LABEL_SIZE, maxLines = 3) {
  const lines = [];
  let cur = '';
  for (const word of String(text).trim().split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || textWidth(next, size) <= width) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (!lines.length || lines.length > maxLines || lines.some((l) => textWidth(l, size) > width)) return null;
  return lines;
}

// Layout of a label inside a w × h cell feature: { lines, size, lineHeight } or null.
export function fitLabel(text, w, h, sizes = [LABEL_SIZE]) {
  const innerW = w * MAP_CELL - 2 * (LABEL_INSET + LABEL_PAD);
  const innerH = h * MAP_CELL - 2 * LABEL_INSET;
  for (const size of sizes) {
    const lineHeight = Math.round(size * 1.15);
    const maxLines = Math.floor((innerH - 2) / lineHeight);
    const lines = maxLines > 0 ? wrapLabel(text, innerW, size, maxLines) : null;
    if (lines) return { lines, size, lineHeight };
  }
  return null;
}

// Does a strip feature's label fit along it (one line)?
function fitsAlong(text, f) {
  return textWidth(text) + 16 <= Math.max(f.w, f.h) * MAP_CELL;
}

/* ---------- geometry ---------- */

const areaOf = (r) => r.w * r.h;
const span = (a0, al, b0, bl) => Math.min(a0 + al, b0 + bl) - Math.max(a0, b0); // > 0 overlap, 0 touch, < 0 gap
const spanX = (a, b) => span(a.x, a.w, b.x, b.w);
const spanY = (a, b) => span(a.y, a.h, b.y, b.h);

export function overlapArea(a, b) {
  const w = spanX(a, b);
  const h = spanY(a, b);
  return w > 0 && h > 0 ? w * h : 0;
}

// Share an edge (touching, not overlapping).
function touching(a, b) {
  return (spanX(a, b) === 0 && spanY(a, b) > 0) || (spanY(a, b) === 0 && spanX(a, b) > 0);
}

function mayOverlap(a, b) {
  if (BASE.has(a.type) || BASE.has(b.type)) return true;
  const la = LINEAR.has(a.type);
  const lb = LINEAR.has(b.type);
  if (la && lb) return true;
  if (a.type === 'bridge' || b.type === 'bridge') {
    const other = a.type === 'bridge' ? b : a;
    return LINEAR.has(other.type) || other.type === 'bridge' || (other.type === 'square' && isLinear(other));
  }
  if (a.type === 'pier' || b.type === 'pier') {
    const other = a.type === 'pier' ? b : a;
    return WATERY.has(other.type);
  }
  return (la && isLinear(b)) || (lb && isLinear(a));
}

// Pairs of features in one map that overlap where they should not.
export function overlapProblems(features) {
  const out = [];
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i];
      const b = features[j];
      if (overlapArea(a, b) && !mayOverlap(a, b)) out.push([a.id, b.id]);
    }
  }
  return out;
}

const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function union(rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

/* ---------- generator: placement on a cell grid ---------- */

const FREE = 0;
const USED = 1;
const WATER = 2; // open water: only piers go here
const RESERVED = 3; // kept free in the first map for a later addition

const isFree = (v) => v === FREE;
const isWater = (v) => v === WATER;

function makeScene(rng, def) {
  return {
    rng, def, cols: MAP_COLS, rows: MAP_ROWS,
    cell: new Array(MAP_COLS * MAP_ROWS).fill(FREE),
    bounds: { x: 0, y: 0, w: MAP_COLS, h: MAP_ROWS },
    feats: [], roles: {}, ids: new Set(), labels: new Set(), exclude: new Set(),
  };
}

function cellsAre(S, r, ok) {
  if (r.x < 0 || r.y < 0 || r.x + r.w > S.cols || r.y + r.h > S.rows) return false;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) if (!ok(S.cell[y * S.cols + x])) return false;
  }
  return true;
}

function markCells(S, r, value) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) S.cell[y * S.cols + x] = value;
}

function uniqueId(S, base) {
  let id = base;
  for (let n = 2; S.ids.has(id); n++) id = `${base}${n}`;
  S.ids.add(id);
  return id;
}

// Adds a feature to the first map; `value` marks its cells (null: leave them).
function addFeature(S, f, value = USED, role = null) {
  S.feats.push(f);
  S.ids.add(f.id);
  if (f.label) S.labels.add(f.label);
  if (value !== null) markCells(S, f, value);
  if (role) S.roles[role] = f;
  return f;
}

function hStrip(S, id, type, label, y, x = 0, w = S.cols) {
  return addFeature(S, { id, type, label, x, y, w, h: 1 }, USED, id);
}

function vStrip(S, id, type, label, x, y = 0, h = S.rows) {
  return addFeature(S, { id, type, label, x, y, w: 1, h }, USED, id);
}

const countTouching = (S, r, test) => S.feats.reduce((n, f) => n + (test(f) && touching(r, f) ? 1 : 0), 0);

function edgesTouched(S, r) {
  const b = S.bounds;
  return (r.x === b.x) + (r.y === b.y) + (r.x + r.w === b.x + b.w) + (r.y + r.h === b.y + b.h);
}

// 1 at the centre of the area, 0 in a corner.
function centreness(S, r) {
  const b = S.bounds;
  const c = centre(r);
  const dx = Math.abs(c.x - (b.x + b.w / 2)) / (b.w / 2);
  const dy = Math.abs(c.y - (b.y + b.h / 2)) / (b.h / 2);
  return 1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
}

// Cells between two rectangles (0 when they touch or overlap).
const gapBetween = (a, b) => Math.max(0, -spanX(a, b)) + Math.max(0, -spanY(a, b));

function score(S, r, p) {
  let s = (p.pack ?? 0.4) * countTouching(S, r, (f) => !LINEAR.has(f.type) && !BASE.has(f.type));
  if (p.road) s += p.road * Math.min(2, countTouching(S, r, (f) => f.type === 'road'));
  if (p.water) s += p.water * Math.min(1, countTouching(S, r, (f) => WATERY.has(f.type)));
  if (p.edge) s += p.edge * Math.min(2, edgesTouched(S, r));
  if (p.corner) s += p.corner * (edgesTouched(S, r) >= 2 ? 1 : 0);
  if (p.centre) s += p.centre * centreness(S, r);
  if (p.big) s += p.big * areaOf(r);
  if (p.near && S.roles[p.near]) s -= (p.nearW ?? 1) * gapBetween(r, S.roles[p.near]);
  return s;
}

// Best-scoring free rectangle of one of `sizes`, or null.
function findRect(S, sizes, prefs = {}, ok = isFree, where = null) {
  let best = null;
  let bestScore = -Infinity;
  for (const [w, h] of sizes) {
    for (let y = 0; y + h <= S.rows; y++) {
      for (let x = 0; x + w <= S.cols; x++) {
        const r = { x, y, w, h };
        if (!cellsAre(S, r, ok) || (where && !where(S, r))) continue;
        const s = score(S, r, prefs) + S.rng() * (prefs.noise ?? 1.2);
        if (s > bestScore) {
          bestScore = s;
          best = r;
        }
      }
    }
  }
  return best;
}

const fitsRect = (label, w, h, type) => (LINEAR.has(type) ? fitsAlong(label, { w, h }) : !!fitLabel(label, w, h));

// A label not used elsewhere on either map that fits w × h.
function pickLabel(S, labels, w, h, type) {
  const ok = labels.filter((l) => !S.labels.has(l) && fitsRect(l, w, h, type));
  return ok.length ? pickOne(S.rng, ok) : null;
}

// Places a cast role in the first map. `also`: labels a later change will put
// in the same rectangle (one of them must fit too).
function placeRole(S, role, { also = null, minDim = 0 } = {}) {
  if (S.roles[role]) return S.roles[role];
  const spec = S.def.cast[role];
  if (!spec || (spec.needs && !S.roles[spec.needs])) return null;
  const labels = sample(S.rng, spec.labels.filter((l) => !S.labels.has(l)), spec.labels.length);
  for (const label of labels) {
    const sizes = spec.sizes.filter(([w, h]) => fitLabel(label, w, h) && Math.max(w, h) >= minDim &&
      (!also || also.some((l) => !S.labels.has(l) && fitLabel(l, w, h))));
    const rect = sizes.length ? findRect(S, sizes, spec.prefs || {}) : null;
    if (rect) return addFeature(S, { id: uniqueId(S, role), type: spec.type, label, ...rect }, USED, role);
  }
  return null;
}

function growStrip(t, side, k) {
  if (side === 'n') return { x: t.x, y: t.y - k, w: t.w, h: k };
  if (side === 's') return { x: t.x, y: t.y + t.h, w: t.w, h: k };
  if (side === 'w') return { x: t.x - k, y: t.y, w: k, h: t.h };
  return { x: t.x + t.w, y: t.y, w: k, h: t.h };
}

// Splits t into the part that stays and the part given up on one side.
function cutSide(t, side, k) {
  if (side === 'w') return { freed: { x: t.x, y: t.y, w: k, h: t.h }, keep: { x: t.x + k, y: t.y, w: t.w - k, h: t.h } };
  if (side === 'e') return { freed: { x: t.x + t.w - k, y: t.y, w: k, h: t.h }, keep: { x: t.x, y: t.y, w: t.w - k, h: t.h } };
  if (side === 'n') return { freed: { x: t.x, y: t.y, w: t.w, h: k }, keep: { x: t.x, y: t.y + k, w: t.w, h: t.h - k } };
  return { freed: { x: t.x, y: t.y + t.h - k, w: t.w, h: k }, keep: { x: t.x, y: t.y, w: t.w, h: t.h - k } };
}

// Change recipes. Each returns a patch for the second map
// ({ remove: [id], change: [[id, props]], add: [feature] }) or null.
const OPS = {
  replace(S, r) {
    const t = placeRole(S, r.role, { also: r.labels });
    const label = t && pickLabel(S, r.labels, t.w, t.h, r.type);
    if (!label) return null;
    S.labels.add(label);
    return { remove: [t.id], add: [{ id: uniqueId(S, r.id), type: r.type, label, x: t.x, y: t.y, w: t.w, h: t.h }] };
  },
  convert(S, r) {
    const t = placeRole(S, r.role, { also: r.labels });
    if (!t) return null;
    const type = r.type || t.type;
    const ok = r.labels.filter((l) => (l !== t.label || type !== t.type) && (l === t.label || !S.labels.has(l)) && fitsRect(l, t.w, t.h, type));
    if (!ok.length) return null;
    const label = pickOne(S.rng, ok);
    S.labels.add(label);
    return { change: [[t.id, { type, label }]] };
  },
  remove(S, r) {
    const t = placeRole(S, r.role);
    return t && { remove: [t.id] };
  },
  extend(S, r) {
    const t = placeRole(S, r.role);
    if (!t) return null;
    const sides = sample(S.rng, ['n', 'e', 's', 'w'], 4);
    for (const k of [r.by || 1, 1]) {
      for (const side of sides) {
        const strip = growStrip(t, side, k);
        if (!cellsAre(S, strip, isFree)) continue;
        markCells(S, strip, RESERVED);
        return { change: [[t.id, union([t, strip])]] };
      }
    }
    return null;
  },
  reduce(S, r) {
    const t = placeRole(S, r.role, { minDim: 3 });
    if (!t) return null;
    const cuts = [];
    for (const side of ['w', 'e']) for (let k = 1; k <= t.w - 2; k++) cuts.push([side, k]);
    for (const side of ['n', 's']) for (let k = 1; k <= t.h - 2; k++) cuts.push([side, k]);
    for (const [side, k] of sample(S.rng, cuts, cuts.length)) {
      const { keep, freed } = cutSide(t, side, k);
      if (!fitLabel(t.label, keep.w, keep.h) || areaOf(keep) * 5 < areaOf(t) * 2) continue;
      if (!r.then) return { change: [[t.id, keep]] };
      const label = pickLabel(S, r.then.labels, freed.w, freed.h, r.then.type);
      if (!label) continue;
      S.labels.add(label);
      return { change: [[t.id, keep]], add: [{ id: uniqueId(S, r.then.id), type: r.then.type, label, ...freed }] };
    }
    return null;
  },
  relocate(S, r) {
    const t = placeRole(S, r.role);
    const dest = t && findRect(S, [[t.w, t.h]], r.prefs || {}, isFree, (_, d) => gapBetween(d, t) >= 2);
    if (!dest) return null;
    markCells(S, dest, RESERVED);
    return { change: [[t.id, dest]] };
  },
  add(S, r) {
    for (const label of sample(S.rng, r.labels.filter((l) => !S.labels.has(l)), r.labels.length)) {
      const sizes = r.sizes.filter(([w, h]) => fitsRect(label, w, h, r.type) || r.type === 'pier');
      const rect = sizes.length ? findRect(S, sizes, r.prefs || {}, r.onWater ? isWater : isFree, r.where || null) : null;
      if (!rect) continue;
      markCells(S, rect, RESERVED);
      S.labels.add(label);
      return { add: [{ id: uniqueId(S, r.id), type: r.type, label, ...rect }] };
    }
    return null;
  },
};

const changeCount = (r) => (r.op === 'reduce' && r.then ? 2 : 1);

// 4–7 changes, no two recipes about the same feature.
function chooseRecipes(S) {
  const want = int(S.rng, 4, 6);
  const pool = S.def.recipes.slice();
  const used = new Set();
  const out = [];
  let count = 0;
  while (count < want && pool.length) {
    const r = pickWeighted(S.rng, pool, pool.map((x) => x.w ?? 1));
    pool.splice(pool.indexOf(r), 1);
    const keys = [r.role, r.unless, r.id, r.then && r.then.id].filter(Boolean);
    if (keys.some((k) => used.has(k)) || count + changeCount(r) > 7) continue;
    for (const k of keys) used.add(k);
    out.push(r);
    count += changeCount(r);
  }
  return out;
}

function buildAttempt(rng, def) {
  const S = makeScene(rng, def);
  def.scene(S);
  const recipes = chooseRecipes(S);
  for (const r of recipes) if (r.unless) S.exclude.add(r.unless);
  const patches = [];
  const run = (r) => {
    const p = OPS[r.op](S, r);
    if (p) patches.push(p);
  };
  recipes.filter((r) => r.early).forEach(run);
  for (const [role, spec] of Object.entries(def.cast)) if (spec.keep && chance(rng, spec.p ?? 1)) placeRole(S, role);
  recipes.filter((r) => !r.early && r.op !== 'add').forEach(run);
  recipes.filter((r) => !r.early && r.op === 'add').forEach(run);
  for (const [role, spec] of Object.entries(def.cast)) {
    if (!spec.keep && !S.roles[role] && !S.exclude.has(role) && chance(rng, spec.p ?? 0.6)) placeRole(S, role);
  }
  const before = S.feats.map((f) => ({ ...f }));
  let after = before.map((f) => ({ ...f }));
  for (const p of patches) {
    if (p.remove) after = after.filter((f) => !p.remove.includes(f.id));
    for (const [id, props] of p.change || []) Object.assign(after.find((f) => f.id === id) || {}, props);
    if (p.add) after.push(...p.add.map((f) => ({ ...f })));
  }
  return { before, after };
}

/* ---------- settings: scene, cast (features of the first map), change recipes ---------- */

const TOWNS = ['Ashford', 'Brampton', 'Chalton', 'Denby', 'Elmswell', 'Fenwick', 'Hadleigh', 'Kingsley', 'Langford', 'Millbrook', 'Norbury', 'Oakham', 'Stanton', 'Thornbury', 'Westcombe'];
const RIVERS = ['River Ash', 'River Lea', 'River Dene', 'River Cole', 'River Wren'];
const SMALL = [[2, 2], [3, 2], [2, 3]];
const MID = [[3, 2], [2, 3], [3, 3], [4, 2]];
const LARGE = [[4, 2], [3, 3], [4, 3], [5, 2], [3, 4]];
const PATH_SIZES = [[1, 4], [1, 5], [4, 1], [5, 1], [6, 1]];

// A pier from a beach out to sea, or a cycle path that starts at a road.
const belowBeach = (S, r) => !!S.roles.beach && touching(r, S.roles.beach) && spanX(r, S.roles.beach) > 0;
const offRoad = (S, r) => S.feats.some((f) => f.type === 'road' && touching(r, f) && (r.w === 1 ? spanX(r, f) > 0 : spanY(r, f) > 0));

function bridgeOver(S, x, y) {
  addFeature(S, { id: 'bridge', type: 'bridge', label: 'Bridge', x, y, w: 1, h: 1 }, null);
}

const SETTINGS = {
  village: {
    area: 'the village',
    place: (rng) => `the village of ${pickOne(rng, TOWNS)}`,
    scene(S) {
      const y = int(S.rng, 3, 4);
      hStrip(S, 'road', 'road', 'Main Road', y);
      if (chance(S.rng, 0.55)) {
        const x = pickOne(S.rng, [3, 4, 7, 8]);
        vStrip(S, 'river', 'river', pickOne(S.rng, RIVERS), x);
        bridgeOver(S, x, y);
      }
    },
    cast: {
      church: { type: 'building', labels: ['Church'], sizes: [[2, 2]], prefs: { road: 2, centre: 2 }, keep: true },
      pond: { type: 'lake', labels: ['Pond'], sizes: [[2, 2], [3, 2]], prefs: { centre: 1 }, keep: true, p: 0.7 },
      green: { type: 'park', labels: ['Village green'], sizes: [[3, 2], [4, 2]], prefs: { road: 2, centre: 1 }, keep: true, p: 0.5 },
      farm: { type: 'farmland', labels: ['Farmland', 'Fields'], sizes: LARGE, prefs: { edge: 2, big: 0.3 }, p: 0.9 },
      farm2: { type: 'farmland', labels: ['Fields', 'Farmland', 'Orchard'], sizes: MID, prefs: { edge: 2 }, p: 0.5 },
      woods: { type: 'woodland', labels: ['Woodland', 'Woods'], sizes: [[3, 2], [3, 3], [4, 2], [4, 3]], prefs: { corner: 3, edge: 1 }, p: 0.8 },
      houses: { type: 'houses', labels: ['Houses', 'Cottages'], sizes: SMALL, prefs: { road: 2 }, p: 0.9 },
      houses2: { type: 'houses', labels: ['Cottages', 'Houses'], sizes: SMALL, prefs: { road: 2 }, p: 0.4 },
      shop: { type: 'building', labels: ['Shop', 'Post office'], sizes: [[2, 2]], prefs: { road: 2, centre: 1 }, p: 0.8 },
      school: { type: 'building', labels: ['School'], sizes: [[2, 2], [3, 2]], prefs: { road: 1.5 }, p: 0.5 },
      farmhouse: { type: 'building', labels: ['Farmhouse'], sizes: [[3, 2]], prefs: { near: 'farm' }, p: 0.4 },
      windmill: { type: 'building', labels: ['Windmill'], sizes: [[3, 2]], prefs: { edge: 1 }, p: 0.3 },
      pub: { type: 'building', labels: ['Pub'], sizes: [[2, 2]], prefs: { road: 2 }, p: 0.4 },
    },
    recipes: [
      { op: 'replace', role: 'farm', type: 'houses', labels: ['Housing estate', 'Houses'], id: 'estate', w: 3 },
      { op: 'add', id: 'newschool', unless: 'school', type: 'building', labels: ['School', 'Primary school'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, w: 2 },
      { op: 'reduce', role: 'woods', then: { type: 'houses', labels: ['Houses', 'Cottages'], id: 'newhouses' }, w: 2 },
      { op: 'add', id: 'carpark', type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 2, near: 'shop' }, w: 1.5 },
      { op: 'convert', role: 'shop', labels: ['Café', 'Restaurant'], w: 1.5 },
      { op: 'extend', role: 'school', w: 1.5 },
      { op: 'remove', role: 'windmill', w: 1 },
      { op: 'convert', role: 'farmhouse', labels: ['Hotel', 'Restaurant'], w: 1 },
      { op: 'add', id: 'bypass', type: 'road', labels: ['New road', 'Bypass'], sizes: [[12, 1]], prefs: { edge: 3 }, early: true, w: 1 },
      { op: 'replace', role: 'farm2', type: 'sports', labels: ['Sports field', 'Playing field'], id: 'sports', w: 1.2 },
      { op: 'relocate', role: 'shop', prefs: { road: 2 }, w: 1 },
      { op: 'add', id: 'play', type: 'park', labels: ['Play area', 'Playground'], sizes: [[2, 2], [3, 2]], prefs: { near: 'houses' }, w: 1 },
      { op: 'convert', role: 'pub', type: 'houses', labels: ['Flats'], w: 0.8 },
    ],
  },
  town: {
    area: 'the town centre',
    place: (rng) => `the centre of ${pickOne(rng, TOWNS)}`,
    scene(S) {
      hStrip(S, 'street', 'road', 'High Street', int(S.rng, 3, 4));
      vStrip(S, 'road', 'road', pickOne(S.rng, ['Station Road', 'Church Road', 'Park Road', 'Mill Road']), pickOne(S.rng, [3, 4, 7, 8]));
    },
    cast: {
      hall: { type: 'building', labels: ['Town hall'], sizes: [[2, 2], [3, 2]], prefs: { road: 2, centre: 2 }, keep: true },
      church: { type: 'building', labels: ['Church'], sizes: [[2, 2]], prefs: { road: 1 }, keep: true, p: 0.7 },
      park: { type: 'park', labels: ['Park'], sizes: [[3, 2], [3, 3], [4, 2]], prefs: { edge: 2 }, keep: true, p: 0.8 },
      carpark: { type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, p: 0.6 },
      library: { type: 'building', labels: ['Library'], sizes: [[3, 2], [2, 3]], prefs: { road: 2 }, p: 0.8 },
      bank: { type: 'building', labels: ['Bank', 'Post office'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, p: 0.7 },
      cinema: { type: 'building', labels: ['Cinema'], sizes: [[2, 2], [3, 2]], prefs: { road: 1 }, p: 0.6 },
      bus: { type: 'building', labels: ['Bus station'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, p: 0.7 },
      market: { type: 'shops', labels: ['Market'], sizes: [[2, 2], [3, 2]], prefs: { road: 2, centre: 1 }, p: 0.5 },
      shops: { type: 'shops', labels: ['Shops'], sizes: SMALL, prefs: { road: 2 }, p: 0.9 },
      offices: { type: 'building', labels: ['Offices'], sizes: SMALL, prefs: { road: 1 }, p: 0.5 },
      houses: { type: 'houses', labels: ['Houses', 'Terraced houses'], sizes: MID, prefs: { edge: 1 }, p: 0.6 },
    },
    recipes: [
      { op: 'replace', role: 'carpark', type: 'shops', labels: ['Shopping centre'], id: 'mall', w: 3 },
      { op: 'convert', role: 'street', type: 'square', labels: ['High Street'], w: 1.5 },
      { op: 'relocate', role: 'bus', prefs: { road: 2 }, w: 1.5 },
      { op: 'extend', role: 'library', w: 1.5 },
      { op: 'convert', role: 'bank', labels: ['Café', 'Restaurant'], w: 1.5 },
      { op: 'replace', role: 'cinema', type: 'houses', labels: ['Flats'], id: 'flats', w: 1.2 },
      { op: 'add', id: 'carpark2', unless: 'carpark', type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, w: 1 },
      { op: 'remove', role: 'offices', w: 0.7 },
      { op: 'replace', role: 'houses', type: 'building', labels: ['Offices', 'Hotel'], id: 'offices2', w: 0.8 },
      { op: 'replace', role: 'market', type: 'square', labels: ['Square'], id: 'square', w: 0.8 },
    ],
  },
  campus: {
    area: 'the campus',
    place: (rng) => `the campus of ${pickOne(rng, ['Westfield', 'Northgate', 'Hillcrest', 'Riverside', 'Kingsbridge'])} University`,
    scene(S) {
      hStrip(S, 'road', 'road', pickOne(S.rng, ['Main Road', 'College Road', 'University Road']), S.rows - 1);
      if (chance(S.rng, 0.6)) vStrip(S, 'walk', 'path', 'Footpath', int(S.rng, 4, 7), 0, S.rows - 1);
    },
    cast: {
      main: { type: 'building', labels: ['Main building'], sizes: [[3, 2], [4, 2], [3, 3]], prefs: { centre: 2, road: 1 }, keep: true },
      lake: { type: 'lake', labels: ['Lake'], sizes: [[2, 2], [3, 2]], prefs: { centre: 0.5 }, keep: true, p: 0.8 },
      trees: { type: 'woodland', labels: ['Trees', 'Woodland'], sizes: MID, prefs: { corner: 2 }, keep: true, p: 0.6 },
      library: { type: 'building', labels: ['Library'], sizes: [[2, 2], [3, 2]], prefs: {}, p: 0.8 },
      lecture: { type: 'building', labels: ['Lecture theatre'], sizes: [[3, 2]], prefs: {}, p: 0.6 },
      science: { type: 'building', labels: ['Science block'], sizes: [[3, 2]], prefs: {}, p: 0.5 },
      field: { type: 'sports', labels: ['Sports field', 'Playing fields'], sizes: LARGE, prefs: { edge: 2 }, p: 0.8 },
      carpark: { type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 2 }, p: 0.8 },
      halls: { type: 'houses', labels: ['Student housing'], sizes: [[3, 2]], prefs: { edge: 1 }, p: 0.5 },
      cafe: { type: 'building', labels: ['Café'], sizes: [[2, 2]], prefs: { near: 'lake' }, p: 0.4 },
      tennis: { type: 'sports', labels: ['Tennis courts'], sizes: [[3, 2]], prefs: { near: 'field' }, p: 0.5 },
    },
    recipes: [
      { op: 'replace', role: 'carpark', type: 'building', labels: ['Science block', 'Lecture theatre', 'Sports centre'], id: 'newblock', w: 2 },
      { op: 'convert', role: 'library', labels: ['IT centre', 'Offices', 'Café'], w: 1.5 },
      { op: 'replace', role: 'field', type: 'houses', labels: ['Student housing'], id: 'newhalls', unless: 'halls', w: 1.2 },
      { op: 'reduce', role: 'field', then: { type: 'houses', labels: ['Student housing'], id: 'newhalls' }, unless: 'halls', w: 1.5 },
      { op: 'add', id: 'sportscentre', type: 'building', labels: ['Sports centre', 'Gym'], sizes: [[3, 2], [2, 2]], prefs: { near: 'field' }, w: 1.5 },
      { op: 'extend', role: 'lecture', w: 1 },
      { op: 'extend', role: 'science', w: 1 },
      { op: 'add', id: 'cyclepath', type: 'path', labels: ['Cycle path'], sizes: PATH_SIZES, where: offRoad, w: 1 },
      { op: 'relocate', role: 'carpark', prefs: { road: 2 }, w: 1.2 },
      { op: 'add', id: 'newcafe', unless: 'cafe', type: 'building', labels: ['Café'], sizes: [[2, 2]], prefs: { near: 'lake' }, w: 1 },
      { op: 'replace', role: 'tennis', type: 'pool', labels: ['Swimming pool'], id: 'pool', w: 0.8 },
    ],
  },
  island: {
    area: 'the island',
    place: (rng) => `the island of ${pickOne(rng, ['Kalua', 'Moraya', 'Senna', 'Corran', 'Palua', 'Tavi'])}`,
    scene(S) {
      addFeature(S, { id: 'sea', type: 'sea', label: 'Sea', x: 0, y: 0, w: S.cols, h: S.rows }, WATER);
      const land = { id: 'island', type: 'island', label: '', x: 1, y: 1, w: S.cols - 2, h: S.rows - 3 };
      addFeature(S, land, FREE);
      S.bounds = { x: land.x, y: land.y, w: land.w, h: land.h };
      const w = int(S.rng, 4, 6);
      const x = int(S.rng, land.x + 1, land.x + land.w - w - 1);
      addFeature(S, { id: 'beach', type: 'beach', label: 'Beach', x, y: land.y + land.h - 1, w, h: 1 }, USED, 'beach');
    },
    cast: {
      trees: { type: 'woodland', labels: ['Trees', 'Palm trees'], sizes: LARGE, prefs: { edge: 2, big: 0.3 }, p: 1 },
      forest: { type: 'woodland', labels: ['Forest', 'Woodland'], sizes: MID, prefs: { corner: 2 }, keep: true },
      lake: { type: 'lake', labels: ['Lake', 'Lagoon'], sizes: [[2, 2], [3, 2]], prefs: {}, keep: true, p: 0.6 },
      lighthouse: { type: 'building', labels: ['Lighthouse'], sizes: [[3, 2]], prefs: { edge: 2 }, keep: true, p: 0.5 },
      huts: { type: 'houses', labels: ['Fishing huts', 'Huts'], sizes: [[2, 2], [3, 2]], prefs: { near: 'beach' }, p: 0.5 },
    },
    recipes: [
      { op: 'reduce', role: 'trees', then: { type: 'building', labels: ['Hotel'], id: 'hotel' }, w: 2.5 },
      { op: 'add', id: 'hotel', type: 'building', labels: ['Hotel'], sizes: [[3, 2], [2, 2]], prefs: { near: 'beach' }, w: 1.5 },
      { op: 'add', id: 'reception', type: 'building', labels: ['Reception'], sizes: [[3, 2]], prefs: { centre: 1 }, w: 2 },
      { op: 'add', id: 'restaurant', type: 'building', labels: ['Restaurant'], sizes: [[3, 2]], prefs: { near: 'beach' }, w: 2 },
      { op: 'add', id: 'pool', type: 'pool', labels: ['Swimming pool'], sizes: [[3, 2]], prefs: { near: 'beach' }, w: 1.5 },
      { op: 'add', id: 'pier', type: 'pier', labels: ['Pier', 'Jetty'], sizes: [[1, 2]], onWater: true, where: belowBeach, w: 2 },
      { op: 'add', id: 'chalets', type: 'houses', labels: ['Chalets', 'Cabins'], sizes: [[2, 2], [3, 2]], prefs: { edge: 1 }, w: 1.5 },
      { op: 'add', id: 'footpath', type: 'path', labels: ['Footpath'], sizes: PATH_SIZES, w: 1 },
      { op: 'convert', role: 'huts', type: 'shops', labels: ['Shops', 'Café'], w: 1 },
      { op: 'remove', role: 'huts', w: 0.6 },
    ],
  },
  park: {
    area: 'the park',
    place: (rng) => `${pickOne(rng, ['Elmwood', 'Victoria', 'Ashgrove', 'Riverside', 'Kingsmead'])} Park`,
    scene(S) {
      hStrip(S, 'road', 'road', pickOne(S.rng, ['Park Road', 'Park Lane', 'London Road']), 0);
      if (chance(S.rng, 0.5)) hStrip(S, 'walk', 'path', 'Footpath', int(S.rng, 4, 5));
    },
    cast: {
      lake: { type: 'lake', labels: ['Lake', 'Pond'], sizes: [[3, 2], [4, 2], [3, 3]], prefs: { centre: 3 }, keep: true },
      gardens: { type: 'park', labels: ['Flower gardens', 'Rose garden'], sizes: [[3, 2], [4, 2]], prefs: {}, keep: true, p: 0.8 },
      woods: { type: 'woodland', labels: ['Woodland', 'Trees'], sizes: LARGE, prefs: { corner: 3 }, p: 0.9 },
      play: { type: 'park', labels: ['Playground', 'Play area'], sizes: [[3, 2], [4, 2], [2, 2]], prefs: { road: 1 }, p: 0.8 },
      cafe: { type: 'building', labels: ['Café'], sizes: [[2, 2]], prefs: { near: 'lake' }, p: 0.4 },
      tennis: { type: 'sports', labels: ['Tennis courts'], sizes: [[3, 2]], prefs: { edge: 1 }, p: 0.7 },
      carpark: { type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 3 }, p: 0.8 },
      bandstand: { type: 'building', labels: ['Bandstand'], sizes: [[3, 2]], prefs: { centre: 1 }, p: 0.5 },
      greenhouse: { type: 'building', labels: ['Greenhouse'], sizes: [[4, 2], [3, 3]], prefs: { edge: 1 }, p: 0.5 },
      toilets: { type: 'building', labels: ['Toilets'], sizes: [[2, 2]], prefs: { road: 1 }, p: 0.4 },
    },
    recipes: [
      { op: 'add', id: 'newcafe', unless: 'cafe', type: 'building', labels: ['Café'], sizes: [[2, 2]], prefs: { near: 'lake', nearW: 2 }, w: 1.5 },
      { op: 'relocate', role: 'play', w: 1.5 },
      { op: 'convert', role: 'tennis', labels: ['Skate park'], w: 1.3 },
      { op: 'extend', role: 'carpark', by: 2, w: 1.2 },
      { op: 'replace', role: 'greenhouse', type: 'park', labels: ['Picnic area'], id: 'picnic', w: 1.2 },
      { op: 'reduce', role: 'woods', then: { type: 'park', labels: ['Picnic area'], id: 'picnic' }, w: 1 },
      { op: 'add', id: 'visitor', type: 'building', labels: ['Visitor centre'], sizes: [[3, 2]], prefs: { road: 2 }, w: 1.2 },
      { op: 'remove', role: 'bandstand', w: 1 },
      { op: 'add', id: 'cyclepath', type: 'path', labels: ['Cycle path'], sizes: PATH_SIZES, where: offRoad, w: 0.8 },
    ],
  },
  coast: {
    area: 'the town',
    place: (rng) => `the seaside town of ${pickOne(rng, ['Seaton', 'Porthaven', 'Saltby', 'Kingsport', 'Westhaven'])}`,
    scene(S) {
      addFeature(S, { id: 'sea', type: 'sea', label: 'Sea', x: 0, y: S.rows - 2, w: S.cols, h: 2 }, WATER);
      S.bounds = { x: 0, y: 0, w: S.cols, h: S.rows - 2 };
      hStrip(S, 'road', 'road', pickOne(S.rng, ['Coast Road', 'Harbour Road', 'Sea Road']), 3);
      const w = int(S.rng, 3, 5);
      const x = chance(S.rng, 0.5) ? int(S.rng, 0, 2) : S.cols - w - int(S.rng, 0, 2);
      addFeature(S, { id: 'beach', type: 'beach', label: 'Beach', x, y: 4, w, h: 2 }, USED, 'beach');
      if (chance(S.rng, 0.55)) hStrip(S, 'railway', 'railway', 'Railway', 0);
    },
    cast: {
      church: { type: 'building', labels: ['Church'], sizes: [[2, 2]], prefs: { road: 1 }, keep: true },
      lighthouse: { type: 'building', labels: ['Lighthouse'], sizes: [[3, 2]], prefs: { water: 2, edge: 2 }, keep: true, p: 0.6 },
      hotel: { type: 'building', labels: ['Hotel'], sizes: [[2, 2], [3, 2]], prefs: { road: 1 }, keep: true, p: 0.6 },
      warehouses: { type: 'industry', labels: ['Warehouses', 'Warehouse'], sizes: [[3, 2], [4, 2]], prefs: { water: 2, road: 1 }, p: 0.9 },
      factory: { type: 'industry', labels: ['Factory'], sizes: [[2, 2], [3, 2]], prefs: { water: 1 }, p: 0.7 },
      fishmarket: { type: 'shops', labels: ['Fish market'], sizes: [[3, 2], [2, 2]], prefs: { water: 2 }, p: 0.6 },
      houses: { type: 'houses', labels: ['Houses', 'Cottages'], sizes: SMALL, prefs: { road: 2 }, p: 0.9 },
      houses2: { type: 'houses', labels: ['Cottages', 'Houses'], sizes: SMALL, prefs: { road: 1 }, p: 0.5 },
      station: { type: 'building', labels: ['Station'], sizes: [[3, 2]], prefs: { near: 'railway' }, needs: 'railway', p: 0.8 },
      boatyard: { type: 'industry', labels: ['Boatyard'], sizes: [[3, 2]], prefs: { water: 2 }, p: 0.5 },
    },
    recipes: [
      { op: 'convert', role: 'warehouses', type: 'houses', labels: ['Apartments', 'Flats'], w: 2 },
      { op: 'replace', role: 'factory', type: 'building', labels: ['Leisure centre', 'Aquarium'], id: 'leisure', w: 1.5 },
      { op: 'add', id: 'pier', type: 'pier', labels: ['Pier'], sizes: [[1, 2]], onWater: true, where: belowBeach, w: 1.5 },
      { op: 'convert', role: 'fishmarket', type: 'building', labels: ['Restaurant', 'Café'], w: 1.2 },
      { op: 'convert', role: 'railway', type: 'path', labels: ['Cycle path'], w: 1.2 },
      { op: 'convert', role: 'station', labels: ['Café', 'Museum'], w: 1 },
      { op: 'add', id: 'carpark', type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { near: 'beach' }, w: 1 },
      { op: 'replace', role: 'boatyard', type: 'houses', labels: ['Flats', 'Apartments'], id: 'flats', w: 1 },
    ],
  },
  industrial: {
    area: 'the district',
    place: (rng) => `the ${pickOne(rng, ['Eastgate', 'Millfield', 'Northbank', 'Westford'])} district of ${pickOne(rng, TOWNS)}`,
    scene(S) {
      const y = int(S.rng, 3, 4);
      const x = pickOne(S.rng, [3, 4, 7, 8]);
      hStrip(S, 'canal', 'river', 'Canal', y);
      vStrip(S, 'road', 'road', pickOne(S.rng, ['Mill Road', 'Factory Road', 'Dock Road']), x);
      bridgeOver(S, x, y);
      if (chance(S.rng, 0.5)) hStrip(S, 'railway', 'railway', 'Railway', chance(S.rng, 0.5) ? 0 : S.rows - 1);
    },
    cast: {
      church: { type: 'building', labels: ['Church', 'Chapel'], sizes: [[2, 2]], prefs: { road: 1 }, keep: true, p: 0.7 },
      pub: { type: 'building', labels: ['Pub'], sizes: [[2, 2]], prefs: { road: 2 }, keep: true },
      terraces: { type: 'houses', labels: ['Terraced houses', 'Houses'], sizes: [[3, 2], [4, 2]], prefs: { edge: 1, road: 1 }, keep: true, p: 0.7 },
      factory: { type: 'industry', labels: ['Factory'], sizes: [[3, 2], [3, 3], [4, 2]], prefs: { water: 2 }, p: 1 },
      works: { type: 'industry', labels: ['Brickworks', 'Workshops', 'Sawmill'], sizes: [[3, 2], [3, 3]], prefs: { edge: 1 }, p: 0.6 },
      warehouse: { type: 'industry', labels: ['Warehouse', 'Warehouses'], sizes: [[3, 2], [4, 2]], prefs: { water: 2 }, p: 0.9 },
      gasworks: { type: 'industry', labels: ['Gasworks'], sizes: [[3, 2], [3, 3]], prefs: { edge: 2 }, p: 0.7 },
      yard: { type: 'industry', labels: ['Goods yard', 'Depot'], sizes: [[2, 2], [3, 2]], prefs: { near: 'railway' }, p: 0.6 },
    },
    recipes: [
      { op: 'replace', role: 'factory', type: 'houses', labels: ['Housing estate', 'Houses'], id: 'estate', w: 2 },
      { op: 'convert', role: 'warehouse', type: 'houses', labels: ['Flats', 'Apartments'], w: 2 },
      { op: 'replace', role: 'gasworks', type: 'park', labels: ['Park'], id: 'park', w: 1.5 },
      { op: 'convert', role: 'railway', type: 'path', labels: ['Cycle path'], w: 1.2 },
      { op: 'add', id: 'school', type: 'building', labels: ['School', 'Primary school'], sizes: [[2, 2], [3, 2]], prefs: { road: 1 }, w: 1.2 },
      { op: 'add', id: 'shops', type: 'shops', labels: ['Shops', 'Supermarket'], sizes: [[2, 2], [3, 2], [4, 2]], prefs: { road: 2 }, w: 1 },
      { op: 'replace', role: 'yard', type: 'carpark', labels: ['Car park'], id: 'carpark', w: 1 },
      { op: 'remove', role: 'works', w: 0.8 },
    ],
  },
  school: {
    area: 'the school grounds',
    place: (rng) => `the grounds of ${pickOne(rng, ['Hillcrest', 'Oakfield', 'Parkside', 'Greenway', 'Westlea'])} School`,
    scene(S) {
      hStrip(S, 'road', 'road', pickOne(S.rng, ['School Road', 'Park Lane', 'Mill Lane']), S.rows - 1);
    },
    cast: {
      main: { type: 'building', labels: ['Main building'], sizes: [[3, 2], [4, 2]], prefs: { road: 2, centre: 1 }, keep: true },
      trees: { type: 'woodland', labels: ['Trees'], sizes: [[2, 2], [3, 2]], prefs: { corner: 2 }, keep: true, p: 0.7 },
      hall: { type: 'building', labels: ['Hall', 'Assembly hall'], sizes: [[2, 2], [3, 2]], prefs: {}, keep: true, p: 0.5 },
      classrooms: { type: 'building', labels: ['Classroom block', 'Classrooms'], sizes: [[3, 2], [4, 2]], prefs: { near: 'main' }, p: 1 },
      field: { type: 'sports', labels: ['Playing field', 'Sports field'], sizes: LARGE, prefs: { edge: 2, big: 0.3 }, p: 1 },
      play: { type: 'park', labels: ['Playground'], sizes: [[3, 2], [4, 2]], prefs: { near: 'main' }, p: 0.8 },
      carpark: { type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 3 }, p: 0.9 },
      canteen: { type: 'building', labels: ['Canteen'], sizes: [[3, 2]], prefs: {}, p: 0.6 },
      garden: { type: 'park', labels: ['Garden'], sizes: [[2, 2], [3, 2]], prefs: {}, p: 0.6 },
      tennis: { type: 'sports', labels: ['Tennis courts'], sizes: [[3, 2]], prefs: { edge: 1 }, p: 0.5 },
      huts: { type: 'building', labels: ['Huts'], sizes: [[2, 2]], prefs: { edge: 1 }, p: 0.4 },
    },
    recipes: [
      { op: 'add', id: 'sportshall', type: 'building', labels: ['Sports hall', 'Gym'], sizes: [[3, 2], [2, 2]], prefs: { near: 'field' }, w: 1.5 },
      { op: 'extend', role: 'classrooms', w: 1.5 },
      { op: 'relocate', role: 'carpark', prefs: { road: 3 }, w: 1.3 },
      { op: 'reduce', role: 'field', then: { type: 'building', labels: ['Science block', 'Classrooms'], id: 'science' }, w: 1.3 },
      { op: 'convert', role: 'canteen', labels: ['Library', 'Music room'], w: 1.2 },
      { op: 'replace', role: 'garden', type: 'building', labels: ['Classrooms', 'Library'], id: 'newblock', w: 1 },
      { op: 'replace', role: 'tennis', type: 'pool', labels: ['Swimming pool'], id: 'pool', w: 0.8 },
      { op: 'remove', role: 'huts', w: 1 },
      { op: 'extend', role: 'play', w: 0.8 },
    ],
  },
  hospital: {
    area: 'the hospital site',
    place: (rng) => `the site of ${pickOne(rng, ['Northfield', 'Westbrook', 'Kingsmead', 'Ashley', 'Riverside'])} Hospital`,
    scene(S) {
      const x = chance(S.rng, 0.5) ? 0 : S.cols - 1;
      vStrip(S, 'road', 'road', pickOne(S.rng, ['Hospital Road', 'London Road', 'Station Road']), x);
      if (chance(S.rng, 0.5)) hStrip(S, 'access', 'road', 'Access road', int(S.rng, 3, 4), x === 0 ? 1 : S.cols - 8, 7);
    },
    cast: {
      hospital: { type: 'building', labels: ['Hospital', 'Main hospital'], sizes: [[3, 2], [4, 2], [3, 3]], prefs: { road: 2, centre: 1 }, p: 1 },
      chapel: { type: 'building', labels: ['Chapel'], sizes: [[2, 2]], prefs: {}, keep: true, p: 0.7 },
      trees: { type: 'woodland', labels: ['Trees', 'Woodland'], sizes: MID, prefs: { corner: 2 }, keep: true, p: 0.8 },
      nursery: { type: 'building', labels: ['Nursery'], sizes: [[2, 2], [3, 2]], prefs: {}, keep: true, p: 0.4 },
      gardens: { type: 'park', labels: ['Gardens', 'Garden'], sizes: [[3, 2], [2, 2]], prefs: { near: 'hospital' }, p: 0.8 },
      carpark: { type: 'carpark', labels: ['Car park'], sizes: [[2, 2], [3, 2]], prefs: { road: 3 }, p: 0.9 },
      staff: { type: 'houses', labels: ['Staff housing'], sizes: [[3, 2]], prefs: { edge: 1 }, p: 0.7 },
      clinic: { type: 'building', labels: ['Clinic'], sizes: [[2, 2]], prefs: { road: 1 }, p: 0.7 },
      offices: { type: 'building', labels: ['Offices'], sizes: [[3, 2]], prefs: {}, p: 0.5 },
    },
    recipes: [
      { op: 'extend', role: 'hospital', w: 1.5 },
      { op: 'replace', role: 'gardens', type: 'carpark', labels: ['Staff car park', 'Car park'], id: 'carpark2', w: 1.2 },
      { op: 'replace', role: 'staff', type: 'building', labels: ['Research centre'], id: 'research', w: 1.3 },
      { op: 'relocate', role: 'clinic', prefs: { road: 1 }, w: 1.2 },
      { op: 'add', id: 'helipad', type: 'square', labels: ['Helipad'], sizes: [[3, 2], [2, 3]], prefs: { near: 'hospital' }, w: 1.2 },
      { op: 'add', id: 'pharmacy', type: 'shops', labels: ['Pharmacy'], sizes: [[3, 2]], prefs: { road: 2 }, w: 1 },
      { op: 'convert', role: 'offices', labels: ['Café'], w: 0.8 },
      { op: 'extend', role: 'carpark', by: 2, w: 1 },
    ],
  },
};

/* ---------- generateMap ---------- */

const FRAMES = ['past', 'present', 'future'];
const DEFAULT_NOW = Date.UTC(2025, 0, 1); // only when no `now` is passed

function frameLabels(rng, frame, now) {
  const year = new Date(now).getUTCFullYear();
  const round5 = (y) => Math.round(y / 5) * 5;
  if (frame === 'past') {
    let after = round5(year - int(rng, 6, 30));
    let before = after - pickOne(rng, [10, 15, 20, 25, 30, 40, 50]);
    if (chance(rng, 0.2)) {
      after -= int(rng, 1, 4);
      before -= int(rng, 0, 3);
    }
    return [String(before), String(after)];
  }
  if (frame === 'present') {
    const before = chance(rng, 0.7) ? round5(year - int(rng, 10, 40)) : year - int(rng, 8, 35);
    return [String(before), pickWeighted(rng, ['Today', 'Now', 'Present day'], [6, 2, 2])];
  }
  const target = year + int(rng, 4, 15);
  const before = pickWeighted(rng, ['Today', 'Present day', 'Now', String(year)], [4, 2, 1, 3]);
  if (chance(rng, 0.2)) return [before, 'Proposed'];
  return [before, `${chance(rng, 0.6) ? round5(target) : target} (planned)`];
}

function mirror(features, cols, rows, fx, fy) {
  for (const f of features) {
    if (fx) f.x = cols - f.x - f.w;
    if (fy) f.y = rows - f.y - f.h;
  }
}

const labelFits = (f) => BASE.has(f.type) || f.type === 'bridge' || f.type === 'pier' ||
  (isLinear(f) ? fitsAlong(f.label, f) : !!fitLabel(f.label, f.w, f.h));

function acceptable(map) {
  const changes = mapChanges(map);
  const changed = changes.filter((c) => c.kind !== 'unchanged').length;
  const kept = changes.filter((c) => c.kind === 'unchanged').reduce((n, c) => n + c.ids.length, 0);
  if (changed < 4 || changed > 7 || kept < 2) return false;
  return [map.before, map.after].every((s) => s.features.length <= MAX_FEATURES &&
    !overlapProblems(s.features).length && s.features.every(labelFits));
}

export function generateMap(rng, { now = DEFAULT_NOW, setting = null, frame = null } = {}) {
  const id = SETTINGS[setting] ? setting : pickOne(rng, MAP_SETTINGS).id;
  const def = SETTINGS[id];
  const fr = FRAMES.includes(frame) ? frame : pickOne(rng, FRAMES);
  const place = def.place(rng);
  const [beforeLabel, afterLabel] = frameLabels(rng, fr, now);
  let map = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const { before, after } = buildAttempt(rng, def);
    map = {
      kind: 'map', place, setting: id, frame: fr, cols: MAP_COLS, rows: MAP_ROWS,
      before: { label: beforeLabel, features: before },
      after: { label: afterLabel, features: after },
    };
    if (acceptable(map)) break;
  }
  const fx = chance(rng, 0.5);
  const fy = id !== 'island' && chance(rng, 0.35);
  mirror(map.before.features, MAP_COLS, MAP_ROWS, fx, fy);
  mirror(map.after.features, MAP_COLS, MAP_ROWS, fx, fy);
  return map;
}

/* ---------- change analysis ---------- */

const KIND_ORDER = ['replaced', 'added', 'removed', 'converted', 'extended', 'reduced', 'relocated', 'unchanged'];
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function change(kind, before, after) {
  const c = { kind, ids: [...new Set([...before, ...after].map((f) => f.id))], before, after };
  if (kind === 'extended' || kind === 'reduced') c.ratio = Math.round((areaOf(after[0]) / areaOf(before[0])) * 100) / 100;
  return c;
}

function compareFeature(b, a) {
  if (overlapArea(a, b) < 0.5 * Math.min(areaOf(a), areaOf(b))) return change('relocated', [b], [a]);
  if (!sameText(a.label, b.label) || a.type !== b.type) return change('converted', [b], [a]);
  if (areaOf(a) !== areaOf(b)) return change(areaOf(a) > areaOf(b) ? 'extended' : 'reduced', [b], [a]);
  return change(sameRect(a, b) ? 'unchanged' : 'relocated', [b], [a]);
}

// How much of the map a change affects, for ordering.
function weight(c) {
  const sum = (fs) => fs.reduce((n, f) => n + areaOf(f), 0);
  if (c.kind === 'extended' || c.kind === 'reduced') return Math.abs(sum(c.after) - sum(c.before)) * 1.5;
  return Math.max(sum(c.before), sum(c.after)) * (c.kind === 'replaced' ? 1.3 : 1);
}

// Segments of one road or river (same type and label, touching) count once.
function mergeStrips(changes) {
  const out = [];
  for (const c of changes) {
    const f = c.after[0] || c.before[0];
    const prev = ['added', 'removed', 'unchanged'].includes(c.kind) && isLinear(f) && out.find((o) => {
      const g = o.after[0] || o.before[0];
      return o.kind === c.kind && g.type === f.type && sameText(g.label, f.label) &&
        [...o.before, ...o.after].some((x) => overlapArea(x, f) || touching(x, f));
    });
    if (prev) {
      prev.ids.push(...c.ids);
      prev.before.push(...c.before);
      prev.after.push(...c.after);
    } else out.push(c);
  }
  return out;
}

// Change = { kind, ids, before: Feature[], after: Feature[], ratio? } where kind is
// added | removed | replaced (removed + added on the same site) | converted
// (same id, new type or label) | extended | reduced (same id, bigger/smaller;
// ratio = new area / old area) | relocated (same id, moved) | unchanged.
// Sea and island are background and never listed.
export function mapChanges(map) {
  const B = (map?.before?.features || []).filter((f) => !BASE.has(f.type));
  const A = (map?.after?.features || []).filter((f) => !BASE.has(f.type));
  const inA = new Map(A.map((f) => [f.id, f]));
  const inB = new Set(B.map((f) => f.id));
  const out = B.filter((b) => inA.has(b.id)).map((b) => compareFeature(b, inA.get(b.id)));
  const gone = B.filter((f) => !inA.has(f.id));
  const fresh = A.filter((f) => !inB.has(f.id));
  const linked = (b, a) => overlapArea(a, b) >= Math.max(1, 0.3 * Math.min(areaOf(a), areaOf(b)));
  const takenA = new Set();
  const takenB = new Set();
  for (const b0 of gone) {
    if (takenB.has(b0)) continue;
    takenB.add(b0);
    const before = [];
    const after = [];
    const queue = [[b0, true]];
    while (queue.length) {
      const [f, isOld] = queue.shift();
      (isOld ? before : after).push(f);
      for (const g of isOld ? fresh : gone) {
        const taken = isOld ? takenA : takenB;
        if (taken.has(g) || !(isOld ? linked(f, g) : linked(g, f))) continue;
        taken.add(g);
        queue.push([g, !isOld]);
      }
    }
    out.push(change(after.length ? 'replaced' : 'removed', before, after));
  }
  for (const a of fresh) if (!takenA.has(a)) out.push(change('added', [], [a]));
  return mergeStrips(out).sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || weight(y) - weight(x));
}

/* ---------- English: noun phrases for features ---------- */

const COMMON = new Set(`main road street lane car park shopping centre center housing estate sports field fields playing
  tennis courts court swimming pool bus station town hall post office primary secondary school village green community
  leisure visitor student building buildings lecture theatre science block staff fish market cycle path footpath foot
  flower garden gardens picnic area skate play new old research nursery clinic café cafe restaurant hotel library museum
  cinema church chapel bank shop shops houses house flats apartments factory factories warehouse warehouses works gasworks
  brickworks goods yard depot boatyard pier jetty marina beach sea lake pond river canal bridge footbridge railway line
  woodland woods trees tree forest farmland farm farmhouse windmill pub reception lighthouse bandstand greenhouse toilets
  helipad pharmacy laboratories laboratory classroom classrooms canteen accommodation chalets huts cabins cottages
  terraced industrial units access bypass high square plaza pedestrian offices office assembly music room gym orchard
  rose palm lagoon sawmill workshops tourist information police fire hospital university college sports hall`.split(/\s+/));
const PLURAL_END = /s$/;
const SINGULAR_S = /(bus|campus|works|glass|grass|ss|us|is)$/;
const MASS = /(farmland|woodland|housing|accommodation|parking|grassland|wasteland|scrubland)$/;
const DEFAULT_LABEL = {
  building: 'Building', houses: 'Houses', shops: 'Shops', industry: 'Factory', carpark: 'Car park', square: 'Square',
  park: 'Park', sports: 'Sports field', pool: 'Swimming pool', woodland: 'Woodland', farmland: 'Farmland', lake: 'Lake',
  beach: 'Beach', sea: 'Sea', island: '', road: 'Road', path: 'Footpath', railway: 'Railway', river: 'River',
  bridge: 'Bridge', pier: 'Pier',
};

// "Main Road", "River Ash", "Grand Hotel" are names; "Car park", "Town Hall" are not.
function isProper(label, f) {
  const words = label.split(/\s+/);
  if (words.length < 2 || !words.every((w) => /^[A-Z0-9]/.test(w) || /^(of|the|and|on|upon)$/.test(w))) return false;
  if (isLinear(f) || /^River\b/.test(label)) return true;
  return words.some((w) => /^[A-Z][a-z]/.test(w) && !COMMON.has(w.toLowerCase()));
}

function nameWithArticle(label) {
  if (/^River\b|^High Street$/.test(label) || /\b(Hotel|Hall|Centre|Museum|Library|Market|Theatre|Inn|Canal|Estate|Pier)$/.test(label)) return `the ${label}`;
  return label;
}

const lowerWord = (w) => (/^[A-Z][a-zà-ÿ'’-]*$/.test(w) ? w.toLowerCase() : w);

// { def: 'the car park', indef: 'a car park', fresh: 'a new car park', bare, plural }
function nounOf(f) {
  const label = String(f.label || '').trim() || DEFAULT_LABEL[f.type] || f.type;
  const proper = isProper(label, f);
  let bare = proper ? label : label.split(/\s+/).map(lowerWord).join(' ');
  if (!proper && f.type === 'railway' && bare === 'railway') bare = 'railway line';
  const plural = !proper && PLURAL_END.test(bare) && !SINGULAR_S.test(bare);
  const mass = !proper && MASS.test(bare);
  const def = proper ? nameWithArticle(label) : `the ${bare}`;
  const indef = proper ? def : plural || mass ? bare : `${article(bare)} ${bare}`;
  const fresh = proper || /^new\b/.test(bare) ? indef : plural || mass ? `new ${bare}` : `${article('new')} new ${bare}`;
  return { bare, def, indef, fresh, plural, mass, proper };
}

// "a school and a car park"; "a shop and café, and a park" when a name has its own "and".
function listOf(fs, form) {
  const items = fs.map((f) => nounOf(f)[form]);
  if (fs.slice(0, -1).some((f) => !nounOf(f).proper && / and /.test(nounOf(f).bare))) return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
  return joinList(items);
}
const partOf = (f) => (nounOf(f).plural ? `some of ${nounOf(f).def}` : `part of ${nounOf(f).def}`);
const pluralOf = (fs) => fs.length > 1 || nounOf(fs[0]).plural;

/* ---------- English: places on the map ---------- */

const AREA_WORDS = [
  [/\bvillage\b/i, 'the village'], [/\b(campus|university)\b/i, 'the campus'], [/\bisland\b/i, 'the island'],
  [/\bhospital\b/i, 'the hospital site'], [/\bschool\b/i, 'the school grounds'], [/\bdistrict\b/i, 'the district'],
  [/\bcentre\b/i, 'the town centre'], [/\bcity\b/i, 'the city'], [/\btown\b/i, 'the town'], [/\bpark\b/i, 'the park'],
  [/\bsite\b/i, 'the site'],
];
const CORNER_WORDS = { 'north-west': 'top left-hand', 'north-east': 'top right-hand', 'south-west': 'bottom left-hand', 'south-east': 'bottom right-hand' };

function areaNoun(map) {
  for (const [re, noun] of AREA_WORDS) if (re.test(map.place || '')) return noun;
  return SETTINGS[map.setting]?.area || 'the area';
}

function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const yearOf = (label) => {
  const m = /\b(1[5-9]\d\d|2[01]\d\d)\b/.exec(String(label || ''));
  return m ? Number(m[1]) : null;
};

function makeContext(map) {
  const before = map.before.features;
  const after = map.after.features;
  const changes = mapChanges(map);
  const land = [...before, ...after].filter((f) => !BASE.has(f.type));
  const island = [...before, ...after].find((f) => f.type === 'island');
  return {
    map, frame: map.frame, changes, area: areaNoun(map),
    stable: changes.filter((c) => c.kind === 'unchanged').flatMap((c) => c.after).filter((f) => f.type !== 'bridge' && f.type !== 'pier'),
    bounds: island || (land.length ? union(land) : { x: 0, y: 0, w: map.cols, h: map.rows }),
    oldIds: new Set(before.map((f) => f.id)),
    side: (s) => (s === 'before' ? before : after).filter((f) => !BASE.has(f.type)),
    by: yearOf(map.before.label), ay: yearOf(map.after.label),
    rng: makeRng(hashOf(JSON.stringify([map.place, map.before.label, map.after.label, before.length, after.length, ...after.map((f) => f.id + f.x + f.y)]))),
    verbs: new Map(), refUse: new Map(), openers: new Set(), tick: 0, passive: 0, active: 0,
  };
}

// "the new school" for a feature that only exists in the second map.
function defIn(ctx, f, side) {
  const n = nounOf(f);
  return side === 'after' && !ctx.oldIds.has(f.id) && !n.proper && !/^new\b/.test(n.bare) ? `the new ${n.bare}` : n.def;
}

function regionOf(ctx, r) {
  const b = ctx.bounds;
  const c = centre(r);
  const u = (c.x - b.x) / b.w;
  const v = (c.y - b.y) / b.h;
  const ns = v < 0.36 ? 'north' : v > 0.64 ? 'south' : '';
  const ew = u < 0.36 ? 'west' : u > 0.64 ? 'east' : '';
  const corner = !!(ns && ew) && (ns === 'north' ? r.y <= b.y : r.y + r.h >= b.y + b.h) && (ew === 'west' ? r.x <= b.x : r.x + r.w >= b.x + b.w);
  return { ns, ew, corner, word: ns && ew ? `${ns}-${ew}` : ns || ew || 'centre' };
}

function regionPhrase(ctx, r) {
  const g = regionOf(ctx, r);
  if (g.corner) {
    return chance(ctx.rng, 0.3)
      ? { prep: `in the ${CORNER_WORDS[g.word]} corner of`, obj: 'the map' }
      : { prep: `in the ${g.word} corner of`, obj: ctx.area };
  }
  const b = ctx.bounds;
  const edge = r.x <= b.x || r.y <= b.y || r.x + r.w >= b.x + b.w || r.y + r.h >= b.y + b.h;
  if (edge && g.word !== 'centre' && /^the (village|town|city)$/.test(ctx.area) && chance(ctx.rng, 0.35)) return { prep: 'on the outskirts of', obj: ctx.area };
  if (g.word === 'centre') return { prep: chance(ctx.rng, 0.5) && !/centre/.test(ctx.area) ? 'in the centre of' : 'in the middle of', obj: ctx.area };
  return { prep: `in the ${g.word} of`, obj: ctx.area };
}

// A road between two features that face each other across it.
function roadBetween(ctx, t, r, side) {
  for (const R of ctx.side(side)) {
    if (R.type !== 'road' && !(R.type === 'square' && isLinear(R))) continue;
    if (R.w >= R.h && spanX(t, r) > 0) {
      const [top, bottom] = t.y < r.y ? [t, r] : [r, t];
      if (top.y + top.h === R.y && bottom.y === R.y + R.h && R.x <= Math.max(t.x, r.x) && R.x + R.w >= Math.min(t.x + t.w, r.x + r.w)) return R;
    } else if (R.h > R.w && spanY(t, r) > 0) {
      const [left, right] = t.x < r.x ? [t, r] : [r, t];
      if (left.x + left.w === R.x && right.x === R.x + R.w && R.y <= Math.max(t.y, r.y) && R.y + R.h >= Math.min(t.y + t.h, r.y + r.h)) return R;
    }
  }
  return null;
}

function compassFrom(t, r) {
  const ns = t.y + t.h <= r.y ? 'north' : t.y >= r.y + r.h ? 'south' : '';
  const ew = t.x + t.w <= r.x ? 'west' : t.x >= r.x + r.w ? 'east' : '';
  if (spanX(t, r) > 0) return ns;
  if (spanY(t, r) > 0) return ew;
  return ns && ew ? `${ns}-${ew}` : ns || ew;
}

// How t relates to the landmark r, or null when nothing true and useful can be said.
function relate(ctx, t, r, side) {
  if (overlapArea(t, r)) return null;
  const obj = nounOf(r).def;
  const refs = [r];
  if (isLinear(r)) {
    const horiz = r.w >= r.h;
    const beside = horiz ? spanX(t, r) > 0 && spanY(t, r) === 0 : spanY(t, r) > 0 && spanX(t, r) === 0;
    if (!beside) return null;
    const dir = horiz ? (t.y < r.y ? 'north' : 'south') : t.x < r.x ? 'west' : 'east';
    if (r.type === 'river') return { prep: `on the ${dir} bank of`, obj, w: 3, refs };
    if (r.type === 'railway') return { prep: `immediately to the ${dir} of`, obj, w: 2, refs };
    if ((horiz ? t.w : t.h) >= 3 && chance(ctx.rng, 0.4)) return { prep: 'alongside', obj, w: 2.6, refs };
    return { prep: `on the ${dir}ern side of`, obj, w: 2.8, refs };
  }
  const dir = compassFrom(t, r);
  if (touching(t, r)) {
    if (NATURAL.has(r.type) && areaOf(r) >= 4 && chance(ctx.rng, 0.5)) return { prep: 'bordering', obj, w: 3, refs };
    return { prep: pickOne(ctx.rng, ['next to', 'adjacent to', 'beside', `immediately to the ${dir} of`]), obj, w: 3.2, refs };
  }
  const road = roadBetween(ctx, t, r, side);
  if (road) {
    return chance(ctx.rng, 0.6) ? { prep: 'opposite', obj, w: 4, refs } : { prep: `across ${nounOf(road).def} from`, obj, w: 3.8, refs };
  }
  const gap = gapBetween(t, r);
  if (gap > 2 || !dir) return null;
  return { prep: `to the ${dir} of`, obj, w: 2.6 - gap * 0.5, refs };
}

function betweenPhrase(t, refs) {
  for (const a of refs) {
    for (const b of refs) {
      if (a === b || isLinear(a) || isLinear(b)) continue;
      const across = spanY(t, a) > 0 && spanY(t, b) > 0 && a.x + a.w <= t.x && t.x + t.w <= b.x && t.x - a.x - a.w <= 1 && b.x - t.x - t.w <= 1;
      const down = spanX(t, a) > 0 && spanX(t, b) > 0 && a.y + a.h <= t.y && t.y + t.h <= b.y && t.y - a.y - a.h <= 1 && b.y - t.y - t.h <= 1;
      if (across || down) return { prep: 'between', obj: `${nounOf(a).def} and ${nounOf(b).def}`, w: 4.2, refs: [a, b] };
    }
  }
  return null;
}

// Where t is: { prep, obj, text }. `side`: the map it is read from.
function locate(ctx, t, side, exclude = []) {
  const refs = ctx.stable.filter((r) => !exclude.includes(r.id) && !sameRect(r, t));
  const cands = refs.map((r) => relate(ctx, t, r, side)).filter(Boolean);
  const btw = betweenPhrase(t, refs.filter((r) => !isLinear(r)));
  if (btw) cands.push(btw);
  cands.push({ ...regionPhrase(ctx, t), w: 2.4, refs: [] });
  for (const c of cands) for (const r of c.refs) c.w -= 0.9 * (ctx.refUse.get(r.id) || 0);
  const top = cands.sort((a, b) => b.w - a.w).slice(0, 3);
  const pick = pickWeighted(ctx.rng, top, top.map((c) => Math.max(0.2, c.w) ** 2));
  for (const r of pick.refs) ctx.refUse.set(r.id, (ctx.refUse.get(r.id) || 0) + 1);
  return { prep: pick.prep, obj: pick.obj, text: `${pick.prep} ${pick.obj}` };
}

const contains = (r, c) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;

// What each end of a strip runs into (a road junction or a feature).
function stripEnds(ctx, f, side) {
  const others = ctx.side(side).filter((g) => g.id !== f.id && g.type !== 'bridge' && g.type !== 'pier');
  const horiz = f.w >= f.h;
  const out = [];
  for (const end of [0, 1]) {
    const outside = horiz ? { x: end ? f.x + f.w : f.x - 1, y: f.y } : { x: f.x, y: end ? f.y + f.h : f.y - 1 };
    const inside = horiz ? { x: end ? f.x + f.w - 1 : f.x, y: f.y } : { x: f.x, y: end ? f.y + f.h - 1 : f.y };
    const hit = others.find((g) => isLinear(g) && (contains(g, inside) || contains(g, outside))) ||
      others.find((g) => !isLinear(g) && contains(g, outside));
    if (hit) out.push(hit);
  }
  return out;
}

// Where a road, path, railway or river runs.
function stripPhrase(ctx, f, side) {
  const b = ctx.bounds;
  const horiz = f.w >= f.h;
  const edges = horiz
    ? [[f.y <= b.y, 'northern'], [f.y + f.h >= b.y + b.h, 'southern']]
    : [[f.x <= b.x, 'western'], [f.x + f.w >= b.x + b.w, 'eastern']];
  const edge = edges.find(([on]) => on);
  if (edge) return { prep: `along the ${edge[1]} edge of`, obj: ctx.area };
  if ((horiz ? f.w / b.w : f.h / b.h) >= 0.75) {
    const g = regionOf(ctx, f);
    const part = horiz ? g.ns : g.ew;
    return part ? { prep: `through the ${part}ern part of`, obj: ctx.area } : { prep: /centre/.test(ctx.area) ? 'through the middle of' : 'through the centre of', obj: ctx.area };
  }
  const ends = stripEnds(ctx, f, side).map((g) => ({ g, def: defIn(ctx, g, side) }));
  if (ends.length === 2 && ends[0].g.id !== ends[1].g.id) return { prep: 'linking', obj: `${ends[0].def} and ${ends[1].def}` };
  const road = ends.find((e) => isLinear(e.g));
  if (road) return { prep: 'leading off', obj: road.def };
  if (ends.length) return { prep: 'leading to', obj: ends[0].def };
  return regionPhrase(ctx, f);
}

const whereIs = (ctx, f, side, exclude) => {
  const p = isLinear(f) ? stripPhrase(ctx, f, side) : locate(ctx, f, side, exclude);
  return { ...p, text: `${p.prep} ${p.obj}` };
};

/* ---------- English: sentences ---------- */

const M = (s) => `[[${s}]]`;
const cap = (s) => (s.startsWith('[[') ? `[[${capitalise(s.slice(2))}` : capitalise(s));
const pv = (verb, tense, plural) => verbPhrase(verb, { tense, voice: 'passive', plural });
const av = (verb, tense, plural) => verbPhrase(verb, { tense, voice: 'active', plural });
const asRect = (fs) => ({ ...union(fs), type: fs[0].type, id: fs[0].id });

// Change tense by frame; plans alternate between will, is to and is going to.
function tenseFor(ctx) {
  if (ctx.frame === 'past') return 'past';
  if (ctx.frame === 'present') return 'presentPerfect';
  return ['future', 'toBe', 'future', 'future', 'toBe', 'goingTo'][ctx.tick++ % 6];
}

const OPENERS = {
  past: ['another notable change was', 'a further development was', 'another significant change was'],
  present: ['another notable change has been', 'a further development has been', 'another significant change has been'],
  future: ['the plans also include', 'the proposals also include', 'another planned change is'],
};
const opener = (ctx) => OPENERS[ctx.frame].find((o) => !ctx.openers.has(o)) || OPENERS[ctx.frame][0];

function addVerbs(f) {
  if (['park', 'sports', 'square'].includes(f.type)) return ['create', 'lay out'];
  if (f.type === 'woodland') return ['plant'];
  if (['lake', 'farmland', 'beach', 'path'].includes(f.type)) return ['create'];
  if (['road', 'railway', 'bridge', 'pier', 'carpark'].includes(f.type)) return ['build', 'construct', 'add'];
  if (f.type === 'shops' || (f.type === 'building' && /caf|restaurant|hotel|museum|centre|gym|pharmacy|cinema|library|school|clinic|reception/i.test(f.label))) return ['build', 'construct', 'open', 'add'];
  return ['build', 'construct', 'erect', 'add'];
}
const addNoun = (f) => (['park', 'sports', 'square', 'path', 'lake', 'beach'].includes(f.type) ? 'creation' : f.type === 'woodland' ? 'planting' : 'construction');

function removeVerbs(f) {
  if (f.type === 'woodland') return ['clear', 'cut down'];
  if (['farmland', 'park', 'sports', 'square', 'carpark', 'beach', 'lake'].includes(f.type)) return ['remove', 'clear'];
  if (LINEAR.has(f.type) || f.type === 'pier' || f.type === 'bridge') return ['remove', 'dismantle'];
  return ['demolish', 'pull down', 'remove'];
}
const removeNoun = (f) => (TYPE_GROUP[f.type] === 'built' ? 'demolition' : f.type === 'woodland' ? 'clearance' : 'removal');
const ROOT = {
  construction: 'construct', creation: 'create', planting: 'plant', development: 'develop', replacement: 'replace',
  conversion: 'convert', extension: 'extend', expansion: 'expand', relocation: 'relocate', demolition: 'demolish',
  removal: 'remove', clearance: 'clear', pedestrianisation: 'pedestrianise', reduction: 'reduce',
};

// Piers and bridges are placed by what they stand on.
function whereStructure(ctx, f, side) {
  const host = ctx.side(side).find((g) => g.id !== f.id && (f.type === 'pier' ? g.type === 'beach' && touching(g, f) : g.type === 'river' && overlapArea(g, f)));
  if (!host) return null;
  return f.type === 'pier'
    ? { prep: 'extending into the sea from', obj: nounOf(host).def, text: `extending into the sea from ${nounOf(host).def}` }
    : { prep: 'across', obj: nounOf(host).def, text: `across ${nounOf(host).def}` };
}

const located = (ctx, f, side, exclude) => (f.type === 'pier' || f.type === 'bridge' ? whereStructure(ctx, f, side) : null) || whereIs(ctx, f, side, exclude);

// Each builder returns candidate sentences: { text, focus, verb, voice, nominal?, notFirst?, opener?, byYear? }.
const LINES = {
  added(ctx, c, T) {
    const fs = c.after;
    const f = fs[0];
    const pl = pluralOf(fs);
    const subj = listOf(fs, 'fresh');
    const loc = located(ctx, fs.length > 1 ? asRect(fs) : f, 'after');
    const out = [];
    for (const v of addVerbs(f)) {
      out.push({ verb: v, voice: 'passive', focus: 'change', text: `${subj} ${M(pv(v, T, pl))} ${loc.text}.` });
      out.push({ verb: v, voice: 'passive', focus: 'location', text: `${subj} ${pv(v, T, pl)} ${M(loc.prep)} ${loc.obj}.` });
    }
    const area = !isLinear(f) && f.type !== 'pier' && f.type !== 'bridge';
    const empty = !ctx.side('before').some((g) => !isLinear(g) && overlapArea(g, f));
    if (area && ctx.frame === 'present') out.push({ verb: 'be', voice: 'active', focus: 'location', text: `there ${pl ? 'are' : 'is'} now ${subj} ${M(loc.prep)} ${loc.obj}.` });
    if (area && ctx.frame === 'future') out.push({ verb: 'be', voice: 'active', focus: 'location', text: `there will be ${subj} ${M(loc.prep)} ${loc.obj}.` });
    if (area && empty && ctx.frame === 'present') out.push({ verb: 'occupy', voice: 'active', focus: 'change', text: `${subj} ${M(`now ${av('occupy', 'present', pl)}`)} the previously empty land ${loc.text}.` });
    if (area && empty && ctx.frame === 'future') out.push({ verb: 'occupy', voice: 'active', focus: 'change', text: `${subj} ${M(av('occupy', 'future', pl))} the currently empty land ${loc.text}.` });
    const op = opener(ctx);
    out.push({ verb: ROOT[addNoun(f)], voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M(`the ${addNoun(f)} of`)} ${subj} ${loc.text}.` });
    if (ctx.frame === 'past' && ctx.ay) {
      const v = addVerbs(f)[0];
      out.push({ verb: v, voice: 'passive', focus: 'change', byYear: true, text: `by ${ctx.ay}, ${subj} ${M(verbPhrase(v, { tense: 'pastPerfect', voice: 'passive', plural: pl }))} ${loc.text}.` });
    }
    return out;
  },

  removed(ctx, c, T) {
    const fs = c.before;
    const f = fs[0];
    const pl = pluralOf(fs);
    const subj = listOf(fs, 'def');
    const loc = located(ctx, fs.length > 1 ? asRect(fs) : f, 'before', c.ids);
    const out = [];
    for (const v of removeVerbs(f)) {
      out.push({ verb: v, voice: 'passive', focus: 'change', text: `${subj} ${loc.text} ${M(pv(v, T, pl))}.` });
      out.push({ verb: v, voice: 'passive', focus: 'location', text: `${subj} ${M(loc.prep)} ${loc.obj} ${pv(v, T, pl)}.` });
    }
    const n = nounOf(f);
    if (ctx.frame === 'present' && fs.length === 1 && !n.proper) {
      out.push({ verb: 'exist', voice: 'active', focus: 'location', text: `there ${pl ? 'are' : 'is'} no longer ${pl || n.mass ? `any ${n.bare}` : n.indef} ${M(loc.prep)} ${loc.obj}.` });
    }
    if (ctx.frame === 'past' && ctx.ay) {
      const v = removeVerbs(f)[0];
      out.push({ verb: v, voice: 'passive', focus: 'change', byYear: true, text: `by ${ctx.ay}, ${subj} ${loc.text} ${M(verbPhrase(v, { tense: 'pastPerfect', voice: 'passive', plural: pl }))}.` });
    }
    const op = opener(ctx);
    out.push({ verb: ROOT[removeNoun(f)], voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M(`the ${removeNoun(f)} of`)} ${subj} ${loc.text}.` });
    return out;
  },

  replaced(ctx, c, T) {
    const B = c.before;
    const A = c.after;
    const plB = pluralOf(B);
    const plA = pluralOf(A);
    const oldS = listOf(B, 'def');
    const newS = listOf(A, 'indef');
    const natural = B.every((f) => NATURAL.has(f.type));
    const greenToGreen = natural && A.every((f) => NATURAL.has(f.type));
    const loc = located(ctx, asRect(B), 'before', c.ids);
    const old = chance(ctx.rng, 0.85) ? `${oldS} ${loc.text}` : oldS;
    const former = joinList(B.map((f) => (nounOf(f).proper ? nounOf(f).def : `the ${ctx.frame === 'future' ? 'existing' : 'former'} ${nounOf(f).bare}`)));
    const out = [
      { verb: 'replace', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv('replace', T, plB)} by`)} ${newS}.` },
      { verb: 'replace', voice: 'passive', focus: 'location', text: `${oldS} ${M(loc.prep)} ${loc.obj} ${pv('replace', T, plB)} by ${newS}.` },
      { verb: 'replace', voice: 'active', focus: 'change', text: `${newS} ${M(av('replace', T, plA))} ${old}.` },
      { verb: 'give way', voice: 'active', focus: 'change', text: `${old} ${M(av('give way to', T, plB))} ${newS}.` },
      { verb: natural ? 'clear' : 'demolish', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv(natural ? 'clear' : 'demolish', T, plB)} to make way for`)} ${newS}.` },
    ];
    if (natural && !greenToGreen) {
      out.push({ verb: 'develop', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv('develop', T, plB)} into`)} ${newS}.` });
      out.push({ verb: 'build', voice: 'passive', focus: 'location', text: `${newS} ${pv('build', T, plA)} ${M(`on land ${ctx.frame === 'future' ? 'currently' : 'previously'} occupied by`)} ${oldS}.` });
    } else if (greenToGreen) {
      out.push({ verb: 'turn', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv('turn', T, plB)} into`)} ${newS}.` });
    } else if (ctx.frame === 'present' && A.every((f) => TYPE_GROUP[f.type] === 'built')) {
      out.push({ verb: 'stand', voice: 'active', focus: 'location', text: `${newS} now ${av('stand', 'present', plA)} ${M('on the site of')} ${former}.` });
    } else if (ctx.frame === 'present') {
      out.push({ verb: 'occupy', voice: 'active', focus: 'change', text: `${newS} ${M(`now ${av('occupy', 'present', plA)}`)} the site of ${former}.` });
    } else {
      out.push({ verb: 'build', voice: 'passive', focus: 'location', text: `${newS} ${pv('build', T, plA)} ${M('on the site of')} ${former}.` });
    }
    const op = opener(ctx);
    out.push({ verb: 'replace', voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M('the replacement of')} ${old} with ${newS}.` });
    return out;
  },

  converted(ctx, c, T) {
    const b = c.before[0];
    const a = c.after[0];
    const nb = nounOf(b);
    const na = sameText(a.label, b.label) ? nounOf({ ...a, label: DEFAULT_LABEL[a.type] }) : nounOf(a);
    const pl = nb.plural;
    const op = opener(ctx);
    if (b.type === 'road' && (a.type === 'square' || a.type === 'path')) {
      return [
        { verb: 'pedestrianise', voice: 'passive', focus: 'change', text: `${nb.def} ${M(pv('pedestrianise', T, pl))}.` },
        { verb: 'close', voice: 'passive', focus: 'change', text: `${nb.def} ${M(`${pv('close', T, pl)} to traffic`)} and turned into a pedestrian street.` },
        { verb: 'pedestrianise', voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M('the pedestrianisation of')} ${nb.def}.` },
      ];
    }
    const loc = located(ctx, b, 'before', c.ids);
    const old = !isLinear(b) && chance(ctx.rng, 0.85) ? `${nb.def} ${loc.text}` : nb.def;
    const out = [
      { verb: 'convert', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv('convert', T, pl)} into`)} ${na.indef}.` },
      { verb: 'turn', voice: 'passive', focus: 'change', text: `${old} ${M(`${pv('turn', T, pl)} into`)} ${na.indef}.` },
      { verb: 'become', voice: 'active', focus: 'change', text: `${old} ${M(av('become', T, pl))} ${na.indef}.` },
      { verb: 'convert', voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M('the conversion of')} ${old} into ${na.indef}.` },
    ];
    if (!isLinear(b)) out.push({ verb: 'convert', voice: 'passive', focus: 'location', text: `${nb.def} ${M(loc.prep)} ${loc.obj} ${pv('convert', T, pl)} into ${na.indef}.` });
    if (TYPE_GROUP[b.type] === 'built' && ctx.frame !== 'past') {
      const building = !pl && !/(building|block|centre|hall|station)$/.test(nb.bare) ? `${nb.def} building` : nb.def;
      const vp = ctx.frame === 'present' ? `now ${av('house', 'present', pl)}` : av('house', 'future', pl);
      out.push({ verb: 'house', voice: 'active', focus: 'change', text: `${building} ${M(vp)} ${na.indef}.` });
    }
    return out;
  },

  extended(ctx, c, T) {
    const b = c.before[0];
    const a = c.after[0];
    const nb = nounOf(b);
    const pl = nb.plural;
    const dirs = ['north', 'south', 'west', 'east'].filter((d) => grew(b, a, d));
    const to = dirs.length ? ` to the ${joinList(dirs)}` : '';
    const wards = dirs.length === 1 ? `, expanding ${dirs[0]}wards` : '';
    const built = TYPE_GROUP[b.type] !== 'open' && TYPE_GROUP[b.type] !== 'water';
    const subj = !isLinear(b) && chance(ctx.rng, 0.8) ? `${nb.def} ${whereIs(ctx, b, 'before', c.ids).text}` : nb.def;
    const out = ['extend', 'enlarge', ...(built ? [] : ['expand'])].map((v) => ({ verb: v, voice: 'passive', focus: 'change', text: `${subj} ${M(pv(v, T, pl))}${to}.` }));
    if (!isLinear(b)) out.push({ verb: 'expand', voice: 'active', focus: 'change', text: `${subj} ${M(av('expand', T, pl))}${to}.` });
    if (c.ratio >= 1.9 && c.ratio <= 2.1) out.push({ verb: 'double', voice: 'active', focus: 'change', text: `${subj} ${M(av('double in size', T, pl))}${wards}.` });
    const limit = reach(ctx, b, a, dirs);
    if (limit && ctx.frame === 'past') {
      const when = ctx.ay ? `by ${ctx.ay}, ` : '';
      const vp = ctx.ay ? verbPhrase('extend', { tense: 'pastPerfect', voice: 'passive', plural: pl }) : pv('extend', 'past', pl);
      out.push({ verb: 'extend', voice: 'passive', focus: 'location', byYear: !!ctx.ay, text: `${when}${nb.def} ${vp} ${M('as far as')} ${limit}.` });
    } else if (limit) {
      const vp = ctx.frame === 'present' ? `now ${av('extend', 'present', pl)}` : av('extend', 'future', pl);
      out.push({ verb: 'reach', voice: 'active', focus: 'location', text: `${nb.def} ${vp} ${M('as far as')} ${limit}.` });
    }
    const op = opener(ctx);
    out.push({ verb: built ? 'extend' : 'expand', voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M(`the ${built ? 'extension' : 'expansion'} of`)} ${nb.def}${to}.` });
    const there = { past: 'there was also', present: 'there has also been', future: 'the plans also include' }[ctx.frame];
    out.push({ verb: 'increase', voice: 'active', focus: 'change', nominal: true, notFirst: true, text: `${there} ${M('an increase in')} the size of ${nb.def}.` });
    return out;
  },

  reduced(ctx, c, T) {
    const b = c.before[0];
    const nb = nounOf(b);
    const pl = nb.plural;
    const how = c.ratio <= 0.6 ? 'considerably' : 'slightly';
    const where = !isLinear(b) ? `${nb.def} ${whereIs(ctx, b, 'before', c.ids).text}` : nb.def;
    const out = [
      { verb: 'reduce', voice: 'passive', focus: 'change', text: `${where} ${M(`${pv('reduce', T, pl)} in size`)}.` },
      { verb: 'shrink', voice: 'active', focus: 'change', text: `${nb.def} ${M(av('shrink', T, pl))} ${how}.` },
      { verb: 'decrease', voice: 'active', focus: 'change', text: `the size of ${nb.def} ${M(av('decrease', T, false))} ${how}.` },
    ];
    if (c.ratio >= 0.45 && c.ratio <= 0.55) out.push({ verb: 'halve', voice: 'passive', focus: 'change', text: `${nb.def} ${M(`${pv('halve', T, pl)} in size`)}.` });
    if (NATURAL.has(b.type)) out.push({ verb: 'clear', voice: 'passive', focus: 'change', text: `${partOf(b)} ${M(pv(b.type === 'woodland' && pl ? 'cut down' : 'clear', T, pl))}.` });
    const there = { past: 'there was also', present: 'there has also been', future: 'the plans also involve' }[ctx.frame];
    out.push({ verb: 'reduce', voice: 'active', focus: 'change', nominal: true, notFirst: true, text: `${there} ${M('a reduction in')} the size of ${nb.def}.` });
    return out;
  },

  // A reduced feature whose lost part is now used by new features.
  reducedFor(ctx, c, T) {
    const b = c.before[0];
    const nb = nounOf(b);
    const adds = listOf(c.adds, 'fresh');
    const plA = pluralOf(c.adds);
    const natural = NATURAL.has(b.type);
    const v = natural ? 'clear' : 'demolish';
    const trees = b.type === 'woodland' && nb.plural;
    const site = trees ? `${M(`on land ${ctx.frame === 'future' ? 'currently' : 'previously'} covered by`)} ${nb.bare}` : `${M('on part of')} ${nb.def}`;
    return [
      { verb: v, voice: 'passive', focus: 'change', text: `${partOf(b)} ${M(`${pv(trees ? 'cut down' : v, T, nb.plural)} to make way for`)} ${adds}.` },
      { verb: addVerbs(c.adds[0])[0], voice: 'passive', focus: 'location', text: `${adds} ${pv(addVerbs(c.adds[0])[0], T, plA)} ${site}.` },
      { verb: 'reduce', voice: 'passive', focus: 'change', text: `${nb.def} ${M(`${pv('reduce', T, nb.plural)} in size`)} to make room for ${adds}.` },
    ];
  },

  relocated(ctx, c, T) {
    const b = c.before[0];
    const a = c.after[0];
    const nb = nounOf(b);
    const pl = nb.plural;
    const from = located(ctx, b, 'before', c.ids);
    const to = located(ctx, a, 'after', c.ids);
    const direct = /^(to|in) the /.test(to.prep) || /^on the outskirts/.test(to.prep);
    const toPrep = direct ? to.prep.replace(/^(in|on) /, 'to ') : to.prep;
    const toText = direct ? `${toPrep} ${to.obj}` : `to a new site ${to.text}`;
    const toMarked = direct ? `${M(toPrep)} ${to.obj}` : `to a new site ${M(to.prep)} ${to.obj}`;
    const out = [
      { verb: 'relocate', voice: 'passive', focus: 'change', text: `${nb.def} ${M(pv('relocate', T, pl))} ${toText}.` },
      { verb: 'relocate', voice: 'passive', focus: 'location', text: `${nb.def} ${pv('relocate', T, pl)} ${toMarked}.` },
    ];
    const g1 = regionOf(ctx, b).word;
    const g2 = regionOf(ctx, a).word;
    if (g1 !== g2) out.push({ verb: 'move', voice: 'passive', focus: 'change', text: `${nb.def} ${M(pv('move', T, pl))} from the ${g1} to the ${g2} of ${ctx.area}.` });
    if (ctx.frame === 'present') out.push({ verb: 'locate', voice: 'active', focus: 'change', text: `${nb.def}, ${M('previously located')} ${from.text}, ${pl ? 'are' : 'is'} now situated ${to.text}.` });
    if (ctx.frame === 'past') out.push({ verb: 'move', voice: 'passive', focus: 'change', text: `${M('originally located')} ${from.text}, ${nb.def} ${pv('move', T, pl)} ${toText}.` });
    if (ctx.frame === 'future') out.push({ verb: 'locate', voice: 'passive', focus: 'change', text: `${nb.def}, ${M('currently located')} ${from.text}, ${pv('relocate', T, pl)} ${toText}.` });
    const op = opener(ctx);
    out.push({ verb: 'relocate', voice: 'active', focus: 'change', nominal: true, notFirst: true, opener: op, text: `${op} ${M('the relocation of')} ${nb.def} ${toText}.` });
    return out;
  },
};

function grew(b, a, dir) {
  if (dir === 'north') return a.y < b.y;
  if (dir === 'south') return a.y + a.h > b.y + b.h;
  if (dir === 'west') return a.x < b.x;
  return a.x + a.w > b.x + b.w;
}

// A landmark that an extended feature now reaches, and did not touch before.
function reach(ctx, b, a, dirs) {
  const hit = ctx.stable.find((g) => g.id !== b.id && touching(g, a) && !touching(g, b) && dirs.some((d) => compassFrom(g, a) === d));
  return hit ? nounOf(hit).def : null;
}

/* ---------- English: what stayed the same ---------- */

// Landmarks first: buildings, then water, green spaces, roads.
function notability(f) {
  if (f.type === 'building') return 5;
  if (f.type === 'lake' || f.type === 'river' || f.type === 'beach') return 4;
  if (['park', 'woodland', 'sports', 'pool'].includes(f.type)) return 3;
  if (f.type === 'road' || f.type === 'railway') return 2;
  return 1;
}

function unchangedLines(ctx, kept) {
  const out = [];
  const T = ctx.frame === 'past' ? 'past' : ctx.frame === 'present' ? 'presentPerfect' : 'future';
  const all = kept.slice().sort((x, y) => notability(y) - notability(x));
  const named = (f) => (ctx.mentioned?.has(f.id) ? 1 : 0);
  const areas = all.filter((f) => !isLinear(f)).sort((x, y) => named(x) - named(y));
  const strip = all.find((f) => isLinear(f) && f.type !== 'path');
  const pick = (cands, ids) => out.push({ text: cap(choose(ctx, cands).text), focus: 'unchanged', featureIds: ids, para: 1 });
  // A landmark building, placed on the map.
  const landmark = areas.length > 1 || !strip ? areas.find((f) => f.type === 'building') : null;
  if (landmark) {
    const n = nounOf(landmark);
    const where = `${n.def} ${whereIs(ctx, landmark, 'after', [landmark.id]).text}`;
    const cands = {
      past: [
        ...(ctx.ay ? [{ verb: 'stand', voice: 'active', text: `${where} ${M(`${n.plural ? 'were' : 'was'} still standing`)} in ${ctx.ay}.` }] : []),
        { verb: 'affect', voice: 'passive', text: `${where} ${M(`${n.plural ? 'were' : 'was'} unaffected by`)} these developments.` },
      ],
      present: [
        { verb: 'stand', voice: 'active', text: `${where} ${M(`still ${av('stand', 'present', n.plural)}`)}.` },
        { verb: 'affect', voice: 'passive', text: `${where} ${M(`${n.plural ? 'have' : 'has'} not been affected by`)} these developments.` },
      ],
      future: [
        { verb: 'retain', voice: 'passive', text: `${where} ${M(pv('retain', T, n.plural))}.` },
        { verb: 'affect', voice: 'passive', text: `${where} ${M(`will not be affected by`)} the plans.` },
      ],
    }[ctx.frame];
    pick(cands, [landmark.id]);
  }
  // The other features that stayed the same.
  const others = areas.filter((f) => f !== landmark);
  const group = (others.some((f) => !named(f)) ? others.filter((f) => !named(f)) : others).slice(0, 3);
  if (group.length) {
    const subj = listOf(group, 'def');
    const pl = pluralOf(group);
    const cands = [
      { verb: 'remain', voice: 'active', text: `${subj} ${M(`${av('remain', T, pl)} unchanged`)}.` },
      { verb: 'leave', voice: 'passive', text: `${subj} ${M(`${pv('leave', T, pl)} untouched`)}.` },
    ];
    if (ctx.frame === 'present') cands.push({ verb: 'remain', voice: 'active', text: `${subj} ${M(`still ${av('remain', 'present', pl)}`)} the same.` });
    if (group.length === all.length) cands.push({ verb: 'remain', voice: 'active', text: `only ${subj} ${M(`${av('remain', T, pl)} the same`)}.` });
    pick(cands, group.map((f) => f.id));
  }
  if (strip) {
    const flow = strip.type === 'river' ? 'flow' : 'run';
    const where = stripPhrase(ctx, strip, 'after');
    const vp = { past: `continued to ${flow}`, present: `still ${flow}s`, future: `will continue to ${flow}` }[ctx.frame];
    pick([{ verb: 'continue', voice: 'active', text: `${nounOf(strip).def} ${M(vp)} ${where.prep} ${where.obj}.` }], [strip.id]);
  }
  return out;
}

/* ---------- English: overview, introduction, body ---------- */

const LINKERS = ['In addition,', 'Meanwhile,', 'Furthermore,', 'Elsewhere,', 'At the same time,'];

function choose(ctx, cands) {
  const nominalOk = (ctx.nominals || 0) < 2 && !ctx.lastNominal;
  let pool = cands.filter((c) => !(c.opener && ctx.openers.has(c.opener)) && !(c.byYear && ctx.byYear) && (nominalOk || !c.nominal));
  if (!pool.length) pool = cands;
  const fresh = pool.filter((c) => (ctx.verbs.get(c.verb) || 0) < 2);
  if (fresh.length) pool = fresh;
  const share = ctx.passive / Math.max(1, ctx.passive + ctx.active);
  const weights = pool.map((c) => (ctx.verbs.get(c.verb) ? 0.3 : 1) * (c.verb === ctx.lastVerb ? 0.15 : 1) * (c.voice === 'passive' && share > 0.4 ? 0.4 : 1) * (c.nominal ? 0.6 : 1) * (c.byYear ? 0.7 : 1));
  const c = pickWeighted(ctx.rng, pool, weights);
  ctx.verbs.set(c.verb, (ctx.verbs.get(c.verb) || 0) + 1);
  ctx.lastVerb = c.verb;
  ctx.lastNominal = !!c.nominal;
  if (c.nominal) ctx.nominals = (ctx.nominals || 0) + 1;
  if (c.opener) ctx.openers.add(c.opener);
  if (c.byYear) ctx.byYear = true;
  if (c.voice === 'passive') ctx.passive++;
  else ctx.active++;
  return c;
}

// The changes as described: a reduced feature and what was built on its land become one.
function describedChanges(ctx) {
  const items = [];
  const used = new Set();
  for (const c of ctx.changes.filter((x) => x.kind === 'reduced')) {
    const lost = c.before[0];
    const adds = ctx.changes.filter((x) => x.kind === 'added' && !used.has(x) && x.after.every((f) => !isLinear(f) && overlapArea(f, lost) * 2 >= areaOf(f)));
    if (!adds.length) continue;
    adds.forEach((x) => used.add(x));
    used.add(c);
    items.push({ ...c, kind: 'reducedFor', ids: [...c.ids, ...adds.flatMap((x) => x.ids)], adds: adds.flatMap((x) => x.after) });
  }
  for (const c of ctx.changes) if (!used.has(c) && c.kind !== 'unchanged') items.push(c);
  return items.sort((x, y) => weight(y) - weight(x));
}

// "the construction of" + "a new school": the head is the part to drill.
function nominalOf(c) {
  const b = c.before[0];
  const a = c.after[0];
  if (c.kind === 'added') return [`the ${addNoun(a)} of`, listOf(c.after, 'fresh'), ROOT[addNoun(a)]];
  if (c.kind === 'removed') return [`the ${removeNoun(b)} of`, listOf(c.before, 'def'), ROOT[removeNoun(b)]];
  if (c.kind === 'replaced') {
    if (c.before.every((f) => NATURAL.has(f.type)) && !c.after.every((f) => NATURAL.has(f.type))) return ['the development of', `${listOf(c.before, 'def')} into ${listOf(c.after, 'indef')}`, 'develop'];
    return ['the replacement of', `${listOf(c.before, 'def')} with ${listOf(c.after, 'indef')}`, 'replace'];
  }
  if (c.kind === 'converted') {
    if (b.type === 'road' && (a.type === 'square' || a.type === 'path')) return ['the pedestrianisation of', nounOf(b).def, 'pedestrianise'];
    return ['the conversion of', `${nounOf(b).def} into ${sameText(a.label, b.label) ? nounOf({ ...a, label: DEFAULT_LABEL[a.type] }).indef : nounOf(a).indef}`, 'convert'];
  }
  if (c.kind === 'extended') return TYPE_GROUP[b.type] !== 'open' && TYPE_GROUP[b.type] !== 'water' ? ['the extension of', nounOf(b).def, 'extend'] : ['the expansion of', nounOf(b).def, 'expand'];
  if (c.kind === 'reduced') return ['a reduction in', `the size of ${nounOf(b).def}`, 'reduce'];
  if (c.kind === 'reducedFor') return ['the clearance of', `${partOf(b)} for ${listOf(c.adds, 'indef')}`, 'clear'];
  return ['the relocation of', nounOf(b).def, 'relocate'];
}

function tally(fs) {
  const t = { rural: 0, green: 0, built: 0, homes: 0, industry: 0, leisure: 0 };
  for (const f of fs) {
    const a = areaOf(f);
    if (f.type === 'farmland' || f.type === 'woodland') t.rural += a;
    if (['farmland', 'woodland', 'park', 'sports'].includes(f.type)) t.green += a;
    if (TYPE_GROUP[f.type] === 'built') t.built += a;
    if (f.type === 'houses') t.homes += a;
    if (f.type === 'industry') t.industry += a;
    if (['park', 'sports', 'pool', 'square'].includes(f.type) || /hotel|restaurant|café|cafe|leisure|cinema|museum|chalet|cabin|gym|sports/i.test(f.label)) t.leisure += a;
  }
  return t;
}

// The overall change in one clause (from X into Y where the land use shows it).
function characterise(ctx, T) {
  const b = tally(ctx.side('before'));
  const a = tally(ctx.side('after'));
  const d = Object.fromEntries(Object.keys(a).map((k) => [k, a[k] - b[k]]));
  const area = ctx.area;
  const transformed = M(`${pv('transform', T, false)} from`);
  if (ctx.area === 'the island' && b.built <= 3 && d.built >= 4) {
    const resort = ctx.side('after').some((f) => /hotel|chalet|cabin|reception|restaurant/i.test(f.label));
    return { verb: 'transform', text: `overall, ${area} ${transformed} an undeveloped natural area into ${resort ? 'a tourist resort' : 'a far more developed one'}.` };
  }
  const share = (t, k) => t[k] / Math.max(1, t.built);
  const pl = /grounds$/.test(area);
  if (d.industry <= -4 && d.homes >= 3 && share(b, 'industry') >= 0.4 && share(a, 'homes') >= 0.4) return { verb: 'transform', text: `overall, ${area} ${transformed} a largely industrial area into a mainly residential one.` };
  if (d.industry <= -4 && d.homes >= 3) return { verb: 'become', text: `overall, ${area} ${M(`${av('become', T, pl)} far less industrial`)}, with more of its land given over to housing.` };
  if (d.industry <= -4 && d.leisure >= 3) return { verb: 'transform', text: `overall, ${area} ${transformed} a largely industrial area into one used mainly for leisure${d.homes > 0 ? ' and housing' : ''}.` };
  if (d.rural <= -4 && d.homes >= 3 && /village/.test(area)) return { verb: 'transform', text: `overall, ${area} ${transformed} a largely rural settlement into a more built-up residential area.` };
  const lostGreen = [...new Set(ctx.changes
    .filter((c) => ['replaced', 'removed', 'reduced'].includes(c.kind))
    .flatMap((c) => c.before).filter((f) => ['farmland', 'woodland', 'park', 'sports'].includes(f.type))
    .map((f) => nounOf(f).bare))];
  const urban = /village|town|city|district/.test(area);
  if (d.green <= -4 && d.built >= 3 && lostGreen.length) {
    return { verb: 'become', text: `overall, ${area} ${M(`${av('become', T, pl)} considerably more ${urban ? 'built-up' : 'developed'}`)}, largely at the expense of ${pl ? 'their' : 'its'} ${joinList(lostGreen.slice(0, 2))}.` };
  }
  if (d.built >= 4) return { verb: 'become', text: `overall, ${area} ${M(`${av('become', T, pl)} considerably more ${urban ? 'built-up' : 'developed'}`)}.` };
  const leisureAdds = ctx.changes.filter((c) => ['added', 'replaced', 'converted'].includes(c.kind) && tally(c.after).leisure > 0).length;
  if (leisureAdds >= 2) return { verb: 'undergo', text: `overall, ${area} ${M(`${av('undergo', T, pl)} considerable development`)}, with the addition of several leisure facilities.` };
  const grows = ctx.changes.some((c) => c.kind === 'extended' || c.kind === 'added');
  if (grows && ctx.changes.some((c) => c.kind === 'converted' || c.kind === 'replaced')) {
    const lead = { past: 'generally speaking, the changes', present: 'generally speaking, the changes', future: 'generally speaking, the proposals' }[ctx.frame];
    const vp = ctx.frame === 'future' ? 'involve' : 'illustrate';
    return { verb: vp, text: `${lead} ${vp} ${M('the extension and improvement of')} the facilities ${/site|campus|island/.test(area) ? 'on' : 'in'} ${area}.` };
  }
  if (ctx.changes.filter((c) => c.kind !== 'unchanged').length >= 6) return { verb: 'undergo', text: `overall, ${area} ${M(`${av('undergo', T, pl)} considerable redevelopment`)}.` };
  const there = { past: 'there were', present: 'there have been', future: 'there will be' }[ctx.frame];
  return { verb: 'be', text: `overall, ${there} ${M('a number of notable changes')} to the buildings and amenities ${/site|campus|island/.test(area) ? 'on' : 'in'} ${area}.` };
}

function overviewLines(ctx, items, kept) {
  const T = ctx.frame === 'past' ? 'past' : ctx.frame === 'present' ? 'presentPerfect' : 'future';
  const first = characterise(ctx, T);
  ctx.verbs.set(first.verb, 1);
  const top = items.slice(0, 2);
  const [h1, r1] = nominalOf(top[0]);
  const n2 = top[1] && nominalOf(top[1]);
  const second = !n2 ? '' : n2[0] === h1 && n2[0] !== 'a reduction in' ? ` and ${n2[1]}` : ` and ${n2[0]} ${n2[1]}`;
  for (const c of top) ctx.verbs.set(nominalOf(c)[2], (ctx.verbs.get(nominalOf(c)[2]) || 0) + 1);
  const noun = /changes/.test(first.text) ? 'developments' : 'changes';
  const lead = { past: `the most noticeable ${noun} were`, present: `the most noticeable ${noun} are`, future: 'the most significant proposals are' }[ctx.frame];
  const landmarks = kept.slice().sort((x, y) => notability(y) - notability(x)).slice(0, 2);
  const remain = { past: 'remained', present: pluralOf(landmarks.length ? landmarks : kept) ? 'remain' : 'remains', future: 'will remain' }[ctx.frame];
  const still = landmarks.length ? `, while ${listOf(landmarks, 'def')} ${remain} unchanged` : '';
  if (landmarks.length) ctx.verbs.set('remain', 1);
  ctx.mentioned = new Set(landmarks.map((f) => f.id));
  return [
    { text: cap(first.text), focus: 'overview', featureIds: [] },
    {
      text: cap(`${top[1] ? lead : lead.replace(/(changes|developments|proposals) (were|are)$/, (_, n, v) => `${n.slice(0, -1)} ${v === 'were' ? 'was' : 'is'}`)} ${M(h1)} ${r1}${second}${still}.`),
      focus: 'overview',
      featureIds: [...top.flatMap((c) => c.ids), ...landmarks.map((f) => f.id)],
    },
  ];
}

function yearsWord(n) {
  const tens = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if (n <= 20) return numberWord(n);
  if (n < 100 && n % 10 === 0) return tens[n / 10];
  if (n < 100 && n % 5 === 0) return `${tens[Math.floor(n / 10)]}-five`;
  return String(n);
}

function introLines(ctx) {
  const P = ctx.map.place || 'the area';
  const { by, ay } = ctx;
  const cands = [];
  if (ctx.frame === 'past' && by && ay) {
    cands.push(`the maps ${M('illustrate how')} ${P} changed between ${by} and ${ay}.`);
    cands.push(`the two maps ${M('depict')} ${P} in ${by} and ${ay} and the developments that took place over this ${yearsWord(ay - by)}-year period.`);
    cands.push(`the maps ${M('compare')} the layout of ${P} in ${by} with its layout in ${ay}.`);
  } else if (ctx.frame === 'past') {
    cands.push(`the maps ${M('illustrate how')} ${P} changed over a period of time.`);
  } else if (ctx.frame === 'present' && by) {
    cands.push(`the maps ${M('illustrate how')} ${P} has changed since ${by}.`);
    cands.push(`the two maps ${M('depict')} ${P} in ${by} and at present, together with the developments that have taken place since then.`);
    cands.push(`the maps ${M('compare')} the layout of ${P} in ${by} with its present-day layout.`);
  } else if (ctx.frame === 'present') {
    cands.push(`the maps ${M('illustrate how')} ${P} has changed over time.`);
  } else {
    cands.push(`the maps ${M('illustrate')} the current layout of ${P} and the changes that are planned${ay ? ` for ${ay}` : ''}.`);
    cands.push(`the two maps ${M('compare')} ${P} as it is today with a proposed plan for its future development.`);
  }
  return [{ text: cap(pickOne(ctx.rng, cands)), focus: 'intro', featureIds: [] }];
}

function bodyLines(ctx, items, featured) {
  const out = [];
  const groups = [
    items.filter((c) => ['replaced', 'added', 'removed', 'reducedFor'].includes(c.kind)),
    items.filter((c) => ['converted', 'extended', 'reduced', 'relocated'].includes(c.kind)),
  ];
  const linkers = LINKERS.slice();
  const last = groups.flat().at(-1);
  groups.forEach((list, para) => list.forEach((c, i) => {
    let cands = LINES[c.kind](ctx, c, tenseFor(ctx));
    if (!out.length || i === 0) cands = cands.filter((x) => !x.notFirst);
    if (featured.has(c)) cands = cands.filter((x) => !x.nominal);
    // A "today" answer needs at least one present perfect passive ("has been built").
    if (c === last && ctx.frame === 'present' && !ctx.passive) cands = cands.filter((x) => x.voice === 'passive');
    const pick = choose(ctx, cands);
    let text = pick.text;
    const fronted = /^(by \d|part of|there |only |\[\[|the size of|another|a further|the plans|the proposals)/.test(text);
    const prevLinked = out.length && LINKERS.some((l) => out[out.length - 1].text.startsWith(l));
    if (i > 0 && !fronted && !prevLinked && linkers.length && chance(ctx.rng, 0.5)) text = `${linkers.splice(Math.floor(ctx.rng() * linkers.length), 1)[0]} ${text}`;
    out.push({ text: cap(text), focus: pick.focus, featureIds: c.ids, para });
  }));
  return out;
}

// { intro, overview, body }: Line[] = { text, focus, featureIds, para? }; every text
// has exactly one [[ ]] chunk. focus: intro | overview | change | location | unchanged.
// Body lines carry para (0: new and removed features, 1: alterations and what stayed).
export function describeMap(map) {
  const ctx = makeContext(map);
  const items = describedChanges(ctx);
  const kept = ctx.changes.filter((c) => c.kind === 'unchanged').flatMap((c) => c.after).filter((f) => f.type !== 'bridge' && f.type !== 'pier');
  if (!items.length) return { intro: introLines(ctx), overview: [], body: unchangedLines(ctx, kept) };
  const overview = overviewLines(ctx, items, kept);
  const body = [...bodyLines(ctx, items, new Set(items.slice(0, 2))), ...unchangedLines(ctx, kept)];
  return { intro: introLines(ctx), overview, body };
}

/* ---------- rubric ---------- */

const NOW_WORDS = [[/^today$/i, 'today'], [/^now$/i, 'now'], [/present|current/i, 'at present']];
const nowPhrase = (label) => (NOW_WORDS.find(([re]) => re.test(String(label).trim())) || [null, 'at present'])[1];

// One sentence in IELTS style; the app adds the standard instructions.
export function mapRubric(map) {
  const P = map.place || 'an area';
  const by = yearOf(map.before?.label);
  const ay = yearOf(map.after?.label);
  if (map.frame === 'future') {
    const now = by && !/today|now|present|current/i.test(map.before.label) ? `in ${by}` : nowPhrase(map.before?.label || '');
    return ay ? `The maps below show ${P} ${now} and the planned changes for ${ay}.` : `The maps below show ${P} ${now} and the proposed changes to it.`;
  }
  if (map.frame === 'present') return `The maps below show ${P} ${by ? `in ${by}` : 'in the past'} and ${nowPhrase(map.after?.label || '')}.`;
  if (by && ay) return `The maps below show ${P} in ${by} and ${ay}.`;
  return `The maps below show changes to ${P}.`;
}

/* ---------- validateMap: a tolerant reader for maps written by hand or by an LLM ---------- */

const TYPE_ALIASES = {
  house: 'houses', housing: 'houses', homes: 'houses', home: 'houses', flats: 'houses', flat: 'houses', apartments: 'houses', residential: 'houses', cottages: 'houses',
  shop: 'shops', store: 'shops', stores: 'shops', supermarket: 'shops', market: 'shops', mall: 'shops', 'shopping centre': 'shops', retail: 'shops',
  factory: 'industry', factories: 'industry', industrial: 'industry', warehouse: 'industry', warehouses: 'industry',
  'car park': 'carpark', parking: 'carpark', 'parking lot': 'carpark', plaza: 'square', 'pedestrian street': 'square',
  garden: 'park', gardens: 'park', playground: 'park', green: 'park', 'green space': 'park',
  field: 'farmland', fields: 'farmland', farm: 'farmland', orchard: 'farmland', agriculture: 'farmland',
  'sports field': 'sports', pitch: 'sports', 'tennis courts': 'sports', tennis: 'sports', 'playing field': 'sports', golf: 'sports',
  'swimming pool': 'pool', trees: 'woodland', tree: 'woodland', forest: 'woodland', woods: 'woodland', wood: 'woodland',
  pond: 'lake', reservoir: 'lake', water: 'lake', ocean: 'sea', bay: 'sea', sand: 'beach', land: 'island',
  street: 'road', motorway: 'road', highway: 'road', footpath: 'path', 'cycle path': 'path', walkway: 'path', track: 'path', promenade: 'path',
  rail: 'railway', 'railway line': 'railway', train: 'railway', 'train line': 'railway', stream: 'river', canal: 'river',
  jetty: 'pier', marina: 'pier', dock: 'pier', footbridge: 'bridge',
};
const SETTING_WORDS = [
  [/village/i, 'village'], [/campus|university|college/i, 'campus'], [/island/i, 'island'], [/hospital/i, 'hospital'],
  [/school/i, 'school'], [/industrial|district|factory|factories/i, 'industrial'], [/coast|seaside|harbour|harbor|beach|port|waterfront/i, 'coast'],
  [/park/i, 'park'], [/town|city|centre|center/i, 'town'],
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
// A trimmed string, cut at a word boundary when it is too long.
function text(v, max = 60) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max + 1).replace(/\s+\S*$/, '') || s.slice(0, max);
}
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function readType(raw) {
  const t = text(raw, 40).toLowerCase().replace(/[_-]+/g, ' ');
  if (TYPE_GROUP[t]) return t;
  if (TYPE_GROUP[t.replace(/\s+/g, '')]) return t.replace(/\s+/g, '');
  return TYPE_ALIASES[t] || TYPE_ALIASES[t.replace(/s$/, '')] || null;
}

function readFeature(raw, i, cols, rows, problems, where) {
  if (!isObj(raw)) {
    problems.push(`${where}: item ${i + 1} is not a feature object and was dropped.`);
    return null;
  }
  const label = text(raw.label ?? raw.name ?? raw.title, 48);
  let type = readType(raw.type ?? raw.kind ?? raw.category);
  if (!type) {
    type = readType(label) || 'building';
    if (raw.type !== undefined) problems.push(`${where}: unknown type "${text(raw.type, 20)}" read as ${type}.`);
  }
  let x = Math.round(num(raw.x));
  let y = Math.round(num(raw.y));
  let w = Math.round(num(raw.w ?? raw.width));
  let h = Math.round(num(raw.h ?? raw.height));
  const name = label || type;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    problems.push(`${where}: "${name}" has no usable position and was dropped.`);
    return null;
  }
  if (!Number.isFinite(w) || w < 1) w = 1;
  if (!Number.isFinite(h) || h < 1) h = 1;
  if (x >= cols || y >= rows || x + w <= 0 || y + h <= 0) {
    problems.push(`${where}: "${name}" lies outside the grid and was dropped.`);
    return null;
  }
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) problems.push(`${where}: "${name}" was clipped to the grid.`);
  w = Math.min(x + w, cols) - Math.max(x, 0);
  h = Math.min(y + h, rows) - Math.max(y, 0);
  x = Math.max(x, 0);
  y = Math.max(y, 0);
  return { id: text(raw.id, 40), type, label: label || DEFAULT_LABEL[type], x, y, w, h };
}

function readSide(raw, cols, rows, problems, where) {
  const side = isObj(raw) ? raw : {};
  const list = Array.isArray(raw) ? raw : Array.isArray(side.features) ? side.features : [];
  let features = list.map((f, i) => readFeature(f, i, cols, rows, problems, where)).filter(Boolean);
  if (features.length > MAX_FEATURES) {
    problems.push(`${where}: only the first ${MAX_FEATURES} features were kept.`);
    features = features.slice(0, MAX_FEATURES);
  }
  const ids = new Set();
  for (const f of features) {
    let id = slug(f.id) || slug(f.label) || f.type;
    if (ids.has(id)) for (let n = 2; ids.has(`${id}-${n}`) || ids.has(id); n++) if (!ids.has(`${id}-${n}`)) id = `${id}-${n}`;
    ids.add(id);
    f.id = id;
  }
  for (const [a, b] of overlapProblems(features)) problems.push(`${where}: "${a}" and "${b}" overlap.`);
  return { label: text(side.label ?? side.title ?? side.year, 30), features };
}

function inferFrame(after) {
  if (/plan|propos|future|will/i.test(after)) return 'future';
  if (/today|now|present|current/i.test(after)) return 'present';
  return 'past';
}

// The format above, as rules and a worked example for the "Task from Claude"
// prompt, so Claude writes maps this module can read.
export const MAP_PROMPT_RULES = `- Two maps of the same place on a 12 × 8 grid, "before" and "after". North is at the top: x counts columns from the west edge (0–11), y counts rows from the north edge (0–7).
- Each feature is {"id","type","label","x","y","w","h"} in whole grid cells: (x, y) is its north-west cell and w × h its size. At most 25 features per map.
- The same id in both maps is the same feature: change its type or label to show a conversion, its size to show an extension or reduction, its position to show a relocation. A feature only in "after" was added; one only in "before" was removed; an added feature on the site of a removed one replaced it.
- Make 4–7 changes, and keep at least 2 features exactly the same in both maps.
- Types: building, houses, shops, industry, carpark, square, park, sports, pool, woodland, farmland, lake, beach, sea, island, road, path, railway, river, bridge, pier.
- Roads, paths, railways and rivers are strips one cell wide (h = 1 runs west–east, w = 1 runs north–south); for a bend, use two features with the same label. A bridge goes where a road or path crosses a river or railway. A pier stands on sea, lake, beach or river. Sea and island lie beneath everything: for an island, put a full-grid sea under it and leave a one-cell ring of sea around it.
- Features must not overlap, except strips crossing each other, bridges on strips, piers on water or beach, and anything on sea or island.
- Labels: at most about 25 characters, sentence case ("Car park"), Title Case for names ("Main Road"). A feature w cells wide holds words of up to about 3 × w letters: 2 × 2 holds "Car park"; "Shopping centre" needs 3 × 2.
- "frame": "past" (both maps dated in the past, such as "1965" and "1995"), "present" (the second map is "Today"), or "future" (the second map is a plan, such as "2035 (planned)").
- "place" is a noun phrase such as "the village of Ashford"; "setting" is one of: ${MAP_SETTINGS.map((s) => s.id).join(', ')}.
- British spelling.`;

export const MAP_FORMAT_EXAMPLE = JSON.stringify({
  kind: 'map', place: 'the village of Ashford', setting: 'village', frame: 'present',
  before: { label: '1995', features: [
    { id: 'main-road', type: 'road', label: 'Main Road', x: 0, y: 4, w: 12, h: 1 },
    { id: 'church', type: 'building', label: 'Church', x: 1, y: 1, w: 2, h: 2 },
    { id: 'shop', type: 'shops', label: 'Shop', x: 4, y: 1, w: 2, h: 2 },
    { id: 'farmland', type: 'farmland', label: 'Farmland', x: 7, y: 0, w: 5, h: 3 },
    { id: 'woods', type: 'woodland', label: 'Woods', x: 0, y: 6, w: 4, h: 2 },
    { id: 'cottages', type: 'houses', label: 'Cottages', x: 5, y: 6, w: 3, h: 2 },
    { id: 'school', type: 'building', label: 'School', x: 9, y: 5, w: 2, h: 2 },
  ] },
  after: { label: 'Today', features: [
    { id: 'main-road', type: 'road', label: 'Main Road', x: 0, y: 4, w: 12, h: 1 },
    { id: 'church', type: 'building', label: 'Church', x: 1, y: 1, w: 2, h: 2 },
    { id: 'shop', type: 'shops', label: 'Shop', x: 4, y: 1, w: 2, h: 2 },
    { id: 'estate', type: 'houses', label: 'Housing estate', x: 7, y: 0, w: 5, h: 3 },
    { id: 'woods', type: 'woodland', label: 'Woods', x: 0, y: 6, w: 2, h: 2 },
    { id: 'car-park', type: 'carpark', label: 'Car park', x: 2, y: 6, w: 2, h: 2 },
    { id: 'cottages', type: 'houses', label: 'Cottages', x: 5, y: 6, w: 3, h: 2 },
    { id: 'school', type: 'building', label: 'School', x: 8, y: 5, w: 3, h: 2 },
  ] },
});

// { map, problems }: map is null when nothing usable is left or it shows fewer than three changes.
export function validateMap(input) {
  const problems = [];
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { map: null, problems: ['The map is not valid JSON.'] };
    }
  }
  if (isObj(raw) && !raw.before && isObj(raw.map)) raw = raw.map;
  if (!isObj(raw)) return { map: null, problems: ['No map object was found.'] };
  const size = (v, lo, hi, d) => (Number.isFinite(num(v)) ? Math.min(hi, Math.max(lo, Math.round(num(v)))) : d);
  const cols = size(raw.cols ?? raw.width, 6, 24, MAP_COLS);
  const rows = size(raw.rows ?? raw.height, 4, 16, MAP_ROWS);
  const before = readSide(raw.before, cols, rows, problems, 'First map');
  const after = readSide(raw.after, cols, rows, problems, 'Second map');
  const place = text(raw.place, 80).replace(/[.]+$/, '') || 'the area';
  const frame = FRAMES.includes(raw.frame) ? raw.frame : inferFrame(after.label);
  const defaults = { past: ['Before', 'After'], present: ['Before', 'Today'], future: ['Today', 'Proposed'] }[frame];
  before.label ||= defaults[0];
  after.label ||= defaults[1];
  const setting = SETTINGS[raw.setting] ? raw.setting : (SETTING_WORDS.find(([re]) => re.test(place)) || [null, 'town'])[1];
  if (!before.features.length && !after.features.length) return { map: null, problems: [...problems, 'Neither map has any usable features.'] };
  const map = { kind: 'map', place, setting, frame, cols, rows, before, after };
  const changed = mapChanges(map).filter((c) => c.kind !== 'unchanged').length;
  if (changed < 3) return { map: null, problems: [...problems, `The maps show only ${changed} change${changed === 1 ? '' : 's'}; at least 3 are needed.`] };
  return { map, problems };
}
