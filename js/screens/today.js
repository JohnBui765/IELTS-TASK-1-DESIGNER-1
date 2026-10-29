// Today tab: the phrases due for review, one-tap new tasks of every type,
// the tasks in progress, and a little progress.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, row, button, card } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { startOfDay, DAY, plural, debounce, formatDate } from '../core/util.js';
import { reviewQueue, knowledgeSummary } from '../core/drills.js';
import { TASK_TYPES, typeInfo } from '../core/tasks.js';
import { newTask } from './shared.js';

const INSTALL_DISMISSED = 't1.installHintDismissed';

function installDismissed() {
  try {
    return !!localStorage.getItem(INSTALL_DISMISSED);
  } catch {
    return false;
  }
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);

function streakDays(history, now = Date.now()) {
  const days = new Set(history.map((e) => startOfDay(e.at)));
  let day = startOfDay(now);
  if (!days.has(day)) day = startOfDay(day - DAY / 2);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = startOfDay(day - DAY / 2);
  }
  return n;
}

function reviewCard({ due, fresh, total }) {
  const caughtUp = total === 0;
  return card({
    className: 'review',
    children: [
      h(
        'div',
        { class: 'review-top' },
        h('span', { class: ['review-badge', caughtUp && 'green'] }, icon(caughtUp ? 'check' : 'flame', { size: 28 })),
        h(
          'div',
          null,
          caughtUp ? h('div', { class: 'review-title' }, 'All caught up') : h('div', { class: 'review-count' }, String(total)),
          h('div', { class: 'review-sub' }, caughtUp ? 'Nothing is due. Practise a task, or come back tomorrow.' : [due ? `${plural(due, 'phrase')} to review` : '', due && fresh ? ' · ' : '', fresh ? `${fresh} new` : ''].join('')),
        ),
      ),
      caughtUp
        ? null
        : button({ label: 'Start review', icon: 'play', size: 'large', block: true, onTap: () => push('practice', { mode: 'review' }, { modal: true }) }),
    ],
  });
}

function newTaskCard() {
  const tiles = [...TASK_TYPES, { id: 'random', label: 'Surprise me', icon: 'dice' }].map((t) =>
    h(
      'button',
      {
        type: 'button',
        class: 'type-tile',
        onClick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            await newTask(t.id === 'random' ? TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)].id : t.id);
          } finally {
            btn.disabled = false;
          }
        },
      },
      h('span', { class: 'type-tile-icon' }, icon(t.icon, { size: 24 })),
      h('span', { class: 'type-tile-label' }, t.label),
    ),
  );
  return section({ header: 'New task', plain: true, children: [h('div', { class: 'type-grid' }, tiles)] });
}

function installHint(onDismiss) {
  return h(
    'div',
    { class: 'install-hint card' },
    h('span', { class: 'install-icon' }, icon('phone', { size: 22 })),
    h(
      'div',
      { class: 'install-text' },
      h('div', { class: 'install-title' }, 'Install on your iPhone'),
      h('div', { class: 'install-sub' }, 'Tap ', icon('share', { size: 15, className: 'inline-icon' }), ' Share, then Add to Home Screen. It opens full screen and works offline.'),
    ),
    h('button', { type: 'button', class: 'icon-btn install-close', 'aria-label': 'Dismiss', onClick: onDismiss }, icon('close', { size: 18 })),
  );
}

export default async function create() {
  const body = h('div', { class: 'today' });
  const view = screen({
    title: 'Today',
    subtitle: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    tab: 'today',
    body,
  });

  async function render() {
    const now = Date.now();
    const [entries, progress, tasks, history, attempts] = await Promise.all([
      store.getAllEntries(),
      store.getProgress(),
      store.getTasks(),
      store.getHistory({ limit: 400 }),
      store.getAttempts(),
    ]);
    const limit = store.settings().reviewLimit || 20;
    const queue = reviewQueue(entries, progress, now, { limit });
    const dueNow = Math.min(queue.due, limit);
    const freshNow = queue.entries.length - dueNow;
    const sum = knowledgeSummary(entries, progress, now);
    const blocks = [];
    if (!store.isPersistentStorage()) {
      blocks.push(h('div', { class: 'storage-warning card' }, icon('warning', { size: 20 }), h('span', null, 'This browser is not saving data. Practice works, but nothing will be kept after you close the app.')));
    }
    if (isIOS() && !isStandalone() && !installDismissed()) {
      const hint = installHint(() => {
        try {
          localStorage.setItem(INSTALL_DISMISSED, '1');
        } catch {
          /* storage blocked: the hint just comes back next time */
        }
        hint.remove();
      });
      blocks.push(hint);
    }
    blocks.push(reviewCard({ due: dueNow, fresh: freshNow, total: queue.entries.length }));
    blocks.push(newTaskCard());

    const drafts = new Map();
    for (const a of attempts) if (!a.done && a.text?.trim() && !drafts.has(a.taskId)) drafts.set(a.taskId, a);
    const recent = tasks.slice(0, 4);
    if (recent.length) {
      blocks.push(
        section({
          header: 'Recent tasks',
          children: [
            ...recent.map((t) =>
              row({
                icon: typeInfo(t.type).icon,
                iconBg: 'var(--accent)',
                title: t.title,
                subtitle: drafts.has(t.id) ? `Draft · ${plural(drafts.get(t.id).words || 0, 'word')}` : `${typeInfo(t.type).label} · ${formatDate(t.updatedAt)}`,
                onTap: () => push('task', { taskId: t.id }),
              }),
            ),
            tasks.length > 4 ? row({ title: h('span', { class: 'accent-text' }, 'All tasks'), onTap: () => view.el.dispatchEvent(new CustomEvent('tabchange', { bubbles: true, detail: 'tasks' })) }) : null,
          ],
        }),
      );
    }
    const done = attempts.filter((a) => a.done).length;
    blocks.push(
      h(
        'div',
        { class: 'stats' },
        stat('flame', 'var(--orange)', streakDays(history, now), 'day streak'),
        stat('star', 'var(--green)', sum.mastered, 'mastered'),
        stat('pencil', 'var(--accent)', done, done === 1 ? 'answer written' : 'answers written'),
      ),
    );
    replaceChildren(body, ...blocks);
  }

  function stat(iconName, color, value, label) {
    return h('div', { class: 'stat card' }, h('span', { class: 'stat-icon', style: { color } }, icon(iconName, { size: 20 })), h('div', { class: 'stat-value' }, String(value)), h('div', { class: 'stat-label' }, label));
  }

  const refresh = debounce(() => render().catch((err) => console.error(err)), 150);
  const off = store.onChange(refresh);
  await render();
  return {
    el: view.el,
    title: 'Today',
    onShow: ({ returning } = {}) => returning && refresh(),
    onDestroy: off,
  };
}

