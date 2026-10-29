// Knowledge tab: the learner's bank of phrases, structures, lexis and rules.
// Search and filter it, open an entry, add one by hand, import a pack from
// Claude, undo an import, export everything.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, badge, chip, emptyState, actionSheet, toast, textField } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { KINDS, LEVELS, SECTIONS, TYPES, labelOf } from '../core/kb-schema.js';
import { exportPack } from '../core/knowledge.js';
import { stripMarks } from '../core/marked.js';
import { normalizeAnswer } from '../core/text.js';
import { debounce } from '../core/util.js';
import { saveJson, localDate } from '../ui/files.js';
import { markedText } from './task.js';

const FILTER_KEY = 't1.knowledge.filter';

function loadFilter() {
  try {
    return { type: '', level: '', kind: '', ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') };
  } catch {
    return { type: '', level: '', kind: '' };
  }
}

function saveFilter(f) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    /* storage blocked: the filter resets next time */
  }
}

const levelTone = (l) => (l === 'C1' ? 'purple' : l === 'B1' ? '' : 'blue');

export function boxTone(p) {
  if (!p || !p.seen) return null;
  if ((p.box || 0) >= 5) return badge('Mastered', 'green');
  if (p.due <= Date.now()) return badge('Due', 'orange');
  return null;
}

export default async function create() {
  const filter = loadFilter();
  let query = '';
  const list = h('div', { class: 'kb-list' });
  const countEl = h('p', { class: 'kb-count' });
  const chipsRow = h('div', { class: 'kb-filters' });
  const search = textField({ placeholder: 'Search phrases, notes, examples', className: 'kb-search', enterkeyhint: 'search', onInput: (v) => {
    query = v;
    renderList();
  } });
  search.type = 'search';

  async function menu() {
    const choice = await actionSheet({
      title: 'Knowledge',
      actions: [
        { label: 'Add knowledge from Claude', value: 'import' },
        { label: 'Add an entry by hand', value: 'new' },
        { label: 'Imports (undo an import)', value: 'packs' },
        { label: 'Export my knowledge', value: 'export' },
      ],
    });
    if (choice === 'import') push('import', {}, { modal: true });
    else if (choice === 'new') push('entry-edit', {}, { modal: true });
    else if (choice === 'packs') push('packs');
    else if (choice === 'export') {
      const entries = await store.getAllEntries();
      const ok = await saveJson(`task1-knowledge-${localDate()}.json`, exportPack(entries), { title: 'Task 1 knowledge' });
      if (ok) toast(`Exported ${entries.length} entries`, { icon: 'download' });
    }
  }

  const view = screen({
    title: 'Knowledge',
    tab: 'knowledge',
    actions: [{ icon: 'plus', label: 'Add knowledge', onTap: menu }],
    body: [search, chipsRow, countEl, list],
  });

  let entries = [];
  let progress = new Map();

  function renderChips() {
    const group = (key, options, all) =>
      h(
        'div',
        { class: 'kb-chip-row', role: 'group' },
        [{ id: '', label: all }, ...options].map((o) =>
          chip({
            label: o.label,
            selected: filter[key] === o.id,
            onTap: () => {
              filter[key] = o.id;
              saveFilter(filter);
              renderChips();
              renderList();
            },
          }),
        ),
      );
    replaceChildren(chipsRow, group('type', TYPES, 'All tasks'), group('level', LEVELS, 'All levels'), group('kind', KINDS, 'All kinds'));
  }

  function matches(e) {
    if (filter.type && e.types?.length && !e.types.includes(filter.type)) return false;
    if (filter.level && e.level !== filter.level) return false;
    if (filter.kind && e.kind !== filter.kind) return false;
    if (!query.trim()) return true;
    const q = normalizeAnswer(query);
    const hay = normalizeAnswer([stripMarks(e.text), e.pattern, e.note, ...e.examples.map((x) => stripMarks(x.text)), ...(e.wrong || [])].join(' '));
    return hay.includes(q);
  }

  function renderList() {
    const shown = entries.filter(matches);
    countEl.textContent = `${shown.length} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    if (!entries.length) {
      replaceChildren(list, emptyState({ icon: 'books', title: 'Your bank is empty', message: 'Add knowledge from a coursebook with Claude, or write an entry yourself.', action: { label: 'Add knowledge', icon: 'plus', onTap: () => push('import', {}, { modal: true }) } }));
      return;
    }
    const groups = SECTIONS.map((s) => ({ s, items: shown.filter((e) => e.section === s.id) })).filter((g) => g.items.length);
    replaceChildren(list,
      ...groups.map(({ s, items }) =>
        section({
          header: h('span', { class: 'kb-section-head' }, s.label, h('button', { type: 'button', class: 'kb-practise', onClick: () => push('practice', { mode: 'entries', entryIds: items.map((e) => e.id), title: s.label }, { modal: true }) }, icon('target', { size: 14 }), 'Practise')),
          children: items.map((e) =>
            h(
              'button',
              { type: 'button', class: 'row tappable kb-row', onClick: () => push('entry', { entryId: e.id }) },
              h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, markedText(e.text)), h('span', { class: 'row-subtitle' }, [labelOf(KINDS, e.kind), e.types?.length ? e.types.map((t) => labelOf(TYPES, t)).join(', ') : 'All tasks', e.origin === 'import' ? 'imported' : e.origin === 'user' ? 'yours' : null].filter(Boolean).join(' · '))),
              h('span', { class: 'kb-badges' }, boxTone(progress.get(e.id)), e.risk ? badge('⚠', 'orange') : null, badge(e.level, levelTone(e.level))),
              h('span', { class: 'row-chevron' }, icon('chevronRight')),
            ),
          ),
        }),
      ),
    );
    if (!shown.length) replaceChildren(list, h('p', { class: 'section-note' }, 'Nothing matches. Clear a filter or the search.'));
  }

  async function load() {
    [entries, progress] = await Promise.all([store.getAllEntries(), store.getProgress()]);
    renderList();
  }

  renderChips();
  await load();
  const refresh = debounce(() => load().catch((err) => console.error(err)), 150);
  const off = store.onChange(({ store: s }) => (s === 'entries' || s === 'progress' || s === 'all') && refresh());
  return { el: view.el, title: 'Knowledge', onDestroy: off };
}
