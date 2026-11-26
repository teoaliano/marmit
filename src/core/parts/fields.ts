/* Fields row: X / Y / Z number fields that sit on the bar. Drag a letter to scrub, click a value to type, and the link
   button keeps the axes in proportion. Also home to the slider's click-snap rule, the other piece of number maths
   the bar's own controls share. */
import { clamp } from '../physics';
import type { FieldAxis } from '../types';
import { h, ic, type Build, type Ctl } from './dom';
import { clickToType, decimals, scrub, snapGrid, stepKey, withUnit } from './num';

export interface Lim { min: number; max: number; step: number }

/** A linked edit: axis `i` asks for `next`, and every axis moves by the same ratio next / base[i], or by the same
    offset when base[i] is 0 (a ratio from 0 means nothing). The ratio is limited so every axis stays inside its own
    range, which keeps the proportions intact when one axis hits an end. `base` is the vector when the gesture began. */
export function linkScale(base: number[], i: number, next: number, lims: Lim[]): number[] {
  const ratio = base[i] !== 0;
  let lo = -Infinity, hi = Infinity;
  base.forEach((x, j) => {
    const { min, max } = lims[j];
    if (!ratio) { lo = Math.max(lo, min - x); hi = Math.min(hi, max - x); }
    else if (x !== 0) { lo = Math.max(lo, Math.min(min / x, max / x)); hi = Math.min(hi, Math.max(min / x, max / x)); }
  });
  const k = clamp(ratio ? next / base[i] : next - base[i], lo, hi);
  return base.map((x, j) => snapGrid(ratio ? x * k : x + k, lims[j].step, lims[j].min, lims[j].max));
}


interface Axis extends Lim { key: string; label: string; unit?: string }
const axesOf = (c: Ctl): Axis[] => (c.cfg.axes as (FieldAxis | string)[]).map(a => {
  const x = typeof a === 'string' ? { key: a } as FieldAxis : a;
  return { key: x.key, label: x.label ?? x.key.slice(0, 1).toUpperCase(), min: x.min ?? c.cfg.min ?? -Infinity,
    max: x.max ?? c.cfg.max ?? Infinity, step: x.step ?? c.cfg.step ?? 1, unit: x.unit ?? c.cfg.unit };
});
const fmt = (a: Axis, v: number) => v.toFixed(decimals(a.step, Number.isFinite(a.min) ? a.min : undefined, Number.isFinite(a.max) ? a.max : undefined));
const STEP_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'];

export const fields: Build = (c, ctx) => {
  const el = h('div', 'mm-fields', { role: 'group' }), lab = h('span', 'mm-label'), list = h('div', 'mm-flds'),
    link = h('button', 'mm-btn mm-fields-link', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'Link axes' }, ic('link'));
  el.append(lab, list, link); el.dataset.mmNodrag = '';
  c.el = el; c.follow = true; c.hasValue = true;
  let ax: Axis[] = [], cells: { box: HTMLElement; val: HTMLElement }[] = [], cleanups: (() => void)[] = [];
  let linked = !!c.cfg.linked, cfgLinked = c.cfg.linked;
  // the vector a linked gesture started from: kept for the whole gesture so clamping never bends the proportions
  let base: number[] | null = null, settle: ReturnType<typeof setTimeout> | undefined;

  const vals = () => c.value as Record<string, number>;
  const vec = () => ax.map(a => vals()[a.key]);
  const norm = (v: unknown) => {
    const cur = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, o: Record<string, number> = {};
    for (const a of ax) {
      const x = cur[a.key];
      o[a.key] = snapGrid(typeof x === 'number' && Number.isFinite(x) ? x : clamp(0, a.min, a.max), a.step, a.min, a.max);
    }
    return o;
  };
  const write = (next: number[]) => {
    const o = { ...vals() }; let changed = false;
    ax.forEach((a, j) => { if (o[a.key] !== next[j]) { o[a.key] = next[j]; changed = true; } });
    if (changed) { c.value = o; c.apply(); ctx.emit(c, { ...o }); }
  };
  /** set one axis (and, linked, the rest with it); returns what axis i actually holds now */
  const setAxis = (i: number, v: number) => {
    if (linked && ax.length > 1) write(linkScale(base ?? vec(), i, v, ax));
    else { const a = ax[i], next = vec(); next[i] = snapGrid(v, a.step, a.min, a.max); write(next); }
    return vals()[ax[i].key];
  };
  // a key press or a typed number is its own small gesture; a run of them (a held arrow) shares one base until it pauses
  const brief = () => { base ??= vec(); clearTimeout(settle); settle = setTimeout(() => { base = null; }, 500); };

  link.addEventListener('click', () => { linked = !linked; base = null; c.apply(); c.cfg.onLinkChange?.(linked); });

  c.render = () => {
    const cfg = c.cfg;
    ax = axesOf(c);
    if (cfg.linked !== cfgLinked) { cfgLinked = cfg.linked; linked = !!cfg.linked; }
    lab.textContent = cfg.label ?? ''; lab.hidden = !cfg.label;
    el.setAttribute('aria-label', cfg.label ?? 'Fields');
    cleanups.forEach(f => f()); cleanups = []; base = null;
    cells = ax.map((a, i) => {
      const name = (cfg.label ? cfg.label + ' ' : '') + a.label;
      const box = h('div', 'mm-fld'), letter = h('span', 'mm-fld-ax', { 'aria-hidden': 'true' }, a.label),
        val = h('span', 'mm-fld-v', { role: 'spinbutton', tabindex: 0, 'aria-label': name });
      if (Number.isFinite(a.min)) val.setAttribute('aria-valuemin', String(a.min));
      if (Number.isFinite(a.max)) val.setAttribute('aria-valuemax', String(a.max));
      if (cfg.fieldWidth) box.style.minWidth = cfg.fieldWidth + 'px';
      box.append(letter, val);
      cleanups.push(scrub(letter, {
        get: () => vals()[a.key], set: v => setAxis(i, v), perPx: () => a.step,
        onStart: () => { clearTimeout(settle); base = vec(); }, onEnd: () => { base = null; },
      }));
      clickToType(val, {
        get: () => vals()[a.key], text: () => fmt(a, vals()[a.key]), label: name,
        commit: v => { brief(); setAxis(i, v); },
        step: (k, v, shift) => stepKey(k, v, a.min, a.max, a.step, shift),
      });
      val.addEventListener('keydown', e => {
        if (e.altKey || e.metaKey || e.ctrlKey || !STEP_KEYS.includes(e.key)) return;
        const n = stepKey(e.key, vals()[a.key], a.min, a.max, a.step, e.shiftKey);
        if (n === null) return;
        e.preventDefault(); e.stopPropagation(); brief(); setAxis(i, n);
      });
      return { box, val };
    });
    list.replaceChildren(...cells.map(x => x.box));
  };
  c.apply = () => {
    c.value = norm(c.value);
    ax.forEach((a, i) => {
      const v = vals()[a.key], t = fmt(a, v), val = cells[i]?.val; if (!val) return;
      val.replaceChildren(t, ...(a.unit ? [h('span', 'mm-unit', {}, withUnit('', a.unit))] : []));
      val.setAttribute('aria-valuenow', String(v)); val.setAttribute('aria-valuetext', a.unit ? `${t} ${a.unit}` : t);
    });
    link.style.display = c.cfg.linkable === false || ax.length < 2 ? 'none' : '';
    link.setAttribute('aria-pressed', String(linked)); link.classList.toggle('on', linked);
  };
  c.destroy = () => { cleanups.forEach(f => f()); clearTimeout(settle); };
};
