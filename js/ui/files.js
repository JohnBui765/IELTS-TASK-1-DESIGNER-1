// Saving a JSON file (share sheet on iOS, a download elsewhere) and reading
// one back through the file picker.
import { h } from './dom.js';

export function localDate(d = new Date()) {
  // Local date: toISOString is UTC (early morning in Vietnam gives yesterday).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Resolves true when the file was handed over, false when the user cancelled.
export async function saveJson(name, data, { title = name } = {}) {
  const file = new File([JSON.stringify(data, null, 1)], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  return true;
}

// The text of a file the user picks, or null if they pick nothing.
export function pickFile({ accept = 'application/json,.json,.txt,.md' } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file ? await file.text() : null);
    });
    // Cancelling the picker fires no event everywhere; the promise then just
    // stays pending, which is harmless.
    document.body.appendChild(input);
    input.click();
  });
}
