// Prompts for the Claude app ("copy, paste into Claude, paste the reply
// back"): feedback on an answer, a model answer, a new task. No API key and no
// cost beyond the learner's own Claude plan.
import { INSTRUCTIONS } from './tasks.js';
import { KB_FORMAT, KINDS, LEVELS, MIN_EXAMPLES, SECTIONS, TYPES } from './kb-schema.js';
import { stripMarks } from './marked.js';

const ids = (list) => list.map((x) => x.id).join(', ');

// The figures, exactly, so Claude checks accuracy against the real data.
export function dataSummary(task) {
  const out = [];
  for (const v of task.visuals) {
    if (v.kind === 'pie') {
      out.push(`${v.title} (pie chart${v.pies.length > 1 ? 's' : ''}, %):`);
      for (const p of v.pies) out.push(`  ${p.label || 'All'}: ${p.slices.map((s) => `${s.name} ${s.value}%`).join(', ')}`);
    } else if (v.kind === 'map') {
      const names = (fs) => fs.map((f) => `${f.label || f.type} (${f.type}, x${f.x} y${f.y}, ${f.w}×${f.h})`).join('; ');
      out.push(`${v.place} — map 1 (${v.before.label}): ${names(v.before.features)}`);
      out.push(`map 2 (${v.after.label}): ${names(v.after.features)}`);
      out.push('Grid: x grows to the east, y grows to the south (north is at the top).');
    } else if (v.kind === 'process') {
      out.push(`${v.title} (${v.cycle ? 'a cycle' : 'a linear process'}), ${v.steps.length} stages:`);
      v.steps.forEach((s, i) => out.push(`  ${i + 1}. ${s.label}${s.detail ? ` — ${s.detail}` : ''}`));
    } else {
      const unit = v.unit?.kind === 'percent' ? '%' : v.unit?.kind === 'currency' ? v.unit.symbol : v.unit?.label || '';
      out.push(`${v.title} (${v.kind === 'line' ? 'line graph' : v.kind === 'bar' ? 'bar chart' : 'table'}${unit ? `, ${unit}` : ''}):`);
      out.push(`  ${v.x.kind === 'category' ? 'Categories' : 'Points'}: ${v.x.values.join(', ')}${v.x.projectedFrom != null ? ` (from ${v.x.values[v.x.projectedFrom]} the figures are projections)` : ''}`);
      for (const s of v.series) out.push(`  ${s.name}: ${s.values.join(', ')}`);
    }
  }
  return out.join('\n');
}

function packFormat(title) {
  return `{"format":"${KB_FORMAT}","pack":{"title":"${title.replace(/"/g, "'")}","source":"Claude feedback on my answer","more":false},"entries":[{"kind":"rule","text":"The process [[comprises]] six stages.","pattern":"","types":["process"],"section":"overview","level":"C1","risk":false,"note":"'Comprise' takes no 'of'.","wrong":["comprises of"],"verbatim":false,"page":"","examples":[{"text":"…[[…]]…","from":"claude"}]}]}`;
}

const ENTRY_RULES = `Entry rules: kind is one of ${ids(KINDS)}; text has EXACTLY ONE part in [[double brackets]] (the part to drill); types are any of ${ids(TYPES)} (or ["all"]); section is one of ${ids(SECTIONS)}; level is one of ${ids(LEVELS)}; "wrong" lists wrong versions of the bracketed part, each a drop-in replacement and specific enough to be wrong wherever it appears; at least ${MIN_EXAMPLES} examples, each one full Task 1 sentence (12 to 35 words) with exactly one [[ ]], from "claude"; British spelling; formal and impersonal.`;

export function feedbackPrompt(task, essay, words) {
  return `You are an experienced IELTS examiner. Assess my answer to this IELTS Academic Writing Task 1 strictly and specifically.

THE TASK
${task.rubric}
${INSTRUCTIONS}
Write at least 150 words.

THE EXACT DATA
${dataSummary(task)}

MY ANSWER (${words} words)
${essay.trim()}

PLEASE GIVE
1. A band (0–9, halves allowed) for Task Achievement, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy, with the reasons for each, and an overall estimate.
2. Every error as: what I wrote → the correction → why. Check every figure against the data.
3. Whether my overview is clear and whether I selected the key features and made comparisons where relevant.
4. My weakest paragraph rewritten at Band 8–9.

THEN, at the very end, put my repeated mistakes (as "rule" entries with their wrong forms) and the three best upgrades for my writing into ONE json code block for my study app, in this format:
\`\`\`json
${packFormat(`Feedback – ${task.title}`)}
\`\`\`
${ENTRY_RULES}`;
}

export function modelAnswerPrompt(task) {
  return `Write a Band 9 model answer to this IELTS Academic Writing Task 1.

THE TASK
${task.rubric}
${INSTRUCTIONS}
Write at least 150 words.

THE EXACT DATA
${dataSummary(task)}

RULES
- 170 to 190 words, four paragraphs: introduction (paraphrase the task, never copy it), overview (the main trends or features, no figures), and two body paragraphs that group the data by pattern and support it with accurate figures.
- Formal, impersonal, British spelling. No opinions and no speculation about causes. Use the tense the time frame needs.
- Mark 10 to 14 phrases worth learning with [[double brackets]] (reporting verbs, overview frames, trend language, comparison and proportion language, linking). At most one [[ ]] per sentence.
- Reply with the answer only, inside one text code block.`;
}

// The model answer split into drill sentences: each keeps one [[ ]].
export function modelSentences(text) {
  const clean = String(text).replace(/```[a-z]*\n?|```/g, '').trim();
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z“"(\[])/);
  const out = [];
  for (const s of sentences) {
    const marks = s.match(/\[\[[^[\]]+?\]\]/g) || [];
    marks.forEach((m) => {
      const only = stripMarks(s.replace(m, '\u0000')).replace('\u0000', m);
      out.push(only);
    });
  }
  return { text: clean, sentences: out };
}
