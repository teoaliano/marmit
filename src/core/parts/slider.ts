/* The slider, in three variants:
   - fill: the whole 32px item is the slider, a pill that fills, with label and value inside (the default)
   - notched: one cell per value, for small stepped ranges; a more exact alternative to fill
   - knob: a compact rotary knob, drag up/right to turn it up, double-click to reset (Ableton-style)
   All share the value rules: the step grid from min, keyboard stepping, click the value to type. */
import { clamp, isReduced } from '../physics';
import { h, type Ctl, type Ctx } from './dom';
import { clickToType, decimals, snapGrid, stepKey, withUnit } from './num';

export type SliderVariant = 'fill' | 'notched' | 'knob';
/** most cells a notched slider draws; a range with more steps falls back to fill */
export const MAX_NOTCHES = 24;

/** rubber band: how far an overscroll of x px shows, flattening toward d */
const rubber = (x: number, d = 26) => Math.sign(x) * (1 - 1 / (Math.abs(x) * .55 / d + 1)) * d;
const svgNS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string> = {}) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export function sliderVariant(c: Ctl, ctx: Ctx, variant: SliderVariant) {
  const lim = () => { const min = c.cfg.min ?? 0, max = c.cfg.max ?? 100; return { min, max, step: c.cfg.step ?? (max - min > 10 ? 1 : (max - min) / 100) }; };
  const steps = () => { const { min, max, step } = lim(), n = (max - min) / step; return Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Infinity; };
  if (variant !== 'notched' && variant !== 'knob') variant = 'fill';
  if (variant === 'notched' && steps() > MAX_NOTCHES) variant = 'fill';
  const kind = variant;
  const plain = (v: number) => { const { min, max, step } = lim(); return v.toFixed(decimals(step, min, max)); };
  const set = (v: number) => { const { min, max, step } = lim(); v = snapGrid(v, step, min, max); if (v !== c.value) { c.value = v; c.apply(); ctx.emit(c, v); } return v; };
  const frac = () => { const { min, max } = lim(), v = c.value as number; return max > min ? clamp((v - min) / (max - min), 0, 1) : 0; };
  /** where the fill starts: 0, or the zero point when the range crosses zero (it then fills outward from there) */
  const zero = () => { const { min, max } = lim(); return min < 0 && max > 0 ? -min / (max - min) : 0; };
  const editable = () => c.cfg.editable !== false && c.cfg.showValue !== false;
  const initial = { v: undefined as number | undefined };

  // the value text (with its unit) and the click-to-type editor on it
  const valueEl = (cls: string) => h('span', 'mm-value ' + cls, { tabindex: -1 });
  const paint = (out: HTMLElement) => {
    const v = c.value as number, unit = c.cfg.unit as string | undefined, txt = c.cfg.format ? c.cfg.format(v) : plain(v);
    out.replaceChildren(txt, ...(unit ? [h('span', 'mm-unit', {}, withUnit('', unit))] : []));
    return unit ? `${txt} ${unit}` : txt;
  };
  /** arrows / Page / Home / End step; Enter types; double-click (knob) resets */
  const keys = (target: HTMLElement, open: () => void) => target.addEventListener('keydown', e => {
    if (e.target !== target || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') { if (editable()) { e.preventDefault(); e.stopPropagation(); open(); } return; }
    const { min, max, step } = lim(), n = stepKey(e.key, c.value as number, min, max, step, e.shiftKey);
    if (n === null) return;
    e.preventDefault(); e.stopPropagation(); set(n);
  });
  const aria = (s: HTMLElement, text: string) => {
    const { min, max } = lim();
    s.setAttribute('aria-valuemin', String(min)); s.setAttribute('aria-valuemax', String(max));
    s.setAttribute('aria-valuenow', String(c.value)); s.setAttribute('aria-valuetext', text); s.setAttribute('aria-label', c.cfg.label ?? 'Value');
  };
  const initValue = () => { const { min, max } = lim(); if (typeof c.value !== 'number') c.value = c.cfg.value ?? (min + max) / 2; initial.v ??= c.value as number; };
  c.follow = true; c.hasValue = true;

  /* ---------------- fill: the item is the slider ---------------- */
  if (kind === 'fill') {
    const el = h('div', 'mm-sf', { role: 'slider', tabindex: 0 }), base = h('div', 'mm-sf-base'), fill = h('div', 'mm-sf-fill'),
      tx = h('div', 'mm-sf-tx'), on = h('div', 'mm-sf-tx on', { 'aria-hidden': 'true' }),
      lab = h('span', 'mm-sf-l'), labOn = h('span', 'mm-sf-l'), out = valueEl('mm-sf-v'), outOn = h('span', 'mm-value mm-sf-v'), marks = h('div', 'mm-sf-marks');
    tx.append(lab, out); on.append(labOn, outOn); base.append(marks, fill, tx, on); el.append(base);
    el.dataset.mmNodrag = ''; c.el = el;
    const ed = clickToType(out, {
      get: () => c.value as number, text: () => plain(c.value as number), commit: v => set(v),
      step: (k, v, shift) => { const { min, max, step } = lim(); return stepKey(k, v, min, max, step, shift); },
      get label() { return c.cfg.label ?? 'Value'; },
    });
    const open = () => { if (!editable()) return; el.classList.add('editing'); ed.open(); };
    el.addEventListener('focusout', () => setTimeout(() => { if (!ed.editing) el.classList.remove('editing'); }, 0));
    out.addEventListener('focus', () => el.focus({ preventScroll: true }));
    keys(el, open);
    // drag is relative to where you grabbed it, so a press never makes the value jump; Shift drags 10× finer
    let p: { id: number; x: number; y: number; raw: number; moved: boolean; last: number } | null = null;
    const along = (e: PointerEvent) => { const a = ctx.angleOf(c); return e.clientX * Math.cos(a) + e.clientY * Math.sin(a); };
    el.addEventListener('pointerdown', e => {
      if (e.button || el.classList.contains('editing')) return;
      e.stopPropagation(); el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true });
      p = { id: e.pointerId, x: e.clientX, y: e.clientY, raw: frac(), moved: false, last: along(e) };
      base.classList.remove('settle');
    });
    el.addEventListener('pointermove', e => {
      if (!p || e.pointerId !== p.id) return;
      if (!p.moved) { if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 3) return; p.moved = true; el.classList.add('drag'); p.last = along(e); }
      const W = base.offsetWidth || 1, d = along(e) - p.last; p.last = along(e);
      p.raw += d / W * (e.shiftKey ? .1 : 1);
      const { min, max } = lim(); set(min + clamp(p.raw, 0, 1) * (max - min));
      // past an end the pill stretches that way and squashes a little, like rubber
      const ex = p.raw < 0 ? p.raw : p.raw > 1 ? p.raw - 1 : 0, o = Math.abs(rubber(ex * W)) / W;
      base.style.transformOrigin = ex < 0 ? 'right center' : 'left center';
      base.style.transform = o ? `scale(${1 + o * .5}, ${1 - o * .9})` : '';
    });
    const end = (e: PointerEvent) => {
      if (!p || e.pointerId !== p.id) return;
      const q = p; p = null; el.classList.remove('drag');
      if (base.style.transform) { base.classList.add('settle'); base.style.transform = ''; }
      if (!q.moved) {
        // a tap on the value types; anywhere else does nothing (relative drag never jumps)
        const r = out.getBoundingClientRect();
        if (e.clientX >= r.left - 6 && e.clientX <= r.right + 6) open();
      }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    c.render = () => {
      initValue();
      el.style.width = (c.cfg.width ?? 168) + 'px';
      lab.textContent = labOn.textContent = c.cfg.label ?? ''; out.hidden = outOn.hidden = c.cfg.showValue === false;
      // few steps: a dot at each notch; a range across zero: a mark at zero
      const n = steps(); marks.replaceChildren();
      if (n <= 10) for (let i = 1; i < n; i++) { const m = h('i', 'mm-sf-mk'); m.style.left = i / n * 100 + '%'; marks.append(m); }
      if (zero()) { const m = h('i', 'mm-sf-mk zero'); m.style.left = zero() * 100 + '%'; marks.append(m); }
    };
    c.apply = () => {
      const f = frac(), z = zero(), a = Math.min(z, f), b = Math.max(z, f);
      const clip = `inset(0 ${((1 - b) * 100).toFixed(3)}% 0 ${(a * 100).toFixed(3)}% round 999px)`;
      fill.style.clipPath = on.style.clipPath = clip;
      const t = paint(out); paint(outOn); aria(el, t);
    };
    return;
  }

  const el = h('div', 'mm-labeled mm-sv ' + (kind === 'knob' ? 'mm-sknob' : 'mm-snotch')), lab = h('span', 'mm-label'), out = valueEl('');
  el.dataset.mmNodrag = ''; c.el = el;
  const ed = clickToType(out, {
    get: () => c.value as number, text: () => plain(c.value as number), commit: v => set(v),
    step: (k, v, shift) => { const { min, max, step } = lim(); return stepKey(k, v, min, max, step, shift); },
    get label() { return c.cfg.label ?? 'Value'; },
  });
  out.addEventListener('click', e => { if (!editable()) e.stopImmediatePropagation(); }, true);

  /* ---------------- notched: one cell per value ---------------- */
  if (kind === 'notched') {
    const row = h('div', 'mm-sn', { role: 'slider', tabindex: 0 });
    el.append(lab, row, out);
    out.addEventListener('focus', () => row.focus({ preventScroll: true }));
    keys(row, () => ed.open());
    let cells: HTMLElement[] = [];
    // one cell per value. A range from 0 (or across it) has a cell per step and its zero lights nothing; a range that
    // starts above 0 (1–8) has a cell for every value, the first one included, so 3 lights three cells
    const counted = () => { const { min } = lim(); return min > 0; };
    const cellCount = () => steps() + (counted() ? 1 : 0);
    // absolute: the cell under the pointer is the value (clicking a cell fills up to and including it)
    const pick = (e: PointerEvent) => {
      const r = row.getBoundingClientRect(), a = ctx.angleOf(c), w = row.offsetWidth, n = cellCount();
      const local = (e.clientX - (r.left + r.width / 2)) * Math.cos(a) + (e.clientY - (r.top + r.height / 2)) * Math.sin(a) + w / 2;
      const t = local / w, { min, step } = lim();
      const k = counted() ? clamp(Math.ceil(t * n - 1e-9), 1, n) - 1 : t <= 0 ? 0 : clamp(Math.ceil(t * n - 1e-9), 0, n);
      set(min + k * step);
    };
    /* the squish: cells near the pointer swell in a soft wave, each on its own spring, and pulling past an end
       stretches the end cell like rubber. Runs a small loop only while something is moving. */
    const sq = { px: NaN, hv: 0, hvV: 0, over: 0, overV: 0, k: [] as number[], v: [] as number[], raf: 0, last: 0, kbd: false };
    const spring = (x: number, v: number, t: number, K: number, z: number, dt: number) => { const C = 2 * Math.sqrt(K) * z; v += (K * (t - x) - C * v) * dt; return [x + v * dt, v]; };
    const along = (e: PointerEvent) => {
      const r = row.getBoundingClientRect(), a = ctx.angleOf(c);
      return (e.clientX - (r.left + r.width / 2)) * Math.cos(a) + (e.clientY - (r.top + r.height / 2)) * Math.sin(a) + row.offsetWidth / 2;
    };
    const tick = (now: number) => {
      const dt = Math.min(.034, Math.max(.001, (now - sq.last) / 1000)); sq.last = now;
      const hovering = !Number.isNaN(sq.px), n = cells.length, focusOnly = !hovering && sq.kbd && document.activeElement === row;   // keyboard focus: the current cell stands up
      let moving = false;
      [sq.hv, sq.hvV] = spring(sq.hv, sq.hvV, hovering || pid !== null ? 1 : 0, 520, .8, dt);
      if (pid === null) [sq.over, sq.overV] = spring(sq.over, sq.overV, 0, 520, .55, dt);
      if (Math.abs(sq.hvV) > 1e-3 || Math.abs(sq.overV) > 1e-3 || Math.abs(sq.over) > .05) moving = true;
      const cur = cells.findIndex(x => x.classList.contains('cur'));
      cells.forEach((x, i) => {
        let g = 0;
        if (hovering) { const d = sq.px * n - (i + .5); g = Math.exp(-d * d / 2.2); }
        const end = i === (sq.over > 0 ? n - 1 : 0) ? Math.abs(sq.over) / 30 : 0;
        const t = 1 + .42 * g * sq.hv + end + (focusOnly && i === cur ? .25 : 0);
        if (isReduced()) { sq.k[i] = 1; sq.v[i] = 0; }
        else { [sq.k[i], sq.v[i]] = spring(sq.k[i] ?? 1, sq.v[i] ?? 0, t, 900, .7, dt); if (Math.abs(t - sq.k[i]) > 1e-3 || Math.abs(sq.v[i]) > 1e-3) moving = true; }
        x.style.transform = `scaleY(${sq.k[i].toFixed(3)})`;
      });
      sq.raf = moving || pid !== null ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => { if (!sq.raf) { sq.last = performance.now(); sq.raf = requestAnimationFrame(tick); } };
    let pid: number | null = null;
    row.addEventListener('pointerdown', e => { if (e.button) return; e.stopPropagation(); sq.kbd = false; row.setPointerCapture(e.pointerId); pid = e.pointerId; row.focus({ preventScroll: true }); row.classList.add('drag'); pick(e); wake(); });
    row.addEventListener('pointermove', e => {
      const x = along(e), w = row.offsetWidth || 1;
      sq.px = x / w;
      if (e.pointerId === pid) { pick(e); sq.over = x < 0 ? rubber(x) : x > w ? rubber(x - w) : 0; sq.overV = 0; }
      wake();
    });
    row.addEventListener('pointerleave', () => { if (pid === null) { sq.px = NaN; wake(); } });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = null; row.classList.remove('drag');
      const r = row.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) sq.px = NaN;
      wake();
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('focus', wake); row.addEventListener('blur', wake); row.addEventListener('keydown', () => { sq.kbd = true; wake(); }, true);
    c.destroy = () => cancelAnimationFrame(sq.raf);
    c.render = () => {
      initValue();
      lab.textContent = c.cfg.label ?? ''; lab.hidden = !c.cfg.label; out.hidden = c.cfg.showValue === false;
      out.classList.toggle('mm-editable', editable());
      const n = cellCount(); row.style.width = (c.cfg.width ?? Math.max(72, Math.min(160, n * 12))) + 'px';
      row.classList.toggle('few', n <= 10);
      cells = Array.from({ length: n }, () => h('i')); row.replaceChildren(...cells); sq.k = []; sq.v = [];
    };
    c.apply = () => {
      const { min, step } = lim(), n = cells.length, k = Math.round(((c.value as number) - min) / step) + (counted() ? 1 : 0), z = Math.round(zero() * steps());
      const lo = Math.min(z, k), hi = Math.max(z, k);
      cells.forEach((x, i) => { x.classList.toggle('on', i >= lo && i < hi); x.classList.toggle('cur', k > z ? i === k - 1 : i === k); });
      aria(row, paint(out)); wake();
    };
    return;
  }

  /* ---------------- knob: compact rotary, Ableton-style ---------------- */
  // stack: label above, knob, value below (in a knobs panel); otherwise label · knob · value in a row
  el.classList.toggle('stack', !!c.cfg.stack);
  const knob = h('div', 'mm-kn', { role: 'slider', tabindex: 0 }), sv = svg('svg', { viewBox: '0 0 28 28' }),
    a0 = svg('path', { class: 'mm-kn-a0' }), a1 = svg('path', { class: 'mm-kn-a1' }), cap = svg('circle', { class: 'mm-kn-cap', cx: '14', cy: '14', r: '7.5' }), ptr = svg('line', { class: 'mm-kn-ptr' });
  sv.append(a0, a1, cap, ptr); knob.append(sv); el.append(lab, knob, out);
  out.addEventListener('focus', () => knob.focus({ preventScroll: true }));
  keys(knob, () => ed.open());
  const A = (t: number) => -135 + 270 * t;   // 270° sweep, 0 at the bottom left
  const pol = (r: number, a: number): [number, number] => [14 + r * Math.sin(a * Math.PI / 180), 14 - r * Math.cos(a * Math.PI / 180)];
  const arc = (r: number, x0: number, x1: number) => {
    if (x1 - x0 < .5) return '';
    const [ax, ay] = pol(r, x0), [bx, by] = pol(r, x1);
    return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${r} ${r} 0 ${x1 - x0 > 180 ? 1 : 0} 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
  };
  // drag up or right turns it up (160px for the whole range); Shift is 10× finer; double-click resets
  // a double press (two quick presses in place, no drag between) resets: detected here rather than with dblclick,
  // which doesn't fire through pointer capture or on touch
  let kp: { id: number; raw: number; x: number; y: number; moved: boolean } | null = null, lastTap = { t: 0, x: 0, y: 0 };
  knob.addEventListener('pointerdown', e => {
    if (e.button) return; e.stopPropagation(); knob.setPointerCapture(e.pointerId); knob.focus({ preventScroll: true });
    if (e.timeStamp - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 4) {
      lastTap.t = 0; if (initial.v !== undefined) set(initial.v); return;
    }
    kp = { id: e.pointerId, raw: frac(), x: e.clientX, y: e.clientY, moved: false }; knob.classList.add('drag');
  });
  knob.addEventListener('pointermove', e => {
    if (!kp || e.pointerId !== kp.id) return;
    const d = (e.clientX - kp.x) - (e.clientY - kp.y); kp.x = e.clientX; kp.y = e.clientY; if (d) kp.moved = true;
    kp.raw = clamp(kp.raw + d / 160 * (e.shiftKey ? .1 : 1), 0, 1);
    const { min, max } = lim(); set(min + kp.raw * (max - min));
  });
  const kend = (e: PointerEvent) => {
    if (!kp || e.pointerId !== kp.id) return;
    lastTap = kp.moved ? { t: 0, x: 0, y: 0 } : { t: e.timeStamp, x: e.clientX, y: e.clientY };
    kp = null; knob.classList.remove('drag');
  };
  knob.addEventListener('pointerup', kend); knob.addEventListener('pointercancel', kend);
  c.render = () => {
    initValue();
    lab.textContent = c.cfg.label ?? ''; lab.hidden = !c.cfg.label; out.hidden = c.cfg.showValue === false;
    out.classList.toggle('mm-editable', editable());
    const n = steps();
    // few steps: the ring is cut into one segment per step
    a0.setAttribute('d', n <= 12 ? Array.from({ length: n }, (_, i) => arc(12, A(i / n) + 4, A((i + 1) / n) - 4)).join('') : arc(12, -135, 135));
  };
  c.apply = () => {
    const f = frac(), z = zero(), n = steps();
    if (n <= 12) {
      const k = f * n, kz = z * n, lo = Math.min(k, kz), hi = Math.max(k, kz);
      a1.setAttribute('d', Array.from({ length: n }, (_, i) => { const s0 = clamp(lo - i, 0, 1), s1 = clamp(hi - i, 0, 1); return s1 > s0 ? arc(12, A(i / n) + 4 + (270 / n - 8) * s0, A(i / n) + 4 + (270 / n - 8) * s1) : ''; }).join(''));
    } else a1.setAttribute('d', arc(12, A(Math.min(z, f)), A(Math.max(z, f))));
    const [x0, y0] = pol(2, A(f)), [x1, y1] = pol(6.2, A(f));
    ptr.setAttribute('x1', x0.toFixed(2)); ptr.setAttribute('y1', y0.toFixed(2)); ptr.setAttribute('x2', x1.toFixed(2)); ptr.setAttribute('y2', y1.toFixed(2));
    aria(knob, paint(out));
  };
}
