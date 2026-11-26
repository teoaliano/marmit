/* anchor control: a 3 × 3 dot grid on the bar that sets horizontal and vertical alignment in one click. The chosen
   dot is a filled highlight that springs between cells and keeps its speed when retargeted mid-move. */
import { Spring } from '../physics';
import type { AnchorValue, AnchorX, AnchorY } from '../types';
import { h, head, trigger, type Build } from './dom';

export const ANCHOR_X: AnchorX[] = ['left', 'center', 'right'];
export const ANCHOR_Y: AnchorY[] = ['top', 'center', 'bottom'];

/** a clean value: anything invalid falls back to `def`, then to center */
export function anchorNorm(v: unknown, def?: unknown): AnchorValue {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<AnchorValue>, d = (def && typeof def === 'object' ? def : {}) as Partial<AnchorValue>;
  const pick = <T>(all: T[], a: unknown, b: unknown) => (all.includes(a as T) ? a : all.includes(b as T) ? b : 'center') as T;
  return { x: pick(ANCHOR_X, o.x, d.x), y: pick(ANCHOR_Y, o.y, d.y) };
}

/** the cell an arrow key moves to, one step and no wrapping; null if the key isn't an arrow */
export function anchorMove(v: AnchorValue, key: string): AnchorValue | null {
  const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key];
  if (!d) return null;
  const i = Math.max(0, Math.min(2, ANCHOR_X.indexOf(v.x) + d[0])), j = Math.max(0, Math.min(2, ANCHOR_Y.indexOf(v.y) + d[1]));
  return { x: ANCHOR_X[i], y: ANCHOR_Y[j] };
}

export const anchorLabel = (x: AnchorX, y: AnchorY) =>
  x === 'center' && y === 'center' ? 'Center' : `${y[0].toUpperCase() + y.slice(1)} ${x}`;

// critically damped spring with a 0.3 s visual duration (bounce 0): k = (2π / 0.3)², c = 2√k
const K = (2 * Math.PI / 0.3) ** 2, C = 2 * Math.sqrt(K);
/** sizes of the two grids: on the bar it fits a 32px item; in a panel it's big enough to aim at comfortably */
const SIZES = { bar: { cell: 9, pad: 2.5, hl: 7 }, panel: { cell: 44, pad: 6, hl: 18 } };

/** the 3 × 3 grid itself: cells, keys and the sprung highlight. `pick` is called with the new value. */
function grid(kind: 'bar' | 'panel', label: () => string, value: () => AnchorValue, pick: (v: AnchorValue) => void) {
  const S = SIZES[kind];
  const el = h('div', 'mm-anchor' + (kind === 'panel' ? ' big' : ''), { role: 'radiogroup' }), hl = h('i', 'mm-anchor-hl', { 'aria-hidden': 'true' });
  hl.style.width = hl.style.height = S.hl + 'px';
  hl.style.left = hl.style.top = S.pad + (S.cell - S.hl) / 2 + 'px';
  const cells: HTMLButtonElement[] = [];
  ANCHOR_Y.forEach(y => ANCHOR_X.forEach(x => {
    const b = h('button', 'mm-anchor-cell', { type: 'button', role: 'radio', 'aria-label': anchorLabel(x, y), 'data-x': x, 'data-y': y }, h('span', 'mm-anchor-dot'));
    b.addEventListener('click', () => pick({ x, y }));
    cells.push(b);
  }));
  el.append(hl, ...cells);
  el.addEventListener('keydown', e => {
    const n = anchorMove(value(), e.key); if (!n) return;
    e.preventDefault(); e.stopPropagation();
    cells[ANCHOR_Y.indexOf(n.y) * 3 + ANCHOR_X.indexOf(n.x)].focus(); pick(n);
  });
  // the highlight follows a spring per axis; one rAF loop runs only while it moves
  const sx = new Spring(S.cell, 0.01), sy = new Spring(S.cell, 0.01); let raf = 0, last = 0, placed = false;
  const draw = () => { hl.style.transform = `translate(${sx.x.toFixed(2)}px,${sy.x.toFixed(2)}px)`; };
  const tick = (t: number) => {
    const dt = Math.min(1 / 30, (t - last) / 1000 || 1 / 60); last = t;
    for (let i = 0; i < 4; i++) { sx.step(dt / 4, K, C); sy.step(dt / 4, K, C); }
    if (sx.rest && sy.rest) { sx.snap(); sy.snap(); raf = 0; } else raf = requestAnimationFrame(tick);
    draw();
  };
  return {
    el,
    apply() {
      const v = value();
      el.setAttribute('aria-label', label());
      cells.forEach(b => { const on = b.dataset.x === v.x && b.dataset.y === v.y; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      sx.t = ANCHOR_X.indexOf(v.x) * S.cell; sy.t = ANCHOR_Y.indexOf(v.y) * S.cell;
      // the first placement (and a detached element) jumps straight there
      if (!placed || !el.isConnected) { placed = true; sx.snap(); sy.snap(); draw(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    destroy() { cancelAnimationFrame(raf); },
  };
}

/** a 14px picture of the grid with the chosen cell filled: the panel trigger's icon */
const glyph = (v: AnchorValue) => {
  let d = '';
  ANCHOR_Y.forEach((y, j) => ANCHOR_X.forEach((x, i) => {
    const on = x === v.x && y === v.y, cx = 2.5 + i * 4.5, cy = 2.5 + j * 4.5;
    d += on ? `<circle cx="${cx}" cy="${cy}" r="2.1" fill="currentColor"/>` : `<circle cx="${cx}" cy="${cy}" r=".9" fill="currentColor" opacity=".55"/>`;
  }));
  return `<svg viewBox="0 0 14 14" aria-hidden="true">${d}</svg>`;
};

export const anchor: Build = (c, ctx) => {
  c.hasValue = true;
  const val = () => (c.value = anchorNorm(c.value, c.cfg.value));
  const label = () => c.cfg.label ?? 'Anchor';
  const set = (v: AnchorValue) => { const cur = val(); if (cur.x === v.x && cur.y === v.y) return; c.value = v; c.apply(); ctx.emit(c, v); };

  /* display: 'panel': a trigger on the bar (its icon shows the choice) opening a big grid */
  if (c.cfg.display === 'panel') {
    const renderTrigger = trigger(c, ctx, undefined, () => glyph(val()));
    let big: ReturnType<typeof grid> | null = null, readout: HTMLElement | null = null;
    const paintIcon = () => { const ic = c.el.querySelector<HTMLElement>('.mm-ic'); if (ic && !c.cfg.icon) ic.innerHTML = glyph(val()); };
    c.render = () => { renderTrigger(); val(); paintIcon(); };
    c.apply = () => { const v = val(); paintIcon(); big?.apply(); if (readout) readout.textContent = anchorLabel(v.x, v.y); };
    c.panel = {
      build(pc) {
        big = grid('panel', label, val, set); readout = h('span', 'mm-anchor-out');
        pc.replaceChildren(...[head(c.cfg.title, label(), readout)].filter(Boolean) as Node[], big.el);
        c.apply();
      },
      onOpen: pc => pc.querySelector<HTMLElement>('.mm-anchor-cell[aria-checked=true]'),
    };
    c.destroy = () => big?.destroy();
    return;
  }

  /* on the bar: the small grid is the item */
  const g = grid('bar', label, val, set);
  g.el.dataset.mmNodrag = ''; c.el = g.el; c.follow = false;
  c.render = () => { val(); };
  c.apply = () => g.apply();
  c.destroy = () => g.destroy();
};
