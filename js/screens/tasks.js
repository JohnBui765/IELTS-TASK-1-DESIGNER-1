// Tasks tab: every saved task, newest first, and a quick way to make more.
import { h, replaceChildren } from '../ui/dom.js';
import { screen, section, row, emptyState, actionSheet } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { TASK_TYPES, typeInfo } from '../core/tasks.js';
import { formatDate, plural, debounce } from '../core/util.js';
import { newTask } from './shared.js';

async function pickType() {
  const choice = await actionSheet({
    title: 'New task',
    actions: [...TASK_TYPES.map((t) => ({ label: t.label, value: t.id })), { label: 'Make one with Claude…', value: 'claude' }],
  });
  if (choice === 'claude') push('claude-task', {}, { modal: true });
  else if (choice) newTask(choice);
}

export default async function create() {
  const body = h('div', { class: 'tasks' });
  const view = screen({ title: 'Tasks', tab: 'tasks', actions: [{ icon: 'plus', label: 'New task', onTap: pickType }], body });

  async function render() {
    const [tasks, attempts] = await Promise.all([store.getTasks(), store.getAttempts()]);
    if (!tasks.length) {
      replaceChildren(body, emptyState({ icon: 'chartLine', title: 'No tasks yet', message: 'Make a line graph, a map, a process… The app writes the question and works out the language.', action: { label: 'New task', icon: 'plus', onTap: pickType } }));
      return;
    }
    const written = new Map();
    for (const a of attempts) if (a.done) written.set(a.taskId, (written.get(a.taskId) || 0) + 1);
    const byType = new Map();
    for (const t of tasks) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type).push(t);
    }
    replaceChildren(body,
      ...TASK_TYPES.filter((t) => byType.has(t.id)).map((type) =>
        section({
          header: type.label,
          children: byType.get(type.id).map((t) =>
            row({
              icon: typeInfo(t.type).icon,
              iconBg: 'var(--accent)',
              title: t.title,
              subtitle: [formatDate(t.updatedAt), written.get(t.id) ? plural(written.get(t.id), 'answer') : null, t.origin === 'claude' ? 'from Claude' : null].filter(Boolean).join(' · '),
              onTap: () => push('task', { taskId: t.id }),
            }),
          ),
        }),
      ),
    );
  }

  const refresh = debounce(() => render().catch((err) => console.error(err)), 120);
  const off = store.onChange(({ store: s }) => (s === 'tasks' || s === 'attempts' || s === 'all') && refresh());
  await render();
  return { el: view.el, title: 'Tasks', onDestroy: off };
}
