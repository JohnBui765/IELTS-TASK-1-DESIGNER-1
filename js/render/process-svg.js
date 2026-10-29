// Draws a process as numbered stages in a snake layout (two columns on a
// phone, three when wider), with arrows between stages and, for a cycle, an
// arrow from the last stage back to the first. Drawn at the container's real
// pixel width so the labels stay legible.
import { h, svg, clear } from '../ui/dom.js';

const FONT = 13.5;
const LINE = 17;

// Splits a label into lines that fit `width` px (approximate glyph widths).
function wrap(text, width, max = 3) {
  const perLine = Math.max(6, Math.floor(width / (FONT * 0.56)));
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '…');
  }
  return lines;
}

const arrowHead = (x, y, dir) => {
  const s = 6;
  const pts = {
    right: `${x},${y} ${x - s * 1.6},${y - s} ${x - s * 1.6},${y + s}`,
    left: `${x},${y} ${x + s * 1.6},${y - s} ${x + s * 1.6},${y + s}`,
    down: `${x},${y} ${x - s},${y - s * 1.6} ${x + s},${y - s * 1.6}`,
  }[dir];
  return svg('polygon', { points: pts, class: 'pr-head' });
};

function draw(p, width) {
  const n = p.steps.length;
  const cols = width >= 540 ? 3 : 2;
  const gapX = 34;
  const gapY = 40;
  const margin = p.cycle ? 22 : 4;
  const boxW = (width - margin * 2 - gapX * (cols - 1)) / cols;
  const lines = p.steps.map((s) => wrap(s.label, boxW - 46));
  const boxH = Math.max(58, Math.max(...lines.map((l) => l.length)) * LINE + 24);
  const rows = Math.ceil(n / cols);
  const height = rows * boxH + (rows - 1) * gapY + (p.cycle ? 30 : 8);
  const pos = p.steps.map((_, i) => {
    const r = Math.floor(i / cols);
    const c = r % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    return { x: margin + c * (boxW + gapX), y: 4 + r * (boxH + gapY), r, c };
  });
  const root = svg('svg', { class: 'pr-svg', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${p.title}: ${n} stages${p.cycle ? ', a cycle' : ''}` });
  // Arrows first, so the boxes sit on top of them.
  for (let i = 0; i < n - 1; i++) {
    const a = pos[i];
    const b = pos[i + 1];
    if (a.r === b.r) {
      const toRight = b.c > a.c;
      const y = a.y + boxH / 2;
      const x1 = toRight ? a.x + boxW + 3 : a.x - 3;
      const x2 = toRight ? b.x - 3 : b.x + boxW + 3;
      root.append(svg('line', { x1, y1: y, x2: toRight ? x2 - 8 : x2 + 8, y2: y, class: 'pr-arrow' }), arrowHead(x2, y, toRight ? 'right' : 'left'));
    } else {
      const x = a.x + boxW / 2;
      const y1 = a.y + boxH + 3;
      const y2 = b.y - 3;
      root.append(svg('line', { x1: x, y1, x2: x, y2: y2 - 8, class: 'pr-arrow' }), arrowHead(x, y2, 'down'));
    }
  }
  if (p.cycle && n > 2) {
    const last = pos[n - 1];
    const first = pos[0];
    const yb = last.y + boxH + 14;
    const d = `M${last.x + boxW / 2} ${last.y + boxH + 3}V${yb}H${6}V${first.y + boxH / 2}H${first.x - 11}`;
    root.append(svg('path', { d, class: 'pr-arrow pr-return' }), arrowHead(first.x - 3, first.y + boxH / 2, 'right'));
  }
  p.steps.forEach((s, i) => {
    const { x, y } = pos[i];
    const g = svg('g', { class: 'pr-step' });
    g.append(
      svg('rect', { x, y, width: boxW, height: boxH, rx: 12, class: 'pr-box' }),
      svg('circle', { cx: x + 18, cy: y + 18, r: 11, class: 'pr-num' }),
      svg('text', { x: x + 18, y: y + 22.5, 'text-anchor': 'middle', class: 'pr-num-text' }, document.createTextNode(String(i + 1))),
    );
    const top = y + boxH / 2 - ((lines[i].length - 1) * LINE) / 2 + 5;
    lines[i].forEach((l, k) => g.appendChild(svg('text', { x: x + 36, y: top + k * LINE, class: 'pr-label' }, document.createTextNode(l))));
    root.appendChild(g);
  });
  return root;
}

export function renderProcess(p) {
  const body = h('div', { class: 'pr-body' });
  const el = h(
    'figure',
    { class: 'process' },
    h('figcaption', { class: 'ch-title' }, p.title, p.cycle ? h('span', { class: 'ch-unit' }, ' (a cycle)') : null),
    body,
  );
  let width = 0;
  const build = () => {
    width = Math.floor(body.clientWidth || 340);
    clear(body);
    body.appendChild(draw(p, width));
  };
  let frame = 0;
  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => Math.abs(Math.floor(body.clientWidth) - width) > 2 && build());
    })
    : null;
  observer?.observe(body);
  requestAnimationFrame(build);
  return {
    el,
    destroy() {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}
