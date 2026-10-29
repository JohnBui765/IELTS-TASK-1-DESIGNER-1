// Sentences with one key part marked for drills: "Sales [[peaked at]] 90,000."
// Every engine (charts, maps, processes, the knowledge bank) uses this markup.

const MARK = /\[\[([^[\]]+?)\]\]/g;

export function countMarks(text) {
  return (String(text).match(MARK) || []).length;
}

// { before, answer, after } for a sentence with exactly one mark, else null.
export function markedParts(text) {
  const s = String(text);
  if (countMarks(s) !== 1) return null;
  const m = /\[\[([^[\]]+?)\]\]/.exec(s);
  return { before: s.slice(0, m.index), answer: m[1].trim(), after: s.slice(m.index + m[0].length) };
}

export function stripMarks(text) {
  return String(text).replace(MARK, '$1');
}

// Wraps the first case-insensitive, whole-word occurrence of `phrase` in
// [[ ]]. Returns null when the phrase is not in the text.
export function markPhrase(text, phrase) {
  const p = String(phrase).trim();
  if (!p) return null;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[1].length;
  return `${text.slice(0, start)}[[${m[2]}]]${text.slice(start + m[2].length)}`;
}
