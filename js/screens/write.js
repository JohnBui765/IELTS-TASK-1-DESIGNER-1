// Writing an answer: a 20-minute timer that starts with the first keystroke,
// a live word count, autosave, the question and chart a tap away, and the
// checker (the rules from CLAUDE-task1.md plus every ✗ form in the bank).
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, button, sheet, toast, alert, badge, emptyState } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { checkEssay, countWords } from '../core/lint.js';
import { INSTRUCTIONS } from '../core/tasks.js';
import { feedbackPrompt } from '../core/claude-prompts.js';
import { copyText } from '../ui/clipboard.js';
import { uid, debounce } from '../core/util.js';
import { renderVisual } from './shared.js';

const fmtTime = (s) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`;

export default async function create({ taskId }) {
  const task = await store.getTask(taskId);
  if (!task) {
    const view = screen({ title: 'Write', back: { label: 'Back' }, body: [emptyState({ icon: 'pencil', title: 'Task not found', message: 'It may have been deleted.' })] });
    return { el: view.el, missing: true };
  }
  const minutes = store.settings().writeMinutes || 20;
  const drafts = (await store.getAttempts(taskId)).filter((a) => !a.done);
  let attempt = drafts[0] || { id: uid(), taskId, text: '', words: 0, seconds: 0, startedAt: null, done: false };

  const timeEl = h('span', { class: 'w-time tabular' }, fmtTime(minutes * 60 - attempt.seconds));
  const wordsEl = h('span', { class: 'w-words tabular' });
  const area = h('textarea', {
    class: 'w-area',
    placeholder: 'Write your answer here…',
    autocapitalize: 'sentences',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Your answer',
  });
  area.value = attempt.text;
  const results = h('div', { class: 'w-results', 'aria-live': 'polite' });

  let ticking = null;
  let last = Date.now();
  const tick = () => {
    const now = Date.now();
    if (document.visibilityState === 'visible') attempt.seconds += Math.round((now - last) / 1000);
    last = now;
    const left = minutes * 60 - attempt.seconds;
    timeEl.textContent = fmtTime(left);
    timeEl.classList.toggle('over', left < 0);
    timeEl.classList.toggle('low', left >= 0 && left < 120);
    if (left === 0) toast('Time is up — finish your sentence and check your answer.', { icon: 'clock', tone: 'orange', duration: 4000 });
  };
  const startTimer = () => {
    if (ticking || attempt.done) return;
    attempt.startedAt = attempt.startedAt || Date.now();
    last = Date.now();
    ticking = setInterval(tick, 1000);
  };

  const updateCount = () => {
    const n = countWords(area.value);
    wordsEl.textContent = `${n} ${n === 1 ? 'word' : 'words'}`;
    wordsEl.classList.toggle('enough', n >= 150);
  };

  const persist = async () => {
    attempt.text = area.value;
    attempt.words = countWords(area.value);
    if (!attempt.text.trim() && !drafts.length) return;
    attempt = await store.saveAttempt(attempt);
  };
  const autosave = debounce(() => persist().catch((err) => console.error(err)), 800);

  area.addEventListener('input', () => {
    startTimer();
    updateCount();
    autosave();
  });

  function selectRange(start, end) {
    area.focus();
    area.setSelectionRange(start, end);
  }

  function renderResults(res) {
    const errors = res.issues.filter((i) => i.severity === 'error').length;
    const warns = res.issues.length - errors;
    replaceChildren(results,
      h(
        'div',
        { class: 'w-summary card' },
        h('div', { class: 'w-summary-title' }, errors ? `${errors} to fix` : 'No rule broken', warns ? h('span', { class: 'w-summary-sub' }, ` · ${warns} to check`) : null),
        h('p', { class: 'w-summary-note' }, 'The checker applies the rules from your reference and your knowledge bank. It does not give a band score — ask Claude for that below.'),
      ),
      ...res.issues.map((i) =>
        h(
          'div',
          { class: ['w-issue', 'card', i.severity] },
          h('div', { class: 'w-issue-head' }, icon(i.severity === 'error' ? 'xCircle' : i.severity === 'warn' ? 'warning' : 'lightbulb', { size: 18 }), h('strong', null, i.title)),
          h('p', null, i.detail),
          i.matches?.length
            ? h(
              'div',
              { class: 'w-matches' },
              i.matches.slice(0, 6).map((m) => h('button', { type: 'button', class: 'chip', onClick: () => selectRange(m.start, m.end) }, `“${m.text.trim().slice(0, 40)}”`)),
            )
            : null,
        ),
      ),
      res.credits.length
        ? h(
          'div',
          { class: 'w-credits card' },
          h('div', { class: 'w-issue-head' }, icon('star', { size: 18 }), h('strong', null, `Phrases from your bank (${res.credits.length})`)),
          h('div', { class: 'w-matches' }, res.credits.map((c) => h('button', { type: 'button', class: 'chip', onClick: () => push('entry', { entryId: c.entryId }) }, c.phrase, ' ', badge(c.level, c.level === 'C1' ? 'purple' : 'blue')))),
        )
        : null,
      h(
        'div',
        { class: 'w-claude card' },
        h('div', { class: 'w-issue-head' }, icon('sparkles', { size: 18 }), h('strong', null, 'Band feedback from Claude')),
        h('p', null, 'Copies your answer with the exact data. Paste it into the Claude app; the reply ends with a block you can add to Knowledge.'),
        button({
          label: 'Copy feedback prompt',
          icon: 'copy',
          variant: 'secondary',
          onTap: async () => {
            if (await copyText(feedbackPrompt(task, area.value, countWords(area.value)))) toast('Prompt copied — paste it into Claude', { icon: 'copy' });
          },
        }),
      ),
    );
  }

  async function check() {
    await persist();
    const res = checkEssay(area.value, { rubric: task.rubric, entries: await store.getAllEntries() });
    renderResults(res);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return res;
  }

  async function finish() {
    if (countWords(area.value) < 20) {
      toast('Write your answer first.', { icon: 'pencil', tone: 'orange' });
      return;
    }
    clearInterval(ticking);
    ticking = null;
    const res = await check();
    attempt.done = true;
    attempt.issues = res.issues.filter((i) => i.severity === 'error').length;
    attempt = await store.saveAttempt(attempt);
    await store.addHistory({ kind: 'write', taskId, words: attempt.words, seconds: attempt.seconds });
    await alert({ title: 'Answer saved', message: `${attempt.words} words in ${fmtTime(attempt.seconds)}. Your checker results are below.` });
  }

  async function showTask() {
    const box = h('div', { class: 'w-sheet' }, h('p', { class: 'rubric-main' }, task.rubric), h('p', null, INSTRUCTIONS));
    const s = sheet({ title: 'The task', content: [box] });
    for (const v of task.visuals) {
      const comp = await renderVisual(v, {});
      box.appendChild(h('div', { class: 'card visual-card' }, comp.el));
    }
    await s.closed;
  }

  updateCount();
  const view = screen({
    title: 'Write',
    largeTitle: false,
    back: { label: 'Task' },
    className: 'write-screen',
    actions: [{ icon: 'chartLine', label: 'Show the task', onTap: showTask }],
    body: [
      h('div', { class: 'w-bar' }, h('span', { class: 'w-clock' }, icon('clock', { size: 16 }), timeEl), wordsEl),
      h('p', { class: 'w-question' }, task.rubric),
      area,
      results,
    ],
    footer: [
      button({ label: 'Check', icon: 'checkCircle', variant: 'secondary', size: 'large', onTap: () => check() }),
      button({ label: 'Finish', icon: 'check', size: 'large', onTap: () => finish() }),
    ],
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') persist().catch(() => {});
  };
  document.addEventListener('visibilitychange', onHide);

  return {
    el: view.el,
    title: 'Write',
    async beforeLeave() {
      await persist();
      return true;
    },
    onDestroy() {
      clearInterval(ticking);
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}

