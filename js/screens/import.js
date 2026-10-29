// Add knowledge from Claude: copy the instructions (once, for a Claude
// Project) or a one-off prompt, paste Claude's reply, review every entry
// (new, adds examples, already in the bank, unusable) and add what you keep.
// The pasted reply survives the app being closed while you are in Claude.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, button, toast, badge, textArea } from '../ui/components.js';
import { pop, push } from '../ui/router.js';
import * as store from '../data/store.js';
import { planImport, applyImport } from '../core/knowledge.js';
import { PROJECT_INSTRUCTIONS, buildExtractPrompt } from '../core/kb-prompt.js';
import { lintSentence } from '../core/lint.js';
import { stripMarks } from '../core/marked.js';
import { labelOf, SECTIONS } from '../core/kb-schema.js';
import { copyText, readText } from '../ui/clipboard.js';
import { pickFile } from '../ui/files.js';
import { uid, debounce, plural } from '../core/util.js';
import { markedText } from './task.js';

const DRAFT_KEY = 't1.import.draft';
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT_KEY) || '';
  } catch {
    return '';
  }
};
const writeDraft = (text) => {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked: the draft is simply not kept */
  }
};

export default async function create() {
  let entries = await store.getAllEntries();
  let plan = null;
  const chosen = new Set();
  const reply = textArea({ value: readDraft(), rows: 6, placeholder: 'Paste Claude’s whole reply here', ariaLabel: 'Claude’s reply', onInput: (v) => updateSoon(v) });
  const review = h('div', { class: 'imp-review', 'aria-live': 'polite' });
  const addBtn = button({ label: 'Add', size: 'large', block: true, disabled: true, onTap: () => add() });

  const copy = async (text, label) => {
    if (await copyText(text)) toast(`${label} copied`, { icon: 'copy' });
  };

  function itemRow(item) {
    const id = item.entry ? item.entry.text : '';
    const on = chosen.has(item);
    const box = h(
      'button',
      {
        type: 'button',
        class: ['imp-item', on && 'on'],
        'aria-pressed': String(on),
        onClick: () => {
          if (chosen.has(item)) chosen.delete(item);
          else chosen.add(item);
          renderReview();
        },
      },
      h('span', { class: 'imp-check' }, icon(on ? 'checkCircle' : 'circle', { size: 22 })),
      h(
        'span',
        { class: 'imp-main' },
        h('span', { class: 'imp-text' }, markedText(item.action === 'merge' ? item.target.text : id)),
        h(
          'span',
          { class: 'imp-sub' },
          item.action === 'merge'
            ? `Adds ${plural(item.examples.length, 'example')} to an entry you have`
            : `${labelOf(SECTIONS, item.entry.section)} · ${plural(item.entry.examples.length, 'example')}`,
          ' ',
          badge(item.entry.level, item.entry.level === 'C1' ? 'purple' : 'blue'),
        ),
        ...[...(item.problems || []), ...(item.issues || [])].map((p) => h('span', { class: 'imp-problem' }, icon('warning', { size: 13 }), p)),
      ),
    );
    return box;
  }

  function renderReview() {
    if (!plan) {
      replaceChildren(review);
      addBtn.disabled = true;
      return;
    }
    const by = (a) => plan.items.filter((i) => i.action === a);
    const fresh = by('new');
    const merge = by('merge');
    const dup = by('duplicate');
    const bad = by('reject');
    if (!plan.items.length && plan.problems.length) {
      replaceChildren(review, h('div', { class: 'cz-callout imp-error' }, icon('warning', { size: 18 }), h('div', { class: 'cz-callout-text' }, plan.problems.map((p) => h('p', null, p)))));
      addBtn.disabled = true;
      return;
    }
    const n = [...chosen].length;
    addBtn.disabled = !n;
    addBtn.querySelector('span').textContent = n ? `Add ${n} ${n === 1 ? 'item' : 'items'}` : 'Add';
    replaceChildren(review,
      h('p', { class: 'imp-summary' }, [plural(fresh.length, 'new entry', 'new entries'), merge.length ? `${merge.length} with new examples` : null, dup.length ? `${dup.length} already in your bank` : null, bad.length ? `${bad.length} cannot be used` : null].filter(Boolean).join(' · ')),
      plan.meta?.title ? h('p', { class: 'imp-pack' }, icon('book', { size: 15 }), plan.meta.title, plan.meta.source && plan.meta.source !== plan.meta.title ? ` — ${plan.meta.source}` : '') : null,
      plan.more ? h('div', { class: 'cz-callout' }, icon('info', { size: 18 }), h('div', { class: 'cz-callout-text' }, h('p', null, 'Claude has more for this material. Add these first, then send “continue” in the same chat and paste that reply here.'))) : null,
      ...plan.problems.map((p) => h('p', { class: 'imp-problem' }, icon('warning', { size: 13 }), p)),
      fresh.length ? section({ header: 'New', children: fresh.map(itemRow) }) : null,
      merge.length ? section({ header: 'New examples for entries you have', children: merge.map(itemRow) }) : null,
      dup.length ? section({ header: 'Already in your bank', children: [h('p', { class: 'imp-muted' }, dup.map((d) => stripMarks(d.entry.text)).join(' · '))] }) : null,
      bad.length ? section({ header: 'Cannot be used', children: bad.map((b) => h('p', { class: 'imp-problem' }, icon('xCircle', { size: 13 }), b.problems.join(' '))) }) : null,
    );
  }

  function update(text) {
    writeDraft(text);
    if (!text.trim()) {
      plan = null;
      chosen.clear();
      renderReview();
      return;
    }
    plan = planImport(text, entries, { lintExample: lintSentence });
    chosen.clear();
    plan.items.filter((i) => i.action === 'new' || i.action === 'merge').forEach((i) => chosen.add(i));
    renderReview();
  }
  const updateSoon = debounce(update, 250);

  async function add() {
    const items = plan.items.filter((i) => chosen.has(i));
    if (!items.length) return;
    const { pack, entries: writes } = applyImport(plan, items, { now: Date.now(), idGen: uid });
    await store.commitImport(pack, writes);
    writeDraft('');
    toast(`Added ${plural(pack.counts.new, 'entry', 'entries')}${pack.counts.examples ? ` and ${plural(pack.counts.examples, 'example')}` : ''}`);
    entries = await store.getAllEntries();
    if (plan.more) {
      reply.value = '';
      update('');
      return;
    }
    pop({ force: true });
  }

  const view = screen({
    title: 'Add knowledge',
    largeTitle: false,
    left: [{ label: 'Close', onTap: () => pop({ force: true }) }],
    className: 'import-screen',
    body: [
      h(
        'div',
        { class: 'card imp-step' },
        h('div', { class: 'imp-step-head' }, h('span', { class: 'imp-num' }, '1'), h('strong', null, 'Give Claude the instructions')),
        h('p', null, 'Best: make a Claude Project once and paste these as its instructions. Then each new chat only needs your material — one unit and its answer key, up to 100 pages.'),
        button({ label: 'Copy project instructions', icon: 'copy', block: true, onTap: () => copy(PROJECT_INSTRUCTIONS, 'Instructions') }),
        button({ label: 'Copy a one-off prompt', icon: 'copy', variant: 'secondary', block: true, onTap: () => copy(buildExtractPrompt({ have: entries.map((e) => stripMarks(e.text)) }), 'Prompt') }),
        h('a', { class: 'btn plain block', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, icon('externalLink'), h('span', null, 'Open Claude')),
      ),
      h(
        'div',
        { class: 'card imp-step' },
        h('div', { class: 'imp-step-head' }, h('span', { class: 'imp-num' }, '2'), h('strong', null, 'Paste Claude’s reply')),
        reply,
        h(
          'div',
          { class: 'imp-tools' },
          button({
            label: 'Paste',
            icon: 'clipboard',
            variant: 'secondary',
            onTap: async () => {
              const text = await readText();
              if (text === null) return toast('Allow pasting, or long-press the box and choose Paste.', { icon: 'info', tone: 'accent' });
              reply.value = text;
              update(text);
            },
          }),
          button({
            label: 'Open a file',
            icon: 'upload',
            variant: 'secondary',
            onTap: async () => {
              const text = await pickFile();
              if (text === null) return;
              reply.value = text;
              update(text);
            },
          }),
        ),
      ),
      review,
      h('p', { class: 'section-note' }, h('a', { href: '#', onClick: (e) => { e.preventDefault(); push('packs'); } }, 'Your imports'), ' can each be undone.'),
    ],
    footer: [addBtn],
  });
  if (reply.value.trim()) update(reply.value);
  return { el: view.el, title: 'Add knowledge', swipeBack: false };
}
