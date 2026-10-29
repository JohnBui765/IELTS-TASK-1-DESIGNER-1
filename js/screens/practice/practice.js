// Practice: a full-screen modal that runs drill cards one by one. This
// screen owns the header (close, progress), the footer (Check → feedback →
// Continue) and spaced repetition; cards.js renders each card.
//
// params:
//   { mode: 'review' }                 entries due today, then new ones
//   { mode: 'entries', entryIds }      these entries (a section, mistakes…)
//   { mode: 'task', taskId }           a task's own sentences, then its bank phrases
//   { mode: 'model', taskId }          the task's model answer from Claude
import { h, reducedMotion } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, progressBar, emptyState, alert, iconButton, hasOpenOverlay } from '../../ui/components.js';
import { pop, replace } from '../../ui/router.js';
import { speak as tts, stop as stopSpeech } from '../../ui/speech.js';
import { revealField } from '../../ui/viewport.js';
import * as store from '../../data/store.js';
import { cardForEntry, cardsForLines, reviewQueue } from '../../core/drills.js';
import { newProgress, review, practise } from '../../core/srs.js';
import { describeTask } from '../../core/tasks.js';
import { modelSentences } from '../../core/claude-prompts.js';
import { shuffle } from '../../core/util.js';
import { relevantEntries } from '../task.js';
import { render } from './cards.js';

const PRAISE = ['Correct!', 'Nice!', 'Well done!', 'Spot on!', 'Great!'];
const SETTLE_MS = 350;

async function buildCards(params) {
  const s = store.settings();
  const mode = s.answerMode === 'choose' ? 'choose' : 'type';
  const now = Date.now();
  const rng = Math.random;
  const all = await store.getAllEntries();
  const progress = await store.getProgress();
  const forEntries = (entries) => entries.map((e) => cardForEntry(e, all, { rng, turn: progress.get(e.id)?.seen || 0, mode }));
  if (params.mode === 'review') {
    const q = reviewQueue(all, progress, now, { limit: s.reviewLimit || 20 });
    return { title: 'Review', cards: forEntries(q.entries), empty: { icon: 'checkCircle', title: 'All caught up', message: 'Nothing is due right now. Come back tomorrow, or practise a task.' } };
  }
  if (params.mode === 'entries') {
    const wanted = new Set(params.entryIds || []);
    const entries = all.filter((e) => wanted.has(e.id));
    return { title: params.title || 'Practice', cards: forEntries(shuffle(entries)), empty: { title: 'Nothing to practise', message: 'These phrases were deleted.' } };
  }
  const task = await store.getTask(params.taskId);
  if (!task) return { title: 'Practice', cards: [], empty: { title: 'Task not found', message: 'It may have been deleted.' } };
  if (params.mode === 'model') {
    const lines = modelSentences(task.model?.text || '').sentences.map((text) => ({ text, focus: '' }));
    return { title: 'Model answer', cards: cardsForLines(lines, { rng, mode }), empty: { icon: 'sparkles', title: 'No model answer yet', message: 'Ask Claude for one from the task screen.' } };
  }
  const lang = await describeTask(task);
  const lines = [...lang.intro.slice(0, 2), ...lang.overview.slice(0, 3), ...lang.body.slice(0, 7)];
  const taskCards = cardsForLines(lines, { rng, mode });
  // Then the bank phrases for this kind of task that are due or new.
  const relevant = relevantEntries(all, task.type).flatMap((g) => g.entries);
  const pending = relevant.filter((e) => {
    const p = progress.get(e.id);
    return !p || !p.seen || p.due <= now;
  });
  return { title: task.title, cards: [...taskCards, ...forEntries(shuffle(pending).slice(0, 6))], empty: { title: 'Nothing to practise', message: 'This task has no sentences yet.' } };
}

export default async function create(params) {
  const built = await buildCards(params);
  const queue = built.cards.map((card) => ({ card, retry: 0 }));
  const total = queue.length;
  const reviewMode = params.mode === 'review';
  const results = []; // { card, correct, firstTry }
  const seenEntries = new Set();
  let index = 0;
  let done = 0;

  const bar = progressBar(0);
  const counter = h('span', { class: 'pt-count tabular' });
  const closeBtn = iconButton({ icon: 'close', label: 'End practice', variant: 'gray', onTap: () => requestClose() });
  const top = h('header', { class: 'practice-top' }, closeBtn, h('div', { class: 'pt-progress' }, bar.el), counter);
  const stage = h('div', { class: 'practice-stage' });
  const scroller = h('div', { class: 'scroll practice-scroll' }, stage);
  const fbIcon = h('span', { class: 'pf-icon' });
  const fbTitle = h('div', { class: 'pf-title' });
  const fbDetail = h('div', { class: 'pf-detail' });
  const feedback = h('div', { class: 'pf-feedback', 'aria-live': 'polite' }, fbIcon, h('div', { class: 'pf-text' }, fbTitle, fbDetail));
  const primary = button({ label: 'Check', size: 'large', block: true, onTap: () => (total ? onPrimaryTap() : pop()) });
  const primaryLabel = primary.querySelector('span');
  const knewBtn = button({ label: 'Knew it', variant: 'success', size: 'large', block: true, icon: 'check', onTap: () => grade(true) });
  const forgotBtn = button({ label: "Didn't know", variant: 'destructive', size: 'large', block: true, icon: 'close', onTap: () => grade(false) });
  const footer = h('footer', { class: 'practice-footer', dataset: { state: 'idle' } }, feedback, h('div', { class: 'pf-actions' }, primary, h('div', { class: 'pf-grade' }, forgotBtn, knewBtn)));
  const el = h('section', { class: 'screen practice' }, top, scroller, footer);

  if (!total) {
    scroller.replaceChildren(emptyState({ icon: built.empty.icon || 'checkCircle', title: built.empty.title, message: built.empty.message }));
    primaryLabel.textContent = 'Close';
    footer.dataset.state = 'empty';
    return { el, title: 'Practice', swipeBack: false };
  }

  let state = 'idle';
  let current = null;
  let currentEl = null;
  let settleUntil = 0;
  let settleTimer = 0;
  let closing = false;
  const started = Date.now();

  const speakText = (text) => {
    const s = store.settings();
    return tts(text, { rate: s.speechRate, voiceURI: s.voiceURI, lang: 'en-GB' });
  };
  const answered = () => state === 'right' || state === 'close' || state === 'wrong';
  const settling = () => performance.now() < settleUntil;

  function settle() {
    settleUntil = performance.now() + SETTLE_MS;
    footer.classList.add('settling');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => footer.classList.remove('settling'), SETTLE_MS);
  }

  function setState(next, fb = {}) {
    state = next;
    footer.dataset.state = next;
    settle();
    if (answered()) {
      fbIcon.replaceChildren(icon(next === 'right' ? 'checkCircle' : next === 'close' ? 'pencil' : 'xCircle', { size: 26 }));
      fbTitle.textContent = fb.title || '';
      fbDetail.textContent = fb.detail || '';
      fbDetail.hidden = !fb.detail;
    }
  }

  function updateHeader() {
    bar.set(done / total);
    counter.textContent = `${Math.min(done, total)}/${total}`;
  }

  function mount(node) {
    const old = currentEl;
    currentEl = node;
    node.classList.add('practice-card');
    stage.appendChild(node);
    scroller.scrollTop = 0;
    if (current.focus && el.isConnected) current.focus();
    if (!old) return;
    if (reducedMotion()) return old.remove();
    old.classList.add('leaving');
    const out = old.animate([{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: 'translate3d(-48px,0,0)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    out.finished.then(() => old.remove(), () => old.remove());
    node.animate([{ transform: 'translate3d(56px,0,0)', opacity: 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: 60, fill: 'backwards' });
  }

  function showCard() {
    const item = queue[index];
    setState('idle');
    current = render(item.card, {
      speak: speakText,
      autoSpeak: (text) => store.settings().autoSpeak && speakText(text),
      setReady: (ready) => {
        if (state === 'idle') primary.disabled = !ready;
      },
      submit: () => onPrimary(),
      showGradeButtons: () => state === 'idle' && setState('grade'),
    });
    primaryLabel.textContent = current.primaryLabel || 'Check';
    primary.disabled = !current.readyInitially;
    if (item.retry) current.el.prepend(h('div', { class: 'retry-tag' }, icon('refresh', { size: 14 }), 'Try again'));
    mount(current.el);
    updateHeader();
  }

  // Spaced repetition is saved after every answer, so nothing is lost if
  // iOS closes the app half-way through.
  async function saveProgress(card, outcome) {
    if (!card.entryId || seenEntries.has(card.entryId)) return;
    seenEntries.add(card.entryId);
    const prev = (await store.getProgress([card.entryId])).get(card.entryId) || newProgress(card.entryId, 'kb');
    const next = (reviewMode ? review : practise)(prev, outcome, Date.now());
    await store.saveProgress([next]);
  }

  function onResult(result) {
    if (!result || (state !== 'idle' && state !== 'grade')) return;
    currentEl.classList.add('checked');
    const item = queue[index];
    const fb = result.feedback || {};
    const title = result.correct ? fb.title || (result.hinted ? 'Correct — with a hint' : PRAISE[Math.floor(Math.random() * PRAISE.length)]) : fb.title || 'Not quite';
    setState(result.correct ? 'right' : result.close ? 'close' : 'wrong', { title, detail: fb.detail });
    if (!item.retry) {
      results.push({ card: item.card, correct: result.correct });
      done++;
      saveProgress(item.card, result.correct ? (result.hinted ? 'hinted' : 'right') : 'wrong').catch((err) => console.error(err));
    }
    if (!result.correct && item.retry < 1) queue.push({ card: item.card, retry: item.retry + 1 });
    updateHeader();
    const field = stage.querySelector('input:focus, textarea:focus');
    if (field) revealField(field);
    primaryLabel.textContent = 'Continue';
    primary.disabled = false;
  }

  function grade(correct) {
    if (state !== 'grade' || settling()) return;
    onResult(current.grade(correct));
  }

  function onPrimary() {
    if (settling()) return;
    if (state === 'idle') {
      if (primary.disabled) return;
      onResult(current.check());
    } else if (answered()) {
      next();
    }
  }

  let fieldAtTap = null;
  const typingField = () => {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && stage.contains(a) ? a : null;
  };
  primary.addEventListener('pointerdown', () => (fieldAtTap = typingField()));
  primary.addEventListener('mousedown', (e) => typingField() && e.preventDefault());
  function onPrimaryTap() {
    const field = fieldAtTap;
    fieldAtTap = null;
    if (field && field.isConnected && document.activeElement !== field) field.focus({ preventScroll: true });
    onPrimary();
  }

  function next() {
    stopSpeech();
    index++;
    if (index >= queue.length) return finish();
    showCard();
  }

  async function finish() {
    if (state === 'finishing') return;
    state = 'finishing';
    const correct = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct).map((r) => ({ entryId: r.card.entryId || null, text: `${r.card.parts.before}${r.card.parts.answer}${r.card.parts.after}`, answer: r.card.parts.answer }));
    await store.addHistory({ kind: 'drill', mode: params.mode, total: results.length, correct }).catch(() => {});
    const summary = { title: built.title, mode: params.mode, taskId: params.taskId || null, total: results.length, correct, missed, seconds: Math.round((Date.now() - started) / 1000) };
    for (let tries = 0; tries < 10; tries++) {
      if (!el.isConnected) return;
      if (await replace('results', { summary })) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    closing = true;
    pop({ force: true });
  }

  async function requestClose() {
    if (state === 'finishing' || closing) return;
    if (!results.length) {
      closing = true;
      if (!(await pop({ force: true }))) closing = false;
      return;
    }
    const choice = await alert({
      title: 'End this practice?',
      message: 'Your answers so far are saved.',
      actions: [
        { label: 'Keep going', value: 'stay', style: 'cancel' },
        { label: 'End', value: 'end', style: 'destructive' },
      ],
    });
    if (choice === 'end') finish();
  }

  const onKey = (e) => {
    if (e.key !== 'Enter' || e.isComposing || hasOpenOverlay()) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    e.preventDefault();
    if (state !== 'grade') onPrimary();
  };
  document.addEventListener('keydown', onKey);

  showCard();

  return {
    el,
    title: built.title,
    swipeBack: false,
    onShow({ first } = {}) {
      if (first && state === 'idle' && current?.focus) current.focus();
    },
    beforeLeave() {
      if (closing || state === 'finishing' || !results.length) return true;
      requestClose();
      return false;
    },
    onDestroy() {
      clearTimeout(settleTimer);
      stopSpeech();
      document.removeEventListener('keydown', onKey);
    },
  };
}
