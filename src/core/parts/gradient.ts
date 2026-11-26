/* Gradient editor: a stop bar you click to add stops to, drag along to move them and pull away from to remove them,
   plus shape, angle, flip, rotate and one row per stop. Behaviour follows the fork's background control (gradient
   part); the value keeps a plain angle instead of the fork's handle geometry. */
import type { GradientShape, GradientStop, GradientValue } from '../types';
import { clamp } from '../physics';
import { arrows, h, head, ic, trigger, type Build } from './dom';
import { clickToType, scrub, stepKey } from './num';

/* ---------- pure maths (exported for tests) ---------- */

export type RGBA = [number, number, number, number];
const NAMED: Record<string, string> = {
  black: '#000', white: '#fff', red: '#f00', lime: '#0f0', green: '#008000', blue: '#00f', yellow: '#ff0', cyan: '#0ff',
  aqua: '#0ff', magenta: '#f0f', fuchsia: '#f0f', gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', navy: '#000080', teal: '#008080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
};
const num = (t: string, pct: number) => t === 'none' ? 0 : t.endsWith('%') ? parseFloat(t) * pct / 100 : parseFloat(t);
const hue = (t: string) => {
  const n = parseFloat(t);
  return t.endsWith('turn') ? n * 360 : t.endsWith('grad') ? n * .9 : t.endsWith('rad') ? n * 180 / Math.PI : t === 'none' ? 0 : n;
};

/** hex (3/4/6/8), rgb()/rgba(), hsl()/hsla() (comma or space syntax), a few names; null if it can't read it */
export function parseColor(input: string): RGBA | null {
  const s = String(input ?? '').trim().toLowerCase();
  if (s === 'transparent') return [0, 0, 0, 0];
  if (NAMED[s]) return parseColor(NAMED[s]);
  let m = /^#([0-9a-f]+)$/.exec(s);
  if (m) {
    let x = m[1];
    if (x.length === 3 || x.length === 4) x = [...x].map(d => d + d).join('');
    if (x.length !== 6 && x.length !== 8) return null;
    const b = (i: number) => parseInt(x.slice(i, i + 2), 16);
    return [b(0), b(2), b(4), x.length === 8 ? b(6) / 255 : 1];
  }
  m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (!m) return null;
  const t = m[2].split(/[\s,/]+/).filter(Boolean);
  if (t.length < 3 || t.length > 4) return null;
  const a = t[3] === undefined ? 1 : clamp(num(t[3], 1), 0, 1);
  let rgb: number[];
  if (m[1].startsWith('rgb')) rgb = t.slice(0, 3).map(v => clamp(num(v, 255), 0, 255));
  else {
    const H = ((hue(t[0]) % 360) + 360) % 360, S = clamp(num(t[1], 100), 0, 100) / 100, L = clamp(num(t[2], 100), 0, 100) / 100;
    const f = (n: number) => { const k = (n + H / 30) % 12; return 255 * (L - S * Math.min(L, 1 - L) * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    rgb = [f(0), f(8), f(4)];
  }
  return rgb.some(v => !Number.isFinite(v)) || !Number.isFinite(a) ? null : [rgb[0], rgb[1], rgb[2], a];
}

// anything else (oklch, rebeccapurple…) goes through the browser's canvas, which hands back hex or rgba()
let cx: CanvasRenderingContext2D | null | undefined;
function readColor(s: string): RGBA | null {
  const p = parseColor(s); if (p || typeof document === 'undefined') return p;
  if (cx === undefined) { try { cx = document.createElement('canvas').getContext('2d'); } catch { cx = null; } }
  if (!cx || !isColor(s)) return null;
  cx.fillStyle = '#000'; cx.fillStyle = s;
  return parseColor(String(cx.fillStyle));
}
/** a string the browser accepts as a CSS colour */
export const isColor = (s: string) => typeof CSS !== 'undefined' && CSS.supports ? CSS.supports('color', s) : !!parseColor(s);

const hex2 = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
export const toHex = ([r, g, b, a]: RGBA) => '#' + hex2(r) + hex2(g) + hex2(b) + (a < 1 ? hex2(a * 255) : '');
const toLin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLin = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** mix two colours in linear-light sRGB (alpha mixes straight); t=0 is a, t=1 is b */
export function mixColor(a: string, b: string, t: number): string {
  const A = readColor(a), B = readColor(b);
  if (!A || !B) return t < .5 ? a : b;
  const c = [0, 1, 2].map(i => fromLin(toLin(A[i]) + (toLin(B[i]) - toLin(A[i])) * t));
  return toHex([c[0], c[1], c[2], A[3] + (B[3] - A[3]) * t]);
}

/** the colour the gradient shows at `at` (stops sorted by at) */
export function colorAt(stops: GradientStop[], at: number): string {
  if (!stops.length) return '#000000';
  if (at <= stops[0].at) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (at <= b.at) return b.at === a.at ? b.color : mixColor(a.color, b.color, (at - a.at) / (b.at - a.at));
  }
  return stops[stops.length - 1].color;
}

/** where "+" puts a stop: the midpoint of the widest gap, the bar's ends counting as gap edges */
export function widestGap(stops: GradientStop[]): number {
  const ats = [0, ...stops.map(s => s.at), 100];
  let best = 0, at = 50;
  for (let i = 1; i < ats.length; i++) if (ats[i] - ats[i - 1] > best) { best = ats[i] - ats[i - 1]; at = Math.round((ats[i] + ats[i - 1]) / 2); }
  return at;
}

/** stable sort by position, so equal positions keep their order */
export const sortStops = <T extends GradientStop>(stops: T[]) => [...stops].sort((a, b) => a.at - b.at);
/** mirror every stop: at → 100 − at */
export const flipStops = <T extends GradientStop>(stops: T[]) => sortStops(stops.map(s => ({ ...s, at: +(100 - s.at).toFixed(2) })));

/** reorder rows the fork's way: positions stay put and only the colours move (row `from` lands at row `to`) */
export function moveColor<T extends GradientStop>(stops: T[], from: number, to: number): T[] {
  const cols = stops.map(s => s.color), [c] = cols.splice(from, 1);
  cols.splice(clamp(to, 0, cols.length), 0, c);
  return stops.map((s, i) => ({ ...s, color: cols[i] }));
}

/** add a stop at `at` with the colour the gradient already shows there; returns the list unchanged at the cap */
export function addStop(stops: GradientStop[], at: number, max = 8): GradientStop[] {
  if (stops.length >= Math.max(2, max)) return stops;
  at = Math.round(clamp(at, 0, 100));
  return sortStops([...stops, { at, color: colorAt(stops, at) }]);
}

const SHAPES: GradientShape[] = ['linear', 'radial', 'conic'];
export const wrapAngle = (a: number) => { a = Math.round(a) % 360; return a < 0 ? a + 360 : a || 0; };
const DEFAULT: GradientValue = { shape: 'linear', angle: 90, stops: [{ at: 0, color: '#000000' }, { at: 100, color: '#ffffff' }] };

/** a clean value: known shape, angle 0..359, 2..max stops with at in 0..100 (2 dp), sorted; extra stops thinned evenly */
export function normalizeGradient(v: Partial<GradientValue> | null | undefined, max = 8): GradientValue {
  max = Math.max(2, Math.round(max) || 8);
  let stops = (Array.isArray(v?.stops) ? v!.stops : []).filter(s => s && typeof s.color === 'string' && Number.isFinite(+s.at))
    .map(s => ({ at: +clamp(+s.at, 0, 100).toFixed(2), color: s.color }));
  if (stops.length < 2) stops = DEFAULT.stops.map(s => ({ ...s }));
  stops = sortStops(stops);
  if (stops.length > max) { const n = stops.length; stops = Array.from({ length: max }, (_, i) => stops[Math.round(i * (n - 1) / (max - 1))]); }
  return { shape: SHAPES.includes(v?.shape as GradientShape) ? v!.shape! : 'linear', angle: wrapAngle(Number(v?.angle ?? DEFAULT.angle)), stops };
}

/** the CSS background for a gradient value */
export function gradientCss(value: Partial<GradientValue>): string {
  const v = normalizeGradient(value, Infinity), list = v.stops.map(s => `${s.color} ${s.at}%`).join(', ');
  return v.shape === 'radial' ? `radial-gradient(circle, ${list})`
    : v.shape === 'conic' ? `conic-gradient(from ${v.angle}deg, ${list})` : `linear-gradient(${v.angle}deg, ${list})`;
}

/* ---------- the control ---------- */

interface Stop extends GradientStop { id: number }
const PULL = 24, THRESHOLD = 3;
let seq = 0;

export const gradient: Build = (c, ctx) => {
  c.hasValue = true;
  const renderTrigger = trigger(c, ctx);
  const chip = h('span', 'mm-gchip', { 'aria-hidden': 'true' });
  const max = () => Math.max(2, Math.round(c.cfg.maxStops ?? 8) || 8);
  let list: Stop[] = [], shape: GradientShape = 'linear', angle = 90, sel = 0, off = 0;
  // panel parts, made on first open
  let P: { seg: HTMLElement; thumb: HTMLElement; angleBox: HTMLElement; angleVal: HTMLElement; rot: HTMLButtonElement; add: HTMLButtonElement;
    bar: HTMLElement; preview: HTMLElement; rows: HTMLElement } | null = null;
  const handles = new Map<number, HTMLElement>();
  const rows = new Map<number, { el: HTMLElement; chip: HTMLElement; pick: HTMLInputElement; hex: HTMLInputElement; pos: HTMLElement; rm: HTMLButtonElement }>();

  const value = (): GradientValue => ({ shape, angle, stops: list.map(({ at, color }) => ({ at, color })) });
  const load = () => {
    const v = normalizeGradient(c.value as GradientValue, max());
    shape = v.shape; angle = v.angle;
    // keep ids by index when the count holds, so a selected stop stays selected across set()
    list = v.stops.map((s, i) => ({ id: list.length === v.stops.length ? list[i].id : ++seq, ...s }));
    if (!list.some(s => s.id === sel)) sel = list[0].id;
    c.value = v;
  };
  const commit = () => { list = sortStops(list); c.value = value(); draw(); ctx.emit(c, c.value); };
  const idx = (id: number) => list.findIndex(s => s.id === id);

  c.render = () => { renderTrigger(); c.el.prepend(chip); if (c.el.classList.contains('mm-btn')) c.el.replaceChildren(chip); };
  c.apply = () => { load(); draw(); };

  /* ---- drawing: everything from `list` ---- */
  function draw() {
    const css = gradientCss(value());
    chip.style.setProperty('--g', css);
    if (!P) return;
    const live = list.filter(s => s.id !== off);
    P.preview.style.setProperty('--g', `linear-gradient(90deg, ${(live.length > 1 ? live : list).map(s => `${s.color} ${s.at}%`).join(', ')})`);
    P.seg.querySelectorAll<HTMLElement>('button').forEach(b => { const on = b.dataset.v === shape; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    placeThumb();
    P.angleBox.hidden = shape === 'radial'; P.rot.disabled = shape === 'radial';
    P.angleVal.textContent = String(angle); P.angleVal.setAttribute('aria-valuenow', String(angle)); P.angleVal.setAttribute('aria-valuetext', angle + ' degrees');
    P.add.disabled = list.length >= max();
    const many = list.length > 2;
    // handles: keyed by id, never reordered in the DOM (they're positioned), so focus and capture survive a drag
    for (const [id, el] of handles) if (idx(id) < 0) { el.remove(); handles.delete(id); }
    list.forEach((s, i) => {
      let el = handles.get(s.id);
      if (!el) { el = handleEl(s.id); handles.set(s.id, el); P!.bar.append(el); }
      el.style.left = s.at + '%'; el.style.setProperty('--c', s.color);
      el.classList.toggle('sel', s.id === sel); el.toggleAttribute('data-off', s.id === off);
      el.tabIndex = s.id === sel ? 0 : -1;
      el.setAttribute('aria-valuenow', String(s.at)); el.setAttribute('aria-valuetext', `${s.at}%, ${s.color}`);
      el.setAttribute('aria-label', `Stop ${i + 1} position`);
    });
    // rows: keyed by id, re-ordered only when the order changed, and focus put back if the move dropped it
    for (const [id, r] of rows) if (idx(id) < 0) { r.el.remove(); rows.delete(id); }
    list.forEach((s, i) => {
      let r = rows.get(s.id);
      if (!r) { r = rowEl(s.id); rows.set(s.id, r); }
      r.chip.style.setProperty('--c', s.color);
      const rgba = readColor(s.color); if (rgba) r.pick.value = toHex([rgba[0], rgba[1], rgba[2], 1]);
      // leave text being typed alone, unless the stop's colour itself changed (a reorder, the picker, set())
      if (document.activeElement !== r.hex || r.hex.dataset.shown !== s.color) { r.hex.value = s.color; r.hex.dataset.shown = s.color; }
      r.pos.textContent = String(s.at); r.pos.setAttribute('aria-valuenow', String(s.at));
      r.rm.disabled = !many; r.el.classList.toggle('sel', s.id === sel);
      r.el.setAttribute('aria-label', `Stop ${i + 1}`);
    });
    const want = list.map(s => rows.get(s.id)!.el), have = [...P.rows.children];
    if (want.some((el, i) => have[i] !== el) || have.length !== want.length) {
      const focus = document.activeElement as HTMLElement | null;
      P.rows.append(...want);
      if (focus && focus.isConnected && document.activeElement !== focus) focus.focus({ preventScroll: true });
    }
  }
  const placeThumb = () => {
    const on = P?.seg.querySelector<HTMLElement>('[aria-checked=true]');
    if (on && P) { P.thumb.style.width = on.offsetWidth + 'px'; P.thumb.style.transform = `translateX(${on.offsetLeft}px)`; }
  };

  const select = (id: number) => { if (sel !== id) { sel = id; draw(); } };
  const remove = (id: number) => {
    const i = idx(id); if (i < 0 || list.length <= 2) return;
    list.splice(i, 1);
    if (sel === id) sel = list[Math.min(i, list.length - 1)].id;
    commit();
  };
  const setAt = (id: number, at: number) => {
    const s = list[idx(id)]; if (!s) return 0;
    at = Math.round(clamp(at, 0, 100));
    if (s.at !== at) { s.at = at; commit(); }
    return at;
  };
  const insert = (at: number) => {
    if (list.length >= max()) return null;
    at = Math.round(clamp(at, 0, 100));
    const s: Stop = { id: ++seq, at, color: colorAt(list, at) };
    list.push(s); sel = s.id; commit();
    return s;
  };
  const permute = (from: number, to: number) => {
    to = clamp(to, 0, list.length - 1); if (from === to) return;
    list = moveColor(list, from, to); sel = list[to].id; commit();
  };

  /* ---- the stop bar ---- */
  let drag: { pid: number; id: number; x: number; y: number; on: boolean } | null = null;
  const pctAt = (x: number) => { const r = P!.bar.getBoundingClientRect(); return r.width ? clamp((x - r.left) / r.width * 100, 0, 100) : 0; };
  function handleEl(id: number) {
    const el = h('span', 'mm-ghandle', { role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 100, 'data-id': id });
    el.addEventListener('keydown', e => {
      const s = list[idx(id)]; if (!s) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); e.stopPropagation();
        if (list.length > 2) { remove(id); handles.get(sel)?.focus({ preventScroll: true }); }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); rows.get(id)?.hex.focus(); return; }
      const nv = stepKey(e.key, s.at, 0, 100, 1, e.shiftKey);
      if (nv === null) return;
      e.preventDefault(); e.stopPropagation(); setAt(id, nv);
    });
    // the fork opens the stop's colour picker on double-click; here that's the row's colour field
    el.addEventListener('dblclick', () => { const r = rows.get(id); r?.hex.focus(); });
    el.addEventListener('focus', () => select(id));
    return el;
  }
  const onBarDown = (e: PointerEvent) => {
    if (e.button || drag) return;
    e.stopPropagation(); e.preventDefault();
    const hd = (e.target as HTMLElement).closest<HTMLElement>('.mm-ghandle');
    let id: number;
    if (hd) { id = +hd.dataset.id!; select(id); hd.focus({ preventScroll: true }); }
    else {
      // a click on an empty spot adds a stop there and drags it straight away
      const s = insert(pctAt(e.clientX)); if (!s) return;
      id = s.id; handles.get(id)?.focus({ preventScroll: true });
    }
    drag = { pid: e.pointerId, id, x: e.clientX, y: e.clientY, on: !hd };
    P!.bar.setPointerCapture(e.pointerId); P!.bar.classList.add('drag');
  };
  const onBarMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < THRESHOLD) return; drag.on = true; }
    const r = P!.bar.getBoundingClientRect();
    const wasOff = off;
    off = Math.max(r.top - e.clientY, e.clientY - r.bottom) > PULL && list.length > 2 ? drag.id : 0;
    const s = list[idx(drag.id)], at = Math.round(pctAt(e.clientX));
    if (s && s.at !== at) { s.at = at; commit(); } else if (off !== wasOff) draw();
  };
  const onBarUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null; P!.bar.classList.remove('drag');
    if (off === d.id) { off = 0; remove(d.id); handles.get(sel)?.focus({ preventScroll: true }); } else { off = 0; draw(); }
  };

  /* ---- stop rows ---- */
  let lift: { pid: number; id: number; y: number; on: boolean; from: number; to: number; h: number } | null = null;
  function rowEl(id: number) {
    const grip = h('button', 'mm-ggrip', { type: 'button', 'aria-label': 'Reorder colour (Alt+Up / Alt+Down)', tabindex: -1 }, h('i'), h('i'));
    const pick = h('input', '', { type: 'color', tabindex: -1, 'aria-hidden': 'true' });
    const chipEl = h('label', 'mm-gsw', { title: 'Pick colour' }, pick);
    const hex = h('input', 'mm-ghex', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Colour' });
    const pos = h('span', 'mm-gpos-v', { role: 'spinbutton', tabindex: 0, 'aria-label': 'Position', 'aria-valuemin': 0, 'aria-valuemax': 100 });
    const unit = h('span', 'mm-unit mm-gscrub', { 'aria-hidden': 'true' }, '%');
    const rm = h('button', 'mm-gbtn', { type: 'button', 'aria-label': 'Remove stop' }, ic('minus'));
    const el = h('div', 'mm-gstop', { role: 'group' }, grip, chipEl, hex, h('span', 'mm-gpos', {}, pos, unit), rm);
    const stop = () => list[idx(id)];
    el.addEventListener('pointerdown', () => select(id));
    el.addEventListener('focusin', () => select(id));
    el.addEventListener('keydown', e => {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault(); e.stopPropagation();
        const i = idx(id); permute(i, i + (e.key === 'ArrowUp' ? -1 : 1));
        // focus follows the colour to its new row
        const r = rows.get(sel); (e.target === pos ? r?.pos : r?.hex)?.focus({ preventScroll: true });
      }
    });
    // colour: any CSS colour; invalid text puts the old one back
    // focus selects all; the mouseup that follows a focusing click would drop the selection, so skip that one
    let fresh = false;
    hex.addEventListener('focus', () => { hex.select(); fresh = true; });
    hex.addEventListener('mouseup', e => { if (fresh) e.preventDefault(); fresh = false; });
    const commitHex = () => {
      const s = stop(), t = hex.value.trim(); if (!s) return;
      if (t && t !== s.color && isColor(t)) { s.color = t; commit(); } else { hex.value = s.color; hex.dataset.shown = s.color; }
    };
    hex.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commitHex(); hex.select(); }
      else if (e.key === 'Escape') { const s = stop(); if (s) hex.value = s.color; }
    });
    hex.addEventListener('blur', commitHex);
    pick.addEventListener('input', () => {
      const s = stop(); if (!s) return;
      const a = readColor(s.color)?.[3] ?? 1, p = parseColor(pick.value)!;
      s.color = toHex([p[0], p[1], p[2], a]); commit();
    });
    // position: scrub the %, click the number to type, arrows step
    scrub(unit, { get: () => stop()?.at ?? 0, set: v => setAt(id, v), perPx: () => .5, onStart: () => select(id) });
    clickToType(pos, { get: () => stop()?.at ?? 0, text: () => String(stop()?.at ?? 0), commit: v => setAt(id, v), label: 'Position (%)',
      step: (k, v, sh) => stepKey(k, v, 0, 100, 1, sh) });
    pos.addEventListener('keydown', e => {
      if (e.altKey) return;
      const s = stop(), nv = s ? stepKey(e.key, s.at, 0, 100, 1, e.shiftKey) : null;
      if (nv === null) return; e.preventDefault(); e.stopPropagation(); setAt(id, nv);
    });
    rm.addEventListener('click', () => remove(id));
    // pointer reorder with the grip: lifts after 3px, neighbours make room, colours permute on release
    grip.addEventListener('pointerdown', e => {
      if (e.button) return; e.stopPropagation(); e.preventDefault(); select(id);
      grip.setPointerCapture(e.pointerId);
      const i = idx(id); lift = { pid: e.pointerId, id, y: e.clientY, on: false, from: i, to: i, h: el.offsetHeight + 2 };
    });
    grip.addEventListener('pointermove', e => {
      if (!lift || lift.pid !== e.pointerId) return;
      const dy = e.clientY - lift.y;
      if (!lift.on) { if (Math.abs(dy) < THRESHOLD) return; lift.on = true; P!.rows.classList.add('lifting'); el.classList.add('lift'); }
      const lo = -lift.from * lift.h, hi = (list.length - 1 - lift.from) * lift.h, y = clamp(dy, lo, hi);
      lift.to = clamp(lift.from + Math.round(y / lift.h), 0, list.length - 1);
      el.style.transform = `translateY(${y}px)`;
      list.forEach((s, j) => {
        const r = rows.get(s.id)!; if (s.id === id) return;
        const shift = lift!.from < lift!.to && j > lift!.from && j <= lift!.to ? -1 : lift!.from > lift!.to && j < lift!.from && j >= lift!.to ? 1 : 0;
        r.el.style.transform = shift ? `translateY(${shift * lift!.h}px)` : '';
      });
    });
    const drop = (e: PointerEvent) => {
      if (!lift || lift.pid !== e.pointerId) return;
      const l = lift; lift = null;
      P!.rows.classList.remove('lifting'); el.classList.remove('lift');
      rows.forEach(r => { r.el.style.transition = 'none'; r.el.style.transform = ''; });
      if (l.on && e.type === 'pointerup') permute(l.from, l.to);
      requestAnimationFrame(() => rows.forEach(r => { r.el.style.transition = ''; }));
    };
    grip.addEventListener('pointerup', drop); grip.addEventListener('pointercancel', drop);
    return { el, chip: chipEl, pick, hex, pos, rm };
  }

  /* ---- the panel ---- */
  c.panel = {
    build(pc) {
      handles.clear(); rows.clear();
      const thumb = h('i', 'mm-seg-thumb', { 'aria-hidden': 'true' });
      const seg = h('div', 'mm-seg mm-gseg', { role: 'radiogroup', 'aria-label': 'Shape' }, thumb,
        ...SHAPES.map(s => {
          const b = h('button', '', { type: 'button', role: 'radio', 'data-v': s }, s[0].toUpperCase() + s.slice(1));
          b.addEventListener('click', () => { if (shape !== s) { shape = s; commit(); } });
          return b;
        }));
      arrows(seg, 'button', b => b.click());
      const flip = h('button', 'mm-gbtn', { type: 'button', 'aria-label': 'Flip', title: 'Flip' }, flipIcon());
      flip.addEventListener('click', () => { list = flipStops(list); commit(); });
      const rot = h('button', 'mm-gbtn', { type: 'button', 'aria-label': 'Rotate 90°', title: 'Rotate 90°' }, rotIcon());
      rot.addEventListener('click', () => { angle = wrapAngle(angle + 90); commit(); });
      const add = h('button', 'mm-gbtn', { type: 'button', 'aria-label': 'Add stop', title: 'Add stop' }, ic('plus'));
      add.addEventListener('click', () => insert(widestGap(list)));
      // angle: scrub the word or the °, click the number to type, arrows step (wrapping round 360)
      const angleLab = h('span', 'mm-gscrub mm-glab', { 'aria-hidden': 'true' }, 'Angle');
      const angleVal = h('span', 'mm-gpos-v', { role: 'spinbutton', tabindex: 0, 'aria-label': 'Angle (degrees)', 'aria-valuemin': 0, 'aria-valuemax': 359 });
      const deg = h('span', 'mm-unit mm-gscrub', { 'aria-hidden': 'true' }, '°');
      const angleBox = h('div', 'mm-gangle', {}, angleLab, h('span', 'mm-gpos', {}, angleVal, deg));
      const setAngle = (v: number) => { const a = wrapAngle(v); if (a !== angle) { angle = a; commit(); } return a; };
      for (const s of [angleLab, deg]) scrub(s, { get: () => angle, set: setAngle, perPx: () => 1 });
      const stepA = (k: string, v: number, sh: boolean) => k === 'Home' ? 0 : k === 'End' ? 359 : stepKey(k, v, -Infinity, Infinity, 1, sh);
      clickToType(angleVal, { get: () => angle, text: () => String(angle), commit: setAngle, label: 'Angle (degrees)', step: stepA });
      angleVal.addEventListener('keydown', e => { const nv = stepA(e.key, angle, e.shiftKey); if (nv === null) return; e.preventDefault(); e.stopPropagation(); setAngle(nv); });
      const preview = h('div', 'mm-gprev', { 'aria-hidden': 'true' });
      const bar = h('div', 'mm-gbar', { role: 'group', 'aria-label': 'Gradient stops: click to add, drag to move, pull away to remove' }, preview);
      bar.addEventListener('pointerdown', onBarDown); bar.addEventListener('pointermove', onBarMove);
      bar.addEventListener('pointerup', onBarUp); bar.addEventListener('pointercancel', onBarUp);
      const rowsEl = h('div', 'mm-gstops');
      P = { seg, thumb, angleBox, angleVal, rot, add, bar, preview, rows: rowsEl };
      const hd = head(c.cfg.title, c.cfg.label);
      pc.replaceChildren(...(hd ? [hd] : []), h('div', 'mm-gradient', {}, seg,
        h('div', 'mm-gtools', {}, angleBox, h('span', 'mm-gfill'), flip, rot, add), bar, rowsEl));
      draw();
    },
    onOpen: () => { requestAnimationFrame(placeThumb); return P?.seg.querySelector<HTMLElement>('[aria-checked=true]'); },
  };
};

const svg = (d: string) => { const s = h('span', 'mm-ic'); s.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; return s; };
const flipIcon = () => svg('<path d="M8 2v12"/><path d="M5.5 4.5 2 8l3.5 3.5"/><path d="M10.5 4.5 14 8l-3.5 3.5"/>');
const rotIcon = () => svg('<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13 2.5v3h-3"/>');
