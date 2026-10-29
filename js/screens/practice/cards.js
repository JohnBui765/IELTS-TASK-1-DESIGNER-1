// Drill card renderers. render(card, ctx) → { el, focus?, check() → Result | null,
// grade?(correct) → Result, primaryLabel?, readyInitially? } — the contract
// practice.js runs (the same as Vocab Studio's mode modules).
// Result = { correct, close?, hinted?, feedback?: { title?, detail? } }
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { badge, textField } from '../../ui/components.js';
import { gradeTyped, fullSentence } from '../../core/drills.js';
import { labelOf, SECTIONS } from '../../core/kb-schema.js';
import { keepVisible } from '../../ui/viewport.js';

const CAPTION = { type: 'Fill the gap', choose: 'Choose the missing words', spot: 'Which is correct?', recall: 'Say it, then reveal' };

function head(card) {
  const level = card.hint?.level;
  return h(
    'div',
    { class: 'cz-head' },
    h('span', { class: 'cz-caption' }, CAPTION[card.type]),
    h('span', { class: 'dr-tags' }, card.hint?.section ? badge(labelOf(SECTIONS, card.hint.section)) : null, level ? badge(level, level === 'C1' ? 'purple' : 'blue') : null),
  );
}

function sentence(parts, blank) {
  return h('p', { class: 'cz-sentence' }, parts.before, blank, parts.after);
}

function noteBox(card) {
  const { note, pattern } = card.hint || {};
  if (!note && !pattern) return null;
  return h(
    'div',
    { class: 'cz-callout dr-note', hidden: true },
    icon('lightbulb', { size: 18 }),
    h('div', { class: 'cz-callout-text' }, pattern ? h('p', { class: 'dr-pattern' }, pattern) : null, note ? h('p', null, note) : null),
  );
}

function speakButton(ctx, text) {
  return h('button', { type: 'button', class: 'icon-btn cz-speak', 'aria-label': 'Read aloud', onClick: () => ctx.speak(text) }, icon('speaker'));
}

/* ---------- type the missing words ---------- */

function typeCard(card, ctx) {
  const { parts } = card;
  const blank = h('span', { class: 'cz-blank', style: { '--cz-w': `${Math.max(3, Math.min(14, parts.answer.length * 0.62))}em` } }, ' ');
  let hintLevel = 0;
  const hints = h('div', { class: 'dr-hints' });
  const note = noteBox(card);
  const field = textField({
    answer: true,
    placeholder: 'Type the missing words',
    enterkeyhint: 'done',
    className: 'cz-field',
    onInput: (v) => {
      blank.textContent = v || ' ';
      blank.classList.toggle('filled', !!v.trim());
      ctx.setReady(!!v.trim());
    },
    onEnter: () => ctx.submit(),
  });
  const hintBtn = h(
    'button',
    {
      type: 'button',
      class: 'cz-hint-btn',
      onClick: () => {
        hintLevel++;
        const words = parts.answer.split(/\s+/);
        const lines = [];
        if (card.hint?.pattern) lines.push(card.hint.pattern);
        lines.push(`${words.length} ${words.length === 1 ? 'word' : 'words'}, starting “${parts.answer.slice(0, Math.min(hintLevel, parts.answer.length))}…”`);
        hints.replaceChildren(...lines.map((t) => h('p', null, t)));
        if (hintLevel >= 3) hintBtn.disabled = true;
        field.focus();
      },
    },
    icon('lightbulb', { size: 16 }),
    'Hint',
  );
  const el = h('div', { class: 'cz-card card' }, head(card), sentence(parts, blank), field, h('div', { class: 'dr-row' }, hintBtn), hints, note);
  return {
    el,
    focus: () => {
      field.focus();
      keepVisible(field);
    },
    check() {
      const typed = field.value;
      if (!typed.trim()) return null;
      const r = gradeTyped(typed, parts.answer);
      field.readOnly = true;
      blank.textContent = parts.answer;
      blank.classList.add(r.correct ? 'is-right' : 'is-wrong');
      if (note) note.hidden = false;
      el.appendChild(h('div', { class: 'dr-full' }, speakButton(ctx, fullSentence(parts)), h('span', null, 'Listen')));
      ctx.autoSpeak(fullSentence(parts));
      return {
        correct: r.correct,
        close: !r.correct && r.close,
        hinted: r.correct && hintLevel > 0,
        feedback: r.correct ? {} : { title: r.close ? 'Almost — check the spelling and the form' : 'Not quite', detail: `Answer: ${parts.answer}` },
      };
    },
  };
}

/* ---------- choose ---------- */

function chooseCard(card, ctx) {
  const { parts } = card;
  let picked = null;
  const blank = h('span', { class: 'cz-blank' }, ' ');
  const note = noteBox(card);
  const chips = card.options.map((opt) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip',
        onClick: () => {
          if (el.classList.contains('checked')) return;
          picked = opt;
          chips.forEach((c) => c.classList.toggle('selected', c === chipFor(opt)));
          blank.textContent = opt;
          blank.classList.add('filled');
          ctx.setReady(true);
        },
      },
      opt,
    ),
  );
  const chipFor = (opt) => chips[card.options.indexOf(opt)];
  const el = h('div', { class: 'dr-choose' }, h('div', { class: 'cz-card card' }, head(card), sentence(parts, blank), note), h('div', { class: 'cz-bank' }, chips));
  return {
    el,
    check() {
      if (!picked) return null;
      const correct = picked === parts.answer;
      chips.forEach((c, i) => {
        c.disabled = true;
        if (card.options[i] === parts.answer) c.classList.add('right');
        else if (card.options[i] === picked) c.classList.add('wrong');
      });
      blank.textContent = parts.answer;
      blank.classList.add(correct ? 'is-right' : 'is-wrong');
      if (note) note.hidden = false;
      ctx.autoSpeak(fullSentence(parts));
      return { correct, feedback: correct ? {} : { detail: `Answer: ${parts.answer}` } };
    },
  };
}

/* ---------- spot the error ---------- */

function spotCard(card, ctx) {
  const choices = card.flip ? [card.wrong, card.right] : [card.right, card.wrong];
  let picked = -1;
  const note = noteBox(card);
  const buttons = choices.map((text, i) =>
    h(
      'button',
      {
        type: 'button',
        class: 'dr-option card',
        onClick: () => {
          if (el.classList.contains('checked')) return;
          picked = i;
          buttons.forEach((b, j) => b.classList.toggle('selected', j === i));
          ctx.setReady(true);
        },
      },
      h('span', { class: 'dr-letter' }, i ? 'B' : 'A'),
      h('span', null, text),
    ),
  );
  const el = h('div', { class: 'dr-spot' }, h('div', { class: 'cz-card card' }, head(card), h('p', { class: 'dr-prompt' }, 'One of these breaks a rule. Tap the correct one.'), note), buttons);
  return {
    el,
    check() {
      if (picked < 0) return null;
      const correct = choices[picked] === card.right;
      buttons.forEach((b, j) => {
        b.disabled = true;
        b.classList.add(choices[j] === card.right ? 'is-right' : 'is-wrong');
      });
      if (note) note.hidden = false;
      return { correct, feedback: correct ? { detail: `Not “${card.wrongPart}”.` } : { detail: `Correct: ${card.parts.answer} — not “${card.wrongPart}”.` } };
    },
  };
}

/* ---------- say it, then reveal (self-graded) ---------- */

function recallCard(card, ctx) {
  const { parts } = card;
  const blank = h('span', { class: 'cz-blank' }, ' '.repeat(6));
  const note = noteBox(card);
  if (note) note.hidden = false;
  const el = h('div', { class: 'cz-card card' }, head(card), sentence(parts, blank), note);
  return {
    el,
    primaryLabel: 'Show answer',
    readyInitially: true,
    check() {
      blank.textContent = parts.answer;
      blank.classList.add('filled');
      el.appendChild(h('div', { class: 'dr-full' }, speakButton(ctx, fullSentence(parts)), h('span', null, 'Did you say it?')));
      ctx.autoSpeak(fullSentence(parts));
      ctx.showGradeButtons();
      return null;
    },
    grade: (correct) => ({ correct, feedback: correct ? {} : { detail: `Answer: ${parts.answer}` } }),
  };
}

const RENDERERS = { type: typeCard, choose: chooseCard, spot: spotCard, recall: recallCard };

export function render(card, ctx) {
  return RENDERERS[card.type](card, ctx);
}
