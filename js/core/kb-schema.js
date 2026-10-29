// The knowledge format, version 1 ("task1-kb/1"). Frozen: packs made with
// these names must keep importing. Add values only; never rename one.

export const KB_FORMAT = 'task1-kb/1';

export const KINDS = Object.freeze([
  { id: 'phrase', label: 'Phrase', help: 'a reusable phrase or sentence frame' },
  { id: 'structure', label: 'Structure', help: 'a grammar pattern' },
  { id: 'lexis', label: 'Lexis', help: 'a word, collocation or closed word set' },
  { id: 'rule', label: 'Rule', help: 'a do or don’t' },
]);

export const TYPES = Object.freeze([
  { id: 'line', label: 'Line graph' },
  { id: 'bar', label: 'Bar chart' },
  { id: 'table', label: 'Table' },
  { id: 'pie', label: 'Pie chart' },
  { id: 'map', label: 'Maps' },
  { id: 'process', label: 'Process' },
  { id: 'mixed', label: 'Two visuals' },
]);

export const SECTIONS = Object.freeze([
  { id: 'intro', label: 'Introduction', help: 'introducing and paraphrasing the task' },
  { id: 'overview', label: 'Overview', help: 'the main features' },
  { id: 'trend', label: 'Trends', help: 'change over time' },
  { id: 'comparison', label: 'Comparison', help: 'comparing and contrasting figures' },
  { id: 'proportion', label: 'Proportion', help: 'shares and percentages' },
  { id: 'figures', label: 'Figures', help: 'numbers, approximation, prepositions with figures' },
  { id: 'sequence', label: 'Sequence', help: 'process stages' },
  { id: 'change', label: 'Map changes', help: 'how a place changed' },
  { id: 'location', label: 'Location', help: 'places on a map' },
  { id: 'tense', label: 'Tense', help: 'choosing tenses' },
  { id: 'linking', label: 'Linking', help: 'cohesion and paragraph hinges' },
  { id: 'summary', label: 'Summary', help: 'closing sentences' },
  { id: 'general', label: 'General', help: 'tone, register, rules that apply everywhere' },
]);

export const LEVELS = Object.freeze([
  { id: 'B1', label: 'B1', help: 'correct but basic' },
  { id: 'B2', label: 'B2', help: 'the working register of a good answer' },
  { id: 'B2+', label: 'B2+', help: 'strong B2' },
  { id: 'C1', label: 'C1', help: 'nominalisation, participle clauses, clefts, apposition and other advanced control' },
]);

export const MIN_EXAMPLES = 3;

const ids = (list) => new Set(list.map((x) => x.id));
export const KIND_IDS = ids(KINDS);
export const TYPE_IDS = ids(TYPES);
export const SECTION_IDS = ids(SECTIONS);
export const LEVEL_IDS = ids(LEVELS);

export const labelOf = (list, id) => list.find((x) => x.id === id)?.label || id;
