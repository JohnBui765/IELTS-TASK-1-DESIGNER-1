// Adding or editing one entry by hand. The form is checked by the same rules
// as an import (exactly one [[ ]] to drill, valid section and level, marked
// examples); editing a starter entry keeps it from being overwritten later.
import { h, replaceChildren } from '../ui/dom.js';
import { screen, section, segmented, textField, textArea, chip, toast, alert, button } from '../ui/components.js';
import { pop } from '../ui/router.js';
import * as store from '../data/store.js';
import { KINDS, LEVELS, SECTIONS, TYPES } from '../core/kb-schema.js';
import { checkEntry } from '../core/knowledge.js';
import { uid } from '../core/util.js';

export default async function create({ entryId } = {}) {
  const existing = entryId ? await store.getEntry(entryId) : null;
  const draft = existing
    ? { ...existing, examples: existing.examples.map((x) => ({ ...x })), wrong: [...(existing.wrong || [])], types: [...(existing.types || [])] }
    : { kind: 'phrase', text: '', pattern: '', types: [], section: 'overview', level: 'B2', risk: false, note: '', wrong: [], examples: [] };

  const examplesBox = h('div', { class: 'ee-examples' });
  const problemsBox = h('div', { class: 'ee-problems', 'aria-live': 'polite' });

  const field = (label, control, help) => h('label', { class: 'ee-field' }, h('span', { class: 'ee-label' }, label), control, help ? h('span', { class: 'ee-help' }, help) : null);

  function renderExamples() {
    replaceChildren(examplesBox,
      ...draft.examples.map((x, i) =>
        h(
          'div',
          { class: 'ee-example' },
          textArea({ value: x.text, rows: 2, ariaLabel: `Example ${i + 1}`, onInput: (v) => (x.text = v) }),
          h('button', { type: 'button', class: 'btn plain small destructive', onClick: () => { draft.examples.splice(i, 1); renderExamples(); } }, 'Remove'),
        ),
      ),
      button({ label: 'Add an example', icon: 'plus', variant: 'plain', onTap: () => { draft.examples.push({ text: '', from: 'user', page: '' }); renderExamples(); } }),
    );
  }

  const typeChips = h('div', { class: 'kb-chip-row' });
  function renderTypes() {
    replaceChildren(typeChips,
      chip({ label: 'All tasks', selected: !draft.types.length, onTap: () => { draft.types = []; renderTypes(); } }),
      ...TYPES.map((t) => chip({ label: t.label, selected: draft.types.includes(t.id), onTap: () => { draft.types = draft.types.includes(t.id) ? draft.types.filter((x) => x !== t.id) : [...draft.types, t.id]; renderTypes(); } })),
    );
  }

  const sectionSelect = h('select', { class: 'field ee-select', onChange: (e) => (draft.section = e.target.value) }, SECTIONS.map((s) => h('option', { value: s.id, selected: s.id === draft.section }, s.label)));

  async function save() {
    const raw = { ...draft, examples: draft.examples.filter((x) => x.text.trim()).map((x) => ({ text: x.text, from: x.from || 'user', page: x.page || '' })) };
    const { entry, problems } = checkEntry(raw);
    const blocking = !entry;
    replaceChildren(problemsBox, ...problems.map((p) => h('p', null, p)));
    if (blocking) {
      await alert({ title: 'Cannot save yet', message: problems.join(' ') || 'Check the entry.' });
      return;
    }
    const keepIds = new Map((existing?.examples || []).map((x) => [x.text, x]));
    const examples = entry.examples.map((x) => ({ ...keepIds.get(x.text), ...x, id: keepIds.get(x.text)?.id || uid() }));
    const now = Date.now();
    const value = existing
      ? { ...existing, ...entry, id: existing.id, examples, edited: true, updatedAt: now }
      : { ...entry, id: uid(), examples, origin: 'user', packId: null, source: 'Added by hand', createdAt: now, updatedAt: now };
    await store.saveEntries([value]);
    toast(existing ? 'Entry saved' : 'Entry added');
    pop({ force: true });
  }

  renderExamples();
  renderTypes();
  const view = screen({
    title: existing ? 'Edit entry' : 'New entry',
    largeTitle: false,
    left: [{ label: 'Cancel', onTap: () => pop({ force: true }) }],
    actions: [{ label: 'Save', strong: true, onTap: save }],
    className: 'entry-edit',
    body: [
      section({
        plain: true,
        children: [
          field('Kind', segmented({ options: KINDS.map((k) => ({ value: k.id, label: k.label })), value: draft.kind, onChange: (v) => (draft.kind = v) })),
          field('Item', textArea({ value: draft.text, rows: 3, placeholder: 'The diagram [[illustrates]] how X is made.', onInput: (v) => (draft.text = v) }), 'Put [[double brackets]] around the words to drill. Use X and Y for content.'),
          field('Pattern', textField({ value: draft.pattern, placeholder: 'with + noun + -ing participle', onInput: (v) => (draft.pattern = v) }), 'Optional: the formula or the word forms.'),
          field('Level', segmented({ options: LEVELS.map((l) => ({ value: l.id, label: l.label })), value: draft.level, onChange: (v) => (draft.level = v) })),
          field('Section', sectionSelect),
          field('Task types', typeChips),
          field('Note', textArea({ value: draft.note, rows: 3, placeholder: 'When to use it, what to avoid.', onInput: (v) => (draft.note = v) })),
          field('Wrong forms', textField({ value: draft.wrong.join('; '), placeholder: 'comprises of; comprised of', onInput: (v) => (draft.wrong = v.split(';').map((w) => w.trim()).filter(Boolean)) }), 'Optional, separated by ;. The checker flags these in your answers.'),
          h('span', { class: 'ee-label' }, 'Examples'),
          examplesBox,
          problemsBox,
        ],
      }),
    ],
  });
  return { el: view.el, title: view.el.title, swipeBack: false };
}
