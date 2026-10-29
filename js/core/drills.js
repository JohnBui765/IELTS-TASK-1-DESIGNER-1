// What to practise and how: the daily review queue for knowledge entries,
// and drill cards built from entries or from a task's sentences. Pure: rng
// and now are injected.
//
// Card = {
//   type: 'type' | 'choose' | 'spot' | 'recall',
//   entryId?: string,              // knowledge entry (updates spaced repetition)
//   parts: { before, answer, after },   // the sentence with its gap
//   options?: string[],            // 'choose': answers to pick from (one is right)
//   right?: string, wrong?: string, // 'spot': the two versions of the sentence
//   hint: { level?, note?, pattern?, section? },
// }
import { isDue } from './srs.js';
import { markedParts, stripMarks } from './marked.js';
import { SECTIONS } from './kb-schema.js';
import { levenshtein } from './grade.js';
import { normalizeAnswer } from './text.js';
import { shuffle } from './util.js';

const SECTION_ORDER = new Map(SECTIONS.map((s, i) => [s.id, i]));
// New entries: the working register first (B2), then B2+, C1, and B1 last.
const LEVEL_ORDER = { B2: 0, 'B2+': 1, C1: 2, B1: 3 };

const hintOf = (e) => ({ level: e.level, note: e.note, pattern: e.pattern, section: e.section, risk: !!e.risk });

/* ---------- the review queue ---------- */

// Due entries first (most overdue, lowest box), then new ones in a sensible
// order (introduction before body; B2 before C1), up to `limit`.
export function reviewQueue(entries, progress, now, { limit = 20 } = {}) {
  const due = [];
  const fresh = [];
  for (const e of entries) {
    const p = progress.get(e.id);
    if (!p || !p.seen) fresh.push(e);
    else if (isDue(p, now)) due.push({ e, p });
  }
  due.sort((a, b) => (a.p.box || 0) - (b.p.box || 0) || (a.p.due || 0) - (b.p.due || 0));
  // New entries are mixed across sections (one introduction phrase, one
  // overview phrase, one trend phrase…) rather than twenty of one kind.
  const bySection = new Map();
  fresh
    .sort((a, b) => (SECTION_ORDER.get(a.section) ?? 99) - (SECTION_ORDER.get(b.section) ?? 99) || (LEVEL_ORDER[a.level] ?? 1) - (LEVEL_ORDER[b.level] ?? 1))
    .forEach((e) => {
      if (!bySection.has(e.section)) bySection.set(e.section, []);
      bySection.get(e.section).push(e);
    });
  const picked = due.slice(0, limit).map((x) => x.e);
  const queues = [...bySection.values()];
  for (let round = 0; picked.length < limit && queues.some((q) => q.length); round++) {
    for (const q of queues) {
      if (picked.length >= limit) break;
      if (q.length) picked.push(q.shift());
    }
  }
  return { entries: picked, due: due.length, fresh: fresh.length };
}

export function knowledgeSummary(entries, progress, now) {
  const out = { total: entries.length, fresh: 0, learning: 0, mastered: 0, due: 0 };
  for (const e of entries) {
    const p = progress.get(e.id);
    if (!p || !p.seen) out.fresh++;
    else {
      if ((p.box || 0) >= 5) out.mastered++;
      else out.learning++;
      if (isDue(p, now)) out.due++;
    }
  }
  return out;
}

/* ---------- cards ---------- */

// The sentence to drill: examples in turn (by how often the entry was seen),
// so the learner meets the pattern in a new sentence each time.
function sentenceFor(entry, turn) {
  const pool = entry.examples?.length ? entry.examples.map((x) => x.text) : [entry.text];
  return markedParts(pool[turn % pool.length]) || markedParts(entry.text);
}

function distractors(entry, all, answer, rng, n = 3) {
  const key = answer.toLowerCase();
  const seen = new Set([key]);
  const near = all.filter((e) => e.id !== entry.id && e.section === entry.section);
  const far = all.filter((e) => e.id !== entry.id && e.section !== entry.section && e.kind === entry.kind);
  const out = [];
  for (const pool of [near, far, all]) {
    const shuffled = shuffle(pool, rng);
    for (const e of shuffled) {
      const a = markedParts(e.text)?.answer;
      if (!a || seen.has(a.toLowerCase())) continue;
      seen.add(a.toLowerCase());
      out.push(a);
      if (out.length >= n) return out;
    }
  }
  return out;
}

// One card for an entry. `turn`: how many times it has been seen (rotates
// the example). mode: the learner's answer setting ('type' | 'choose').
export function cardForEntry(entry, all, { rng, turn = 0, mode = 'type' } = {}) {
  const hint = hintOf(entry);
  if (entry.wrong?.length && rng() < 0.35) {
    const base = markedParts(entry.text);
    const ex = (entry.examples || []).map((x) => markedParts(x.text)).find((p) => p && base && p.answer.toLowerCase() === base.answer.toLowerCase()) || base;
    if (ex) {
      const wrong = entry.wrong[Math.floor(rng() * entry.wrong.length)];
      return {
        type: 'spot',
        entryId: entry.id,
        parts: ex,
        right: `${ex.before}${ex.answer}${ex.after}`,
        wrong: `${ex.before}${wrong}${ex.after}`,
        wrongPart: wrong,
        flip: rng() < 0.5,
        hint,
      };
    }
  }
  const parts = sentenceFor(entry, turn);
  if (parts.answer.split(/\s+/).length > 5) return { type: 'recall', entryId: entry.id, parts, hint };
  if (mode === 'choose') {
    const options = shuffle([parts.answer, ...distractors(entry, all, parts.answer, rng)], rng);
    if (options.length >= 3) return { type: 'choose', entryId: entry.id, parts, options, hint };
  }
  return { type: 'type', entryId: entry.id, parts, hint };
}

// Cards from a task's own sentences (no spaced repetition).
export function cardsForLines(lines, { rng, mode = 'type' } = {}) {
  const answers = lines.map((l) => markedParts(l.text)?.answer).filter(Boolean);
  return lines
    .map((l) => markedParts(l.text) && { l, parts: markedParts(l.text) })
    .filter(Boolean)
    .map(({ l, parts }) => {
      const hint = { section: l.focus };
      if (mode === 'choose') {
        const pool = shuffle([...new Set(answers.filter((a) => a.toLowerCase() !== parts.answer.toLowerCase()))], rng).slice(0, 3);
        if (pool.length >= 2) return { type: 'choose', parts, options: shuffle([parts.answer, ...pool], rng), hint };
      }
      return { type: parts.answer.split(/\s+/).length > 5 ? 'recall' : 'type', parts, hint };
    });
}

// A typed answer: right, nearly right (a slip), or wrong. Case, commas and
// edge punctuation never matter. The chunk is compared whole: unlike a
// vocabulary answer, its commas do not separate alternatives and its leading
// "to" is not optional ("the north of" is not "to the north of").
export function gradeTyped(input, answer) {
  const key = (s) => normalizeAnswer(String(s ?? '').replace(/,(?!\d)/g, ' ')).replace(/ +/g, ' ');
  const typed = key(input);
  const target = key(answer);
  if (!typed) return { correct: false, close: false };
  if (typed === target) return { correct: true, close: false };
  const letters = (target.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return { correct: false, close: levenshtein(typed, target) <= (letters <= 4 ? 1 : 2) };
}

export const fullSentence = (parts) => `${parts.before}${parts.answer}${parts.after}`;
export const plainText = stripMarks;
