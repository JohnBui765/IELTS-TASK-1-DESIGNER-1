// One knowledge entry: the item, its pattern and note, every example (with
// where it came from), the ✗ forms, progress, and Edit / Practise / Delete.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, row, badge, button, confirm, toast, emptyState } from '../ui/components.js';
import { push, pop } from '../ui/router.js';
import * as store from '../data/store.js';
import { KINDS, SECTIONS, TYPES, labelOf } from '../core/kb-schema.js';
import { stripMarks } from '../core/marked.js';
import { boxLabel } from '../core/srs.js';
import { formatDate } from '../core/util.js';
import { speak } from '../ui/speech.js';
import { markedText } from './task.js';

const FROM = { book: 'From the book', claude: 'Written by Claude', core: 'Starter set', user: 'Yours' };

export default async function create({ entryId }) {
  let entry = await store.getEntry(entryId);
  if (!entry || entry.hidden) {
    const view = screen({ title: 'Entry', back: { label: 'Back' }, body: [emptyState({ icon: 'books', title: 'Entry not found', message: 'It may have been deleted.' })] });
    return { el: view.el, missing: true };
  }
  const say = (text) => {
    const s = store.settings();
    speak(stripMarks(text), { rate: s.speechRate, voiceURI: s.voiceURI, lang: 'en-GB' });
  };
  const body = h('div', { class: 'entry' });
  const view = screen({
    title: labelOf(KINDS, entry.kind),
    largeTitle: false,
    back: { label: 'Back' },
    actions: [{ label: 'Edit', onTap: () => push('entry-edit', { entryId: entry.id }, { modal: true }) }],
    body,
    footer: [
      button({ label: 'Practise', icon: 'target', size: 'large', block: true, onTap: () => push('practice', { mode: 'entries', entryIds: [entry.id], title: 'Practice' }, { modal: true }) }),
    ],
  });

  async function render() {
    const p = (await store.getProgress([entry.id])).get(entry.id);
    const meta = [labelOf(SECTIONS, entry.section), entry.types?.length ? entry.types.map((t) => labelOf(TYPES, t)).join(', ') : 'All task types'].join(' · ');
    replaceChildren(body,
      h(
        'div',
        { class: 'card entry-hero' },
        h('div', { class: 'entry-badges' }, badge(entry.level, entry.level === 'C1' ? 'purple' : entry.level === 'B1' ? '' : 'blue'), entry.risk ? badge('⚠ Use with care', 'orange') : null, entry.mindset ? badge('Mindset') : null, entry.verbatim && entry.origin === 'import' ? badge('Word for word') : null),
        h('p', { class: 'entry-text' }, markedText(entry.text)),
        entry.pattern ? h('p', { class: 'entry-pattern' }, entry.pattern) : null,
        h('p', { class: 'entry-meta' }, meta),
        entry.note ? h('div', { class: 'cz-callout entry-note' }, icon('lightbulb', { size: 18 }), h('div', { class: 'cz-callout-text' }, h('p', null, entry.note))) : null,
      ),
      entry.wrong?.length
        ? section({ header: 'Not like this', children: entry.wrong.map((w) => row({ icon: 'xCircle', iconBg: 'var(--red-fill)', title: w, accessory: 'none' })) })
        : null,
      section({
        header: `Examples (${entry.examples.length})`,
        children: entry.examples.map((x) =>
          h(
            'div',
            { class: 'row entry-example' },
            h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, markedText(x.text)), h('span', { class: 'row-subtitle' }, [FROM[x.from] || x.from, x.page ? `p. ${x.page}` : null].filter(Boolean).join(' · '))),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Read aloud', onClick: () => say(x.text) }, icon('speaker')),
          ),
        ),
        footer: entry.examples.length < 3 ? 'Fewer than three examples: add more in Edit, or import them from Claude.' : null,
      }),
      section({
        header: 'Progress and source',
        children: [
          row({ title: 'Progress', detail: p?.seen ? `${boxLabel(p.box)} · ${p.right}/${p.seen} right` : 'Not practised yet', accessory: 'none' }),
          p?.seen && p.due ? row({ title: 'Next review', detail: p.due <= Date.now() ? 'Due now' : formatDate(p.due), accessory: 'none' }) : null,
          row({ title: 'Source', detail: [entry.source, entry.page ? `p. ${entry.page}` : null].filter(Boolean).join(', ') || '—', accessory: 'none' }),
        ],
      }),
      section({ children: [row({ title: 'Delete entry', destructive: true, accessory: 'none', onTap: remove })] }),
    );
  }

  async function remove() {
    if (!(await confirm({ title: 'Delete this entry?', message: entry.origin === 'core' ? 'It is hidden from your bank and practice.' : 'Its progress is deleted too.', confirmLabel: 'Delete', destructive: true }))) return;
    await store.deleteEntry(entry);
    toast('Entry deleted');
    pop({ force: true });
  }

  await render();
  const off = store.onChange(async ({ store: s }) => {
    if (s !== 'entries' && s !== 'progress' && s !== 'all') return;
    const fresh = await store.getEntry(entryId);
    if (!fresh || fresh.hidden) return;
    entry = fresh;
    render();
  });
  return { el: view.el, title: labelOf(KINDS, entry.kind), onDestroy: off };
}
