/* pad control: a 2D point in a panel. Drag the point (or click anywhere) on a square surface with a faint 6 × 6 grid,
   or type / scrub the X and Y values under it. The y axis points up: the top edge is max. */
import { clamp } from '../physics';
import type { PadAxis } from '../types';
import { h, head, trigger, type Build } from './dom';
import { decimals, scrub, snapGrid, stepKey, withUnit } from './num';

export interface Axis { min: number; max: number; step: number; label: string; unit?: string }
export type PadValue = { x: number; y: number };

/** an axis with its defaults filled in: [-1..1], step (max − min) / 200. A broken range throws. */
export function padAxis(a: PadAxis | undefined, name: 'X' | 'Y'): Axis {
  const min = a?.min ?? -1, max = a?.max ?? 1, step = a?.step ?? (max - min) / 200;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min) || !(step > 0)) throw new RangeError(`[marmit] pad: invalid ${name} axis`);
  return { min, max, step, label: a?.label ?? name, unit: a?.unit };
}
const snapA = (v: number, a: Axis) => snapGrid(v, a.step, a.min, a.max);

/** a clean value: each axis clamped and snapped to its step grid; a missing or broken axis takes `def` */
export function padNorm(v: unknown, ax: Axis, ay: Axis, def?: PadValue): PadValue {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<PadValue>, num = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  return { x: snapA(num(o.x) ? o.x! : def?.x ?? 0, ax), y: snapA(num(o.y) ? o.y! : def?.y ?? 0, ay) };
}

/** surface fractions (0..1 from the left, 0..1 from the top) → value. The top is max. */
export const padFromPoint = (fx: number, fy: number, ax: Axis, ay: Axis): PadValue => ({
  x: snapA(ax.min + clamp(fx, 0, 1) * (ax.max - ax.min), ax),
  y: snapA(ay.max - clamp(fy, 0, 1) * (ay.max - ay.min), ay),
});
export const padToPoint = (v: PadValue, ax: Axis, ay: Axis) => ({
  fx: clamp((v.x - ax.min) / (ax.max - ax.min), 0, 1), fy: clamp((ay.max - v.y) / (ay.max - ay.min), 0, 1),
});

export const PAD_GRID = 6;
/** a press released without moving lands on the nearest interior grid intersection, if it is within 8px of it */
export function padSnapPoint(px: number, py: number, w: number, hgt: number): { x: number; y: number } | undefined {
  const i = Math.round(px / w * PAD_GRID), j = Math.round(py / hgt * PAD_GRID);
  if (i < 1 || i >= PAD_GRID || j < 1 || j >= PAD_GRID) return;
  const q = { x: i / PAD_GRID * w, y: j / PAD_GRID * hgt };
  return Math.abs(px - q.x) <= 8 && Math.abs(py - q.y) <= 8 ? q : undefined;
}

/* The island closes an open panel on Escape from a window capture listener. Escape inside the pad means "undo this
   drag / edit", so the pad claims it first: this listener is registered when the module loads, before any island. */
let escClaim: (() => void) | null = null;
if (typeof addEventListener !== 'undefined') addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !escClaim) return;
  e.preventDefault(); e.stopImmediatePropagation(); escClaim();
}, true);

const SIZE = 176, HIT = 10;
const gridSvg = () => {
  let d = '';
  for (let i = 1; i < PAD_GRID; i++) { const p = (i / PAD_GRID * 100).toFixed(3); d += `M${p} 0V100M0 ${p}H100`; }
  return `<svg class="mm-pad-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
};

export const pad: Build = (c, ctx) => {
  c.hasValue = true;
  let ax = padAxis(undefined, 'X'), ay = padAxis(undefined, 'Y'), def: PadValue = { x: 0, y: 0 };
  const val = () => c.value as PadValue;
  const set = (v: PadValue) => {
    const n = padNorm(v, ax, ay, val()), cur = val();
    if (n.x === cur.x && n.y === cur.y) return false;
    c.value = n; c.apply(); ctx.emit(c, n); return true;
  };
  const fmt = (v: number, a: Axis) => v.toFixed(decimals(a.step, a.min, a.max));

  // bar trigger: an icon button whose icon is a tiny live preview of the point (unless an icon or a pill is asked for)
  const renderTrigger = trigger(c, ctx), mini = h('span', 'mm-ic mm-pad-mini');
  mini.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" stroke="currentColor" stroke-width="1.4" opacity=".45"/><circle r="2.4" fill="currentColor"/></svg>';
  const own = () => !c.cfg.icon && c.cfg.trigger !== 'pill';

  // panel parts, built on first open
  let surf: HTMLElement | null = null, dot: HTMLElement, guides: HTMLElement, inputs: Record<'x' | 'y', HTMLInputElement>, labels: Record<'x' | 'y', HTMLElement>, units: Record<'x' | 'y', HTMLElement>;

  c.render = () => {
    ax = padAxis(c.cfg.x, 'X'); ay = padAxis(c.cfg.y, 'Y');
    def = padNorm(c.cfg.value, ax, ay, { x: 0, y: 0 });
    c.value = padNorm(c.value, ax, ay, def);
    renderTrigger();
    const t = c.trigger!;
    if (own()) { t.classList.replace('mm-pill', 'mm-btn'); c.follow = false; t.replaceChildren(mini); }
  };
  c.apply = () => {
    const v = c.value = padNorm(c.value, ax, ay, def), { fx, fy } = padToPoint(v, ax, ay);
    const circle = mini.querySelector('circle')!; circle.setAttribute('cx', (4 + fx * 8).toFixed(2)); circle.setAttribute('cy', (4 + fy * 8).toFixed(2));
    if (!surf) return;
    dot.style.left = guides.style.left = fx * 100 + '%'; dot.style.top = guides.style.top = fy * 100 + '%';
    surf.setAttribute('aria-valuetext', `${ax.label} ${withUnit(fmt(v.x, ax), ax.unit)}, ${ay.label} ${withUnit(fmt(v.y, ay), ay.unit)}`);
    for (const k of ['x', 'y'] as const) {
      const a = k === 'x' ? ax : ay, inp = inputs[k];
      if (document.activeElement !== inp) inp.value = fmt(v[k], a);
      inp.setAttribute('aria-valuenow', String(v[k])); inp.setAttribute('aria-valuemin', String(a.min)); inp.setAttribute('aria-valuemax', String(a.max));
      labels[k].textContent = a.label; units[k].textContent = a.unit ?? ''; units[k].hidden = !a.unit;
      units[k].classList.toggle('sym', !!a.unit && !/^\p{L}/u.test(a.unit)); // "45%", but "45 px"
    }
  };

  c.panel = {
    build(pc) {
      surf = h('div', 'mm-pad', { tabindex: 0, role: 'slider', 'aria-roledescription': '2D pad', 'aria-label': c.cfg.label });
      surf.style.width = surf.style.height = SIZE + 'px';
      // grid and guides are clipped to the surface; the point is not, so it stays whole at the edges
      const clip = h('div', 'mm-pad-clip', { 'aria-hidden': 'true' });
      clip.innerHTML = gridSvg();
      guides = h('i', 'mm-pad-guides'); dot = h('i', 'mm-pad-dot', { 'aria-hidden': 'true' });
      clip.append(guides); surf.append(clip, dot);
      const s = surf;

      /* ---- surface drag ---- */
      let drag: { id: number; x0: number; y0: number; gx: number; gy: number; start: PadValue; moved: boolean; lock: 'x' | 'y' | null; held: PadValue; r: DOMRect } | null = null;
      const endDrag = () => { if (!drag) return; try { s.releasePointerCapture(drag.id); } catch { /* gone */ } drag = null; s.classList.remove('drag'); escClaim = null; };
      const at = (e: PointerEvent) => {
        const d = drag!, p = padFromPoint((e.clientX - d.gx - d.r.left) / d.r.width, (e.clientY - d.gy - d.r.top) / d.r.height, ax, ay);
        if (d.lock === 'x') p.y = d.held.y; else if (d.lock === 'y') p.x = d.held.x;
        set(p);
      };
      s.addEventListener('pointerdown', e => {
        if (e.button) return;
        e.preventDefault(); s.focus({ preventScroll: true }); s.setPointerCapture(e.pointerId);
        const r = s.getBoundingClientRect(), dr = dot.getBoundingClientRect(), cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
        // grabbing the point keeps the offset, so it doesn't jump under the pointer
        const onDot = Math.hypot(e.clientX - cx, e.clientY - cy) <= HIT;
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, gx: onDot ? e.clientX - cx : 0, gy: onDot ? e.clientY - cy : 0, start: { ...val() }, moved: false, lock: null, held: { ...val() }, r };
        s.classList.add('drag');
        escClaim = () => { const st = drag!.start; endDrag(); set(st); };
        if (!onDot) at(e);
      });
      s.addEventListener('pointermove', e => {
        const d = drag; if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
        if (!d.moved && Math.hypot(dx, dy) >= 3) d.moved = true;
        // Shift locks the axis of the dominant movement; letting go of Shift frees it
        if (!e.shiftKey) d.lock = null;
        else if (!d.lock && d.moved) { d.lock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'; d.held = { ...val() }; }
        at(e);
      });
      s.addEventListener('pointerup', e => {
        const d = drag; if (!d || e.pointerId !== d.id) return;
        if (!d.moved && !e.shiftKey) {
          const q = padSnapPoint(e.clientX - d.gx - d.r.left, e.clientY - d.gy - d.r.top, d.r.width, d.r.height);
          if (q) set(padFromPoint(q.x / d.r.width, q.y / d.r.height, ax, ay));
        }
        endDrag();
      });
      s.addEventListener('pointercancel', () => endDrag());
      s.addEventListener('lostpointercapture', () => endDrag());
      s.addEventListener('dblclick', () => set(def));
      s.addEventListener('keydown', e => {
        if (e.key === 'Home') set(def);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const x = stepKey(e.key, val().x, ax.min, ax.max, ax.step, e.shiftKey); if (x !== null) set({ ...val(), x }); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const y = stepKey(e.key, val().y, ay.min, ay.max, ay.step, e.shiftKey); if (y !== null) set({ ...val(), y }); }
        else return;
        e.preventDefault(); e.stopPropagation();
      });

      /* ---- axis fields ---- */
      const fieldsRow = h('div', 'mm-pad-fields');
      fieldsRow.dataset.dragLabels = String(c.cfg.dragLabels !== false);
      inputs = {} as typeof inputs; labels = {} as typeof labels; units = {} as typeof units;
      for (const k of ['x', 'y'] as const) {
        const A = () => (k === 'x' ? ax : ay);
        const lab = labels[k] = h('span', 'mm-pad-lab', { 'aria-hidden': 'true' });
        const inp = inputs[k] = h('input', 'mm-pad-in', { type: 'text', role: 'spinbutton', spellcheck: 'false', inputmode: 'decimal', 'aria-label': `${c.cfg.label} ${k.toUpperCase()}` });
        const unit = units[k] = h('span', 'mm-unit');
        const box = h('label', 'mm-pad-field', {}, lab, inp, unit);
        let before = 0;
        const commit = () => { const n = parseFloat(inp.value); if (Number.isFinite(n)) set({ ...val(), [k]: n }); inp.value = fmt(val()[k], A()); };
        const leave = () => { escClaim = null; s.focus({ preventScroll: true }); };
        inp.addEventListener('focus', () => {
          before = val()[k]; inp.select();
          escClaim = () => { inp.value = fmt(before, A()); set({ ...val(), [k]: before }); leave(); };
        });
        inp.addEventListener('blur', () => { escClaim = null; commit(); });
        // keep the select-all from focus: the mouseup of the focusing click would collapse it
        let fresh = false;
        inp.addEventListener('pointerdown', () => { fresh = document.activeElement !== inp; });
        inp.addEventListener('mouseup', e => { if (fresh) { fresh = false; e.preventDefault(); } });
        inp.addEventListener('keydown', e => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); leave(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const a = A(), cur = parseFloat(inp.value), n = stepKey(e.key, Number.isFinite(cur) ? cur : val()[k], a.min, a.max, a.step, e.shiftKey);
            if (n !== null) { set({ ...val(), [k]: n }); inp.value = fmt(val()[k], a); inp.select(); }
          }
        });
        if (c.cfg.dragLabels !== false) {
          lab.classList.add('mm-pad-scrub');
          let pid = 0;
          lab.addEventListener('pointerdown', e => { pid = e.pointerId; });
          scrub(lab, {
            get: () => val()[k], set: n => { set({ ...val(), [k]: n }); return val()[k]; }, perPx: () => A().step,
            // Escape mid-scrub: cancel the gesture, which puts the value back
            onStart: () => { escClaim = () => lab.dispatchEvent(new PointerEvent('pointercancel', { pointerId: pid })); },
            onEnd: () => { escClaim = null; },
          });
          // a press on the label scrubs; it must not focus the input through the <label>
          lab.addEventListener('click', e => e.preventDefault());
        }
        fieldsRow.append(box);
      }

      const hd = head(c.cfg.title, c.cfg.label);
      pc.replaceChildren(...(hd ? [hd] : []), s, fieldsRow);
      c.apply();
    },
    onOpen: () => surf,
  };
};
