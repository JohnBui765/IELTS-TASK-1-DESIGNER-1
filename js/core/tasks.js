// Tasks: one generated (or imported) Task 1 question with its visual(s).
// Task = { id, type, seed, origin: 'gen' | 'claude' | 'user', title, rubric,
//          visuals: Visual[], createdAt, updatedAt, model?: { text, at } }
// `rubric` is the question's first sentence; rubricText() adds the standard
// instructions. Maps and processes load their engines on first use.
import { makeRng, pickOne } from './rng.js';
import { chartRubric, chartSubject, chartNoun, generateChart, nowYear } from './charts.js';
import { describeChart } from './describe.js';
import { TOPICS, topicById } from './topics.js';
import { capitalise } from './english.js';

export const TASK_TYPES = Object.freeze([
  { id: 'line', label: 'Line graph', short: 'Line', icon: 'chartLine' },
  { id: 'bar', label: 'Bar chart', short: 'Bar', icon: 'chartBar' },
  { id: 'pie', label: 'Pie chart', short: 'Pie', icon: 'chartPie' },
  { id: 'table', label: 'Table', short: 'Table', icon: 'table' },
  { id: 'map', label: 'Maps', short: 'Maps', icon: 'map' },
  { id: 'process', label: 'Process', short: 'Process', icon: 'flow' },
  { id: 'mixed', label: 'Two charts', short: 'Two', icon: 'mixed' },
]);

const THEMES = {
  energy: 'energy production and use', transport: 'how people travel', technology: 'the spread of technology', tourism: 'international travel',
  food: 'food production and spending', leisure: 'leisure activities', work: 'employment', housing: 'housing and household spending',
  environment: 'environmental trends', education: 'higher education', health: 'health and lifestyle',
};

export const typeInfo = (id) => TASK_TYPES.find((t) => t.id === id) || TASK_TYPES[0];

export const INSTRUCTIONS = 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.';

export function rubricText(task) {
  return `${task.rubric}\n\n${INSTRUCTIONS}\n\nWrite at least 150 words.`;
}

function chartTitle(v) {
  if (v.kind === 'pie') {
    const labels = v.pies.map((p) => p.label).filter(Boolean);
    return labels.length ? `${v.title}, ${labels.join(' and ')}` : v.title;
  }
  const xs = v.x.values;
  if (v.x.kind === 'year') return `${v.title}, ${xs[0]}–${xs[xs.length - 1]}`;
  if (v.seriesAreYears) return `${v.title}, ${v.series.map((s) => s.name).join(' and ')}`;
  return v.year ? `${v.title}, ${v.year}` : v.title;
}

// Two visuals on one theme: a trend over time and a breakdown.
function mixedVisuals(rng, now) {
  const themes = [...new Set(TOPICS.map((t) => t.theme))].filter((th) =>
    TOPICS.some((t) => t.theme === th && t.shape === 'time' && !t.axis) && TOPICS.some((t) => t.theme === th && t.shape !== 'time'),
  );
  const theme = pickOne(rng, themes);
  const first = pickOne(rng, TOPICS.filter((t) => t.theme === theme && t.shape === 'time' && !t.axis));
  const second = pickOne(rng, TOPICS.filter((t) => t.theme === theme && t.shape !== 'time'));
  const a = generateChart(rng, { kind: rng() < 0.7 ? 'line' : 'bar', now, topicId: first.id, frame: 'past' });
  const b = generateChart(rng, { kind: second.shape === 'parts' ? 'pie' : 'bar', now, topicId: second.id });
  return [a, b];
}

export function mixedRubric(visuals) {
  const [a, b] = visuals;
  const nounA = chartNoun(a) === 'graph' ? 'line graph' : chartNoun(a);
  const nounB = chartNoun(b) === 'graph' ? 'line graph' : chartNoun(b);
  const verbB = nounB.endsWith('s') ? 'show' : 'shows';
  if (nounA === nounB) return `The first ${nounA} below shows ${chartSubject(a)}, and the second shows ${chartSubject(b)}.`;
  return `The ${nounA} below shows ${chartSubject(a)}, and the ${nounB} ${verbB} ${chartSubject(b)}.`;
}

// A new task. type: one of TASK_TYPES ids. Async: maps and processes load on demand.
export async function generateTask({ type, seed, now }) {
  const rng = makeRng(seed);
  const base = { type, seed, origin: 'gen' };
  if (type === 'map') {
    const { generateMap, mapRubric } = await import('./maps.js');
    const map = generateMap(rng, { now });
    return { ...base, title: capitalise(map.place.replace(/^the /, '')), rubric: mapRubric(map), visuals: [map] };
  }
  if (type === 'process') {
    const { generateProcess, processRubric } = await import('./process.js');
    const p = generateProcess(rng);
    return { ...base, title: p.title, rubric: processRubric(p), visuals: [p] };
  }
  if (type === 'mixed') {
    const visuals = mixedVisuals(rng, now);
    return { ...base, title: `${visuals[0].title} and ${visuals[1].title.toLowerCase()}`, rubric: mixedRubric(visuals), visuals };
  }
  const v = generateChart(rng, { kind: type, now });
  return { ...base, title: chartTitle(v), rubric: chartRubric(v), visuals: [v] };
}

// The same task with fresh figures (same topic and type).
export async function reshapeTask(task, { seed, now }) {
  if (task.type === 'map' || task.type === 'process' || task.type === 'mixed' || task.origin !== 'gen') return generateTask({ type: task.type, seed, now });
  const v0 = task.visuals[0];
  const v = generateChart(makeRng(seed), { kind: v0.kind, now, topicId: v0.topicId, frame: v0.frame === 'typical' || v0.frame === 'dated' || v0.frame === 'undated' ? null : v0.frame });
  return { ...task, seed, title: chartTitle(v), rubric: chartRubric(v), visuals: [v] };
}

// Map sentences about what stayed the same have their own focus; the bank files them under map changes.
const bankFocus = (lang) => {
  for (const part of ['intro', 'overview', 'body']) lang[part] = lang[part].map((l) => (l.focus === 'unchanged' ? { ...l, focus: 'change' } : l));
  return lang;
};

// Language for the whole task: { intro, overview, body } of { text, focus }.
export async function describeTask(task) {
  const seed = task.seed || 1;
  const parts = [];
  for (const v of task.visuals) {
    if (v.kind === 'map') parts.push(bankFocus((await import('./maps.js')).describeMap(v)));
    else if (v.kind === 'process') parts.push((await import('./process.js')).describeProcess(v));
    else parts.push(describeChart(v, { seed }));
  }
  if (parts.length === 1) return parts[0];
  const out = { intro: [], overview: [], body: [] };
  const nounA = chartNoun(task.visuals[0]) === 'graph' ? 'line graph' : chartNoun(task.visuals[0]);
  const nounB = chartNoun(task.visuals[1]) === 'graph' ? 'line graph' : chartNoun(task.visuals[1]);
  // Two charts of one kind are "the first bar chart" and "the second".
  const same = nounA === nounB;
  out.intro.push({ text: `The ${same ? `first ${nounA}` : nounA} illustrates ${task.visuals[0].measureAlt}, [[while]] the ${same ? 'second' : nounB} ${nounB.endsWith('s') ? 'give' : 'gives'} information about ${task.visuals[1].measureAlt}.`, focus: 'intro' });
  parts.forEach((p, i) => {
    out.intro.push(...p.intro.slice(0, 1).map((l) => (same ? { ...l, text: l.text.replace(`The ${nounA}`, `The ${i ? 'second' : 'first'} ${nounA}`) } : l)));
    out.overview.push(...p.overview.slice(0, 2));
    out.body.push(...p.body);
  });
  const theme = THEMES[topicById(task.visuals[0].topicId)?.theme] || 'the subject';
  out.overview.push({ text: `[[Taken together]], the two charts give a fuller picture of ${theme}.`, focus: 'overview' });
  return out;
}

export function taskYearNow(now) {
  return nowYear(now);
}
