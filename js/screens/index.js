// Screen registry. Each module's default export is a factory
// (params, ctx) => { el, title?, onShow?, onHide?, onDestroy?, beforeLeave?, swipeBack? }.
// Screens load on first use, so the app starts with only what Today needs.
const lazy = (load) => async (params, ctx) => (await load()).default(params, ctx);

export function registerScreens(register) {
  register('today', lazy(() => import('./today.js')));
  register('tasks', lazy(() => import('./tasks.js')));
  register('knowledge', lazy(() => import('./knowledge.js')));
  register('settings', lazy(() => import('./settings.js')));
  register('task', lazy(() => import('./task.js'))); // params { taskId }
  register('write', lazy(() => import('./write.js'))); // params { taskId }
  register('entry', lazy(() => import('./entry.js'))); // params { entryId }
  register('entry-edit', lazy(() => import('./entry-edit.js'))); // modal, params { entryId? }
  register('import', lazy(() => import('./import.js'))); // modal: add knowledge from Claude
  register('packs', lazy(() => import('./packs.js'))); // imports, with undo
  register('claude-task', lazy(() => import('./claude-task.js'))); // modal: a task made by Claude
  register('practice', lazy(() => import('./practice/practice.js')), { persist: false }); // modal
  register('results', lazy(() => import('./practice/results.js')), { persist: false }); // modal
}
