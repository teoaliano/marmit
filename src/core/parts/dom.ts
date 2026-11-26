/* What every control is built from: the control record the engine places on the bar, the context it talks back
   through, and the small DOM helpers the builders share. */
import { icons } from '../icons';
import type { IslandItemType, Option, OptionInput, Slot } from '../types';

export interface Ctx {
  /** draw a slot value into `into`, keyed so adapters can keep their portals stable */
  slot(key: string, value: Slot, into: HTMLElement): void;
  dropSlots(prefix: string): void;
  emit(c: Ctl, value: unknown): void;
  /** a button press, menu choice, tile or command: reported to options.onAction */
  action(c: Ctl, entry?: string): void;
  relayout(): void;
  toggle(c: Ctl): void;
  /** pointer entered (true) or left (false) a hover-opening trigger */
  hover(c: Ctl, on: boolean): void;
  closePanel(focusTrigger?: boolean): void;
  setSearch(c: Ctl, open: boolean): void;
  /** the angle the item currently sits at on the bar */
  angleOf(c: Ctl): number;
}

export interface PanelDef {
  build(pc: HTMLElement): void;
  /** called whenever the panel opens; return the element to focus when opened from the keyboard */
  onOpen?(pc: HTMLElement): HTMLElement | null | undefined;
}

export interface Ctl {
  key: string;
  type: IslandItemType;
  cfg: any;
  el: HTMLElement;
  /** size along the bar, measured; separators reserve a fixed slot */
  w: number;
  fixedW?: number;
  /** rotates with the bar's curve (wide controls, separators); square items stay upright */
  follow: boolean;
  /** pressing dents the bar under it */
  dent: boolean;
  /** a drag of the bar may start on it */
  drag: boolean;
  value?: unknown;
  hasValue: boolean;
  sig: string;
  apply(): void;
  render(): void;
  panel?: PanelDef;
  trigger?: HTMLElement;
  pc?: HTMLElement;
  // placement, written by the engine
  x: number; y: number; angle: number; u: number;
  // search state
  open?: boolean;
  destroy?(): void;
}

export type Build = (c: Ctl, ctx: Ctx) => void;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, attrs?: Record<string, string | number | boolean | undefined>, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  el.append(...kids);
  return el;
}
export const ic = (name: string) => { const s = h('span', 'mm-ic'); s.innerHTML = icons[name]; return s; };
export const opt = (o: OptionInput): Option => typeof o === 'string' ? { value: o, label: o } : { ...o, label: o.label ?? o.value };

let nodeIds = new WeakMap<object, number>(), nodeSeq = 0;
/** a signature of everything structural in a config: functions and adapter values are left out, nodes by identity */
export function signature(cfg: Record<string, unknown>) {
  const walk = (v: unknown): unknown => {
    if (v == null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    if (typeof Node !== 'undefined' && v instanceof Node) {
      let id = nodeIds.get(v); if (!id) nodeIds.set(v, id = ++nodeSeq); return '#n' + id;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (Object.getPrototypeOf(v) !== Object.prototype || '$$typeof' in v || '__v_isVNode' in v) return '#x';
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = walk((v as Record<string, unknown>)[k]);
    return o;
  };
  const { value: _v, ...rest } = cfg;
  return JSON.stringify(walk(rest));
}

/** roving arrow-key focus inside a group */
export function arrows(root: HTMLElement, sel: string, onMove?: (el: HTMLElement) => void) {
  root.addEventListener('keydown', e => {
    const ks: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in ks) && e.key !== 'Home' && e.key !== 'End') return;
    const all = [...root.querySelectorAll<HTMLElement>(sel)].filter(x => !x.hasAttribute('disabled') && x.getAttribute('aria-disabled') !== 'true');
    if (!all.length) return;
    const i = all.indexOf(document.activeElement as HTMLElement);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + ks[e.key] + all.length) % all.length;
    e.preventDefault(); e.stopPropagation(); all[n].focus(); onMove?.(all[n]);
  });
}

/* ---------- panel triggers ---------- */
/** `glyph`: a control's own default icon (markup), used when the config gives none, e.g. the anchor's live mini map;
    with one, the trigger is an icon button unless the config asks for a pill */
export function trigger(c: Ctl, ctx: Ctx, pillLabel?: () => string, glyph?: () => string) {
  const usePill = () => c.cfg.trigger === 'pill' || (c.cfg.trigger !== 'icon' && (!(c.cfg.icon || glyph) || !!pillLabel));
  const icon = () => { const i = h('span', 'mm-ic'); if (c.cfg.icon || !glyph) ctx.slot(c.key + '/t/icon', c.cfg.icon, i); else i.innerHTML = glyph(); return i; };
  let el: HTMLElement;
  const make = () => {
    const pill = usePill();
    el = h('button', pill ? 'mm-pill' : 'mm-btn', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    el.addEventListener('click', () => ctx.toggle(c));
    // hover-opening menus: mouse only (a touch has no hover; it opens on the tap)
    el.addEventListener('pointerenter', e => { if (c.cfg.openOn === 'hover' && e.pointerType === 'mouse') ctx.hover(c, true); });
    el.addEventListener('pointerleave', e => { if (c.cfg.openOn === 'hover' && e.pointerType === 'mouse') ctx.hover(c, false); });
    c.el = el; c.trigger = el; c.dent = true; c.drag = true; c.follow = pill;
  };
  make();
  return () => {
    ctx.dropSlots(c.key + '/t/');
    el.setAttribute('aria-label', c.cfg.label);
    el.replaceChildren();
    if (usePill()) {
      if (c.cfg.icon || glyph) el.append(icon());
      const chev = ic('chevron'); chev.className = 'mm-chev';
      el.append(pillLabel ? pillLabel() : c.cfg.label, chev);
    } else el.append(icon());
  };
}
export const head = (title: string | false | undefined, fallback: string, right?: Node) =>
  title === false ? null : h('div', 'mm-ph', {}, h('span', '', {}, title ?? fallback), ...(right ? [right] : []));

