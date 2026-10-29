// Generated charts: a topic, a time frame and a shape for every series,
// turned into a visual that the renderer, the editor and the language engine
// all read. Pure: rng and now are injected.
//
// Visual (line | bar | table): {
//   kind, topicId, title, measure, measureAlt, per, perAlt, groupNoun, countable,
//   unit: { kind: 'number' | 'percent' | 'currency', label?, symbol?, decimals },
//   x: { kind: 'year' | 'hour' | 'month' | 'category', values: string[], projectedFrom: index | null, noun? },
//   series: [{ name, values: number[] }],
//   axis: { max, step },
//   frame: 'past' | 'mixed' | 'future' | 'typical' | 'dated' | 'undated',
//   year?: number,                     // 'dated' snapshots
// }
// Visual (pie): { kind: 'pie', topicId, title, measure, measureAlt, whole, place,
//   unit: { kind: 'percent', decimals: 0 }, pies: [{ label, slices: [{ name, value }] }], frame, year? }
import { TOPICS, topicById } from './topics.js';
import { between, chance, int, pickOne, pickWeighted, sample } from './rng.js';
import { joinList, numberWord } from './english.js';
import { clamp } from './util.js';

export const CHART_KINDS = ['line', 'bar', 'table', 'pie'];
const FORMS = { time: ['line', 'bar', 'table'], parts: ['pie', 'table'], groups: ['bar', 'table'] };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];

// Typical shapes for the topics that follow the clock or the calendar.
const PROFILES = {
  winter: [0.42, 0.3, 0.36, 0.78, 0.7, 0.68, 0.98, 0.86, 0.5],
  summer: [0.3, 0.22, 0.27, 0.52, 0.66, 0.8, 0.72, 0.58, 0.36],
  Mumbai: [0, 0, 0, 0.01, 0.03, 0.9, 1, 0.7, 0.55, 0.12, 0.03, 0],
  Lisbon: [0.2, 0.18, 0.12, 0.1, 0.06, 0.02, 0.01, 0.01, 0.05, 0.16, 0.24, 0.22],
  Singapore: [0.44, 0.22, 0.32, 0.29, 0.31, 0.3, 0.29, 0.3, 0.27, 0.29, 0.48, 0.5],
};
const WORKFORCE = { India: [43, 25, 32], Brazil: [9, 20, 71], Japan: [3, 24, 73], Nigeria: [35, 12, 53], Germany: [1, 27, 72] };
const WATER = { Africa: [84, 5, 11], Europe: [33, 45, 22], 'North America': [41, 46, 13] };

export const nowYear = (now) => new Date(now).getUTCFullYear();

/* ---------- numbers ---------- */

export function decimalsFor(topic) {
  if (topic.unit?.decimals !== undefined) return topic.unit.decimals;
  if (topic.decimals !== undefined) return topic.decimals;
  return topic.range && topic.range[1] <= 12 ? 1 : 0;
}

function roundStep(topic) {
  if (topic.round) return topic.round;
  const d = decimalsFor(topic);
  if (d) return 10 ** -d;
  const hi = topic.range[1];
  if (hi <= 300) return 1;
  if (hi <= 3000) return 5;
  if (hi <= 30000) return 50;
  return 1000;
}

const roundTo = (v, step) => Math.round(Math.round(v / step) * step * 1e6) / 1e6;

// A clean axis: 4–6 ticks of 1, 2, 2.5 or 5 × 10^k, reaching past `top`.
export function niceAxis(top, { percent = false } = {}) {
  if (percent && top > 75) return { max: 100, step: 20 };
  const target = Math.max(top, 1e-9) * 1.06;
  for (const exp of [-2, -1, 0, 1, 2, 3, 4, 5, 6]) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * 10 ** exp;
      const ticks = Math.ceil(target / step);
      if (ticks >= 3 && ticks <= 6) return { max: roundTo(ticks * step, step), step };
    }
  }
  return { max: target, step: target / 4 };
}

/* ---------- curves (0..1) ---------- */

const STYLES = ['linear', 'linear', 'early', 'late', 'peak', 'trough', 'wobble'];

function curve(rng, n, from, to, style) {
  const k = int(rng, 1, Math.max(1, n - 2));
  const top = Math.max(from, to) + between(rng, 0.14, 0.3);
  const bottom = Math.min(from, to) - between(rng, 0.14, 0.3);
  const amp = between(rng, 0.05, 0.1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let v;
    if (style === 'early') v = from + (to - from) * Math.sqrt(t);
    else if (style === 'late') v = from + (to - from) * t * t;
    else if (style === 'peak') v = i <= k ? from + (top - from) * (i / k) : top + (to - top) * ((i - k) / (n - 1 - k));
    else if (style === 'trough') v = i <= k ? from + (bottom - from) * (i / k) : bottom + (to - bottom) * ((i - k) / (n - 1 - k));
    else if (style === 'wobble') v = from + (to - from) * t + (i % 2 ? amp : -amp) * (i > 0 && i < n - 1 ? 1 : 0);
    else v = from + (to - from) * t;
    const noise = i === 0 || i === n - 1 ? 0 : between(rng, -0.025, 0.025);
    out.push(clamp(v + noise, 0.03, 0.97));
  }
  return out;
}

// Start and end levels (0..1) for every series, chosen so the chart tells one
// clear story: a crossover, a gap that widens or narrows, parallel trends, or
// opposite movements. trend 'up': every series rises (life expectancy,
// internet use…), still with a crossover or a narrowing gap where possible.
function storyLevels(rng, count, trend = '') {
  if (trend === 'up') {
    const pairs = pickOne(rng, [
      [[0.1, 0.86], [0.32, 0.62]],
      [[0.5, 0.92], [0.08, 0.76]],
      [[0.45, 0.88], [0.1, 0.5]],
      [[0.22, 0.92], [0.16, 0.42]],
    ]);
    const out = (chance(rng, 0.5) ? pairs : pairs.slice().reverse()).slice(0, count);
    while (out.length < count) {
      const a = between(rng, 0.05, 0.55);
      out.push([a, clamp(a + between(rng, 0.15, 0.45), 0.2, 0.95)]);
    }
    return out.map(([a, b]) => [clamp(a + between(rng, -0.04, 0.04), 0.04, 0.9), clamp(b + between(rng, -0.04, 0.04), 0.1, 0.96)]);
  }
  if (count === 1) {
    if (chance(rng, 0.6)) {
      const a = between(rng, 0.12, 0.45);
      return [[a, clamp(a + between(rng, 0.25, 0.5), 0.4, 0.95)]];
    }
    const a = between(rng, 0.55, 0.88);
    return [[a, clamp(a - between(rng, 0.2, 0.45), 0.08, 0.6)]];
  }
  const story = pickOne(rng, ['cross', 'cross', 'parallel', 'diverge', 'converge', 'opposite']);
  const levels = {
    cross: [[0.2, 0.85], [0.7, 0.35]],
    parallel: chance(rng, 0.6) ? [[0.5, 0.88], [0.12, 0.42]] : [[0.88, 0.55], [0.45, 0.15]],
    diverge: [[0.42, 0.9], [0.36, 0.18]],
    converge: [[0.85, 0.55], [0.15, 0.48]],
    opposite: [[0.3, 0.8], [0.62, 0.2]],
  }[story].map(([a, b]) => [clamp(a + between(rng, -0.05, 0.05), 0.05, 0.95), clamp(b + between(rng, -0.05, 0.05), 0.05, 0.95)]);
  if (chance(rng, 0.5)) levels.reverse();
  while (levels.length < count) {
    const a = between(rng, 0.1, 0.8);
    levels.push([a, clamp(a + between(rng, -0.25, 0.25), 0.06, 0.94)]);
  }
  return levels;
}

/* ---------- axes ---------- */

const YEAR_STEPS = { long: [[10, 6], [10, 7]], short: [[1, 6], [1, 7], [2, 6]], normal: [[5, 5], [5, 6], [5, 7], [2, 6], [10, 5]] };
// Projections only make sense well ahead of today: 5- or 10-year steps.
const PROJECTED_STEPS = [[5, 6], [5, 7], [10, 5], [10, 6]];

function yearAxis(rng, frame, style, now, maxPoints = 9) {
  const year = nowYear(now);
  const [step, count] = pickOne(rng, frame === 'past' ? YEAR_STEPS[style] || YEAR_STEPS.normal : PROJECTED_STEPS);
  const n = Math.min(count, maxPoints);
  let first;
  let projectedFrom = null;
  if (frame === 'future') {
    first = Math.ceil((year + 1) / step) * step;
    projectedFrom = 0;
  } else if (frame === 'mixed') {
    const projected = int(rng, 1, 2);
    const lastActual = Math.floor((year - 1) / step) * step;
    first = lastActual - step * (n - projected - 1);
    projectedFrom = n - projected;
  } else {
    const last = Math.floor((year - 1) / step) * step - (step === 1 ? int(rng, 0, 2) : 0);
    first = last - step * (n - 1);
  }
  return { kind: 'year', values: Array.from({ length: n }, (_, i) => String(first + i * step)), projectedFrom };
}

/* ---------- builders ---------- */

// Everything the language engine needs travels with the visual, so charts
// imported from Claude (no topic) are described the same way.
function baseFields(topic, kind) {
  return {
    kind,
    topicId: topic.id,
    title: topic.title,
    measure: topic.measure,
    measureAlt: topic.measureAlt,
    per: topic.per || 'in',
    perAlt: topic.perAlt || topic.per || 'in',
    groupNoun: topic.groupNoun,
    groupShort: topic.groupShort || topic.groupNoun,
    listNames: topic.listNames !== false,
    subject: topic.short ? { short: topic.short, plural: !!topic.plural, per: topic.subjectPer || topic.per || 'in', prefix: topic.groupPrefix || '' } : null,
    prose: topic.prose || {},
    countable: !!topic.countable,
  };
}

function unitOf(topic) {
  return { kind: 'number', ...(topic.unit || { kind: 'percent' }), decimals: decimalsFor(topic) };
}

function timeVisual(rng, topic, kind, frame, now) {
  const step = roundStep(topic);
  const [lo, hi] = topic.range;
  let x;
  let names;
  let norm;
  if (topic.axis === 'hours' || topic.axis === 'months') {
    x = { kind: topic.axis === 'hours' ? 'hour' : 'month', values: topic.axis === 'hours' ? HOURS.slice() : MONTHS.slice(), projectedFrom: null };
    names = topic.groups.slice();
    norm = names.map((name) => PROFILES[name].map((v) => clamp(v + between(rng, -0.04, 0.04), 0, 1)));
    frame = 'typical';
  } else {
    const count = kind === 'line' ? pickWeighted(rng, [1, 2, 3, 4], [1, 4, 4, 2]) : kind === 'bar' ? int(rng, 2, 3) : int(rng, 3, 5);
    x = yearAxis(rng, frame, topic.years, now, kind === 'bar' ? 5 : kind === 'table' ? 6 : 9);
    names = topic.allGroups ? topic.groups.slice() : sample(rng, topic.groups, Math.min(count, topic.groups.length));
    const styles = topic.trend === 'up' ? ['linear', 'early', 'late', 'linear'] : STYLES;
    norm = storyLevels(rng, names.length, topic.trend).map(([a, b]) => curve(rng, x.values.length, a, b, pickOne(rng, styles)));
  }
  const series = names.map((name, i) => ({ name, values: norm[i].map((v) => roundTo(lo + v * (hi - lo), step)) }));
  const top = Math.max(...series.flatMap((s) => s.values));
  return {
    ...baseFields(topic, kind),
    unit: unitOf(topic),
    x,
    series,
    axis: niceAxis(top, { percent: topic.unit?.kind === 'percent' }),
    frame,
  };
}

// Integer percentages that sum to 100, at least 2 each, no ties.
export function splitHundred(weights) {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (w / total) * 100);
  const out = raw.map((r) => Math.max(2, Math.floor(r)));
  let rest = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; rest !== 0 && j < order.length * 4; j++) {
    const i = order[j % order.length][1];
    if (rest > 0) {
      out[i]++;
      rest--;
    } else if (out[i] > 2) {
      out[i]--;
      rest++;
    }
  }
  // Break ties: move one point between a tied part and another part, never
  // creating a new tie or a part under 2.
  for (let pass = 0; pass < 60; pass++) {
    const dup = out.findIndex((v, i) => out.indexOf(v) !== i);
    if (dup < 0) break;
    const up = !out.includes(out[dup] + 1);
    const target = out[dup] + (up ? 1 : -1);
    const others = out.map((_, k) => k).filter((k) => k !== dup).sort((a, b) => out[b] - out[a]);
    const k = others.find((j) => {
      const next = out[j] + (up ? -1 : 1);
      return next >= 2 && next !== target && !out.some((v, m) => m !== j && m !== dup && v === next);
    });
    if (k === undefined) break;
    out[dup] = target;
    out[k] += up ? -1 : 1;
  }
  return out;
}

// Typical shares for the topic, varied enough that every task differs.
function partWeights(rng, topic) {
  return topic.groups.map((_, i) => (topic.base?.[i] ?? 15) * between(rng, 0.65, 1.45));
}

function shiftShares(rng, values) {
  const w = values.map((v) => v);
  const up = sample(rng, w.map((_, i) => i), Math.min(2, w.length));
  w[up[0]] *= between(rng, 1.4, 2.2);
  if (up[1] !== undefined) w[up[1]] *= between(rng, 0.45, 0.75);
  return splitHundred(w.map((v) => v * between(rng, 0.9, 1.1)));
}

function pieVisual(rng, topic, now) {
  const year = nowYear(now);
  const n = topic.groups.length;
  let pies;
  let frame;
  let yearOut;
  if (topic.pieLabels) {
    pies = topic.pieLabels.map((label) => ({
      label,
      slices: topic.groups.map((name, i) => ({ name, value: 0, w: (WATER[label]?.[i] ?? 30) * between(rng, 0.85, 1.15) })),
    }));
    pies.forEach((p) => splitHundred(p.slices.map((s) => s.w)).forEach((v, i) => (p.slices[i] = { name: p.slices[i].name, value: v })));
    frame = 'dated';
    yearOut = year - int(rng, 2, 6);
  } else {
    const first = splitHundred(partWeights(rng, topic));
    const two = !topic.undated && chance(rng, 0.65);
    if (two) {
      const gap = pickOne(rng, [10, 15, 20, 25, 30]);
      const last = year - int(rng, 1, 5);
      const second = shiftShares(rng, first);
      pies = [{ label: String(last - gap), slices: topic.groups.map((name, i) => ({ name, value: first[i] })) }, { label: String(last), slices: topic.groups.map((name, i) => ({ name, value: second[i] })) }];
      frame = 'past';
    } else {
      yearOut = topic.undated ? undefined : year - int(rng, 1, 6);
      pies = [{ label: yearOut ? String(yearOut) : '', slices: topic.groups.map((name, i) => ({ name, value: first[i] })) }];
      frame = topic.undated ? 'undated' : 'dated';
    }
  }
  return {
    kind: 'pie',
    topicId: topic.id,
    title: topic.title,
    measure: topic.measure,
    measureAlt: topic.measureAlt,
    whole: topic.whole,
    place: topic.place || '',
    prose: topic.prose || {},
    unit: { kind: 'percent', decimals: 0 },
    pies,
    frame,
    ...(yearOut ? { year: yearOut } : {}),
  };
}

// Percentages of a whole shown as a table: one row per part, one column per
// year (or per region).
function partsTable(rng, topic, now) {
  let columns;
  let labels;
  if (topic.pieLabels) {
    labels = topic.pieLabels.slice();
    columns = labels.map((label) => splitHundred(topic.groups.map((_, i) => (WATER[label]?.[i] ?? 30) * between(rng, 0.85, 1.15))));
  } else {
    const n = int(rng, 2, 3);
    const gap = pickOne(rng, [5, 10]);
    const last = nowYear(now) - int(rng, 1, 4);
    labels = Array.from({ length: n }, (_, i) => String(last - gap * (n - 1 - i)));
    columns = [splitHundred(partWeights(rng, topic))];
    while (columns.length < n) columns.push(shiftShares(rng, columns[columns.length - 1]));
  }
  return {
    ...baseFields({ ...topic, per: 'on', groupNoun: 'categories' }, 'table'),
    unit: { kind: 'percent', decimals: 0 },
    x: { kind: topic.pieLabels ? 'category' : 'year', values: labels, projectedFrom: null, noun: topic.pieLabels ? 'regions' : undefined },
    series: topic.groups.map((name, i) => ({ name, values: columns.map((col) => col[i]) })),
    axis: { max: 100, step: 20 },
    frame: topic.pieLabels ? 'dated' : 'past',
    ...(topic.pieLabels ? { year: nowYear(now) - int(rng, 2, 5) } : {}),
    partsOf: topic.whole,
    place: topic.place || '',
  };
}

function groupsVisual(rng, topic, kind, now) {
  const step = roundStep(topic);
  const [lo, hi] = topic.range;
  const cats = topic.categories.slice();
  const names = topic.groups.slice();
  let rows;
  if (topic.id === 'workforce') {
    rows = names.map((_, j) => cats.map((c) => WORKFORCE[c][j]));
    const fixed = cats.map((c, i) => splitHundred(rows.map((r) => r[i] * between(rng, 0.88, 1.12))));
    rows = names.map((_, j) => fixed.map((col) => col[j]));
  } else if (topic.sumsTo100) {
    const cols = cats.map(() => splitHundred(names.map((_, j) => (j === names.length - 1 ? between(rng, 0.15, 0.6) : between(rng, 0.6, 1.6)))));
    const worst = int(rng, 0, cats.length - 1);
    cols[worst] = splitHundred([0.35, 0.9, 1.4].slice(0, names.length));
    rows = names.map((_, j) => cols.map((col) => col[j]));
  } else {
    const pattern = pickOne(rng, ['rise', 'fall', 'hump', 'mixed']);
    const n = cats.length;
    const base = cats.map((_, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      if (pattern === 'rise') return 0.2 + 0.6 * t;
      if (pattern === 'fall') return 0.8 - 0.6 * t;
      if (pattern === 'hump') return 0.3 + 0.55 * Math.sin(Math.PI * t);
      return between(rng, 0.2, 0.85);
    });
    const crossAt = int(rng, 1, Math.max(1, n - 2));
    rows = names.map((_, j) =>
      base.map((b, i) => {
        let v = b;
        if (topic.seriesAreYears) v = j === 0 ? b * (i === crossAt ? between(rng, 1.1, 1.3) : between(rng, 0.55, 0.85)) : b;
        else if (j > 0) v = b + (i < crossAt ? -1 : 1) * between(rng, 0.06, 0.16) * (j % 2 ? 1 : -1);
        return roundTo(lo + clamp(v + between(rng, -0.03, 0.03), 0.02, 0.98) * (hi - lo), step);
      }),
    );
  }
  const series = names.map((name, j) => ({ name, values: rows[j] }));
  const year = nowYear(now) - int(rng, 1, 4);
  const top = Math.max(...series.flatMap((s) => s.values));
  return {
    ...baseFields(topic, kind),
    unit: unitOf(topic),
    x: { kind: 'category', values: cats, projectedFrom: null, noun: topic.categoryNoun },
    series,
    axis: niceAxis(top, { percent: topic.unit?.kind === 'percent' }),
    frame: topic.seriesAreYears ? 'past' : topic.undated ? 'undated' : 'dated',
    ...(topic.seriesAreYears || topic.undated ? {} : { year }),
    seriesAreYears: !!topic.seriesAreYears,
  };
}

/* ---------- entry points ---------- */

export function topicsFor(kind) {
  return TOPICS.filter((t) => FORMS[t.shape].includes(kind));
}

// One chart visual. kind: 'line' | 'bar' | 'table' | 'pie'.
export function generateChart(rng, { kind = 'line', now, topicId = null, frame = null } = {}) {
  const pool = topicsFor(kind);
  const topic = (topicId && topicById(topicId)) || pickOne(rng, pool);
  if (topic.shape === 'parts') return kind === 'table' ? partsTable(rng, topic, now) : pieVisual(rng, topic, now);
  if (topic.shape === 'groups') return groupsVisual(rng, topic, kind === 'line' ? 'bar' : kind, now);
  const f = topic.years === 'short' ? 'past' : frame || pickWeighted(rng, ['past', 'mixed', 'future'], [7, 2.2, 0.8]);
  return timeVisual(rng, topic, kind, f, now);
}

/* ---------- task wording ---------- */

const CHART_NOUN = { line: 'graph', bar: 'bar chart', table: 'table', pie: 'pie chart' };

export function groupsText(v, { alt = false } = {}) {
  const names = v.series.map((s) => s.name);
  const per = alt ? v.perAlt : v.per;
  if (v.listNames !== false && names.length <= 3) return `${per} ${joinList(names)}`;
  return `${per} ${numberWord(names.length)} ${v.groupNoun}`;
}

export function periodText(v) {
  const xs = v.x?.values || [];
  if (v.kind === 'pie') {
    const labels = v.pies.map((p) => p.label).filter(Boolean);
    if (v.pies.length > 1 && labels.every((l) => /^\d{4}$/.test(l))) return `in ${joinList(labels)}`;
    return v.year ? `in ${v.year}` : '';
  }
  if (v.x.kind === 'year') {
    if (v.kind === 'table' && xs.length <= 3) return `in ${joinList(xs)}`;
    const first = xs[0];
    const last = xs[xs.length - 1];
    if (v.frame === 'future') return `as projected for the period from ${first} to ${last}`;
    if (v.frame === 'mixed' && v.x.projectedFrom !== null) return `between ${first} and ${xs[v.x.projectedFrom - 1]}, with projections to ${last}`;
    return `between ${first} and ${last}`;
  }
  if (v.seriesAreYears) return `in ${joinList(v.series.map((s) => s.name))}`;
  return v.year ? `in ${v.year}` : '';
}

// The rubric's first sentence for one chart (the "below shows" part).
export function chartSubject(v) {
  if (v.kind === 'pie') {
    const place = v.place ? ` ${v.place}` : '';
    const labels = v.pies.map((p) => p.label);
    const regions = v.pies.length > 1 && !labels.every((l) => /^\d{4}$/.test(l)) ? ` in ${joinList(labels)}` : '';
    return [v.measure + place + regions, periodText(v)].filter(Boolean).join(' ');
  }
  if (v.partsOf) {
    const where = v.x.kind === 'category' ? `in ${joinList(v.x.values)} in ${v.year}` : periodText(v);
    return [v.measure, v.place, where].filter(Boolean).join(' ');
  }
  if (v.x.kind === 'category') return [v.measure, periodText(v)].filter(Boolean).join(' ');
  return [v.measure, groupsText(v), periodText(v)].filter(Boolean).join(' ');
}

export function chartNoun(v) {
  if (v.kind === 'pie' && v.pies.length > 1) return 'pie charts';
  return CHART_NOUN[v.kind];
}

export function chartRubric(v) {
  const noun = chartNoun(v);
  const verb = noun.endsWith('s') ? 'show' : 'shows';
  return `The ${noun} below ${verb} ${chartSubject(v)}.`;
}
