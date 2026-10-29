// Results after a practice: the score, what was missed, and a quick way to
// practise the mistakes again.
import { h } from '../../ui/dom.js';

import { screen, section, button, ring } from '../../ui/components.js';
import { pop, replace } from '../../ui/router.js';
import { markedText } from '../task.js';

const TITLES = [
  [1, 'Perfect!'],
  [0.85, 'Great work!'],
  [0.6, 'Good effort'],
  [0, 'Keep going'],
];

export default async function create({ summary }) {
  const s = summary || { total: 0, correct: 0, missed: [] };
  const fraction = s.total ? s.correct / s.total : 0;
  const title = TITLES.find(([min]) => fraction >= min)[1];
  const mistakes = s.missed.filter((m) => m.entryId);
  const body = [
    h(
      'div',
      { class: 'res-hero' },
      ring({ fraction, size: 140, stroke: 12, label: `${Math.round(fraction * 100)}%`, color: fraction >= 0.6 ? 'var(--green)' : 'var(--orange)', labelSize: 34 }).el,
      h('h1', { class: 'res-title' }, title),
      h('p', { class: 'res-sub' }, s.title || 'Practice'),
    ),
    h(
      'div',
      { class: 'res-stats' },
      h('div', { class: 'res-stat' }, h('div', { class: 'res-stat-value' }, String(s.correct)), h('div', { class: 'res-stat-label' }, 'Correct')),
      h('div', { class: 'res-stat' }, h('div', { class: 'res-stat-value' }, String(s.total - s.correct)), h('div', { class: 'res-stat-label' }, s.total - s.correct === 1 ? 'Mistake' : 'Mistakes')),
      h('div', { class: 'res-stat' }, h('div', { class: 'res-stat-value' }, `${Math.max(1, Math.round(s.seconds / 60))}m`), h('div', { class: 'res-stat-label' }, 'Time')),
    ),
    s.missed.length
      ? section({
        header: 'To look at again',
        children: s.missed.map((m) => h('div', { class: 'row res-missed' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, markedText(m.text.replace(m.answer, `[[${m.answer}]]`)))))),
      })
      : null,
  ];
  const view = screen({
    title: 'Results',
    largeTitle: false,
    className: 'results results-screen',
    body,
    footer: [
      mistakes.length ? button({ label: 'Practise mistakes', icon: 'refresh', size: 'large', block: true, onTap: () => replace('practice', { mode: 'entries', entryIds: mistakes.map((m) => m.entryId), title: 'Mistakes' }, { modal: true }) }) : null,
      button({ label: 'Done', variant: mistakes.length ? 'secondary' : 'primary', size: 'large', block: true, onTap: () => pop({ force: true }) }),
    ],
  });
  view.footer?.querySelector('.footer-row')?.classList.add('stacked');
  return { el: view.el, title: 'Results', swipeBack: false };
}


