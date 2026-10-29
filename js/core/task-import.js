// Tasks made by Claude: the prompt, and a tolerant reader for the reply that
// turns it into a task the app can draw, describe and drill. Pure.
import { readJsonReply, salvageNestedObjects, isObject } from './json.js';
import { niceAxis, splitHundred, chartRubric } from './charts.js';
import { mixedRubric, TASK_TYPES } from './tasks.js';
import { validateProcess, processRubric } from './process.js';

const KIND_OF = { line: 'line', bar: 'bar', table: 'table', pie: 'pie', map: 'map', process: 'process' };
const FORMATS = {
  line: `{"kind":"line","title":"Coal exports","measure":"coal exports","measureAlt":"the amount of coal exported","per":"from","groupNoun":"countries","unit":{"kind":"number","label":"million tonnes"},"x":{"kind":"year","values":["2000","2005","2010","2015","2020"]},"series":[{"name":"Australia","values":[210,244,286,330,352]},{"name":"Indonesia","values":[78,132,244,338,296]}],"frame":"past"}`,
  bar: `{"kind":"bar","title":"Adults who exercise regularly","measure":"the percentage of men and women in different age groups who exercised regularly","measureAlt":"how many men and women of different ages took regular exercise","unit":{"kind":"percent"},"x":{"kind":"category","values":["18–24","25–34","35–44","45–54"],"noun":"age groups"},"series":[{"name":"men","values":[48,41,37,30]},{"name":"women","values":[39,43,40,35]}],"frame":"dated","year":2023}`,
  table: `{"kind":"table","title":"Rice production","measure":"rice production","measureAlt":"the quantity of rice produced","per":"in","groupNoun":"countries","unit":{"kind":"number","label":"million tonnes"},"x":{"kind":"year","values":["2000","2010","2020"]},"series":[{"name":"India","values":[127,144,178]},{"name":"Vietnam","values":[32,40,43]}],"frame":"past"}`,
  pie: `{"kind":"pie","title":"Household spending","measure":"how the average household budget was spent","measureAlt":"the breakdown of household spending","whole":"household spending","place":"in Canada","pies":[{"label":"2000","slices":[{"name":"housing","value":31},{"name":"food","value":19},{"name":"transport","value":15},{"name":"leisure","value":12},{"name":"other","value":23}]},{"label":"2020","slices":[{"name":"housing","value":36},{"name":"food","value":15},{"name":"transport","value":14},{"name":"leisure","value":16},{"name":"other","value":19}]}],"frame":"past"}`,
  process: `{"kind":"process","title":"Making cheese","cycle":false,"natural":false,"how":"how cheese is made","howAlt":"the stages involved in making cheese","nominal":"the production of cheese","starts":"the collection of milk","ends":"the packaging of the cheese","characterise":"Overall, the process is largely mechanised, [[involving]] machinery at most stages.","steps":[{"label":"Collecting the milk","sentence":"Fresh milk [[is collected]] from local farms."},{"label":"Heating","sentence":"The milk [[is heated]] to kill bacteria."},{"label":"Adding rennet","sentence":"Rennet [[is added]] so that the milk separates into curds and whey."},{"label":"Packaging","sentence":"Finally, the cheese [[is packaged]] and sent to shops."}]}`,
};

const TYPE_RULES = {
  line: 'A line graph: 2–4 series over 5–8 equally spaced years (or 9 times of day, or 12 months).',
  bar: 'A bar chart: 4–6 categories × 1–3 series, or 2–3 series over 4–5 years.',
  table: 'A table: 3–5 rows × 3–6 columns.',
  pie: 'One to three pie charts with the same 4–6 slices; each pie sums to 100.',
  process: 'A process of 5–9 stages. Each "sentence" is the stage in the present simple (passive for man-made processes) with exactly one [[ ]] around the main verb.',
  map: 'Two maps of the same place (before and after).',
};

const bullets = (list) => list.map((r) => `- ${r}`).join('\n');

// map: { rules, example } from maps.js (passed in, so this module does not load it eagerly).
export function taskPrompt(type, topic = '', map = {}) {
  const info = TASK_TYPES.find((t) => t.id === type) || TASK_TYPES[0];
  const visuals = type === 'mixed' ? `[${FORMATS.line}, ${FORMATS.pie}]` : type === 'map' ? `[${map.example || '{"kind":"map", …}'}]` : `[${FORMATS[type]}]`;
  const rules =
    type === 'map'
      ? `${bullets(['Invent a plausible place with a clear story of development (farmland built over, a factory site turned into housing, a new road or bridge); do not copy a published task.'])}\n${map.rules || bullets([TYPE_RULES.map, 'British spelling.'])}`
      : type === 'process'
        ? bullets(['Invent a plausible process with a clear sequence; do not copy a published task.', TYPE_RULES.process, 'British spelling.'])
        : bullets([
          'Invent plausible figures with a clear story (a peak, a crossover, a gap that widens or narrows, a change in the largest share); do not copy a published task.',
          type === 'mixed' ? 'Two visuals on one theme: a line graph (or bar chart) and a pie chart (or table).' : TYPE_RULES[type],
          '"measure" completes "The graph below shows …"; "measureAlt" paraphrases it for the introduction.',
          '"frame": "past" (dated years), "mixed" (past years then projections: add "projectedFrom": the index of the first projected year in x), "future" (all projected), "typical" (a typical day or year), "dated" (one past year: add "year"), or "undated".',
          'British spelling.',
        ]);
  const rubric = type === 'map' ? 'The maps below show …' : type === 'process' ? 'The diagram below shows …' : 'The … below shows …';
  return `Create one realistic IELTS Academic Writing Task 1 question: ${info.label.toLowerCase()}${topic.trim() ? `, on this topic: ${topic.trim()}` : ''}.

RULES
${rules}

Reply with ONE json code block and nothing else, in this format:
\`\`\`json
{"task":{"type":"${type}","title":"short title","rubric":"${rubric}","visuals":${visuals}}}
\`\`\``;
}

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')));
const str = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function readChart(v, problems) {
  const kind = KIND_OF[v.kind];
  const unitIn = isObject(v.unit) ? v.unit : {};
  const unit = { kind: ['number', 'percent', 'currency'].includes(unitIn.kind) ? unitIn.kind : 'number', label: str(unitIn.label, 40), symbol: str(unitIn.symbol, 3) || undefined, decimals: Number.isInteger(unitIn.decimals) ? unitIn.decimals : 0 };
  const xIn = isObject(v.x) ? v.x : {};
  const values = (Array.isArray(xIn.values) ? xIn.values : []).map((x) => str(x, 30)).filter(Boolean).slice(0, 12);
  const series = (Array.isArray(v.series) ? v.series : [])
    .filter(isObject)
    .map((s) => ({ name: str(s.name, 40), values: (Array.isArray(s.values) ? s.values : []).map(num) }))
    .filter((s) => s.name && s.values.length === values.length && s.values.every(Number.isFinite))
    .slice(0, 6);
  if (values.length < 2 || !series.length) {
    problems.push('A chart needs at least two points and one complete series.');
    return null;
  }
  if (series.some((s) => s.values.some((x) => x < 0))) problems.push('Negative values were set to 0.');
  series.forEach((s) => (s.values = s.values.map((x) => Math.max(0, x))));
  const xKind = ['year', 'category', 'hour', 'month'].includes(xIn.kind) ? xIn.kind : values.every((x) => /^\d{4}$/.test(x)) ? 'year' : 'category';
  const top = Math.max(...series.flatMap((s) => s.values));
  if (!unit.decimals && series.some((s) => s.values.some((x) => !Number.isInteger(x)))) unit.decimals = 1;
  const pf = Number.isInteger(xIn.projectedFrom) && xIn.projectedFrom > 0 && xIn.projectedFrom < values.length ? xIn.projectedFrom : null;
  const frames = ['past', 'mixed', 'future', 'typical', 'dated', 'undated'];
  return {
    kind,
    topicId: null,
    title: str(v.title, 80) || 'Chart',
    measure: str(v.measure) || str(v.title).toLowerCase(),
    measureAlt: str(v.measureAlt) || str(v.measure) || str(v.title).toLowerCase(),
    per: str(v.per, 10) || 'in',
    perAlt: str(v.perAlt, 10) || str(v.per, 10) || 'in',
    groupNoun: str(v.groupNoun, 40) || (xKind === 'category' ? 'groups' : 'categories'),
    groupShort: str(v.groupNoun, 40) || 'groups',
    listNames: true,
    subject: null,
    prose: {},
    countable: !!v.countable,
    unit,
    x: { kind: xKind, values, projectedFrom: pf, noun: str(xIn.noun, 40) || undefined },
    series,
    axis: niceAxis(top, { percent: unit.kind === 'percent' }),
    frame: frames.includes(v.frame) ? v.frame : pf !== null ? 'mixed' : xKind === 'hour' || xKind === 'month' ? 'typical' : xKind === 'year' ? 'past' : 'dated',
    ...(Number.isInteger(v.year) ? { year: v.year } : {}),
    seriesAreYears: series.every((s) => /^\d{4}$/.test(s.name)),
  };
}

function readPie(v, problems) {
  const pies = (Array.isArray(v.pies) ? v.pies : [])
    .filter(isObject)
    .map((p) => ({ label: str(p.label, 30), slices: (Array.isArray(p.slices) ? p.slices : []).filter(isObject).map((s) => ({ name: str(s.name, 40), value: num(s.value) })).filter((s) => s.name && Number.isFinite(s.value) && s.value > 0).slice(0, 6) }))
    .filter((p) => p.slices.length >= 2)
    .slice(0, 3);
  if (!pies.length) {
    problems.push('A pie chart needs at least two slices.');
    return null;
  }
  for (const p of pies) {
    const total = p.slices.reduce((s, x) => s + x.value, 0);
    if (Math.round(total) !== 100) problems.push(`The slices for ${p.label || 'a pie'} added up to ${Math.round(total)}; they were scaled to 100.`);
    splitHundred(p.slices.map((s) => s.value)).forEach((val, i) => (p.slices[i].value = val));
  }
  return {
    kind: 'pie',
    topicId: null,
    title: str(v.title, 80) || 'Pie chart',
    measure: str(v.measure) || str(v.title).toLowerCase(),
    measureAlt: str(v.measureAlt) || str(v.measure) || str(v.title).toLowerCase(),
    whole: str(v.whole, 60) || 'the total',
    place: str(v.place, 60),
    prose: {},
    unit: { kind: 'percent', decimals: 0 },
    pies,
    frame: ['past', 'dated', 'undated'].includes(v.frame) ? v.frame : pies.length > 1 ? 'past' : 'dated',
    ...(Number.isInteger(v.year) ? { year: v.year } : {}),
  };
}

// { task, problems }: task is null when nothing usable was found. `validateMap`
// comes from maps.js (passed in, so this module does not load it eagerly).
export function readTaskReply(text, { validateMap = null } = {}) {
  const problems = [];
  const extract = (value) => (isObject(value) && isObject(value.task) ? [value.task] : isObject(value) && Array.isArray(value.visuals) ? [value] : null);
  const found = readJsonReply(String(text ?? ''), { extract, salvage: (t) => salvageNestedObjects(t, extract) });
  const raw = found?.[0];
  if (!raw) return { task: null, problems: ['Could not read the reply — copy the whole JSON block from Claude.'] };
  const visuals = [];
  for (const v of (Array.isArray(raw.visuals) ? raw.visuals : []).filter(isObject).slice(0, 2)) {
    if (v.kind === 'pie') visuals.push(readPie(v, problems));
    else if (v.kind === 'process') {
      const r = validateProcess(v);
      problems.push(...r.problems);
      visuals.push(r.process);
    } else if (v.kind === 'map') {
      if (!validateMap) problems.push('Maps cannot be read here.');
      else {
        const r = validateMap(v);
        problems.push(...r.problems);
        visuals.push(r.map);
      }
    } else if (KIND_OF[v.kind]) visuals.push(readChart(v, problems));
  }
  const usable = visuals.filter(Boolean);
  if (!usable.length) return { task: null, problems: problems.length ? problems : ['The reply has no visual the app can draw.'] };
  const type = usable.length > 1 ? 'mixed' : usable[0].kind;
  const rubric = str(raw.rubric, 400);
  const fallback = type === 'mixed' ? mixedRubric(usable) : usable[0].kind === 'process' ? processRubric(usable[0]) : usable[0].kind === 'map' ? `The maps below show ${usable[0].place}.` : chartRubric(usable[0]);
  return {
    task: { type, seed: 1, origin: 'claude', title: str(raw.title, 80) || usable[0].title || 'Task from Claude', rubric: /below show/i.test(rubric) && !rubric.includes('…') ? rubric : fallback, visuals: usable },
    problems,
  };
}
