// The writing checker: the rules of CLAUDE-task1.md applied to an answer,
// plus every ✗ form in the knowledge bank. It flags and explains; it never
// gives a band score. Pure.
import { markedParts } from './marked.js';
import { similarity } from './grade.js';

const APOS = /[’‘`´]/g;

// Words as IELTS counts them: "2,000", "18–24" and "50%" are one word each.
export function countWords(text) {
  return String(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function findAll(text, re) {
  const out = [];
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  for (const m of text.matchAll(new RegExp(re.source, flags))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = (p) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(p.replace(APOS, "'")).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu');

const BE = '(?:am|is|are|was|were|be|been|being)';
const NEVER_PASSIVE = 'risen|rised|fallen|occurred|peaked|plummeted|rocketed|soared|dipped|fluctuated|declined|levelled off|leveled off|remained|stabilised';
const USUALLY_ACTIVE = 'increased|decreased|doubled|tripled|halved|dropped|grown|expanded|changed';
const SUBJECTIVE = 'amazingly|shockingly|surprisingly|predictably|worryingly|alarmingly|astonishingly|unfortunately|fortunately|sadly|luckily|interestingly|obviously|of course|at last';
const INFORMAL = "a lot|lots of|a bit|kind of|sort of|huge|really|pretty much|went up|goes up|go up|gone up|going up|went down|goes down|go down|gone down|going down|skyrocketed";
const SPECULATION = "because|due to|owing to|as a result of|probably|perhaps|this is why|the reason";
const OVERVIEW = /\b(overall|in general|generally speaking|in summary|to sum up|in conclusion|to conclude|it is clear that|what stands out|taken together|the (?:most )?(?:noticeable|striking|significant|obvious) (?:feature|change|trend|difference))\b/i;

// The built-in rules: { id, severity, title, detail, re }.
const RULES = [
  { id: 'person', severity: 'error', title: 'Personal pronoun', detail: 'Task 1 is impersonal: no I, we or you. Try "It can be seen that…".', re: /\b(?:me|my|we|us|our|you|your)\b/gi },
  { id: 'contraction', severity: 'error', title: 'Contraction', detail: 'Write the full form: "did not", "it is".', re: /\b\w+n't\b|\b(?:it|that|there|here|what|who|he|she|let)'s\b|\b\w+'(?:re|ve|ll|d|m)\b/gi },
  { id: 'question', severity: 'error', title: 'Question', detail: 'No rhetorical questions in Task 1: state the information.', re: /[^.!?\n]*\?/g },
  { id: 'subjective', severity: 'error', title: 'Interprets, does not report', detail: 'Words like "surprisingly" or "obviously" add opinion or outside knowledge. Report the data neutrally ("markedly", "The clear trend in the figures is that…").', re: new RegExp(`\\b(?:${SUBJECTIVE})\\b`, 'gi') },
  { id: 'passive-never', severity: 'error', title: 'Passive of an intransitive verb', detail: 'Rise, fall, occur, peak, decline and remain have no passive: "sales rose", never "sales were risen".', re: new RegExp(`\\b${BE}\\s+(?:\\w+ly\\s+)?(?:${NEVER_PASSIVE})\\b`, 'gi') },
  { id: 'passive-check', severity: 'warn', title: 'Passive of a change verb', detail: 'In data, increase, decrease, double and drop are intransitive ("sales increased"). The passive is right only when someone did it ("the car park was expanded").', re: new RegExp(`\\b${BE}\\s+(?:\\w+ly\\s+)?(?:${USUALLY_ACTIVE})\\b(?!\\s+(?:by\\s+(?:the|a|an)\\b|to\\s+make))`, 'gi') },
  { id: 'comprise-of', severity: 'error', title: '"Comprise" takes no "of"', detail: 'Write "The process comprises six stages" (or "consists of").', re: /\bcompris(?:e|es|ed|ing)\s+of\b/gi },
  { id: 'informal', severity: 'error', title: 'Informal register', detail: 'Use formal equivalents: considerably (not a lot), rose / fell (not went up / went down), slightly (not a bit).', re: new RegExp(`\\b(?:${INFORMAL})\\b`, 'gi') },
  { id: 'bycontrast', severity: 'error', title: '"By contrast" is two words', detail: 'Write "By contrast,".', re: /\bbycontrast\b/gi },
  { id: 'speculation', severity: 'warn', title: 'Explaining why?', detail: 'Task 1 reports what the visual shows; it does not explain causes. Check that this is not speculation.', re: new RegExp(`\\b(?:${SPECULATION})\\b`, 'gi') },
  { id: 'witnessed', severity: 'tip', title: '"Witnessed" is overused', detail: '"Saw" or "experienced" are safer: "The 1990s saw a sharp rise…".', re: /\bwitness(?:ed|es)?\b/gi },
];

const DRAMATIC = /\b(?:plummet(?:ed|s|ing)?|rocket(?:ed|s|ing)?|soar(?:ed|s|ing)?)\b/gi;
const MOVES = { rise: /\b(?:rise|rises|rose|risen|rising)\b/gi, increase: /\bincreas(?:e|es|ed|ing)\b/gi, fall: /\b(?:fall|falls|fell|fallen|falling)\b/gi, decrease: /\bdecreas(?:e|es|ed|ing)\b/gi };

function ruleMatches(rule, text) {
  if (rule.id === 'person') {
    // "I" only in capitals; "US" (the country) is not a pronoun.
    const found = [...findAll(text, /\bI\b/g), ...findAll(text, rule.re).filter((m) => m.text !== 'US')];
    return found.sort((a, b) => a.start - b.start);
  }
  return findAll(text, rule.re);
}

function lemmaOf(entry) {
  const p = markedParts(entry.text);
  return p ? p.answer : '';
}

// Bank phrases used in the answer, found with any word ending ("peaked at"
// for "peak at"). Short or B1 phrases are not counted.
function credits(text, entries) {
  const out = [];
  const seen = new Set();
  for (const e of entries) {
    if (e.level === 'B1') continue;
    const answer = lemmaOf(e);
    if (answer.length < 5 || /^(first|then|next|finally|by|in|of|from|at)$/i.test(answer)) continue;
    const parts = answer.split(/\s+/).map((w) => (w.length >= 4 ? `${esc(w).replace(/(e|es|s|ed|ing)$/i, '')}[\\p{L}]*` : esc(w)));
    const re = new RegExp(`(?<![\\p{L}])${parts.join('\\s+')}(?![\\p{L}])`, 'iu');
    const m = re.exec(text);
    if (!m) continue;
    const key = answer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ entryId: e.id, phrase: m[0], level: e.level, start: m.index, end: m.index + m[0].length });
  }
  const rank = { C1: 0, 'B2+': 1, B2: 2 };
  return out.sort((a, b) => (rank[a.level] ?? 3) - (rank[b.level] ?? 3));
}

// { words, issues, credits }. issues: [{ id, severity, title, detail, matches }],
// matches: [{ start, end, text }] in the original text.
export function checkEssay(text, { rubric = '', entries = [], minWords = 150 } = {}) {
  const raw = String(text ?? '');
  const t = raw.replace(APOS, "'");
  const words = countWords(t);
  const issues = [];
  const taken = [];
  const add = (issue) => {
    if (!issue.matches || issue.matches.length) issues.push(issue);
    for (const m of issue.matches || []) taken.push(m);
  };
  if (words < minWords) add({ id: 'length', severity: 'error', title: `Under ${minWords} words (${words})`, detail: 'An answer under 150 words loses marks for Task Achievement.' });
  if (words >= 60 && !OVERVIEW.test(t)) add({ id: 'overview', severity: 'error', title: 'No overview found', detail: 'Start a paragraph with "Overall," (or "In general,") and give the main trends or features, without figures.' });
  for (const rule of RULES) add({ id: rule.id, severity: rule.severity, title: rule.title, detail: rule.detail, matches: ruleMatches(rule, t) });
  const dramatic = findAll(t, DRAMATIC);
  if (dramatic.length > 1) add({ id: 'dramatic', severity: 'warn', title: 'Dramatic verbs used more than once', detail: 'Plummet, rocket and soar are journalistic: keep them for one genuinely extreme movement.', matches: dramatic.slice(1) });
  for (const [lemma, re] of Object.entries(MOVES)) {
    const hits = findAll(t, re);
    if (hits.length >= 4) add({ id: `repeat-${lemma}`, severity: 'tip', title: `"${lemma}" used ${hits.length} times`, detail: 'Vary the verbs and switch to nouns sometimes ("a sharp rise in…", "saw a decline").', matches: hits });
  }
  const firstSentence = t.split(/(?<=[.!?])\s+/)[0] || '';
  const rubricFirst = String(rubric).split(/(?<=[.!?])\s+/)[0] || '';
  if (rubricFirst && firstSentence.length > 20 && similarity(firstSentence, rubricFirst) >= 0.7) {
    add({ id: 'copied', severity: 'warn', title: 'Introduction repeats the question', detail: 'Paraphrase it: change the reporting verb ("illustrates", "sets out") and the wording of what is measured.', matches: [{ start: 0, end: firstSentence.length, text: firstSentence }] });
  }
  // ✗ forms from the knowledge bank, unless a built-in rule already flagged the same words.
  const overlaps = (m) => taken.some((x) => m.start < x.end && x.start < m.end);
  const fromBank = new Map();
  for (const e of entries) {
    for (const w of e.wrong || []) {
      const matches = findAll(t, phraseRe(w.replace(/[,.]$/, ''))).filter((m) => !overlaps(m));
      if (!matches.length) continue;
      const key = w.toLowerCase();
      if (fromBank.has(key)) continue;
      fromBank.set(key, true);
      add({ id: `bank-${e.id}-${key}`, severity: 'error', title: `“${w}”`, detail: `${e.note} Use: ${lemmaOf(e)}.`, matches, entryId: e.id });
    }
  }
  const order = { error: 0, warn: 1, tip: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { words, issues, credits: credits(t, entries) };
}

// Short titles of the rules one sentence breaks (used to vet imported examples).
export function lintSentence(sentence) {
  const t = String(sentence).replace(APOS, "'");
  return RULES.filter((r) => r.severity === 'error' && r.id !== 'question' && ruleMatches(r, t).length).map((r) => r.title);
}
