// Draws a map task: the two maps side by side in a wide container and stacked
// on a phone (a CSS container query, no resize listeners). Schematic exam
// style: flat fills, features labelled on the map, a north arrow on each.
// setHighlight(ids) outlines features in both maps for the drills.
import { h, svg } from '../ui/dom.js';
import { MAP_CELL as C, LABEL_SIZE, fitLabel, wrapLabel, textWidth, isLinear } from '../core/maps.js';

const PAD = 6; // frame margin
const HEAD = 30; // caption strip above the frame
const INSET = 3; // gap between neighbouring features
const BAND = Math.round(C * 0.6); // drawn width of a road or river strip
const SIZES = [LABEL_SIZE, 13, 12];

// Drawing order: background, land uses, strips, structures, buildings.
const LAYER = {
  sea: 0, island: 0, lake: 1, beach: 1, farmland: 1, woodland: 1, park: 1, sports: 1, carpark: 1, square: 1,
  river: 2, railway: 2, path: 2, road: 2, bridge: 3, pier: 3, pool: 4, building: 4, houses: 4, shops: 4, industry: 4,
};
const STRIP_ORDER = { river: 0, railway: 1, path: 2, square: 3, road: 4 };
const rank = (f) => (isLinear(f) ? 20 + (STRIP_ORDER[f.type] ?? 4) : (LAYER[f.type] ?? 4) * 10);
const WATER = new Set(['sea', 'lake', 'river']);
let seq = 0;

const text = (s) => document.createTextNode(s);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function patterns(id) {
  return svg(
    'defs',
    {},
    svg('pattern', { id: `${id}-wood`, width: 12, height: 12, patternUnits: 'userSpaceOnUse' },
      svg('circle', { cx: 3, cy: 3, r: 2.3, class: 'map-tree' }), svg('circle', { cx: 9, cy: 9, r: 2.3, class: 'map-tree' })),
    svg('pattern', { id: `${id}-farm`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, class: 'map-furrow' })),
  );
}

function northArrow(x) {
  return svg(
    'g',
    { class: 'map-north', 'aria-hidden': 'true' },
    svg('path', { d: `M${x} 5L${x + 5} 19L${x} 15.5L${x - 5} 19Z` }),
    svg('text', { x: x - 9, y: 18, 'text-anchor': 'end', class: 'map-north-n' }, text('N')),
  );
}

// One map. Returns { el, highlight(set) }.
function drawMap(map, side, place) {
  const id = `mp${++seq}`;
  const { cols, rows } = map;
  const { label, features } = map[side];
  const W = cols * C + PAD * 2;
  const H = HEAD + rows * C + PAD;
  const X = (gx) => PAD + gx * C;
  const Y = (gy) => HEAD + gy * C;
  const box = (f, inset = 0) => ({ x: X(f.x) + inset, y: Y(f.y) + inset, w: f.w * C - inset * 2, h: f.h * C - inset * 2 });
  const shapes = new Map();
  const labelBoxes = [];
  const layers = [0, 1, 2, 3, 4].map(() => svg('g', {}));
  const cases = svg('g', {});
  const labels = svg('g', { class: 'map-labels' });
  const hl = svg('g', { class: 'map-hl' });
  const area = { x: X(0), y: Y(0), w: cols * C, h: rows * C };

  const keep = (f, el) => {
    el.setAttribute('data-id', f.id);
    if (!shapes.has(f.id)) shapes.set(f.id, []);
    shapes.get(f.id).push(el);
    return el;
  };
  const rect = (f, inset, cls, rx = 3, extra = {}) => {
    const b = box(f, inset);
    return svg('rect', { x: b.x, y: b.y, width: Math.max(1, b.w), height: Math.max(1, b.h), rx, class: cls, ...extra });
  };

  // A beach runs right down to the water (or an island's coast) where it meets it.
  const beach = (f) => {
    const isl = features.find((g) => g.type === 'island' && overlaps(box(g), box(f)));
    const within = (g, x, y) => x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h;
    const wet = (x, y) => features.some((g) => (g.type === 'lake' || g.type === 'river' || (g.type === 'sea' && !isl)) && within(g, x, y));
    const side = (cells) => {
      if (isl && cells.some(([x, y]) => !within(isl, x, y))) return -9;
      return cells.some(([x, y]) => wet(x, y)) ? 0 : INSET;
    };
    const across = (y) => [...Array(f.w).keys()].map((k) => [f.x + k, y]);
    const down = (x) => [...Array(f.h).keys()].map((k) => [x, f.y + k]);
    const [n, e, s2, w] = [side(across(f.y - 1)), side(down(f.x + f.w)), side(across(f.y + f.h)), side(down(f.x - 1))];
    const b = box(f);
    return svg('rect', { x: b.x + w, y: b.y + n, width: b.w - w - e, height: b.h - n - s2, rx: 3, class: 'mf map-beach' });
  };

  // A strip as a line along its middle. An end that joins another strip runs
  // on to its centre line, so junctions meet.
  const joins = (f, x, y) => f.type !== 'river' && features.some((g) => g !== f && isLinear(g) && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h);
  const stripLine = (f, cls, width, extra = {}) => {
    const b = box(f);
    const horiz = f.w >= f.h;
    const e0 = (horiz ? joins(f, f.x - 1, f.y) : joins(f, f.x, f.y - 1)) ? C / 2 : 0;
    const e1 = (horiz ? joins(f, f.x + f.w, f.y) : joins(f, f.x, f.y + f.h)) ? C / 2 : 0;
    const coords = horiz
      ? { x1: b.x - e0, y1: b.y + b.h / 2, x2: b.x + b.w + e1, y2: b.y + b.h / 2 }
      : { x1: b.x + b.w / 2, y1: b.y - e0, x2: b.x + b.w / 2, y2: b.y + b.h + e1 };
    return svg('line', { ...coords, class: cls, 'stroke-width': width * Math.min(f.w, f.h), ...extra });
  };

  for (const f of features.slice().sort((a, b) => rank(a) - rank(b))) {
    const layer = layers[isLinear(f) ? 2 : LAYER[f.type] ?? 4];
    const t = f.type;
    if (t === 'sea') layer.append(keep(f, rect(f, 0, 'mf map-sea', 0)));
    else if (t === 'island') layer.append(keep(f, rect(f, -9, 'mf map-island', C * 0.9)));
    else if (t === 'beach') layer.append(keep(f, beach(f)));
    else if (t === 'lake') layer.append(keep(f, rect(f, INSET, 'mf map-lake', Math.min(f.w, f.h) * C * 0.42)));
    else if (t === 'woodland' || t === 'farmland') {
      const g = svg('g', { class: `mf map-${t}` }, rect(f, INSET, 'map-base', t === 'woodland' ? 9 : 2),
        rect(f, INSET, 'map-texture', t === 'woodland' ? 9 : 2, { fill: `url(#${id}-${t === 'woodland' ? 'wood' : 'farm'})` }));
      layer.append(keep(f, g));
    } else if (t === 'sports') {
      const g = svg('g', { class: 'mf map-sports' }, rect(f, INSET, 'map-base', 3));
      if (f.w * C > 40 && f.h * C > 40) g.append(rect(f, INSET + 7, 'map-pitch', 1));
      layer.append(keep(f, g));
    } else if (t === 'square' && isLinear(f)) {
      cases.append(keep(f, stripLine(f, 'mf map-square-edge', BAND + 3)));
      layer.append(keep(f, stripLine(f, 'mf map-square-strip', BAND)));
    } else if (t === 'road') {
      cases.append(keep(f, stripLine(f, 'mf map-road-edge', BAND + 3)));
      layer.append(keep(f, stripLine(f, 'mf map-road', BAND)));
    } else if (t === 'river') {
      layer.append(keep(f, stripLine(f, 'mf map-river', BAND + 2)));
    } else if (t === 'railway') {
      layer.append(keep(f, stripLine(f, 'mf map-rail', 2.5 / Math.min(f.w, f.h))), keep(f, stripLine(f, 'mf map-rail-ties', 9 / Math.min(f.w, f.h))));
    } else if (t === 'path') {
      layer.append(keep(f, stripLine(f, 'mf map-path', 2.5 / Math.min(f.w, f.h))));
    } else if (t === 'bridge') {
      const over = features.find((g) => (g.type === 'river' || g.type === 'railway') && overlaps(box(g), box(f)));
      const across = over ? over.h > over.w : f.w >= f.h; // deck runs across the river
      const b = box(f);
      const d = across
        ? { x: b.x - 4, y: b.y + (b.h - BAND - 4) / 2, width: b.w + 8, height: BAND + 4 }
        : { x: b.x + (b.w - BAND - 4) / 2, y: b.y - 4, width: BAND + 4, height: b.h + 8 };
      const [x0, y0, x1, y1] = [d.x, d.y, d.x + d.width, d.y + d.height];
      const rails = across
        ? `M${x0 - 3} ${y0 - 3}L${x0} ${y0}H${x1}L${x1 + 3} ${y0 - 3}M${x0 - 3} ${y1 + 3}L${x0} ${y1}H${x1}L${x1 + 3} ${y1 + 3}`
        : `M${x0 - 3} ${y0 - 3}L${x0} ${y0}V${y1}L${x0 - 3} ${y1 + 3}M${x1 + 3} ${y0 - 3}L${x1} ${y0}V${y1}L${x1 + 3} ${y1 + 3}`;
      layer.append(keep(f, svg('g', { class: 'mf map-bridge' }, svg('rect', { ...d, class: 'map-deck' }), svg('path', { d: rails, class: 'map-parapet' }))));
    } else if (t === 'pier') {
      const b = box(f);
      const horiz = f.w > f.h;
      const r = horiz ? { x: b.x, y: b.y + b.h / 2 - 5, width: b.w, height: 10 } : { x: b.x + b.w / 2 - 5, y: b.y, width: 10, height: b.h };
      layer.append(keep(f, svg('rect', { ...r, rx: 2, class: 'mf map-pier' })));
    } else {
      layer.append(keep(f, rect(f, INSET, `mf map-${t in LAYER ? t : 'building'}`, t === 'pool' ? 6 : 3)));
    }
  }

  /* ---------- labels ---------- */

  const solids = features.filter((f) => f.type !== 'sea' && f.type !== 'island').map((f) => ({ f, b: box(f) }));
  const lineHeight = (size) => Math.round(size * 1.15);
  const free = (b, self) => b.x >= area.x && b.y >= area.y && b.x + b.w <= area.x + area.w && b.y + b.h <= area.y + area.h &&
    !labelBoxes.some((o) => overlaps(o, b)) && !solids.some((s) => s.f !== self && overlaps(s.b, b));

  const write = (f, lines, size, cx, cy, { cls = '', rotate = false, halo = f.type } = {}) => {
    const lh = lineHeight(size);
    const width = Math.max(...lines.map((l) => textWidth(l, size)));
    const top = cy - (lines.length * lh) / 2;
    const attrs = { x: cx, y: top + lh / 2 + size * 0.35, 'font-size': size, class: `map-t map-t-${halo} ${cls}`.trim(), 'data-id': f.id };
    if (rotate) attrs.transform = `rotate(-90 ${cx} ${cy})`;
    const el = lines.length === 1
      ? svg('text', attrs, text(lines[0]))
      : svg('text', attrs, lines.map((l, i) => svg('tspan', { x: cx, dy: i ? lh : 0 }, text(l))));
    labels.append(el);
    const bw = rotate ? lines.length * lh : width;
    const bh = rotate ? width : lines.length * lh;
    labelBoxes.push({ x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh });
    if (shapes.has(f.id)) shapes.get(f.id).push(el);
  };

  // Beside the feature, at the cheapest spot: covering another label costs most,
  // then the feature itself, then buildings, then other shapes, then distance.
  // Always inside the frame.
  const BUILT = new Set(['building', 'houses', 'shops', 'industry', 'pool']);
  const shared = (a, o) => Math.max(0, Math.min(a.x + a.w, o.x + o.w) - Math.max(a.x, o.x)) * Math.max(0, Math.min(a.y + a.h, o.y + o.h) - Math.max(a.y, o.y));
  const besideOrOn = (f, lines, size) => {
    const b = box(f);
    const lh = lineHeight(size);
    const w = Math.max(...lines.map((l) => textWidth(l, size))) + 4;
    const hgt = lines.length * lh;
    const clamp = (x, y) => ({
      x: Math.min(Math.max(x, area.x + 2), area.x + area.w - w - 2),
      y: Math.min(Math.max(y, area.y + 2), area.y + area.h - hgt - 2), w, h: hgt,
    });
    const cost = (bx, d) => d * 0.5 + labelBoxes.reduce((n, o) => n + shared(o, bx) * 20, 0) + shared(b, bx) * 8 +
      solids.reduce((n, o) => n + (o.f === f ? 0 : shared(o.b, bx) * (BUILT.has(o.f.type) ? 3 : 0.4)), 0);
    let best = null;
    for (const gap of [3, 3 + C / 2, 3 + C]) {
      const xs = [b.x + b.w / 2 - w / 2, b.x, b.x + b.w - w];
      const ys = [b.y + b.h / 2 - hgt / 2, b.y, b.y + b.h - hgt];
      const spots = [
        ...ys.map((y) => [b.x + b.w + gap, y]), ...ys.map((y) => [b.x - gap - w, y]),
        ...xs.map((x) => [x, b.y - gap - hgt]), ...xs.map((x) => [x, b.y + b.h + gap]),
      ];
      for (const [x, y] of spots) {
        const bx = clamp(x, y);
        const c = cost(bx, gap);
        if (!best || c < best.c) best = { c, bx };
      }
    }
    write(f, lines, size, best.bx.x + w / 2, best.bx.y + hgt / 2, { halo: 'land', cls: 'map-t-out' });
  };

  // Along a strip, in its longest stretch not crossed by another strip.
  const alongStrip = (f) => {
    const horiz = f.w >= f.h;
    const n = horiz ? f.w : f.h;
    const crossed = (i) => features.some((g) => g !== f && (isLinear(g) || g.type === 'bridge') &&
      overlaps(box(g), box(horiz ? { x: f.x + i, y: f.y, w: 1, h: f.h } : { x: f.x, y: f.y + i, w: f.w, h: 1 })));
    let best = [0, 0];
    for (let i = 0, start = 0; i <= n; i++) {
      if (i === n || crossed(i)) {
        if (i - start > best[1] - best[0]) best = [start, i];
        start = i + 1;
      }
    }
    const b = box(f);
    const size = SIZES.find((s) => textWidth(f.label, s) + 10 <= (best[1] - best[0]) * C) || SIZES[2];
    // Slide along the free stretch to the spot that covers the fewest other labels.
    const half = (textWidth(f.label, size) + 6) / 2;
    const lo = best[0] * C + half;
    const hi = Math.max(lo, best[1] * C - half);
    const at = (m) => (horiz ? { x: b.x + m - half, y: b.y + b.h / 2 - size * 0.7, w: half * 2, h: size * 1.4 } : { x: b.x + b.w / 2 - size * 0.7, y: b.y + m - half, w: size * 1.4, h: half * 2 });
    const centreOf = (lo + hi) / 2;
    let mid = centreOf;
    let bestCost = Infinity;
    for (let m = lo; m <= hi + 0.1; m += C / 4) {
      const c = labelBoxes.reduce((n, o) => n + shared(o, at(m)), 0) * 100 + Math.abs(m - centreOf);
      if (c < bestCost) {
        bestCost = c;
        mid = m;
      }
    }
    const cx = horiz ? b.x + mid : b.x + b.w / 2;
    const cy = horiz ? b.y + b.h / 2 : b.y + mid;
    const cls = f.type === 'river' ? 'map-t-water' : '';
    write(f, [f.label], size, cx, cy, { rotate: !horiz, cls, halo: f.type === 'road' ? 'road' : f.type === 'river' ? 'river' : f.type === 'square' ? 'square' : 'land' });
  };

  // The sea's name goes in its widest stretch of open water clear of other labels.
  const seaLabel = (f) => {
    const taken = (x, y) => features.some((g) => g.type !== 'sea' && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h);
    const width = textWidth(f.label) + 12;
    const runs = [];
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x, start = f.x; x <= f.x + f.w; x++) {
        if (x < f.x + f.w && !taken(x, y)) continue;
        const cx = X(start + (x - start) / 2);
        const cy = Y(y + 0.5);
        const lb = { x: cx - width / 2, y: cy - 10, w: width, h: 20 };
        if ((x - start) * C >= width) runs.push({ cx, cy, len: x - start, clash: labelBoxes.some((o) => overlaps(o, lb)) });
        start = x + 1;
      }
    }
    const best = runs.sort((a, b) => a.clash - b.clash || b.len - a.len)[0];
    if (best) write(f, [f.label], LABEL_SIZE, best.cx, best.cy, { cls: 'map-t-water', halo: 'sea' });
  };

  // Labels inside their features first, then strips and the sea, then the
  // ones that must go beside their feature (so those can avoid all the rest).
  const outside = [];
  for (const f of features) {
    if (!f.label || f.type === 'island' || f.type === 'bridge' || f.type === 'sea' || isLinear(f)) continue;
    const fit = f.type !== 'pier' && fitLabel(f.label, f.w, f.h, SIZES);
    const b = box(f);
    if (fit && free({ x: b.x + b.w / 2 - 1, y: b.y + b.h / 2 - 1, w: 2, h: 2 }, f)) {
      write(f, fit.lines, fit.size, b.x + b.w / 2, b.y + b.h / 2, { cls: WATER.has(f.type) ? 'map-t-water' : '' });
    } else outside.push(f);
  }
  for (const f of outside) {
    const lines = f.type === 'pier' ? [f.label] : wrapLabel(f.label, 4 * C, SIZES[2], 3) || wrapLabel(f.label, 6 * C, SIZES[2], 4) || [f.label];
    besideOrOn(f, lines, f.type === 'pier' ? SIZES[1] : SIZES[2]);
  }
  for (const f of features) if (f.label && isLinear(f)) alongStrip(f);
  for (const f of features) if (f.label && f.type === 'sea') seaLabel(f);

  const names = [...new Set(features.filter((f) => f.label && f.type !== 'island').map((f) => f.label))];
  const root = svg(
    'svg',
    { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${label}: map of ${place}${names.length ? ` showing ${names.join(', ')}` : ''}` },
    patterns(id),
    svg('text', { x: PAD, y: 21, class: 'map-cap' }, text(label)),
    northArrow(W - PAD - 6),
    svg('rect', { ...area, width: area.w, height: area.h, class: 'map-land' }),
    layers[0], layers[1], cases, layers[2], layers[3], layers[4], hl, labels,
    svg('rect', { ...area, width: area.w, height: area.h, class: 'map-frame' }),
  );

  function highlight(ids) {
    while (hl.firstChild) hl.removeChild(hl.firstChild);
    root.classList.toggle('has-hl', features.some((f) => ids.has(f.id)));
    for (const [fid, els] of shapes) for (const el of els) el.classList.toggle('is-hl', ids.has(fid));
    for (const f of features) {
      if (!ids.has(f.id) || f.type === 'sea' || f.type === 'island') continue;
      const b = box(f, f.type === 'bridge' ? -4 : 0);
      hl.append(svg('rect', { x: b.x + 1, y: b.y + 1, width: Math.max(2, b.w - 2), height: Math.max(2, b.h - 2), rx: 5, class: 'map-hl-ring' }));
    }
  }

  return { el: root, highlight };
}

// { el, setHighlight(ids) }: both maps of a MapVisual, captioned with their labels.
export function renderMapPair(map, { highlight = [] } = {}) {
  const place = map.place || 'the area';
  const panes = [drawMap(map, 'before', place), drawMap(map, 'after', place)];
  const el = h('div', { class: 'map-pair' }, h('div', { class: 'map-pair-maps' }, panes.map((p) => p.el)));
  const setHighlight = (ids) => {
    const set = new Set(ids || []);
    for (const p of panes) p.highlight(set);
  };
  setHighlight(highlight);
  return { el, setHighlight };
}
