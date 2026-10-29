// Make a task with Claude: pick a type (and a topic if you like), copy the
// prompt, paste Claude's reply, check it, save. The reply survives the app
// being closed while you are in Claude.
import { h, replaceChildren } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, chip, button, textArea, textField, toast } from '../ui/components.js';
import { pop, replace } from '../ui/router.js';
import * as store from '../data/store.js';
import { TASK_TYPES } from '../core/tasks.js';
import { taskPrompt, readTaskReply } from '../core/task-import.js';
import { copyText, readText } from '../ui/clipboard.js';
import { uid, debounce } from '../core/util.js';

const DRAFT_KEY = 't1.claudeTask.draft';
const keep = (v) => {
  try {
    if (v) localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked */
  }
};
const restore = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
};

// The map rules come from the map engine, so Claude writes maps the app can read.
async function mapSpec() {
  const { MAP_PROMPT_RULES, MAP_FORMAT_EXAMPLE } = await import('../core/maps.js').catch(() => ({}));
  return { rules: MAP_PROMPT_RULES, example: MAP_FORMAT_EXAMPLE };
}

export default async function create() {
  const draft = restore() || { type: 'line', topic: '', reply: '' };
  let result = null;
  const status = h('div', { class: 'ct-status', 'aria-live': 'polite' });
  const saveBtn = button({ label: 'Save task', size: 'large', block: true, disabled: true, onTap: () => save() });

  const typeChips = h('div', { class: 'ct-types', role: 'group', 'aria-label': 'Task type' });
  const renderTypes = () =>
    replaceChildren(
      typeChips,
      TASK_TYPES.filter((t) => t.id !== 'mixed').map((t) =>
        chip({
          label: t.label,
          selected: draft.type === t.id,
          onTap: () => {
            draft.type = t.id;
            keep(draft);
            renderTypes();
          },
        }),
      ),
    );
  renderTypes();

  const reply = textArea({ value: draft.reply, rows: 6, placeholder: 'Paste Claude’s whole reply here', ariaLabel: 'Claude’s reply', onInput: (v) => checkSoon(v) });

  async function check(text) {
    draft.reply = text;
    keep(draft);
    if (!text.trim()) {
      result = null;
      replaceChildren(status);
      saveBtn.disabled = true;
      return;
    }
    const { validateMap } = draft.type === 'map' || /"kind"\s*:\s*"map"/.test(text) ? await import('../core/maps.js').catch(() => ({})) : {};
    result = readTaskReply(text, { validateMap });
    saveBtn.disabled = !result.task;
    replaceChildren(
      status,
      result.task
        ? h('p', { class: 'ct-ok' }, icon('checkCircle', { size: 18 }), `${result.task.title} — ${result.task.visuals.length > 1 ? 'two visuals' : TASK_TYPES.find((t) => t.id === result.task.type)?.label.toLowerCase()}, ready to save.`)
        : null,
      ...result.problems.map((p) => h('p', { class: 'imp-problem' }, icon('warning', { size: 13 }), p)),
    );
  }
  const checkSoon = debounce(check, 250);

  async function save() {
    if (!result?.task) return;
    const task = await store.saveTask({ ...result.task, id: uid() });
    keep(null);
    toast('Task saved');
    replace('task', { taskId: task.id }, { modal: false });
  }

  const view = screen({
    title: 'Task from Claude',
    largeTitle: false,
    left: [{ label: 'Close', onTap: () => pop({ force: true }) }],
    className: 'import-screen',
    body: [
      h(
        'div',
        { class: 'card imp-step' },
        h('div', { class: 'imp-step-head' }, h('span', { class: 'imp-num' }, '1'), h('strong', null, 'Choose and copy the prompt')),
        typeChips,
        textField({ value: draft.topic, placeholder: 'Topic (optional), e.g. tourism in Vietnam', onInput: (v) => {
          draft.topic = v;
          keep(draft);
        } }),
        button({
          label: 'Copy prompt',
          icon: 'copy',
          block: true,
          onTap: async () => {
            const text = taskPrompt(draft.type, draft.topic, draft.type === 'map' ? await mapSpec() : {});
            if (await copyText(text)) toast('Prompt copied', { icon: 'copy' });
          },
        }),
        h('a', { class: 'btn plain block', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' }, icon('externalLink'), h('span', null, 'Open Claude')),
      ),
      h(
        'div',
        { class: 'card imp-step' },
        h('div', { class: 'imp-step-head' }, h('span', { class: 'imp-num' }, '2'), h('strong', null, 'Paste Claude’s reply')),
        reply,
        button({
          label: 'Paste',
          icon: 'clipboard',
          variant: 'secondary',
          onTap: async () => {
            const text = await readText();
            if (text === null) return toast('Allow pasting, or long-press the box and choose Paste.', { icon: 'info', tone: 'accent' });
            reply.value = text;
            check(text);
          },
        }),
        status,
      ),
    ],
    footer: [saveBtn],
  });
  if (draft.reply.trim()) check(draft.reply);
  return { el: view.el, title: 'Task from Claude', swipeBack: false };
}
