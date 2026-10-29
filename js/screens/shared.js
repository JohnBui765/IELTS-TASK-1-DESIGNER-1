// Helpers shared by several screens: making a task, drawing any visual.
import { h } from '../ui/dom.js';
import { toast } from '../ui/components.js';
import { push } from '../ui/router.js';
import * as store from '../data/store.js';
import { generateTask } from '../core/tasks.js';
import { newSeed } from '../core/rng.js';
import { uid } from '../core/util.js';
import { renderChart } from '../render/chart-svg.js';

// Generates a task of `type`, saves it and opens it.
export async function newTask(type) {
  try {
    const t = await generateTask({ type, seed: newSeed(), now: Date.now() });
    const task = await store.saveTask({ ...t, id: uid() });
    await push('task', { taskId: task.id });
    return task;
  } catch (err) {
    console.error(err);
    toast('Could not make that task.', { icon: 'xCircle', tone: 'red' });
    return null;
  }
}

// Any visual as a component: { el, setEditable?, setHighlight?, refresh?, destroy? }.
// Maps and processes load their renderers on first use.
export async function renderVisual(v, opts = {}) {
  if (v.kind === 'map') {
    const { renderMapPair } = await import('../render/map-svg.js');
    const pair = renderMapPair(v, opts);
    return { el: h('div', { class: 'visual visual-map' }, pair.el), setHighlight: pair.setHighlight };
  }
  if (v.kind === 'process') {
    const { renderProcess } = await import('../render/process-svg.js');
    return renderProcess(v, opts);
  }
  return renderChart(v, opts);
}
