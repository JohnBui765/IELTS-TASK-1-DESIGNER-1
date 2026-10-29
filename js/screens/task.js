// A task: the question, its visual(s) (charts can be edited), the model
// language worked out from the data, and the knowledge-bank phrases for this
// type of task. Footer: Practise and Write.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, button, segmented, toast, actionSheet, confirm, badge, emptyState, sheet, textArea } from '../ui/components.js';
import { push, pop } from '../ui/router.js';
import * as store from '../data/store.js';
import { describeTask, rubricText, reshapeTask, typeInfo, INSTRUCTIONS } from '../core/tasks.js';
import { markedParts } from '../core/marked.js';
import { speak, stop as stopSpeech } from '../ui/speech.js';
import { copyText, readText } from '../ui/clipboard.js';
import { modelAnswerPrompt, modelSentences } from '../core/claude-prompts.js';
import { newSeed } from '../core/rng.js';
import { debounce } from '../core/util.js';
import { labelOf, SECTIONS } from '../core/kb-schema.js';
import { renderVisual } from './shared.js';
import { pieTable } from '../render/chart-svg.js';

// The bank sections worth showing for each task type, in answer order.
const SECTIONS_FOR = {
  line: ['intro', 'overview', 'trend', 'figures', 'comparison', 'tense', 'linking', 'summary'],
  bar: ['intro', 'overview', 'comparison', 'figures', 'trend', 'linking', 'summary'],
  table: ['intro', 'overview', 'comparison', 'figures', 'trend', 'linking', 'summary'],
  pie: ['intro', 'overview', 'proportion', 'figures', 'comparison', 'linking', 'summary'],
  map: ['intro', 'overview', 'change', 'location', 'tense', 'linking', 'summary'],
  process: ['intro', 'overview', 'sequence', 'linking', 'summary'],
  mixed: ['intro', 'overview', 'comparison', 'trend', 'proportion', 'linking', 'summary'],
};

// A sentence with its key part highlighted, or blanked when `masked`.
export function markedText(text, { masked = false } = {}) {
  const p = markedParts(text);
  if (!p) return h('span', null, text);
  return h('span', null, p.before, h('strong', { class: ['key', masked && 'masked'] }, masked ? ' '.repeat(2) + '·'.repeat(Math.min(12, Math.max(4, p.answer.length))) + ' '.repeat(2) : p.answer), p.after);
}

export function relevantEntries(entries, type) {
  const sections = SECTIONS_FOR[type] || SECTIONS_FOR.line;
  const fits = (e) => !e.types?.length || e.types.includes(type) || (type === 'mixed' && e.types.some((t) => t !== 'map' && t !== 'process'));
  return sections.map((id) => ({ id, entries: entries.filter((e) => e.section === id && fits(e)) })).filter((g) => g.entries.length);
}

export default async function create({ taskId }) {
  let task = await store.getTask(taskId);
  if (!task) {
    const view = screen({ title: 'Task', back: { label: 'Back' }, body: [emptyState({ icon: 'chartLine', title: 'Task not found', message: 'It may have been deleted.' })] });
    return { el: view.el, missing: true };
  }

  let masked = false;
  let part = 'intro';
  let language = { intro: [], overview: [], body: [] };
  const visuals = [];
  const destroyers = [];

  const rubricCard = h('div', { class: 'card rubric' });
  const visualsBox = h('div', { class: 'visuals' });
  const langList = h('ol', { class: 'lang-list' });
  const bankBox = h('div', { class: 'bank' });
  const modelBox = h('div', { class: 'model' });
  const maskBtn = button({ label: 'Hide key words', icon: 'eyeSlash', variant: 'plain', size: 'small', onTap: () => toggleMask() });

  function renderRubric() {
    replaceChildren(rubricCard,
      h('div', { class: 'rubric-caption' }, 'Writing Task 1'),
      h('p', { class: 'rubric-time' }, 'You should spend about 20 minutes on this task.'),
      h('p', { class: 'rubric-main' }, task.rubric),
      h('p', null, INSTRUCTIONS),
      h('p', null, 'Write at least 150 words.'),
    );
  }

  async function renderVisuals() {
    destroyers.splice(0).forEach((d) => d());
    visuals.length = 0;
    const blocks = [];
    for (const v of task.visuals) {
      const comp = await renderVisual(v, { onChange: onDataChange });
      visuals.push(comp);
      if (comp.destroy) destroyers.push(comp.destroy);
      const tools = [];
      if (comp.setEditable) {
        let editing = false;
        let dataShown = false;
        const dataBox = h('div', { class: 'data-view', hidden: true });
        const editBtn = button({
          label: 'Edit data',
          icon: 'hand',
          variant: 'secondary',
          size: 'small',
          onTap: () => {
            editing = !editing;
            editBtn.classList.toggle('active', editing);
            editBtn.querySelector('span').textContent = editing ? 'Done' : 'Edit data';
            comp.setEditable(editing);
          },
        });
        const dataBtn = button({
          label: 'Show data',
          icon: 'table',
          variant: 'secondary',
          size: 'small',
          onTap: () => {
            dataShown = !dataShown;
            dataBtn.querySelector('span').textContent = dataShown ? 'Hide data' : 'Show data';
            dataBox.hidden = !dataShown;
            if (dataShown) replaceChildren(dataBox, v.kind === 'pie' ? pieTable(v) : (renderTable(v)));
          },
        });
        tools.push(h('div', { class: 'visual-tools' }, editBtn, v.kind === 'table' ? null : dataBtn), dataBox);
      }
      blocks.push(h('div', { class: 'card visual-card' }, comp.el, tools, task.origin === 'gen' && v.kind !== 'process' && v.kind !== 'map' ? h('p', { class: 'practice-note' }, 'Practice data, not real statistics.') : null));
    }
    replaceChildren(visualsBox, ...blocks);
  }

  function renderTable(v) {
    const rows = v.series.map((s) => h('tr', null, h('th', { scope: 'row' }, s.name), s.values.map((x) => h('td', null, String(x)))));
    return h('div', { class: 'ch-table-wrap' }, h('table', { class: 'ch-table' }, h('thead', null, h('tr', null, h('th', null, ''), v.x.values.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows)));
  }

  function renderLanguage() {
    const lines = language[part] || [];
    replaceChildren(langList,
      ...lines.map((l) =>
        h(
          'li',
          { class: 'lang-line' },
          h(
            'button',
            {
              type: 'button',
              class: 'lang-text',
              'aria-label': 'Read aloud',
              onClick: () => {
                const s = store.settings();
                speak(l.text.replace(/\[\[|\]\]/g, ''), { rate: s.speechRate, voiceURI: s.voiceURI, lang: 'en-GB' });
                highlight(l.featureIds);
              },
            },
            markedText(l.text, { masked }),
          ),
          part === 'body' ? h('span', { class: 'lang-focus' }, labelOf(SECTIONS, l.focus)) : null,
        ),
      ),
    );
    if (!lines.length) replaceChildren(langList, h('li', { class: 'lang-empty' }, 'Nothing here for this task.'));
  }

  // On a map, the features a sentence describes are outlined while it is the one tapped.
  function highlight(ids = []) {
    for (const comp of visuals) comp.setHighlight?.(ids);
  }

  function toggleMask() {
    masked = !masked;
    maskBtn.querySelector('span').textContent = masked ? 'Show key words' : 'Hide key words';
    maskBtn.querySelector('svg')?.replaceWith(icon(masked ? 'eye' : 'eyeSlash'));
    renderLanguage();
  }

  async function renderBank() {
    const groups = relevantEntries(await store.getAllEntries(), task.type);
    if (!groups.length) {
      replaceChildren(bankBox, h('p', { class: 'section-note' }, 'No phrases for this task type yet. Add some in Knowledge.'));
      return;
    }
    replaceChildren(bankBox,
      ...groups.map((g) =>
        section({
          header: labelOf(SECTIONS, g.id),
          children: g.entries.slice(0, 4).map((e) =>
            h(
              'button',
              { type: 'button', class: 'row tappable bank-row', onClick: () => push('entry', { entryId: e.id }) },
              h('span', { class: 'row-main' }, h('span', { class: 'row-title bank-text' }, markedText(e.text))),
              badge(e.level, e.level === 'C1' ? 'purple' : e.level === 'B1' ? '' : 'blue'),
              h('span', { class: 'row-chevron' }, icon('chevronRight')),
            ),
          ),
          footer: g.entries.length > 4 ? `${g.entries.length - 4} more in Knowledge` : null,
        }),
      ),
    );
  }

  // A model answer from Claude: its [[ ]] phrases become drills.
  function renderModel() {
    if (task.model?.text) {
      const parts = task.model.text.split(/(\[\[[^[\]]+?\]\])/g).map((t) => (/^\[\[/.test(t) ? h('strong', { class: 'key' }, t.slice(2, -2)) : t));
      replaceChildren(
        modelBox,
        h(
          'div',
          { class: 'card model-card' },
          h('p', { class: 'model-text' }, parts),
          h(
            'div',
            { class: 'model-actions' },
            button({ label: 'Practise it', icon: 'target', size: 'small', onTap: () => push('practice', { mode: 'model', taskId: task.id }, { modal: true }) }),
            button({ label: 'Replace', variant: 'secondary', size: 'small', onTap: () => askModel() }),
          ),
        ),
      );
      return;
    }
    replaceChildren(
      modelBox,
      h(
        'div',
        { class: 'card model-card' },
        h('p', { class: 'section-note' }, 'Ask Claude for a Band 9 answer with the exact data. Paste it back here: its marked phrases become drills.'),
        h('div', { class: 'model-actions' }, button({ label: 'Get a model answer', icon: 'sparkles', size: 'small', onTap: () => askModel() })),
      ),
    );
  }

  async function saveModel(text) {
    const { sentences, text: clean } = modelSentences(text);
    if (sentences.length < 3) {
      toast('Paste Claude’s answer, with its [[ ]] phrases.', { icon: 'warning', tone: 'orange' });
      return false;
    }
    task = await store.saveTask({ ...task, model: { text: clean, at: Date.now() } });
    renderModel();
    toast(`Model answer saved · ${sentences.length} phrases to drill`);
    return true;
  }

  function askModel() {
    const box = textArea({ rows: 8, placeholder: 'Paste Claude’s answer here', ariaLabel: 'Claude’s answer' });
    const s = sheet({
      title: 'Model answer',
      right: { label: 'Save', strong: true, onTap: async () => (await saveModel(box.value)) && s.close() },
      content: [
        h('p', { class: 'section-note' }, '1. Copy the prompt and send it in a new Claude chat. 2. Copy Claude’s answer and paste it below.'),
        h(
          'div',
          { class: 'model-actions' },
          button({ label: 'Copy prompt', icon: 'copy', size: 'small', onTap: async () => (await copyText(modelAnswerPrompt(task))) && toast('Prompt copied', { icon: 'copy' }) }),
          h('a', { class: 'btn secondary small', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, icon('externalLink'), h('span', null, 'Open Claude')),
          button({
            label: 'Paste',
            icon: 'clipboard',
            variant: 'secondary',
            size: 'small',
            onTap: async () => {
              const text = await readText();
              if (text !== null) box.value = text;
            },
          }),
        ),
        box,
      ],
    });
  }

  async function refreshLanguage() {
    language = await describeTask(task);
    renderLanguage();
  }

  let dirty = false;
  const save = debounce(async () => {
    dirty = false;
    task = await store.saveTask(task);
  }, 500);
  const relanguage = debounce(() => refreshLanguage().catch((err) => console.error(err)), 250);

  function onDataChange() {
    dirty = true;
    relanguage();
    save();
  }

  async function menu() {
    const choice = await actionSheet({
      title: task.title,
      actions: [
        ...(task.origin === 'gen' ? [{ label: task.type === 'map' || task.type === 'process' || task.type === 'mixed' ? 'Make a new one like it' : 'New figures, same topic', value: 'reshape' }] : []),
        { label: 'Copy the question', value: 'copy' },
        { label: 'Delete task', value: 'delete', style: 'destructive' },
      ],
    });
    if (choice === 'reshape') {
      const next = await reshapeTask(task, { seed: newSeed(), now: Date.now() });
      task = await store.saveTask({ ...next, id: task.id, createdAt: task.createdAt });
      view.setTitle(task.title);
      renderRubric();
      await renderVisuals();
      await refreshLanguage();
      toast('New figures');
    } else if (choice === 'copy') {
      if (await copyText(rubricText(task))) toast('Question copied', { icon: 'copy' });
    } else if (choice === 'delete') {
      if (!(await confirm({ title: 'Delete this task?', message: 'Your answers to it will be deleted too.', confirmLabel: 'Delete', destructive: true }))) return;
      await store.deleteTask(task.id);
      pop({ force: true });
    }
  }

  const parts = segmented({
    ariaLabel: 'Part of the answer',
    options: [
      { value: 'intro', label: 'Introduction' },
      { value: 'overview', label: 'Overview' },
      { value: 'body', label: 'Details' },
    ],
    value: part,
    onChange: (v) => {
      part = v;
      highlight();
      renderLanguage();
    },
  });

  const view = screen({
    title: task.title,
    largeTitle: false,
    back: { label: 'Back' },
    className: 'task-screen',
    actions: [{ icon: 'ellipsis', label: 'More', onTap: menu }],
    body: [
      h('div', { class: 'task-type' }, icon(typeInfo(task.type).icon, { size: 16 }), typeInfo(task.type).label),
      rubricCard,
      visualsBox,
      section({ header: h('span', { class: 'lang-head' }, 'Model language', maskBtn), plain: true, children: [parts, langList] }),
      h('p', { class: 'section-note' }, { map: 'Worked out from the maps. Tap a sentence to hear it and see it on the map.', process: 'Worked out from the diagram. Tap a sentence to hear it.' }[task.type] || 'Worked out from the figures. Tap a sentence to hear it.'),
      h('div', { class: 'bank-head' }, h('h2', null, 'Model answer')),
      modelBox,
      h('div', { class: 'bank-head' }, h('h2', null, 'From your knowledge bank')),
      bankBox,
    ],
    footer: [
      button({ label: 'Practise', icon: 'target', variant: 'secondary', size: 'large', onTap: () => push('practice', { mode: 'task', taskId: task.id }, { modal: true }) }),
      button({ label: 'Write', icon: 'pencil', size: 'large', onTap: () => push('write', { taskId: task.id }) }),
    ],
  });

  renderRubric();
  await renderVisuals();
  await refreshLanguage();
  await renderBank();
  renderModel();
  const off = store.onChange(({ store: s }) => {
    if (s === 'entries' || s === 'all') renderBank();
  });

  return {
    el: view.el,
    title: task.title,
    onDestroy() {
      off();
      stopSpeech();
      destroyers.forEach((d) => d());
      if (dirty) store.saveTask(task).catch((err) => console.error(err));
    },
  };
}
