// Imports: every pack added from Claude (or a file), newest first. Undo
// removes its new entries and the examples it added to other entries.
import { h, replaceChildren } from '../ui/dom.js';
import { screen, section, row, confirm, toast, emptyState } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { formatDate, plural } from '../core/util.js';

export default async function create() {
  const body = h('div', { class: 'packs' });
  const view = screen({ title: 'Imports', back: { label: 'Knowledge' }, body, actions: [{ icon: 'plus', label: 'Add knowledge', onTap: () => push('import', {}, { modal: true }) }] });

  async function render() {
    const packs = await store.getPacks();
    const core = (await store.getAllEntries()).filter((e) => e.origin === 'core').length;
    replaceChildren(body,
      section({ header: 'Built in', children: [row({ icon: 'book', iconBg: 'var(--teal)', title: 'Starter set', subtitle: `${plural(core, 'entry', 'entries')} from CLAUDE-task1.md`, accessory: 'none' })] }),
      packs.length
        ? section({
          header: 'Your imports',
          footer: 'Undo removes the entries an import added and the examples it added to entries you already had.',
          children: packs.map((p) =>
            row({
              icon: 'download',
              iconBg: 'var(--accent)',
              title: p.title,
              subtitle: [formatDate(p.importedAt), plural(p.counts?.new || 0, 'new entry', 'new entries'), p.counts?.examples ? plural(p.counts.examples, 'example') + ' added' : null].filter(Boolean).join(' · '),
              detail: 'Undo',
              onTap: async () => {
                if (!(await confirm({ title: `Undo “${p.title}”?`, message: 'Its entries, their progress and the examples it added will be removed.', confirmLabel: 'Undo import', destructive: true }))) return;
                await store.removePack(p.id);
                toast('Import undone');
              },
            }),
          ),
        })
        : emptyState({ icon: 'download', title: 'No imports yet', message: 'Knowledge you add from Claude appears here, and each import can be undone.' }),
    );
  }

  await render();
  const off = store.onChange(({ store: s }) => (s === 'packs' || s === 'entries' || s === 'all') && render());
  return { el: view.el, title: 'Imports', onDestroy: off };
}
