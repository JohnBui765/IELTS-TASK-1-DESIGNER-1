// Draws a chart visual (line, bar, pie, table) at the real pixel width of its
// container, so text stays crisp and legible on a phone. In edit mode the
// points, bars and pie boundaries can be dragged (or moved with the arrow
// keys); a drag updates only what moved, at most once per frame, and
// reports the new data when the finger lifts.
import { h, svg, clear } from '../ui/dom.js';
import { fmtNumber } from '../core/english.js';
import { fmtValue } from '../core/describe.js';

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'circle', 'square'];
const color = (i) => `var(--series-${(i % 6) + 1})`;
// Text drawn inside a fill: white, except on the yellow slot.
const inkOn = (i) => ((i % 6) === 3 ? '#0b0b0b' : '#ffffff');

function tickLabel(v, unit) {
  const d = v !== Math.round(v) ? (Math.abs(v) < 10 ? 1 : 0) : 0;
  const sym = unit?.kind === 'currency' ? unit.symbol || '$' : '';
  const pct = unit?.kind === 'percent' ? '%' : '';
  if (Math.abs(v) >= 10000) return `${sym}${fmtNumber(v / 1000, v % 1000 ? 1 : 0)}k${pct}`;
  return `${sym}${fmtNumber(v, d)}${pct}`;
}

function marker(shape, x, y, i, r = 4.5) {
  const common = { fill: color(i), stroke: 'var(--card)', 'stroke-width': 2, class: 'ch-marker' };
  if (shape === 'square') return svg('rect', { ...common, x: x - r, y: y - r, width: r * 2, height: r * 2, rx: 1.5 });
  if (shape === 'triangle') return svg('path', { ...common, d: `M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z` });
  if (shape === 'diamond') return svg('path', { ...common, d: `M${x} ${y - r - 1.5}L${x + r + 1.5} ${y}L${x} ${y + r + 1.5}L${x - r - 1.5} ${y}Z` });
  return svg('circle', { ...common, cx: x, cy: y, r });
}

// A column with a 4px rounded top and a square base.
function barPath(x, y, w, base) {
  const r = Math.min(4, w / 2, Math.max(0, base - y));
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`;
}

function legend(names, kind) {
  return h(
    'div',
    { class: 'ch-legend' },
    names.map((name, i) =>
      h(
        'span',
        { class: 'ch-key' },
        kind === 'line'
          ? svg('svg', { width: 22, height: 12, 'aria-hidden': 'true' }, svg('line', { x1: 1, y1: 6, x2: 21, y2: 6, stroke: color(i), 'stroke-width': 2, 'stroke-linecap': 'round' }), marker(SHAPES[i], 11, 6, i, 3.5))
          : h('span', { class: 'ch-swatch', style: { background: color(i) } }),
        h('span', null, name),
      ),
    ),
  );
}

/* ---------- line and bar ---------- */

function frameGeometry(v, width) {
  const ticks = [];
  for (let t = 0; t <= v.axis.max + 1e-9; t += v.axis.step) ticks.push(Math.round(t * 1e6) / 1e6);
  const longest = Math.max(...ticks.map((t) => tickLabel(t, v.unit).length));
  const left = Math.max(30, longest * 7 + 12);
  const height = Math.round(Math.min(340, Math.max(210, width * 0.64)));
  return { left, right: 14, top: 14, bottom: 30, width, height, ticks };
}

function xLabelStep(labels, plotW) {
  const widest = Math.max(...labels.map((l) => String(l).length)) * 6.6 + 10;
  return Math.max(1, Math.ceil((widest * labels.length) / plotW));
}

function drawAxes(g, v, geo, xs) {
  const { left, top, width, height, bottom, ticks } = geo;
  const plotH = height - top - bottom;
  const y = (val) => top + plotH * (1 - val / v.axis.max);
  for (const t of ticks) {
    g.appendChild(svg('line', { x1: left, x2: width - geo.right, y1: y(t), y2: y(t), class: t === 0 ? 'ch-axis' : 'ch-grid' }));
    g.appendChild(svg('text', { x: left - 8, y: y(t) + 4, class: 'ch-tick', 'text-anchor': 'end' }, document.createTextNode(tickLabel(t, v.unit))));
  }
  const step = xLabelStep(v.x.values, width - left - geo.right);
  v.x.values.forEach((label, i) => {
    if (i % step && i !== v.x.values.length - 1) return;
    g.appendChild(svg('text', { x: xs(i), y: height - 9, class: 'ch-tick', 'text-anchor': 'middle' }, document.createTextNode(label)));
  });
  return y;
}

function lineChart(v, width, state) {
  const geo = frameGeometry(v, width);
  const { left, top, height, right } = geo;
  const n = v.x.values.length;
  const plotW = width - left - right - 12;
  const xs = (i) => left + 6 + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const root = svg('svg', { class: 'ch-svg', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${v.title}: line graph of ${v.series.map((s) => s.name).join(', ')}` });
  const y = drawAxes(root, v, geo, xs);
  const pf = v.x.projectedFrom;
  if (pf !== null && pf !== undefined) {
    const x0 = pf === 0 ? left : (xs(pf - 1) + xs(pf)) / 2;
    root.appendChild(svg('rect', { x: x0, y: top, width: width - right - x0, height: height - top - geo.bottom, class: 'ch-projected' }));
    root.appendChild(svg('text', { x: width - right - 4, y: top + 12, class: 'ch-note', 'text-anchor': 'end' }, document.createTextNode('Projected')));
  }
  const parts = [];
  v.series.forEach((s, si) => {
    const solid = svg('path', { class: 'ch-line', stroke: color(si), d: '' });
    const dashed = svg('path', { class: 'ch-line projected', stroke: color(si), d: '' });
    root.append(solid, dashed);
    parts.push({ solid, dashed, markers: [], hits: [] });
  });
  // Markers and hit targets on top of every line.
  v.series.forEach((s, si) => {
    s.values.forEach((val, i) => {
      const m = marker(SHAPES[si], xs(i), y(val), si);
      root.appendChild(m);
      parts[si].markers.push(m);
    });
  });
  v.series.forEach((s, si) => {
    s.values.forEach((val, i) => {
      const hit = svg('circle', { cx: xs(i), cy: y(val), r: 16, class: 'ch-hit', tabindex: state.editable ? 0 : -1, role: 'slider', 'aria-label': `${s.name}, ${v.x.values[i]}`, 'aria-valuenow': val, 'aria-valuemin': 0, 'aria-valuemax': v.axis.max });
      hit.dataset.s = si;
      hit.dataset.i = i;
      root.appendChild(hit);
      parts[si].hits.push(hit);
    });
  });
  const pathFor = (vals, from, to) => vals.slice(from, to + 1).map((val, k) => `${k ? 'L' : 'M'}${xs(from + k).toFixed(1)} ${y(val).toFixed(1)}`).join('');
  const redrawSeries = (si) => {
    const vals = v.series[si].values;
    const cut = pf === null || pf === undefined ? n - 1 : Math.max(0, pf - 1);
    parts[si].solid.setAttribute('d', pf === 0 ? '' : pathFor(vals, 0, cut));
    parts[si].dashed.setAttribute('d', cut < n - 1 ? pathFor(vals, cut, n - 1) : '');
  };
  v.series.forEach((_, si) => redrawSeries(si));
  return {
    root,
    toValue: (clientY, rect) => ((top + (height - top - geo.bottom) - (clientY - rect.top)) / (height - top - geo.bottom)) * v.axis.max,
    update(si, i) {
      const val = v.series[si].values[i];
      redrawSeries(si);
      const m = parts[si].markers[i];
      const fresh = marker(SHAPES[si], xs(i), y(val), si);
      m.replaceWith(fresh);
      parts[si].markers[i] = fresh;
      const hit = parts[si].hits[i];
      hit.setAttribute('cy', y(val));
      hit.setAttribute('aria-valuenow', val);
    },
  };
}

function barChart(v, width, state) {
  const geo = frameGeometry(v, width);
  const { left, top, height, right } = geo;
  const n = v.x.values.length;
  const k = v.series.length;
  const band = (width - left - right) / n;
  const bw = Math.max(6, Math.min(24, (band - 10) / k - 2));
  const groupW = k * bw + (k - 1) * 2;
  const xs = (i) => left + band * i + band / 2;
  const root = svg('svg', { class: 'ch-svg', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${v.title}: bar chart` });
  const y = drawAxes(root, v, geo, xs);
  const base = y(0);
  const bars = v.series.map(() => []);
  const hits = v.series.map(() => []);
  v.series.forEach((s, si) => {
    s.values.forEach((val, i) => {
      const x = xs(i) - groupW / 2 + si * (bw + 2);
      const bar = svg('path', { d: barPath(x, y(val), bw, base), fill: color(si), class: 'ch-bar' });
      root.appendChild(bar);
      bars[si].push(bar);
    });
  });
  v.series.forEach((s, si) => {
    s.values.forEach((val, i) => {
      const x = xs(i) - groupW / 2 + si * (bw + 2);
      const hit = svg('rect', { x: x - 1, y: top, width: bw + 2, height: base - top, class: 'ch-hit', tabindex: state.editable ? 0 : -1, role: 'slider', 'aria-label': `${s.name}, ${v.x.values[i]}`, 'aria-valuenow': val, 'aria-valuemin': 0, 'aria-valuemax': v.axis.max });
      hit.dataset.s = si;
      hit.dataset.i = i;
      root.appendChild(hit);
      hits[si].push(hit);
    });
  });
  return {
    root,
    toValue: (clientY, rect) => ((base - (clientY - rect.top)) / (base - top)) * v.axis.max,
    update(si, i) {
      const val = v.series[si].values[i];
      const x = xs(i) - groupW / 2 + si * (bw + 2);
      bars[si][i].setAttribute('d', barPath(x, y(val), bw, base));
      hits[si][i].setAttribute('aria-valuenow', val);
    },
  };
}

/* ---------- pie ---------- */

function arcPath(cx, cy, r, a0, a1) {
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return `M${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`;
  return `M${cx} ${cy}L${p(a0)}A${r} ${r} 0 ${big} 1 ${p(a1)}Z`;
}

function pieChart(v, width, state) {
  const count = v.pies.length;
  // Two pies side by side even on a small phone; a single pie stays moderate.
  const perRow = count === 1 ? 1 : width >= 170 * count ? count : width >= 280 ? 2 : 1;
  const rows = Math.ceil(count / perRow);
  const cell = width / perRow;
  const R = Math.max(44, Math.min(cell / 2 - 24, count === 1 ? 110 : 100));
  const cellH = R * 2 + 52;
  const height = rows * cellH;
  const root = svg('svg', { class: 'ch-svg', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${v.title}: pie chart${count > 1 ? 's' : ''}` });
  const pies = v.pies.map((p, pi) => {
    const cx = cell * (pi % perRow) + cell / 2;
    const cy = Math.floor(pi / perRow) * cellH + R + 14;
    const g = svg('g', { class: 'ch-pie' });
    root.appendChild(g);
    if (p.label) root.appendChild(svg('text', { x: cx, y: cy + R + 28, class: 'ch-caption', 'text-anchor': 'middle' }, document.createTextNode(p.label)));
    return { p, cx, cy, g };
  });
  const draw = (pi) => {
    const { p, cx, cy, g } = pies[pi];
    clear(g);
    const total = p.slices.reduce((s, x) => s + x.value, 0) || 1;
    let a = -Math.PI / 2;
    const bounds = [];
    p.slices.forEach((s, si) => {
      const a1 = a + (s.value / total) * Math.PI * 2;
      g.appendChild(svg('path', { d: arcPath(cx, cy, R, a, a1), fill: color(si), class: 'ch-slice' }));
      const mid = (a + a1) / 2;
      const fits = a1 - a >= 0.42;
      const rr = fits ? R * 0.64 : R + 13;
      const tx = cx + rr * Math.cos(mid);
      const ty = cy + rr * Math.sin(mid) + 4;
      g.appendChild(svg('text', { x: tx, y: ty, class: fits ? 'ch-in' : 'ch-out', fill: fits ? inkOn(si) : undefined, 'text-anchor': fits ? 'middle' : Math.cos(mid) >= 0 ? 'start' : 'end' }, document.createTextNode(`${Math.round(s.value)}%`)));
      bounds.push(a1);
      a = a1;
    });
    if (state.editable) {
      bounds.slice(0, -1).forEach((b, bi) => {
        const hx = cx + R * Math.cos(b);
        const hy = cy + R * Math.sin(b);
        g.appendChild(svg('circle', { cx: hx, cy: hy, r: 7, class: 'ch-knob' }));
        const hit = svg('circle', { cx: hx, cy: hy, r: 18, class: 'ch-hit', tabindex: 0, role: 'slider', 'aria-label': `Boundary between ${p.slices[bi].name} and ${p.slices[bi + 1].name}`, 'aria-valuenow': p.slices[bi].value });
        hit.dataset.p = pi;
        hit.dataset.b = bi;
        g.appendChild(hit);
      });
    }
  };
  pies.forEach((_, pi) => draw(pi));
  return { root, pies, redraw: draw };
}

/* ---------- table ---------- */

function tableView(v, state) {
  const editable = state.editable;
  const fmt = (val) => fmtNumber(val, v.unit?.decimals ?? 0);
  const head = h('tr', null, h('th', { scope: 'col' }, ''), v.x.values.map((x) => h('th', { scope: 'col' }, x)));
  const rows = v.series.map((s, si) =>
    h(
      'tr',
      null,
      h('th', { scope: 'row' }, s.name),
      s.values.map((val, i) =>
        h(
          'td',
          null,
          editable
            ? h('input', {
              class: 'ch-cell',
              type: 'text',
              inputmode: 'decimal',
              value: String(val),
              'aria-label': `${s.name}, ${v.x.values[i]}`,
              onChange: (e) => {
                const num = Number(String(e.target.value).replace(/[^\d.]/g, ''));
                if (Number.isFinite(num)) {
                  v.series[si].values[i] = num;
                  state.onChange?.(v);
                }
                e.target.value = String(v.series[si].values[i]);
              },
            })
            : fmt(val),
        ),
      ),
    ),
  );
  return h('div', { class: 'ch-table-wrap' }, h('table', { class: 'ch-table' }, h('thead', null, head), h('tbody', null, rows)));
}

// Pie data as a table (the "Data" view of a pie chart).
export function pieTable(v) {
  const head = h('tr', null, h('th', { scope: 'col' }, ''), v.pies.map((p) => h('th', { scope: 'col' }, p.label || '%')));
  const rows = v.pies[0].slices.map((s, i) => h('tr', null, h('th', { scope: 'row' }, s.name), v.pies.map((p) => h('td', null, `${p.slices[i].value}%`))));
  return h('div', { class: 'ch-table-wrap' }, h('table', { class: 'ch-table' }, h('thead', null, head), h('tbody', null, rows)));
}

export function unitLabel(v) {
  const u = v.unit || {};
  if (u.kind === 'percent') return '%';
  if (u.kind === 'currency') return u.symbol || '$';
  return u.label || '';
}

/* ---------- the component ---------- */

// renderChart(visual, { editable, onChange(visual), onReadout(text) })
// → { el, setEditable(bool), refresh(), destroy() }. `visual` is edited in place.
export function renderChart(v, { editable = false, onChange, onReadout } = {}) {
  const state = { editable, onChange };
  const body = h('div', { class: 'ch-body' });
  const readout = h('p', { class: 'ch-readout', 'aria-live': 'polite' });
  const unit = v.kind === 'pie' ? '' : unitLabel(v);
  const el = h(
    'figure',
    { class: ['chart', `chart-${v.kind}`] },
    h('figcaption', { class: 'ch-title' }, v.title, unit && v.kind !== 'table' ? h('span', { class: 'ch-unit' }, ` (${unit})`) : null),
    v.kind === 'table' && unit ? h('div', { class: 'ch-unit-line' }, `Figures in ${unit === '%' ? 'per cent' : unit}`) : null,
    body,
    v.kind === 'pie' ? legend(v.pies[0].slices.map((s) => s.name), 'pie') : v.kind !== 'table' && v.series.length > 1 ? legend(v.series.map((s) => s.name), v.kind) : null,
    readout,
  );
  let chart = null;
  let width = 0;
  let drag = null;
  let frame = 0;
  let pending = null;

  const say = (text) => {
    readout.textContent = text;
    onReadout?.(text);
  };

  function build() {
    width = Math.floor(body.clientWidth || el.clientWidth || 340);
    clear(body);
    el.classList.toggle('editing', state.editable);
    if (v.kind === 'table') {
      body.appendChild(tableView(v, state));
      chart = null;
      return;
    }
    chart = v.kind === 'pie' ? pieChart(v, width, state) : v.kind === 'bar' ? barChart(v, width, state) : lineChart(v, width, state);
    body.appendChild(chart.root);
  }

  const step = () => 10 ** -(v.unit?.decimals ?? 0) * (v.axis && v.axis.max > 2000 ? 1000 : v.axis && v.axis.max > 200 ? 5 : 1);
  const snap = (val) => {
    const s = step();
    return Math.max(0, Math.min(v.axis.max, Math.round(Math.round(val / s) * s * 1e6) / 1e6));
  };

  function setPoint(si, i, val) {
    v.series[si].values[i] = val;
    chart.update(si, i);
    say(`${v.series[si].name}, ${v.x.values[i]}: ${fmtValue(val, v.unit)}`);
  }

  // Moves the boundary after slice b so it sits at angle `ang` (radians from 12 o'clock).
  function setBoundary(pi, b, share) {
    const p = v.pies[pi];
    const before = p.slices.slice(0, b).reduce((s, x) => s + x.value, 0);
    const pair = p.slices[b].value + p.slices[b + 1].value;
    const left = Math.max(1, Math.min(pair - 1, Math.round(share - before)));
    p.slices[b].value = left;
    p.slices[b + 1].value = pair - left;
    chart.redraw(pi);
    say(`${p.slices[b].name} ${left}% · ${p.slices[b + 1].name} ${pair - left}%`);
  }

  function flush() {
    frame = 0;
    if (!pending || !chart) return;
    const { e } = pending;
    pending = null;
    const rect = chart.root.getBoundingClientRect();
    if (drag.kind === 'point') setPoint(drag.si, drag.i, snap(chart.toValue(e.clientY, rect)));
    else {
      const { cx, cy } = chart.pies[drag.pi];
      const ang = Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx);
      const share = (((ang + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 100;
      setBoundary(drag.pi, drag.b, share);
    }
  }

  const onDown = (e) => {
    const hit = e.target.closest?.('.ch-hit');
    if (!hit || !chart) return;
    if (hit.dataset.p !== undefined) {
      if (!state.editable) return;
      drag = { kind: 'pie', pi: Number(hit.dataset.p), b: Number(hit.dataset.b) };
    } else {
      const si = Number(hit.dataset.s);
      const i = Number(hit.dataset.i);
      say(`${v.series[si].name}, ${v.x.values[i]}: ${fmtValue(v.series[si].values[i], v.unit)}`);
      if (!state.editable) return;
      drag = { kind: 'point', si, i };
    }
    e.preventDefault();
    try {
      body.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
  };
  const onMove = (e) => {
    if (!drag) return;
    pending = { e: { clientX: e.clientX, clientY: e.clientY } };
    if (!frame) frame = requestAnimationFrame(flush);
  };
  const onUp = () => {
    if (!drag) return;
    if (frame) {
      cancelAnimationFrame(frame);
      flush();
    }
    drag = null;
    state.onChange?.(v);
  };
  const onKey = (e) => {
    const hit = e.target.closest?.('.ch-hit');
    if (!hit || !state.editable || !chart) return;
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    const down = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !down) return;
    e.preventDefault();
    if (hit.dataset.p !== undefined) {
      const pi = Number(hit.dataset.p);
      const b = Number(hit.dataset.b);
      const p = v.pies[pi];
      const before = p.slices.slice(0, b + 1).reduce((s, x) => s + x.value, 0);
      setBoundary(pi, b, before + (up ? 1 : -1));
      chart.root.querySelector(`.ch-hit[data-p="${pi}"][data-b="${b}"]`)?.focus();
    } else {
      const si = Number(hit.dataset.s);
      const i = Number(hit.dataset.i);
      const delta = Math.max(step(), v.axis.step / (e.shiftKey ? 2 : 10));
      setPoint(si, i, snap(v.series[si].values[i] + (up ? delta : -delta)));
    }
    state.onChange?.(v);
  };

  body.addEventListener('pointerdown', onDown);
  body.addEventListener('pointermove', onMove);
  body.addEventListener('pointerup', onUp);
  body.addEventListener('pointercancel', onUp);
  body.addEventListener('keydown', onKey);

  // Redraw when the width changes (rotation, split view), one frame later.
  let resizeFrame = 0;
  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (Math.abs(Math.floor(body.clientWidth) - width) > 2 && !drag) build();
      });
    })
    : null;
  observer?.observe(body);
  requestAnimationFrame(build);

  return {
    el,
    setEditable(on) {
      state.editable = on;
      say(on ? (v.kind === 'pie' ? 'Drag a handle on the edge of a slice.' : v.kind === 'table' ? 'Tap a figure to change it.' : 'Drag a point or bar up or down.') : '');
      build();
    },
    refresh: build,
    destroy() {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
    },
  };
}
