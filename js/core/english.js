// English helpers shared by the language engines (charts, maps, processes):
// verb forms in every tense Task 1 needs, active and passive, plus lists,
// articles and numbers. British spelling throughout (levelled, modernised).

// base: [past, past participle]
const IRREGULAR = {
  arise: ['arose', 'arisen'], beat: ['beat', 'beaten'], become: ['became', 'become'], bind: ['bound', 'bound'],
  blow: ['blew', 'blown'], break: ['broke', 'broken'], bring: ['brought', 'brought'], build: ['built', 'built'],
  buy: ['bought', 'bought'], choose: ['chose', 'chosen'], come: ['came', 'come'], cut: ['cut', 'cut'],
  dig: ['dug', 'dug'], do: ['did', 'done'], draw: ['drew', 'drawn'], drink: ['drank', 'drunk'],
  drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feed: ['fed', 'fed'],
  find: ['found', 'found'], fly: ['flew', 'flown'], forecast: ['forecast', 'forecast'], freeze: ['froze', 'frozen'],
  get: ['got', 'got'], give: ['gave', 'given'], go: ['went', 'gone'], grind: ['ground', 'ground'],
  grow: ['grew', 'grown'], hang: ['hung', 'hung'], have: ['had', 'had'], hit: ['hit', 'hit'], hold: ['held', 'held'],
  keep: ['kept', 'kept'], lay: ['laid', 'laid'], lead: ['led', 'led'], leave: ['left', 'left'], let: ['let', 'let'],
  light: ['lit', 'lit'], lose: ['lost', 'lost'], make: ['made', 'made'], meet: ['met', 'met'],
  overtake: ['overtook', 'overtaken'], pay: ['paid', 'paid'], put: ['put', 'put'], read: ['read', 'read'],
  rebuild: ['rebuilt', 'rebuilt'], ride: ['rode', 'ridden'], rise: ['rose', 'risen'], run: ['ran', 'run'],
  see: ['saw', 'seen'], seek: ['sought', 'sought'], sell: ['sold', 'sold'], send: ['sent', 'sent'], set: ['set', 'set'],
  shake: ['shook', 'shaken'], show: ['showed', 'shown'], shrink: ['shrank', 'shrunk'], shut: ['shut', 'shut'],
  sink: ['sank', 'sunk'], sit: ['sat', 'sat'], slide: ['slid', 'slid'], spend: ['spent', 'spent'], spin: ['spun', 'spun'],
  split: ['split', 'split'], spread: ['spread', 'spread'], stand: ['stood', 'stood'], stick: ['stuck', 'stuck'],
  strike: ['struck', 'struck'], sweep: ['swept', 'swept'], swim: ['swam', 'swum'], take: ['took', 'taken'],
  teach: ['taught', 'taught'], tear: ['tore', 'torn'], tell: ['told', 'told'], think: ['thought', 'thought'],
  throw: ['threw', 'thrown'], undergo: ['underwent', 'undergone'], understand: ['understood', 'understood'],
  wear: ['wore', 'worn'], weave: ['wove', 'woven'], win: ['won', 'won'], wind: ['wound', 'wound'],
  withdraw: ['withdrew', 'withdrawn'], write: ['wrote', 'written'],
};

// Final consonant doubled before -ed / -ing (British: travel → travelled).
const DOUBLE = new Set(
  ('admit ban can cancel channel chop commit compel control cram dam dial dim dip distil drop equal expel fit ' +
    'fuel fulfil funnel grip hug instil jam knit label level map marshal model mop occur patrol pedal permit pin ' +
    'plan plot plug pop prefer propel quarrel refer rival rub sag ship shop shovel signal skim slim slip snap spiral ' +
    'spot step stir stop strip swap tag tap tip top total transfer trap travel trim tunnel wrap').split(' '),
);

const VOWEL = /[aeiou]/;

function splitPhrasal(verb) {
  const i = verb.indexOf(' ');
  return i < 0 ? [verb, ''] : [verb.slice(0, i), verb.slice(i)];
}

function regularPast(w) {
  if (w.endsWith('e')) return w + 'd';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
  if (DOUBLE.has(w)) return w + w.slice(-1) + 'ed';
  return w + 'ed';
}

function thirdPerson(w) {
  if (w === 'have') return 'has';
  if (w === 'be') return 'is';
  if (w === 'do' || w === 'go' || w === 'undergo') return w + 'es';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|sh|ch|x|z)$/.test(w)) return w + 'es';
  return w + 's';
}

function ingForm(w) {
  if (w === 'be') return 'being';
  if (w.endsWith('ie')) return w.slice(0, -2) + 'ying';
  if (w.endsWith('e') && !/(ee|oe|ye)$/.test(w) && w.length > 2) return w.slice(0, -1) + 'ing';
  if (DOUBLE.has(w)) return w + w.slice(-1) + 'ing';
  return w + 'ing';
}

// { base, s, past, pp, ing } — a phrasal verb inflects its first word only
// ("level off" → "levelled off").
export function forms(verb) {
  const [head, rest] = splitPhrasal(String(verb).trim());
  const irr = IRREGULAR[head];
  const past = head === 'be' ? 'was' : irr ? irr[0] : regularPast(head);
  const pp = head === 'be' ? 'been' : irr ? irr[1] : regularPast(head);
  return {
    base: head + rest,
    s: thirdPerson(head) + rest,
    past: past + rest,
    pp: pp + rest,
    ing: ingForm(head) + rest,
  };
}

export const TENSES = Object.freeze([
  'present', 'past', 'presentPerfect', 'pastPerfect', 'future', 'futurePerfect', 'expected', 'projected', 'goingTo', 'toBe',
]);

const AGREE = { 'have to': ['has to', 'have to'], 'need to': ['needs to', 'need to'] };

// A finite verb phrase. tense: one of TENSES; voice: 'active' | 'passive';
// modal (optional): 'can' | 'must' | 'should' | 'may' | 'have to' | 'need to'
// — it replaces the tense. The adverb goes after an active verb ("rose
// sharply") and before the participle of a passive ("was completely
// demolished").
export function verbPhrase(verb, { tense = 'past', voice = 'active', plural = false, adverb = '', modal = '' } = {}) {
  const f = forms(verb);
  const adv = adverb ? ' ' + adverb : '';
  const be = plural ? 'are' : 'is';
  // "be" is the one verb whose plural differs from its base form and its past.
  const pluralBe = plural && /^be(\s|$)/.test(f.base);
  if (modal) {
    const m = AGREE[modal] ? AGREE[modal][plural ? 1 : 0] : modal;
    return voice === 'passive' ? `${m} be${adv} ${f.pp}` : `${m} ${f.base}${adv}`;
  }
  if (voice === 'passive') {
    const aux = {
      present: be,
      past: plural ? 'were' : 'was',
      presentPerfect: plural ? 'have been' : 'has been',
      pastPerfect: 'had been',
      future: 'will be',
      futurePerfect: 'will have been',
      expected: `${be} expected to be`,
      projected: `${be} projected to be`,
      goingTo: `${be} going to be`,
      toBe: `${be} to be`,
    }[tense];
    if (!aux) throw new Error(`Unknown tense "${tense}"`);
    return `${aux}${adv} ${f.pp}`;
  }
  const head = {
    present: plural ? (pluralBe ? f.base.replace(/^be/, 'are') : f.base) : f.s,
    past: pluralBe ? f.past.replace(/^was/, 'were') : f.past,
    presentPerfect: `${plural ? 'have' : 'has'} ${f.pp}`,
    pastPerfect: `had ${f.pp}`,
    future: `will ${f.base}`,
    futurePerfect: `will have ${f.pp}`,
    expected: `${be} expected to ${f.base}`,
    projected: `${be} projected to ${f.base}`,
    goingTo: `${be} going to ${f.base}`,
    toBe: `${be} to ${f.base}`,
  }[tense];
  if (!head) throw new Error(`Unknown tense "${tense}"`);
  return head + adv;
}

/* ---------- words and numbers ---------- */

// "A", "A and B", "A, B and C" (no serial comma, British style).
export function joinList(items, conj = 'and') {
  const xs = items.filter((x) => x !== '' && x !== null && x !== undefined).map(String);
  if (xs.length < 2) return xs[0] || '';
  return `${xs.slice(0, -1).join(', ')} ${conj} ${xs[xs.length - 1]}`;
}

const AN_WORDS = /^(hour|honest|honour|honor|heir)/i;
const A_WORDS = /^(uni|use|usu|uti|ure|euro|eu|one|once|ufo|u-|ewe)/i;

// "a" or "an" for the phrase that follows it ("an 8% rise", "a university").
export function article(phrase) {
  const s = String(phrase).trim().replace(/^[^\w]+/, '');
  if (/^\d/.test(s)) {
    const n = s.match(/^\d+/)[0];
    if (n.startsWith('8')) return 'an';
    if ((n.startsWith('11') || n.startsWith('18')) && n.length % 3 === 2) return 'an';
    return 'a';
  }
  if (AN_WORDS.test(s)) return 'an';
  if (A_WORDS.test(s)) return 'a';
  return VOWEL.test(s.charAt(0).toLowerCase()) ? 'an' : 'a';
}

export function withArticle(phrase) {
  return `${article(phrase)} ${phrase}`;
}

export function capitalise(s) {
  const str = String(s);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const SMALL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const ORDINAL = 'zeroth first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth'.split(' ');

// Words for 0–20 (formal writing spells small counts out), digits above.
export function numberWord(n) {
  return Number.isInteger(n) && n >= 0 && n <= 20 ? SMALL[n] : String(n);
}

export function ordinalWord(n) {
  return ORDINAL[n] || `${n}th`;
}

// 90000 → "90,000"; 3.456 with decimals 1 → "3.5". Deterministic (no Intl).
export function fmtNumber(value, decimals = 0) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (value < 0 ? '-' : '') + grouped + (frac && /[1-9]/.test(frac) ? '.' + frac : '');
}

const PLURAL_IRREGULAR = { person: 'people', child: 'children', man: 'men', woman: 'women', mouse: 'mice', foot: 'feet', tooth: 'teeth', sheep: 'sheep', fish: 'fish', series: 'series', species: 'species' };

export function pluralNoun(noun) {
  const n = String(noun);
  if (PLURAL_IRREGULAR[n]) return PLURAL_IRREGULAR[n];
  if (/[^aeiou]y$/.test(n)) return n.slice(0, -1) + 'ies';
  if (/(s|sh|ch|x|z)$/.test(n)) return n + 'es';
  return n + 's';
}

// "between 1990 and 2020" style period phrases. `to` may be a word ("today").
export function periodPhrases(from, to) {
  const out = [`between ${from} and ${to}`, `from ${from} to ${to}`];
  const a = Number(from);
  const b = Number(to);
  if (Number.isInteger(a) && Number.isInteger(b) && b > a) out.push(`over the ${b - a}-year period from ${from} to ${to}`);
  return out;
}
