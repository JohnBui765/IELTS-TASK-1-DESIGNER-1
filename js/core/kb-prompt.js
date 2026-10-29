// The instructions for the knowledge extractor (Claude, in another chat or a
// Claude Project). Built from kb-schema.js so the prompt always matches what
// the importer accepts. docs/knowledge-format.md is generated from this file
// (node tools/build-docs.mjs).
import { KB_FORMAT, KINDS, LEVELS, MIN_EXAMPLES, SECTIONS, TYPES } from './kb-schema.js';

const quoteIds = (list) => list.map((x) => `"${x.id}"`).join(', ');
const describe = (list) => list.map((x) => `"${x.id}" (${x.help})`).join(', ');

const EXAMPLE = `{"format":"${KB_FORMAT}",
 "pack":{"title":"IELTS Expert – Unit 3","source":"the book or material, edition and unit","more":false},
 "entries":[{
   "kind":"phrase",
   "text":"The line graph [[sets out]] the main reasons people gave for moving.",
   "pattern":"",
   "types":["line","bar"],
   "section":"intro",
   "level":"C1",
   "risk":false,
   "note":"A precise, formal reporting verb; stronger than 'shows'.",
   "wrong":[],
   "verbatim":true,
   "page":"34",
   "examples":[
     {"text":"The bar chart [[sets out]] the amount of money spent on leisure in five countries in 2019.","from":"book","page":"36"},
     {"text":"The table [[sets out]] the number of international students at four Australian universities between 2010 and 2020.","from":"claude"},
     {"text":"The diagram [[sets out]] the main stages in the production of olive oil, from harvesting to bottling.","from":"claude"}]}]}`;

export const PROJECT_INSTRUCTIONS = `You are my IELTS Academic Writing Task 1 knowledge extractor. I study with an app called Task 1 Studio. I will send you material: coursebook pages (PDF or photos), answer keys, model answers, teacher notes, or feedback on my essays. Turn everything in it that a Task 1 writer can reuse into entries for the app, in the exact JSON format below.

WHAT TO EXTRACT
- Only language and rules usable in IELTS Academic Writing Task 1 (line graphs, bar charts, tables, pie charts, maps, processes, combined tasks). Skip Task 2 opinion and argument language and anything for Speaking, Reading or Listening. Linking language that also works in Task 1 is fine.
- Extract everything reusable in the material, not a sample: phrases and sentence frames, grammar structures, vocabulary and collocations, and rules (dos and don'ts, common errors). Use the answer key for exercise answers; never guess an answer.
- One entry is one learnable unit. Merge variants of the same item into one entry and mention the variants in "pattern" or "note". Split long lists, except a closed set that is best learned together (for example approximation words: just over, just under, roughly): make that one "lexis" entry whose "pattern" lists the set and whose examples each use a different member.
- If I paste entries I already have, do not repeat them.

THE FORMAT
Reply with ONE json code block and nothing else, like this:
\`\`\`json
${EXAMPLE}
\`\`\`

FIELDS
- kind: ${describe(KINDS)}.
- text: the item as it would be written, with EXACTLY ONE part in [[double brackets]]: the part worth drilling (the reporting verb, the linking phrase, the key words of the structure). Use X and Y for content the writer fills in ("The diagram [[illustrates]] how X is made."). For a rule, text is the correct version.
- pattern: for a structure, its formula ("with + noun + -ing participle"); for lexis, its forms and collocations ("rise (v) · a rise in (n) · rose sharply"); otherwise "".
- types: the task types it suits, any of ${quoteIds(TYPES)}, or ["all"].
- section: where it is used: ${describe(SECTIONS)}.
- level: ${describe(LEVELS)}. Judge the item itself, not the level of the book.
- risk: true when the item is valuable but easily misused, or risky in register.
- note: one or two plain sentences: when to use it, what it signals, and the mistake to avoid.
- wrong: wrong versions of the [[ ]] part, each a drop-in replacement, so that putting it in place of the bracketed words gives the typical wrong sentence (text "The process [[comprises]] six stages." → wrong ["comprises of"]). The app also searches my essays for these exact words, so each must be wrong wherever it appears ("comprises of", never just "of"). Use [] when there is none.
- verbatim: true only when text is copied word for word from the material. page: the printed page number it appears on, or "" when unknown. Never invent a page number.
- examples: AT LEAST ${MIN_EXAMPLES}, each one full sentence of 12 to 35 words as it would appear in a Task 1 answer, with exactly one [[ ]] around the words that realise the item (inflected forms are fine: "[[peaked at]]"). First give every sentence in the material that uses the item, especially from model answers, copied word for word, with "from":"book" and its "page". Then add sentences you write yourself, with "from":"claude", until there are at least ${MIN_EXAMPLES}. Set each of yours in a different Task 1 situation (a line graph, a map, a pie chart, a process…), with realistic figures, the tense its time frame needs, natural collocations, and at most one advanced structure per sentence. Never label your own sentence "book".

QUALITY
- British spelling. Formal and impersonal: no I, we or you, no contractions, no opinions, no speculation about causes.
- Every example must be something a Band 8 to 9 candidate would write. If you are not sure an item is correct or natural, say so in "note" and set "risk": true.
- Keep the entries in the order they appear in the material.

LONG MATERIAL
If one reply cannot hold everything, stop after a complete entry and set "more": true in "pack". I will write "continue"; then reply with a new JSON block in the same format containing only the remaining entries. When everything has been given, set "more": false.`;

// The prompt for a one-off chat: the instructions, plus what the learner
// already has (so the extractor skips it) and what to focus on.
export function buildExtractPrompt({ have = [], focus = '' } = {}) {
  const parts = [PROJECT_INSTRUCTIONS, '', 'MY MATERIAL is attached to this message.'];
  if (focus.trim()) parts.push(`Focus on: ${focus.trim()}.`);
  if (have.length) {
    parts.push('', `Entries I already have (${have.length}) — do not repeat them:`);
    have.forEach((t) => parts.push(`- ${t}`));
  }
  return parts.join('\n');
}
