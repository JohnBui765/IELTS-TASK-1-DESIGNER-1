// Knowledge packs (format task1-kb/1): reading them from Claude replies or
// files, checking every entry, and planning how an import merges with what
// the learner already has. Pure: ids and time are injected.
import { KB_FORMAT, KIND_IDS, LEVEL_IDS, MIN_EXAMPLES, SECTION_IDS, TYPE_IDS } from './kb-schema.js';
import { PROJECT_INSTRUCTIONS } from './kb-prompt.js';
import { countMarks, markedParts, markPhrase, stripMarks } from './marked.js';
import { isObject, readJsonReply, salvageNestedObjects } from './json.js';
import { normalizeAnswer } from './text.js';
import { similarity } from './grade.js';

// Headings that only the instructions contain, never a reply.
const PROMPT_SIGNATURE = /WHAT TO EXTRACT[\s\S]*THE FORMAT/;
const NOT_A_REPLY = 'This is the prompt, not Claude’s reply. Paste the reply from Claude.';
// The format example in the instructions, known by its placeholder source.
const EXAMPLE_SOURCE = /"source":"([^"]+)"/.exec(PROJECT_INSTRUCTIONS)?.[1];
const MAX_TEXT = 320;
const MAX_NOTE = 500;
const MAX_EXAMPLE_WORDS = 60;

const SECTION_ALIASES = {
  introduction: 'intro', paraphrase: 'intro', overviews: 'overview', 'main features': 'overview',
  trends: 'trend', movement: 'trend', 'change over time': 'trend', comparisons: 'comparison', contrast: 'comparison',
  proportions: 'proportion', percentages: 'proportion', numbers: 'figures', approximation: 'figures', process: 'sequence',
  sequencing: 'sequence', stages: 'sequence', changes: 'change', map: 'change', maps: 'change', place: 'location',
  places: 'location', prepositions: 'location', tenses: 'tense', cohesion: 'linking', linkers: 'linking',
  conclusion: 'summary', register: 'general', tone: 'general',
};

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const words = (s) => clean(s).split(' ').filter(Boolean).length;

// Comparison key for an item or an example: no marks, no case, no edge punctuation.
export function itemKey(text) {
  return normalizeAnswer(stripMarks(text)).replace(/\s*[.;:!?]+$/, '');
}

/* ---------- reading a reply ---------- */

function looksLikeEntry(v) {
  return isObject(v) && typeof v.text === 'string' && ('examples' in v || 'kind' in v || 'section' in v);
}

function extractPacks(value) {
  if (isObject(value) && Array.isArray(value.entries)) return [value];
  if (Array.isArray(value) && value.some(looksLikeEntry)) return [{ entries: value }];
  if (looksLikeEntry(value)) return [{ entries: [value] }];
  return null;
}

// { meta, rawEntries, problems } — meta: { title, source, more, format }.
// rawEntries is [] when nothing could be read.
export function readPack(text) {
  const str = String(text ?? '');
  const problems = [];
  if (PROMPT_SIGNATURE.test(str)) return { meta: null, rawEntries: [], problems: [NOT_A_REPLY] };
  const found = readJsonReply(str, { extract: extractPacks, salvage: (t) => salvageNestedObjects(t, extractPacks) }) || [];
  const packs = found.filter((p) => !(isObject(p.pack) && clean(p.pack.source) === EXAMPLE_SOURCE));
  if (found.length && !packs.length) return { meta: null, rawEntries: [], problems: [NOT_A_REPLY] };
  if (packs.length < found.length) problems.push('Left out the format example copied from the instructions.');
  // A reply stopped by Claude's length limit: its code block or its JSON never closes.
  const count = (re) => (str.match(re) || []).length;
  if (count(/```/g) % 2 || count(/[{[]/g) > count(/[}\]]/g)) problems.push('The reply looks cut off, so its last entry may be missing. Send “continue” to Claude and paste the rest here.');
  const rawEntries = packs.flatMap((p) => (Array.isArray(p.entries) ? p.entries : []));
  if (!rawEntries.length) {
    return { meta: null, rawEntries: [], problems: ['Could not read the reply — copy the whole JSON block from Claude.'] };
  }
  const head = packs.find((p) => isObject(p.pack)) || {};
  const info = isObject(head.pack) ? head.pack : {};
  const format = clean(head.format || '');
  if (format && format !== KB_FORMAT) problems.push(`The reply says format "${format}"; it was read as ${KB_FORMAT}.`);
  return {
    meta: {
      title: clean(info.title).slice(0, 120),
      source: clean(info.source).slice(0, 200),
      more: packs.some((p) => isObject(p.pack) && (p.pack.more === true || p.pack.more === 'true')),
      format: KB_FORMAT,
    },
    rawEntries,
    problems,
  };
}

/* ---------- checking one entry ---------- */

function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split(/[,;|]/);
  return [];
}

function readLevel(v) {
  const s = clean(v).toUpperCase().replace(/\s+/g, '').replace('PLUS', '+');
  if (LEVEL_IDS.has(s)) return s;
  if (s === 'C2') return 'C1';
  if (s === 'A2' || s === 'A1') return 'B1';
  return null;
}

function readSection(v) {
  const s = clean(v).toLowerCase();
  if (SECTION_IDS.has(s)) return s;
  return SECTION_ALIASES[s] || null;
}

const truthy = (v) => v === true || v === 'true' || v === 'yes' || v === '⚠';

// Marks the item's key words in an example that lacks [[ ]]: the exact words
// first, then the same words with any ending ("peak at" → "peaked at").
function markExample(text, answer) {
  const exact = markPhrase(text, answer);
  if (exact) return exact;
  const parts = answer.split(/\s+/).map((w) => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return w.length >= 4 ? `${esc.replace(/(e|es|s|ed|ing)$/i, '')}[a-z]*` : esc;
  });
  if (!answer.split(/\s+/).some((w) => w.length >= 4)) return null;
  const pattern = parts.join('\\s+');
  const m = new RegExp(`\\b(${pattern})\\b`, 'i').exec(text);
  return m ? `${text.slice(0, m.index)}[[${m[1]}]]${text.slice(m.index + m[1].length)}` : null;
}

function readExamples(raw, answer, problems) {
  const out = [];
  const seen = new Set();
  let unmarked = 0;
  for (const item of Array.isArray(raw) ? raw : []) {
    const obj = typeof item === 'string' ? { text: item } : isObject(item) ? item : null;
    if (!obj) continue;
    let text = clean(obj.text);
    if (!text) continue;
    if (countMarks(text) === 0 && answer) text = markExample(text, answer) || text;
    if (countMarks(text) !== 1 || words(text) > MAX_EXAMPLE_WORDS) {
      unmarked++;
      continue;
    }
    const key = itemKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    const from = ['book', 'claude', 'user', 'core'].includes(obj.from) ? obj.from : 'claude';
    out.push({ text, from, page: clean(obj.page).slice(0, 12) });
  }
  if (unmarked) problems.push(`${unmarked} example${unmarked > 1 ? 's' : ''} without exactly one [[ ]] left out.`);
  return out;
}

// { entry, problems } — entry is null when the item cannot be used.
// `entry` has no id, origin or timestamps yet (planImport adds them).
export function checkEntry(raw) {
  const problems = [];
  if (!isObject(raw)) return { entry: null, problems: ['Not an entry.'] };
  let text = clean(raw.text);
  if (!text) return { entry: null, problems: ['An entry has no text.'] };
  if (text.length > MAX_TEXT) return { entry: null, problems: [`Too long to be one item: “${text.slice(0, 60)}…”`] };
  const firstExample = (Array.isArray(raw.examples) ? raw.examples : [])
    .map((x) => markedParts(typeof x === 'string' ? x : x?.text || ''))
    .find(Boolean);
  if (countMarks(text) === 0 && firstExample) text = markExample(text, firstExample.answer) || text;
  if (countMarks(text) === 0) return { entry: null, problems: [`No [[ ]] part to drill in “${text.slice(0, 80)}”.`] };
  if (countMarks(text) > 1) {
    let n = 0;
    text = text.replace(/\[\[([^[\]]+?)\]\]/g, (m, inner) => (n++ === 0 ? m : inner));
    problems.push('Kept the first [[ ]] only.');
  }
  const answer = markedParts(text).answer;

  let kind = clean(raw.kind).toLowerCase();
  if (!KIND_IDS.has(kind)) {
    if (kind) problems.push(`Unknown kind “${kind}”, read as phrase.`);
    kind = 'phrase';
  }
  const typeList = asList(raw.types).map((t) => clean(t).toLowerCase());
  const types = typeList.includes('all') ? [] : [...new Set(typeList.filter((t) => TYPE_IDS.has(t)))];
  let section = readSection(raw.section);
  if (!section) {
    if (clean(raw.section)) problems.push(`Unknown section “${clean(raw.section)}”, filed under General.`);
    section = 'general';
  }
  let level = readLevel(raw.level);
  if (!level) {
    problems.push('No valid level, set to B2.');
    level = 'B2';
  }
  const answerKey = normalizeAnswer(answer);
  const wrong = [...new Set(asList(raw.wrong).map(clean))]
    .filter((w) => w.length >= 2 && normalizeAnswer(w) !== answerKey)
    .slice(0, 6);
  const examples = readExamples(raw.examples, answer, problems);
  if (examples.length < MIN_EXAMPLES) {
    problems.push(examples.length ? `Only ${examples.length} example${examples.length > 1 ? 's' : ''}.` : 'No usable examples.');
  }
  return {
    entry: {
      kind,
      text,
      pattern: clean(raw.pattern).slice(0, 200),
      types,
      section,
      level,
      risk: truthy(raw.risk),
      note: clean(raw.note).slice(0, MAX_NOTE),
      wrong,
      verbatim: truthy(raw.verbatim),
      page: clean(raw.page).slice(0, 12),
      examples,
      ...(typeof raw.id === 'string' && /^[\w-]{4,64}$/.test(raw.id) ? { id: raw.id } : {}),
    },
    problems,
  };
}

/* ---------- matching and planning an import ---------- */

// The existing entry an incoming one is the same item as, or null: the same
// id, the same text, or the same drilled words in a very similar text.
export function findSame(entry, pool) {
  if (entry.id) {
    const byId = pool.find((e) => e.id === entry.id);
    if (byId) return byId;
  }
  const key = itemKey(entry.text);
  const answer = normalizeAnswer(markedParts(entry.text)?.answer || '');
  let best = null;
  for (const e of pool) {
    if (itemKey(e.text) === key) return e;
    const a = normalizeAnswer(markedParts(e.text)?.answer || '');
    if (a !== answer) continue;
    const sim = similarity(stripMarks(e.text), stripMarks(entry.text));
    if (sim >= 0.8 && (!best || sim > best.sim)) best = { e, sim };
  }
  return best ? best.e : null;
}

function newExamplesFor(target, incoming) {
  const have = new Set(target.examples.map((x) => itemKey(x.text)));
  return incoming.examples.filter((x) => !have.has(itemKey(x.text)));
}

// plan = { meta, more, problems, items } where each item is
//   { action: 'new', entry, problems, issues }
//   { action: 'merge', entry, target, examples, problems, issues }  (adds examples to target)
//   { action: 'duplicate', entry, target }                           (nothing new)
//   { action: 'reject', problems }
// `lintExample(text) → string[]` (optional) flags examples that break a rule.
export function planImport(text, existing, { lintExample = null } = {}) {
  const { meta, rawEntries, problems } = readPack(text);
  const items = [];
  const pool = existing.filter((e) => !e.hidden);
  const planned = []; // incoming entries already in this plan, for duplicates inside one reply
  for (const raw of rawEntries) {
    const { entry, problems: entryProblems } = checkEntry(raw);
    if (!entry) {
      items.push({ action: 'reject', problems: entryProblems });
      continue;
    }
    const issues = lintExample ? entry.examples.flatMap((x) => lintExample(stripMarks(x.text)).map((i) => `“${stripMarks(x.text).slice(0, 50)}…”: ${i}`)) : [];
    const inPlan = findSame(entry, planned.map((p) => p.entry));
    if (inPlan) {
      const host = planned.find((p) => p.entry === inPlan);
      if (host.action === 'new') host.entry.examples.push(...newExamplesFor(host.entry, entry));
      else host.examples.push(...newExamplesFor({ examples: [...host.target.examples, ...host.examples] }, entry));
      continue;
    }
    const target = findSame(entry, pool);
    if (!target) {
      const item = { action: 'new', entry, problems: entryProblems, issues };
      items.push(item);
      planned.push(item);
      continue;
    }
    const examples = newExamplesFor(target, entry);
    const item = examples.length
      ? { action: 'merge', entry, target, examples, problems: entryProblems, issues }
      : { action: 'duplicate', entry, target };
    items.push(item);
    if (item.action === 'merge') planned.push(item);
  }
  return { meta, more: !!meta?.more, problems, items };
}

// Turns the chosen plan items into the pack record and the entries to write.
// `chosen`: the plan items to apply ('new' and 'merge' only).
export function applyImport(plan, chosen, { now, idGen, title = '' }) {
  const packId = idGen();
  const source = plan.meta?.source || '';
  const entryIds = [];
  const added = [];
  const writes = [];
  const merged = new Map(); // target id → updated entry, so two merges into one entry both land
  const withIds = (examples) => examples.map((x) => ({ ...x, id: idGen(), packId }));
  for (const item of chosen) {
    if (item.action === 'new') {
      const id = item.entry.id || idGen();
      entryIds.push(id);
      writes.push({ ...item.entry, id, examples: withIds(item.entry.examples), source, packId, origin: 'import', createdAt: now, updatedAt: now });
    } else if (item.action === 'merge') {
      const examples = withIds(item.examples);
      const prev = merged.get(item.target.id) || item.target;
      const had = prev.wrong || [];
      const wrong = [...new Set([...had, ...item.entry.wrong])].slice(0, 8);
      // Undo takes back exactly what this import added: these examples and these ✗ forms.
      const fresh = wrong.filter((w) => !had.includes(w));
      added.push({ entryId: item.target.id, exampleIds: examples.map((x) => x.id), ...(fresh.length ? { wrong: fresh } : {}) });
      merged.set(item.target.id, { ...prev, examples: [...prev.examples, ...examples], wrong, updatedAt: now });
    }
  }
  writes.push(...merged.values());
  const pack = {
    id: packId,
    title: title || plan.meta?.title || source || 'Imported knowledge',
    source,
    format: KB_FORMAT,
    importedAt: now,
    entryIds,
    added,
    counts: { new: entryIds.length, merged: added.length, examples: added.reduce((n, a) => n + a.exampleIds.length, 0) },
  };
  return { pack, entries: writes };
}

// A pack in the import format, for sharing or moving entries to another
// device. Ids are kept, so importing it again updates instead of duplicating.
export function exportPack(entries, { title = 'My Task 1 knowledge', source = 'Task 1 Studio export' } = {}) {
  return {
    format: KB_FORMAT,
    pack: { title, source, more: false },
    entries: entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      text: e.text,
      pattern: e.pattern || '',
      types: e.types?.length ? e.types : ['all'],
      section: e.section,
      level: e.level,
      risk: !!e.risk,
      note: e.note || '',
      wrong: e.wrong || [],
      verbatim: !!e.verbatim,
      page: e.page || '',
      examples: e.examples.map((x) => ({ text: x.text, from: x.from, page: x.page || '' })),
    })),
  };
}
