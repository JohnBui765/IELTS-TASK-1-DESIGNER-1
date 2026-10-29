// The language engine for charts: correct, data-specific sentences for the
// introduction, overview and body, each with ONE key chunk marked [[ ]] for
// drills. Tense follows the chart's time frame (CLAUDE-task1.md, types 3–5):
// past → past simple; a typical day or an undated survey → present simple;
// projections → future forms; "By 2040" → future perfect, "By 2020" → past
// perfect. Sentences stand alone (no pronouns), so each one works as a drill.
import { makeRng, pickOne } from './rng.js';
import { capitalise, fmtNumber, joinList, numberWord, verbPhrase, withArticle } from './english.js';
import { chartNoun, groupsText } from './charts.js';

/* ---------- values ---------- */

function bare(v, unit) {
  const d = unit?.decimals ?? 0;
  if (unit?.kind === 'percent') return `${fmtNumber(v, d)}%`;
  if (unit?.kind === 'currency') {
    const n = d === 2 ? Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : fmtNumber(v, d);
    return `${unit.symbol || '$'}${n}`;
  }
  return fmtNumber(v, d);
}

// 330 with "thousand visits" → "330,000 visits"; 3.5 "million visitors" stays.
export function fmtValue(v, unit) {
  if (!unit || unit.kind !== 'number') return bare(v, unit);
  const label = unit.label || '';
  const m = /^thousand (.+)$/.exec(label);
  if (m) return `${fmtNumber(v * 1000, Math.max(0, (unit.decimals || 0) - 3))} ${m[1]}`;
  return label ? `${bare(v, unit)} ${label}` : bare(v, unit);
}

// "from 210 to 330 million tonnes" — the unit once, at the end.
function fromTo(a, b, unit) {
  if (unit?.kind === 'number' && /^thousand /.test(unit.label || '')) return `from ${fmtNumber(a * 1000, 0)} to ${fmtValue(b, unit)}`;
  if (unit?.kind === 'number' && unit.label) return `from ${bare(a, unit)} to ${fmtValue(b, unit)}`;
  return `from ${fmtValue(a, unit)} to ${fmtValue(b, unit)}`;
}

function byAmount(a, b, unit) {
  const d = Math.abs(b - a);
  if (unit?.kind === 'percent') return `${fmtNumber(d, unit.decimals || 0)} percentage point${d === 1 ? '' : 's'}`;
  return fmtValue(d, unit);
}

const FRACTIONS = [
  [50, 'half'], [100 / 3, 'a third'], [25, 'a quarter'], [20, 'a fifth'], [200 / 3, 'two thirds'],
  [75, 'three quarters'], [40, 'two fifths'], [60, 'three fifths'], [10, 'one in ten'],
];

// 34 → "just over a third", 49 → "almost half"; null when no fraction is near.
export function fractionPhrase(pct) {
  if (pct < 7) return 'a very small proportion';
  let best = null;
  for (const [f, words] of FRACTIONS) {
    const d = pct - f;
    if (Math.abs(d) <= 3 && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, words };
  }
  if (!best) return null;
  if (Math.abs(best.d) < 0.5) return best.words === 'half' || best.words === 'one in ten' ? `exactly ${best.words}` : `roughly ${best.words}`;
  if (best.words === 'one in ten') return best.d > 0 ? 'just over one in ten' : 'just under one in ten';
  return `${best.d > 0 ? 'just over' : best.words === 'half' ? 'almost' : 'just under'} ${best.words}`;
}

/* ---------- movement ---------- */

const SIZES = [[0.025, 'flat'], [0.08, 'slight'], [0.18, 'moderate'], [0.33, 'significant'], [Infinity, 'dramatic']];
const sizeOf = (m) => SIZES.find(([lim]) => m < lim)[1];

// [lemma, adverb] choices by direction and size. Dramatic verbs (soar,
// plummet) are used once per description at most, as CLAUDE-task1.md asks.
const MOVES = {
  up: {
    slight: [['rise', 'slightly'], ['increase', 'marginally']],
    moderate: [['rise', 'moderately'], ['increase', 'moderately']],
    steady: [['rise', 'steadily'], ['increase', 'steadily'], ['grow', 'consistently']],
    significant: [['rise', 'significantly'], ['increase', 'considerably'], ['grow', 'substantially']],
    dramatic: [['rise', 'sharply'], ['increase', 'dramatically'], ['soar', '']],
  },
  down: {
    slight: [['fall', 'slightly'], ['decrease', 'marginally']],
    moderate: [['fall', 'moderately'], ['decline', 'moderately']],
    steady: [['decline', 'steadily'], ['fall', 'steadily'], ['decrease', 'consistently']],
    significant: [['fall', 'significantly'], ['drop', 'considerably'], ['decline', 'substantially']],
    dramatic: [['fall', 'sharply'], ['drop', 'dramatically'], ['plummet', '']],
  },
};
const NOUNS = {
  up: { slight: 'a slight rise', moderate: 'a moderate increase', steady: 'a steady rise', significant: 'a considerable increase', dramatic: 'a sharp rise' },
  down: { slight: 'a slight fall', moderate: 'a moderate decline', steady: 'a steady decline', significant: 'a considerable fall', dramatic: 'a sharp fall' },
};

function segments(values, scale) {
  const out = [];
  for (let i = 0; i < values.length - 1; i++) {
    const a = values[i];
    const b = values[i + 1];
    const size = sizeOf(Math.abs(b - a) / scale);
    out.push({ i, a, b, dir: size === 'flat' ? 'flat' : b > a ? 'up' : 'down' });
  }
  return out;
}

// Consecutive segments in the same direction, merged: [{ from, to, dir, steps }].
export function runsOf(values, scale) {
  const runs = [];
  for (const seg of segments(values, scale)) {
    const last = runs[runs.length - 1];
    if (last && last.dir === seg.dir) {
      last.to = seg.i + 1;
      last.steps++;
    } else runs.push({ from: seg.i, to: seg.i + 1, dir: seg.dir, steps: 1 });
  }
  return runs;
}

/* ---------- context ---------- */

const FUTURE_TENSES = ['expected', 'projected', 'future'];

function context(v, seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const used = new Set();
  let futureTurn = 0;
  const present = v.frame === 'typical' || v.frame === 'undated';
  return {
    v,
    rng,
    present,
    tense(projected = false) {
      if (projected || v.frame === 'future') return FUTURE_TENSES[futureTurn++ % FUTURE_TENSES.length];
      return present ? 'present' : 'past';
    },
    // Picks a [lemma, adverb] not used yet when possible; soar/plummet once.
    move(dir, size) {
      const options = MOVES[dir][size].filter(([lemma]) => !((lemma === 'soar' || lemma === 'plummet') && used.has('dramatic-verb')));
      const fresh = options.filter(([l, a]) => !used.has(`${l} ${a}`));
      const choice = pickOne(rng, fresh.length ? fresh : options);
      used.add(`${choice[0]} ${choice[1]}`);
      if (choice[0] === 'soar' || choice[0] === 'plummet') used.add('dramatic-verb');
      return choice;
    },
    pick: (items) => pickOne(rng, items),
  };
}

const line = (text, focus) => ({ text, focus });

// "is" / "were" / "is expected to be" / "will be" for a tense.
function beForm(tense, plural) {
  const be = plural ? 'are' : 'is';
  return {
    present: be,
    past: plural ? 'were' : 'was',
    expected: `${be} expected to be`,
    projected: `${be} projected to be`,
    future: 'will be',
  }[tense] || be;
}

function nameOf(v, name) {
  return v.prose?.[name] || name;
}

// A series as a noun phrase, with its prefix: "people aged 35–54", not "35–54".
const seriesName = (v, name) => `${v.subject?.prefix || ''}${nameOf(v, name)}`;

// The subject for one series. variant 0: "coal exports from Australia";
// 1: "the figure for Australia". { text, plural }.
function subjectOf(v, name, variant = 0) {
  const s = v.subject;
  const who = `${s?.prefix || ''}${nameOf(v, name)}`;
  if (s && variant % 2 === 0) return { text: `${s.short} ${s.per} ${who}`, plural: s.plural };
  return { text: `the figure for ${who}`, plural: false };
}

function when(v, from, to, { first = false } = {}) {
  const xs = v.x.values;
  const a = xName(v, from);
  const b = xName(v, to);
  if (from === 0 && to === xs.length - 1 && v.x.kind !== 'year') return `Over ${span(v)} as a whole`;
  if (v.x.kind === 'year' && !first && Number(b) - Number(a) >= 2 && to === xs.length - 1 && v.x.projectedFrom === null) {
    return `Over the following ${numberWord(Number(b) - Number(a))} years`;
  }
  return `Between ${a} and ${b}`;
}

const MONTH_NAMES = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
const xName = (v, i) => (v.x.kind === 'month' ? MONTH_NAMES[v.x.values[i]] || v.x.values[i] : v.x.values[i]);
const at = (v, i) => (v.x.kind === 'hour' ? `at ${xName(v, i)}` : `in ${xName(v, i)}`);
const span = (v) => (v.x.kind === 'hour' ? 'the day' : v.x.kind === 'month' ? 'the year' : 'the period');
const nearZero = (val, v) => val <= v.axis.max * 0.012;

/* ---------- intro ---------- */

function introLines(v, ctx) {
  const noun = v.kind === 'pie' ? (v.pies.length > 1 ? `${numberWord(v.pies.length)} pie charts` : 'pie chart') : chartNoun(v) === 'graph' ? 'line graph' : chartNoun(v);
  const plural = noun.endsWith('s');
  const multi = v.kind === 'pie' ? v.pies.length > 1 : v.series.length > 1;
  const verbs = multi ? ['illustrate', 'compare', 'give information about'] : ['illustrate', 'give information about'];
  const verb = ctx.pick(verbs);
  const fin = (w) => (plural ? w : w.replace(/^(\w+)/, (m) => (m === 'give' ? 'gives' : m + 's')));
  let what;
  let period = '';
  if (v.kind === 'pie') {
    what = [v.measureAlt, v.place].filter(Boolean).join(' ');
    const labels = v.pies.map((p) => p.label).filter(Boolean);
    if (labels.length > 1) period = labels.every((l) => /^\d{4}$/.test(l)) ? `in ${joinList(labels)}` : `in ${joinList(labels)}${v.year ? ` in ${v.year}` : ''}`;
    else if (v.year) period = `in ${v.year}`;
  } else if (v.x.kind === 'category' || v.partsOf) {
    what = [v.measureAlt, v.place].filter(Boolean).join(' ');
    if (v.seriesAreYears) period = `in ${joinList(v.series.map((s) => s.name))}`;
    else if (v.x.kind === 'year') period = `in ${joinList(v.x.values)}`;
    else if (v.year) period = v.partsOf ? `in ${joinList(v.x.values)} in ${v.year}` : `in ${v.year}`;
  } else {
    what = `${v.measureAlt} ${groupsText(v, { alt: true })}`;
    const xs = v.x.values;
    if (v.x.kind === 'year') {
      const pf = v.x.projectedFrom;
      if (v.frame === 'mixed' && pf) period = `from ${xs[0]} to ${xs[pf - 1]}, with projections to ${xs[xs.length - 1]}`;
      else period = `from ${xs[0]} to ${xs[xs.length - 1]}${v.frame === 'future' ? ', based on projections' : ''}`;
    }
  }
  const out = [line(`The ${noun} [[${fin(verb)}]] ${[what, period].filter(Boolean).join(' ')}.`, 'intro')];
  if (v.x?.kind === 'year' && !v.partsOf && v.x.values.length > 2) {
    const xs = v.x.values;
    const span = Number(xs[xs.length - 1]) - Number(xs[0]);
    out.push(line(`The ${noun} ${fin(ctx.pick(verbs.filter((w) => w !== verb)) || 'illustrate')} ${what} [[over ${withArticle(`${numberWord(span)}-year period`)}]], starting in ${xs[0]}.`, 'intro'));
  }
  if (v.kind === 'pie' || v.partsOf) out.push(line(`The ${noun} [[${plural ? 'provide' : 'provides'} a breakdown of]] ${v.whole || v.partsOf}${v.place ? ' ' + v.place : ''}${period ? ' ' + period : ''}.`, 'intro'));
  return out;
}

/* ---------- time series (line, and bar/table over time) ---------- */

function netDir(values, scale) {
  const a = values[0];
  const b = values[values.length - 1];
  const turns = runsOf(values, scale).filter((r) => r.dir !== 'flat').length;
  if (Math.abs(b - a) / scale < 0.05) return turns >= 3 ? 'fluctuate' : 'flat';
  return b > a ? 'up' : 'down';
}

function multiple(a, b) {
  if (a <= 0) return null;
  const r = b / a;
  if (r >= 3.25) return 'more than tripled';
  if (r >= 2.85) return 'tripled';
  if (r >= 2.15) return 'more than doubled';
  if (r >= 1.9) return 'doubled';
  if (r >= 1.75) return 'almost doubled';
  if (r <= 0.45) return 'fell by more than half';
  if (r <= 0.55) return 'halved';
  return null;
}

function crossings(v) {
  const out = [];
  for (let a = 0; a < v.series.length; a++) {
    for (let b = a + 1; b < v.series.length; b++) {
      const A = v.series[a].values;
      const B = v.series[b].values;
      for (let i = 0; i < A.length - 1; i++) {
        const d0 = A[i] - B[i];
        const d1 = A[i + 1] - B[i + 1];
        if (d0 !== 0 && d1 !== 0 && d0 < 0 !== d1 < 0) out.push({ i, winner: d1 > 0 ? a : b, loser: d1 > 0 ? b : a });
      }
    }
  }
  return out;
}

function timeOverview(v, ctx) {
  const scale = v.axis.max;
  const out = [];
  const pf = v.x.projectedFrom;
  const actualEnd = pf && pf > 1 ? pf - 1 : v.x.values.length - 1;
  const actual = v.series.map((s) => s.values.slice(0, actualEnd + 1));
  // A day or a year is a cycle: where it ends says nothing about a trend.
  const cyclical = (vals) => v.frame === 'typical' && new Set(runsOf(vals, scale).map((r) => r.dir).filter((d) => d !== 'flat')).size > 1;
  const dirs = actual.map((vals) => (cyclical(vals) ? 'fluctuate' : netDir(vals, scale)));
  const names = v.series.map((s) => seriesName(v, s.name));
  const tense = ctx.tense(v.frame === 'future');
  const one = v.series.length === 1 ? subjectOf(v, v.series[0].name) : null;
  const all = one ? one.text : `the figures for ${v.series.length === 2 ? 'both' : `all ${numberWord(v.series.length)}`} ${v.groupShort}`;
  const plural = one ? one.plural : true;
  const over = pf && pf > 1 ? ` between ${v.x.values[0]} and ${v.x.values[actualEnd]}` : ` over ${span(v)}`;
  if (dirs.every((d) => d === 'up') || dirs.every((d) => d === 'down')) {
    const up = dirs[0] === 'up';
    out.push(line(`Overall, ${all} [[${verbPhrase(up ? 'rise' : 'fall', { tense, plural })}]]${over}.`, 'overview'));
    if (!pf || pf === 0) out.push(line(`Overall, there ${ctx.present ? 'is' : v.frame === 'future' ? 'is expected to be' : 'was'} [[${up ? 'an upward' : 'a downward'} trend]] in ${all}${over}.`, 'overview'));
  } else if (dirs.every((d) => d === 'fluctuate' || d === 'flat')) {
    out.push(line(`Overall, ${all} [[${verbPhrase('fluctuate', { tense, plural })}]]${over}${v.frame === 'typical' ? '' : ', with little change from start to finish'}.`, 'overview'));
  } else if (v.series.length > 1) {
    const ups = names.filter((_, i) => dirs[i] === 'up');
    const downs = names.filter((_, i) => dirs[i] === 'down');
    if (ups.length && downs.length) {
      const first = `the figure${ups.length > 1 ? 's' : ''} for ${joinList(ups)}`;
      const second = `the figure${downs.length > 1 ? 's' : ''} for ${joinList(downs)}`;
      out.push(line(`Overall, ${first} ${verbPhrase('rise', { tense, plural: ups.length > 1 })}${over}, [[whereas]] ${second} ${verbPhrase('fall', { tense, plural: downs.length > 1 })}.`, 'overview'));
    } else {
      // Some moved one way while the rest ended close to where they started.
      const moved = ups.length ? ups : downs;
      const still = names.filter((_, i) => dirs[i] === 'flat' || dirs[i] === 'fluctuate');
      out.push(line(`Overall, the figure${moved.length > 1 ? 's' : ''} for ${joinList(moved)} ${verbPhrase(ups.length ? 'rise' : 'fall', { tense, plural: moved.length > 1 })}${over}, [[whereas]] the figure${still.length > 1 ? 's' : ''} for ${joinList(still)} ${verbPhrase('end', { tense, plural: still.length > 1 })} close to ${still.length > 1 ? 'their starting levels' : 'its starting level'}.`, 'overview'));
    }
  }
  // Which series leads, or which overtakes which.
  // Only an overtaking from below that lasts to the end is a main feature; "by <year>" takes a perfect.
  const holds = (c) => v.series[c.winner].values[0] < v.series[c.loser].values[0] && v.series[c.winner].values.every((val, k) => k <= c.i || val > v.series[c.loser].values[k]);
  const cross = crossings(v).find(holds);
  if (cross && v.x.kind === 'year') {
    const year = v.x.values[cross.i + 1];
    out.push(line(`[[What stands out is that]] the figure for ${names[cross.winner]} ${verbPhrase('overtake', { tense: pf !== null && cross.i + 1 >= pf ? 'futurePerfect' : 'pastPerfect', plural: false })} that for ${names[cross.loser]} by ${year}.`, 'overview'));
  } else if (v.series.length > 1) {
    const n = v.x.values.length;
    const lead = v.series.map((s, i) => s.values.filter((val, k) => v.series.every((o, j) => j === i || o.values[k] <= val)).length);
    const top = lead.indexOf(Math.max(...lead));
    if (lead[top] === n && v.series.length === 2) out.push(line(`The figure for ${names[top]} [[${verbPhrase('remain', { tense, plural: false })} higher than]] that for ${names[1 - top]} throughout ${span(v)}.`, 'overview'));
    else if (lead[top] === n) out.push(line(`The figure for ${names[top]} [[${verbPhrase('remain', { tense, plural: false })} the highest]] throughout ${span(v)}.`, 'overview'));
    else if (lead[top] >= 0.7 * n) out.push(line(`The figure for ${names[top]} ${beForm(tense, false)} [[generally higher than]] ${v.series.length === 2 ? `that for ${names[1 - top]}` : 'the others'}.`, 'overview'));
  }
  // A shared high or low point (a typical day or year).
  if (v.frame === 'typical' && v.series.length > 1) {
    const peaks = v.series.map((s) => s.values.indexOf(Math.max(...s.values)));
    const lows = v.series.map((s) => s.values.indexOf(Math.min(...s.values)));
    if (lows.every((i) => i === lows[0])) out.push(line(`In ${v.series.length === 2 ? 'both cases' : 'every case'}, the lowest figure [[${verbPhrase('occur', { tense: 'present' })}]] ${at(v, lows[0])}.`, 'overview'));
    else if (peaks.every((i) => i === peaks[0])) out.push(line(`In ${v.series.length === 2 ? 'both cases' : 'every case'}, the figure [[${verbPhrase('peak', { tense: 'present' })}]] ${at(v, peaks[0])}.`, 'overview'));
    const ranges = v.series.map((s) => (Math.max(...s.values) - Math.min(...s.values)) / scale);
    const calm = ranges.indexOf(Math.min(...ranges));
    if (ranges[calm] < 0.3 && v.series.length > 2) out.push(line(`Of the ${numberWord(v.series.length)}, the figure for ${names[calm]} [[varies least]] over ${span(v)}.`, 'overview'));
    let top = { val: -Infinity };
    v.series.forEach((s, si) => s.values.forEach((val, i) => val > top.val && (top = { val, si, i })));
    out.push(line(`[[The highest figure overall]] is ${fmtValue(top.val, v.unit)}, for ${names[top.si]} ${at(v, top.i)}.`, 'overview'));
  }
  // Projections: does the latest direction carry on?
  if (pf && pf > 1) {
    const last = v.x.values[v.x.values.length - 1];
    const pdirs = v.series.map((s) => (s.values[s.values.length - 1] >= s.values[pf - 1] ? 'rise' : 'fall'));
    const adirs = v.series.map((s) => (s.values[pf - 1] >= s.values[Math.max(0, pf - 2)] ? 'rise' : 'fall'));
    const subjectText = capitalise(one ? one.text : `the figures for ${v.series.length === 2 ? 'both' : `all ${numberWord(v.series.length)}`} ${v.groupShort}`);
    if (pdirs.every((d) => d === pdirs[0])) {
      const cont = pdirs.every((d, i) => d === adirs[i]);
      const ing = pdirs[0] === 'rise' ? 'rising' : 'falling';
      out.push(line(`${subjectText} [[${plural ? 'are' : 'is'} expected to ${cont ? `continue ${ing}` : `${pdirs[0]} again`}]] until ${last}.`, 'overview'));
    }
  }
  return out;
}

function seriesBody(v, ctx, si, budget) {
  const s = v.series[si];
  const vals = s.values;
  const scale = v.axis.max;
  const out = [];
  const pf = v.x.projectedFrom;
  const first = subjectOf(v, s.name, si);
  const other = subjectOf(v, s.name, si + 1);
  const subj = (k) => (k % 2 ? other : first);
  if (nearZero(vals[0], v)) out.push(line(`${capitalise(at(v, 0))}, ${subj(0).text} [[${beForm(ctx.tense(pf === 0), subj(0).plural)} close to zero]].`, 'figures'));
  else if (si % 2 === 1) out.push(line(`${capitalise(subj(0).text)} [[${verbPhrase('start', { tense: ctx.tense(pf === 0), plural: subj(0).plural })} ${v.x.kind === 'year' ? 'the period' : span(v)} at]] ${fmtValue(vals[0], v.unit)}.`, 'figures'));
  else out.push(line(`${capitalise(at(v, 0))}, ${subj(0).text} [[${verbPhrase('stand at', { tense: ctx.tense(pf === 0), plural: subj(0).plural })}]] ${fmtValue(vals[0], v.unit)}.`, 'figures'));
  // Runs, split where the projections begin.
  const pieces = pf && pf > 1 ? [[0, pf - 1], [pf - 1, vals.length - 1]] : [[0, vals.length - 1]];
  let k = 1;
  let lastTo = 0; // where the previous sentence's period ended
  let flatEnd = false; // a "remained stable" sentence reaches the last point
  let wholeRun = false; // one sentence already covers the whole period
  for (const [lo, hi] of pieces) {
    const all = runsOf(vals.slice(lo, hi + 1), scale).map((r) => ({ ...r, from: r.from + lo, to: r.to + lo }));
    const room = Math.max(1, budget - out.length);
    const runs = all.length <= room ? all : all.slice().sort((x, y) => Math.abs(vals[y.to] - vals[y.from]) - Math.abs(vals[x.to] - vals[x.from])).slice(0, room).sort((x, y) => x.from - y.from);
    const projected = pf !== null && lo >= pf - 1 && pf > 0;
    for (const r of runs) {
      const a = vals[r.from];
      const b = vals[r.to];
      const sub = subj(k++);
      const tense = ctx.tense(projected);
      const time = when(v, r.from, r.to, { first: r.from === 0 || r.from !== lastTo });
      lastTo = r.to;
      if (r.from === 0 && r.to === vals.length - 1) wholeRun = true;
      if (r.dir === 'flat') {
        flatEnd = r.to === vals.length - 1;
        if (nearZero(a, v) && nearZero(b, v)) {
          out.push(line(`${time}, ${sub.text} [[${verbPhrase('remain', { tense, plural: sub.plural })} close to zero]].`, 'trend'));
          continue;
        }
        const level = fmtValue(Math.round(((a + b) / 2) / (v.axis.step / 10)) * (v.axis.step / 10), v.unit);
        const verb = r.from > 0 ? 'level off' : 'remain';
        out.push(line(`${time}, ${sub.text} [[${verbPhrase(verb, { tense, plural: sub.plural })}${verb === 'remain' ? ' stable' : ''}]] at around ${level}.`, 'trend'));
        continue;
      }
      const steps = vals.slice(r.from, r.to + 1).map((x, i, arr) => (i ? Math.abs(x - arr[i - 1]) : null)).filter((x) => x !== null);
      let total = sizeOf(Math.abs(b - a) / scale);
      const rel = Math.abs(b - a) / Math.max(Math.min(a, b), 0.05 * scale);
      if (rel >= 1 && (total === 'slight' || total === 'moderate')) total = 'significant';
      else if (rel >= 0.4 && total === 'slight') total = 'moderate';
      const even = steps.length >= 2 && Math.min(...steps) >= 0.4 * Math.max(...steps);
      const size = even && total !== 'dramatic' && total !== 'slight' ? 'steady' : total === 'dramatic' && steps.length >= 2 ? 'significant' : total;
      const [lemma, adverb] = ctx.move(r.dir, size === 'flat' ? 'slight' : size);
      if (k % 3 === 0 && !ctx.present && !projected && v.frame !== 'future') {
        out.push(line(`${time}, there ${ctx.present ? 'is' : 'was'} [[${NOUNS[r.dir][size === 'flat' ? 'slight' : size]}]] in ${sub.text}, ${fromTo(a, b, v.unit)}.`, 'trend'));
      } else {
        out.push(line(`${time}, ${sub.text} [[${verbPhrase(lemma, { tense, plural: sub.plural, adverb })}]] ${fromTo(a, b, v.unit)}.`, 'trend'));
      }
    }
  }
  // A peak or a low inside the period.
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const iMax = vals.indexOf(max);
  const iMin = vals.indexOf(min);
  if (out.length < budget + 1 && iMax > 0 && iMax < vals.length - 1 && (max - Math.max(vals[0], vals[vals.length - 1])) / scale > 0.05) {
    const sub = subj(k++);
    const tense = ctx.tense(pf !== null && iMax >= pf);
    out.push(line(`${sub.text.charAt(0).toUpperCase()}${sub.text.slice(1)} [[${verbPhrase('peak', { tense, plural: sub.plural })} at]] ${fmtValue(max, v.unit)} ${at(v, iMax)}.`, 'trend'));
  } else if (out.length < budget + 1 && iMin > 0 && iMin < vals.length - 1 && (Math.min(vals[0], vals[vals.length - 1]) - min) / scale > 0.05) {
    const sub = subj(k++);
    const tense = ctx.tense(pf !== null && iMin >= pf);
    out.push(line(`${capitalise(sub.text)} [[${verbPhrase('fall', { tense, plural: sub.plural })} to a low of]] ${fmtValue(min, v.unit)} ${at(v, iMin)}.`, 'trend'));
  }
  // The whole period: a multiple, or "By <last year>" with a perfect tense.
  const mult = multiple(vals[0], vals[vals.length - 1]);
  const last = v.x.values[vals.length - 1];
  if (mult && v.x.kind === 'year' && v.frame !== 'future' && v.frame !== 'mixed') {
    out.push(line(`Over the period as a whole, ${subj(0).text} [[${mult}]], ${fromTo(vals[0], vals[vals.length - 1], v.unit)}.`, 'trend'));
  } else if (v.x.kind === 'year' && (v.frame === 'mixed' || v.frame === 'future' || v.frame === 'past') && !flatEnd && !wholeRun && (vals.at(-1) === max || vals.at(-1) === min) && vals.at(-1) !== vals[0]) {
    // Only when the series ends at its highest or lowest point, so "had risen to" cannot contradict a peak or an overall fall.
    const future = v.frame !== 'past';
    const dir = vals.at(-1) > vals[0] ? 'rise' : 'fall';
    const sub = subj(1);
    out.push(line(`By ${last}, ${sub.text} [[${verbPhrase(dir, { tense: future ? 'futurePerfect' : 'pastPerfect', plural: sub.plural })}]] to ${fmtValue(vals[vals.length - 1], v.unit)}.`, 'tense'));
  }
  return out;
}

function timeComparisons(v, ctx) {
  const out = [];
  const names = v.series.map((s) => seriesName(v, s.name));
  for (const c of crossings(v).slice(0, 2)) {
    const year = v.x.values[c.i + 1];
    const tense = ctx.tense(v.x.projectedFrom !== null && c.i + 1 >= v.x.projectedFrom);
    out.push(line(`Between ${xName(v, c.i)} and ${xName(v, c.i + 1)}, the figure for ${names[c.winner]} [[${verbPhrase(ctx.pick(['overtake', 'surpass']), { tense, plural: false })}]] that for ${names[c.loser]}.`, 'comparison'));
  }
  // A ratio at the last point between the top two series.
  if (v.series.length > 1) {
    const i = v.x.values.length - 1;
    const order = v.series.map((s, j) => [s.values[i], j]).sort((a, b) => b[0] - a[0]);
    const [hi, lo] = [order[0], order[1]];
    const r = lo[0] > 0 ? hi[0] / lo[0] : 0;
    const phrase = r >= 2.8 && r <= 3.2 ? 'roughly three times as high as' : r >= 1.85 && r <= 2.15 ? 'roughly twice as high as' : r > 1 && r <= 1.04 ? 'almost the same as' : null;
    if (phrase) {
      const be = ctx.present ? 'is' : v.x.projectedFrom !== null && i >= v.x.projectedFrom ? 'is expected to be' : 'was';
      out.push(line(`${capitalise(at(v, i))}, the figure for ${names[hi[1]]} ${be} [[${phrase}]] that for ${names[lo[1]]}.`, 'comparison'));
    }
  }
  return out;
}

/* ---------- categories × series (bar, table) ---------- */

function catPhrase(v, c) {
  if (/age group/.test(v.x.noun || '')) return /^under /i.test(c) ? `the under-${c.slice(6)} age group` : `the ${c} age group`;
  return nameOf(v, c);
}

// "the 18–24 and 25–34 age groups", "medicine and law".
function catsPhrase(v, idx) {
  const cs = idx.map((i) => v.x.values[i]);
  if (!/age group/.test(v.x.noun || '')) return joinList(cs.map((c) => nameOf(v, c)));
  return `the ${joinList(cs.map((c) => (/^under /i.test(c) ? `under-${c.slice(6)}` : c)))} age group${cs.length > 1 ? 's' : ''}`;
}

function cellPhrase(v, si, ci) {
  const s = v.series[si].name;
  const c = v.x.values[ci];
  if (v.seriesAreYears) return `${catPhrase(v, c)} in ${s}`;
  return `${nameOf(v, s)} in ${catPhrase(v, c)}`;
}

function groupsOverview(v, ctx) {
  const out = [];
  const tense = ctx.tense();
  const be = ctx.present ? 'were' : 'were';
  const n = v.x.values.length;
  const [A, B] = v.series;
  if (v.seriesAreYears && B) {
    const ups = A.values.filter((a, i) => B.values[i] > a).length;
    const verb = ups >= n / 2 ? 'rise' : 'fall';
    const count = ups >= n / 2 ? ups : n - ups;
    out.push(line(`Overall, the figures [[${verbPhrase(verb, { tense: 'past', plural: true })}]] in ${count === n ? `all ${numberWord(n)}` : `${numberWord(count)} of the ${numberWord(n)}`} ${v.x.noun || 'categories'} between ${A.name} and ${B.name}.`, 'overview'));
  } else if (B && v.series.length === 2) {
    const aWins = v.x.values.map((_, i) => i).filter((i) => A.values[i] > B.values[i]);
    const bWins = v.x.values.map((_, i) => i).filter((i) => B.values[i] > A.values[i]);
    const [top, bottom, k] = aWins.length >= bWins.length ? [A, B, aWins.length] : [B, A, bWins.length];
    const scope = k === n ? `all ${v.x.noun || 'categories'}` : `most ${v.x.noun || 'categories'}`;
    if (k * 2 > n) out.push(line(`Overall, the figures for ${nameOf(v, top.name)} ${ctx.present ? 'are' : be} [[higher than]] those for ${nameOf(v, bottom.name)} in ${scope}.`, 'overview'));
    else if (aWins.length && bWins.length) out.push(line(`Overall, the figures for ${nameOf(v, A.name)} ${ctx.present ? 'are' : 'were'} [[higher than]] those for ${nameOf(v, B.name)} in ${catsPhrase(v, aWins)}, whereas the reverse ${ctx.present ? 'is' : 'was'} true in ${catsPhrase(v, bWins)}.`, 'overview'));
  }
  // Which series is largest in most categories (sums to 100), or a pattern with age.
  if (v.series.length >= 3) {
    const wins = v.series.map((s, j) => s.values.filter((val, i) => v.series.every((o) => o.values[i] <= val)).length);
    const best = wins.indexOf(Math.max(...wins));
    out.push(line(`Overall, ${nameOf(v, v.series[best].name)} [[${verbPhrase('account for', { tense, plural: false })} the largest share]] in ${wins[best] === n ? `all ${numberWord(n)}` : `${numberWord(wins[best])} of the ${numberWord(n)}`} ${v.x.noun || 'categories'}.`, 'overview'));
  }
  if (/age group/.test(v.x.noun || '')) {
    const avg = v.x.values.map((_, i) => v.series.reduce((sum, s) => sum + s.values[i], 0) / v.series.length);
    const up = avg.every((a, i) => i === 0 || a >= avg[i - 1]);
    const down = avg.every((a, i) => i === 0 || a <= avg[i - 1]);
    if (up || down) out.push(line(`In general, the figures [[${verbPhrase(up ? 'rise' : 'fall', { tense, plural: true })} with age]].`, 'overview'));
  }
  return out;
}

function groupsBody(v, ctx) {
  const out = [];
  const cells = [];
  v.series.forEach((s, si) => s.values.forEach((val, ci) => cells.push({ val, si, ci })));
  cells.sort((a, b) => b.val - a.val);
  const hi = cells[0];
  const lo = cells[cells.length - 1];
  const was = ctx.present ? 'is' : 'was';
  out.push(line(`[[The highest figure overall]] ${was} ${fmtValue(hi.val, v.unit)}, for ${cellPhrase(v, hi.si, hi.ci)}.`, 'comparison'));
  out.push(line(`[[By contrast]], the lowest figure ${was} just ${fmtValue(lo.val, v.unit)}, for ${cellPhrase(v, lo.si, lo.ci)}.`, 'comparison'));
  const [A, B] = v.series;
  if (!B) return out;
  const n = v.x.values.length;
  const gaps = v.x.values.map((_, i) => ({ i, d: B.values[i] - A.values[i] }));
  if (v.seriesAreYears) {
    const changes = gaps.slice().sort((a, b) => b.d - a.d);
    const up = changes[0];
    const down = changes[changes.length - 1];
    if (up.d > 0) out.push(line(`The largest increase was in ${catPhrase(v, v.x.values[up.i])}, where the figure [[rose by]] ${byAmount(A.values[up.i], B.values[up.i], v.unit)}, ${fromTo(A.values[up.i], B.values[up.i], v.unit)}.`, 'trend'));
    const falls = changes.filter((c) => c.d < 0).length;
    if (falls === 1) out.push(line(`${capitalise(catPhrase(v, v.x.values[down.i]))} was the only exception, with the figure [[falling from]] ${fmtValue(A.values[down.i], v.unit)} in ${A.name} to ${fmtValue(B.values[down.i], v.unit)} in ${B.name}.`, 'trend'));
    else if (falls > 1) out.push(line(`The largest decrease was in ${catPhrase(v, v.x.values[down.i])}, where the figure [[fell by]] ${byAmount(A.values[down.i], B.values[down.i], v.unit)}, ${fromTo(A.values[down.i], B.values[down.i], v.unit)}.`, 'trend'));
    return out;
  }
  if (v.series.length === 2) {
    const sorted = gaps.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const big = sorted[0];
    const small = sorted[sorted.length - 1];
    const sa = nameOf(v, A.name);
    const sb = nameOf(v, B.name);
    out.push(line(`In ${catPhrase(v, v.x.values[big.i])}, the figure for ${sa} ${was} ${fmtValue(A.values[big.i], v.unit)}, [[compared with]] ${fmtValue(B.values[big.i], v.unit)} for ${sb}.`, 'comparison'));
    if (small.i !== big.i) out.push(line(`The figures for ${sa} and ${sb} in ${catPhrase(v, v.x.values[small.i])} ${ctx.present ? 'are' : 'were'} ${fmtValue(A.values[small.i], v.unit)} and ${fmtValue(B.values[small.i], v.unit)} [[respectively]].`, 'comparison'));
    const ratio = gaps.map(({ i }) => ({ i, r: Math.max(A.values[i], B.values[i]) / Math.max(1e-9, Math.min(A.values[i], B.values[i])) })).find((x) => x.r >= 1.85 && x.r <= 2.15);
    if (ratio && n > 1) {
      const [h, l] = A.values[ratio.i] > B.values[ratio.i] ? [sa, sb] : [sb, sa];
      out.push(line(`In ${catPhrase(v, v.x.values[ratio.i])}, the figure for ${h} ${was} [[roughly twice as high as]] that for ${l}.`, 'comparison'));
    }
  } else {
    // Several series (e.g. sectors): the leader in two contrasting categories.
    const lead = (i) => v.series.reduce((best, s, j) => (s.values[i] > v.series[best].values[i] ? j : best), 0);
    const pairs = v.x.values.map((_, i) => ({ i, j: lead(i) }));
    const distinct = pairs.filter((p, idx) => pairs.findIndex((q) => q.j === p.j) === idx).slice(0, 2);
    for (const { i, j } of distinct) {
      out.push(line(`In ${catPhrase(v, v.x.values[i])}, ${nameOf(v, v.series[j].name)} [[${verbPhrase('account for', { tense: ctx.tense(), plural: false })}]] the largest share, at ${fmtValue(v.series[j].values[i], v.unit)}.`, 'proportion'));
    }
  }
  return out;
}

/* ---------- pies (and part-of-a-whole tables) ---------- */

const isOther = (name) => /^other/i.test(name);

function pieOverview(v, ctx) {
  const out = [];
  const tense = ctx.tense();
  const largest = v.pies.map((p) => p.slices.reduce((a, b) => (b.value > a.value ? b : a)));
  const same = largest.every((s) => s.name === largest[0].name);
  const whole = v.whole || 'the total';
  const years = v.pies.every((p) => /^\d{4}$/.test(p.label));
  if (!same && v.pies.length > 1 && !largest.some((s) => isOther(s.name))) {
    const first = largest[0].name;
    const swap = largest.find((s) => s.name !== first).name;
    if (years) {
      const when = v.pies[largest.findIndex((s) => s.name === swap)].label;
      out.push(line(`[[What stands out is that]] ${nameOf(v, swap)} ${verbPhrase('replace', { tense: 'pastPerfect' })} ${nameOf(v, first)} as the largest category by ${when}.`, 'overview'));
    } else {
      const placesOf = (name) => v.pies.filter((p, i) => largest[i].name === name).map((p) => p.label);
      out.push(line(`Overall, ${nameOf(v, first)} ${verbPhrase('account for', { tense, plural: false })} the largest share in ${joinList(placesOf(first))}, [[whereas]] ${nameOf(v, swap)} did so in ${joinList(placesOf(swap))}.`, 'overview'));
    }
  }
  const scope = v.pies.length === 1 ? '' : v.pies.every((p) => /^\d{4}$/.test(p.label)) ? (v.pies.length === 2 ? ' in both years' : ' in every year') : ` in all ${numberWord(v.pies.length)}`;
  if (same && !isOther(largest[0].name)) {
    out.push(line(`Overall, ${nameOf(v, largest[0].name)} [[${verbPhrase('account for', { tense, plural: false })} the largest share]] of ${whole}${scope}.`, 'overview'));
  } else if (same) {
    // "Other" is not one category: name the biggest real one.
    const named = v.pies.map((p) => p.slices.filter((x) => !isOther(x.name)).reduce((a, b) => (b.value > a.value ? b : a)).name);
    if (named.every((x) => x === named[0])) out.push(line(`Overall, ${nameOf(v, named[0])} [[${beForm(tense, false)} the largest single category]] of ${whole}${scope}.`, 'overview'));
  }
  if (v.pies.length >= 2 && years) {
    const a = v.pies[0];
    const b = v.pies[v.pies.length - 1];
    const changes = a.slices.map((s, i) => ({ name: s.name, from: s.value, to: b.slices[i].value, d: b.slices[i].value - s.value })).filter((c) => !isOther(c.name));
    const big = changes.reduce((x, y) => (Math.abs(y.d) > Math.abs(x.d) ? y : x));
    // Equal largest changes are named together.
    const tied = changes.filter((c) => Math.abs(c.d) === Math.abs(big.d));
    const names = (list) => joinList(list.map((c) => nameOf(v, c.name)));
    const s = (list) => (list.length > 1 ? 's' : '');
    if (tied.length === 1) out.push(line(`[[The most noticeable change]] was the ${big.d > 0 ? 'rise' : 'fall'} in the proportion of ${whole} accounted for by ${nameOf(v, big.name)}.`, 'overview'));
    else if (big.d) {
      const [first, second] = [tied.filter((c) => c.d > 0), tied.filter((c) => c.d < 0)].sort((x, y) => y.length - x.length);
      const word = (list) => (list[0].d > 0 ? 'rise' : 'fall');
      out.push(line(`[[The most noticeable changes]] were the ${word(first)}${s(first)} in the proportion${s(first)} of ${whole} accounted for by ${names(first)}${second.length ? ` and the ${word(second)}${s(second)} in ${names(second)}` : ''}.`, 'overview'));
    }
  } else if (v.pies.length === 1) {
    const sorted = v.pies[0].slices.filter((x) => !isOther(x.name)).sort((x, y) => y.value - x.value);
    if (sorted[0].value + sorted[1].value > 50) {
      out.push(line(`Overall, ${nameOf(v, sorted[0].name)} and ${nameOf(v, sorted[1].name)} [[together ${verbPhrase('account for', { tense, plural: true })}]] more than half of ${whole}.`, 'overview'));
    }
  }
  return out;
}

function pieBody(v, ctx) {
  const out = [];
  const tense = ctx.tense();
  const whole = v.whole || 'the total';
  const p0 = v.pies[0];
  const sorted = p0.slices.filter((x) => !isOther(x.name)).sort((x, y) => y.value - x.value);
  const when0 = p0.label && v.pies.length > 1 ? (/^\d{4}$/.test(p0.label) ? ` in ${p0.label}` : ` in ${p0.label}`) : '';
  const [a, b, c] = sorted;
  // "Other" is not a category of its own: rank the named ones "apart from" it when it would change the order.
  const apart = (test, name) => {
    const o = p0.slices.find((x) => isOther(x.name) && test(x.value));
    return o ? `Apart from ${nameOf(v, o.name)}, ${nameOf(v, name)}` : capitalise(nameOf(v, name));
  };
  out.push(line(`${apart((x) => x > a.value, a.name)} [[${verbPhrase('account for', { tense, plural: false })}]] the largest share of ${whole}${when0}, at ${a.value}%.`, 'proportion'));
  const frac = fractionPhrase(a.value);
  if (frac && !frac.startsWith('a very')) out.push(line(`${capitalise(nameOf(v, a.name))} ${verbPhrase('make up', { tense, plural: false })} [[${frac}]] of ${whole}${when0}.`, 'proportion'));
  if (b && c && sorted.length >= 4) out.push(line(`${apart((x) => x > b.value, b.name)} ${ctx.present ? 'comes' : 'came'} second, at ${b.value}%, [[followed by]] ${nameOf(v, c.name)} (${c.value}%).`, 'proportion'));
  const last = sorted[sorted.length - 1];
  const where0 = p0.label && v.pies.length > 1 ? ` in ${p0.label}` : '';
  out.push(line(`${apart((x) => x < last.value, last.name)} ${verbPhrase('represent', { tense, plural: false })} [[the smallest proportion]]${where0}, at just ${last.value}%.`, 'proportion'));
  const yearPies = v.pies.every((p) => /^\d{4}$/.test(p.label));
  if (v.pies.length >= 2 && yearPies) {
    const p1 = v.pies[v.pies.length - 1];
    const changes = p0.slices.map((s, i) => ({ name: s.name, from: s.value, to: p1.slices[i].value })).filter((x) => x.from !== x.to && !isOther(x.name));
    changes.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
    for (const ch of changes.slice(0, 3)) {
      const mult = multiple(ch.from, ch.to);
      if (mult && /doubled|tripled/.test(mult)) {
        out.push(line(`The share of ${whole} accounted for by ${nameOf(v, ch.name)} [[${mult}]], from ${ch.from}% in ${p0.label} to ${ch.to}% in ${p1.label}.`, 'trend'));
      } else {
        out.push(line(`The figure for ${nameOf(v, ch.name)} [[${verbPhrase(ch.to > ch.from ? 'rise' : 'fall', { tense: 'past' })} by]] ${byAmount(ch.from, ch.to, v.unit)} between ${p0.label} and ${p1.label}, from ${ch.from}% to ${ch.to}%.`, 'trend'));
      }
    }
    const top = p1.slices.reduce((x, y) => (y.value > x.value ? y : x));
    const top0 = p0.slices.reduce((x, y) => (y.value > x.value ? y : x));
    const was = p0.slices.find((s) => s.name === top.name).value;
    if (was !== top.value && !isOther(top.name)) out.push(line(`${capitalise(nameOf(v, top.name))} ${top0.name === top.name ? 'remained' : 'became'} the largest category in ${p1.label}, with its share [[${top.value > was ? 'rising' : 'falling'} from]] ${was}% to ${top.value}%.`, 'proportion'));
  } else if (v.pies.length > 1) {
    for (const p of v.pies.slice(1)) {
      const top = p.slices.filter((x) => !isOther(x.name)).reduce((x, y) => (y.value > x.value ? y : x));
      out.push(line(`In ${p.label}, ${nameOf(v, top.name)} [[${verbPhrase('account for', { tense, plural: false })}]] the largest share, at ${top.value}%.`, 'proportion'));
    }
    const name = sorted[0].name;
    const shares = v.pies.map((p) => ({ label: p.label, value: p.slices.find((s) => s.name === name).value }));
    const lo = shares.reduce((x, y) => (y.value < x.value ? y : x));
    const hi = shares.reduce((x, y) => (y.value > x.value ? y : x));
    out.push(line(`${capitalise(nameOf(v, name))} accounted for ${hi.value}% of ${whole} in ${hi.label}, [[compared with]] ${lo.value}% in ${lo.label}.`, 'comparison'));
  }
  return out;
}

/* ---------- entry point ---------- */

// { intro, overview, body }: arrays of { text, focus }, every text with one [[ ]].
export function describeChart(v, { seed = 1 } = {}) {
  const ctx = context(v, seed);
  const intro = introLines(v, ctx);
  if (v.kind === 'pie') return { intro, overview: pieOverview(v, ctx), body: pieBody(v, ctx) };
  if (v.partsOf) {
    const pies = v.x.values.map((label, i) => ({ label, slices: v.series.map((s) => ({ name: s.name, value: s.values[i] })) }));
    const asPie = { ...v, kind: 'pie', whole: v.partsOf, pies };
    return { intro, overview: pieOverview(asPie, ctx), body: pieBody(asPie, ctx) };
  }
  if (v.x.kind === 'category') return { intro, overview: groupsOverview(v, ctx), body: groupsBody(v, ctx) };
  const budget = v.series.length <= 2 ? 4 : 2;
  const body = [];
  v.series.slice(0, 3).forEach((_, si) => body.push(...seriesBody(v, ctx, si, budget)));
  body.push(...timeComparisons(v, ctx));
  return { intro, overview: timeOverview(v, ctx), body };
}
