/* The controls that ride on the bar, and the panels that grow out of it. Each control owns one element (placed on the
   bar by the engine) and, for panel triggers, builds the panel's content on demand. */
import { icons } from './icons';
import { clamp } from './physics';
import type { IslandItem, IslandItemType, MenuEntry, Option, OptionInput, Slot } from './types';

export interface Ctx {
  /** draw a slot value into `into`, keyed so adapters can keep their portals stable */
  slot(key: string, value: Slot, into: HTMLElement): void;
  dropSlots(prefix: string): void;
  emit(c: Ctl, value: unknown): void;
  /** a button press, menu choice, tile or command: reported to options.onAction */
  action(c: Ctl, entry?: string): void;
  relayout(): void;
  toggle(c: Ctl): void;
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

/* ---------- helpers ---------- */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, attrs?: Record<string, string | number | boolean | undefined>, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  el.append(...kids);
  return el;
}
const ic = (name: string) => { const s = h('span', 'mm-ic'); s.innerHTML = icons[name]; return s; };
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
function arrows(root: HTMLElement, sel: string, onMove?: (el: HTMLElement) => void) {
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

const fmtNum = (v: number, step: number) => {
  const d = Math.max(0, Math.min(6, (String(step).split('.')[1] || '').length));
  return v.toFixed(d);
};
const snapStep = (v: number, min: number, max: number, step: number) => clamp(Math.round((v - min) / step) * step + min, min, max);

/* ---------- controls ---------- */
type Build = (c: Ctl, ctx: Ctx) => void;

const button: Build = (c, ctx) => {
  const el = h('button', 'mm-btn', { type: 'button' }), icon = h('span', 'mm-ic'); let badge = null as HTMLElement | null;
  el.append(icon); c.el = el; c.dent = true; c.drag = true;
  el.addEventListener('click', e => {
    if (c.cfg.toggle) { c.value = !c.value; c.apply(); ctx.emit(c, c.value); }
    c.cfg.onClick?.(e); ctx.action(c);
  });
  c.render = () => {
    const cfg = c.cfg;
    el.setAttribute('aria-label', cfg.label);
    el.classList.toggle('primary', cfg.variant === 'primary');
    ctx.slot(c.key + '/icon', cfg.icon ?? cfg.label?.slice(0, 1), icon);
    badge?.remove(); badge = null;
    if (cfg.badge !== undefined && cfg.badge !== false && cfg.badge !== 0 && cfg.badge !== '') {
      badge = h('b', 'mm-badge' + (cfg.badge === true ? ' dot' : ''), { 'aria-hidden': 'true' }, cfg.badge === true ? '' : String(cfg.badge));
      el.append(badge);
    }
  };
  c.hasValue = !!c.cfg.toggle; c.value = !!c.cfg.value;
  c.apply = () => { if (c.cfg.toggle) { el.classList.toggle('on', !!c.value); el.setAttribute('aria-pressed', String(!!c.value)); } else { el.classList.remove('on'); el.removeAttribute('aria-pressed'); } };
};

const pill: Build = (c, ctx) => {
  const el = h('button', 'mm-pill', { type: 'button' }); c.el = el; c.dent = true; c.drag = true; c.follow = true;
  el.addEventListener('click', e => { c.cfg.onClick?.(e); ctx.action(c); });
  c.render = () => {
    ctx.dropSlots(c.key + '/');
    el.replaceChildren(); el.classList.toggle('solid', c.cfg.variant === 'solid');
    if (c.cfg.icon) { const i = h('span', 'mm-ic'); ctx.slot(c.key + '/icon', c.cfg.icon, i); el.append(i); }
    el.append(c.cfg.label);
  };
};

const separator: Build = c => { c.el = h('div', 'mm-sep', { role: 'separator', 'aria-orientation': 'vertical' }); c.fixedW = 9.5; c.follow = true; };
const spacer: Build = c => { c.el = h('div', '', { 'aria-hidden': 'true' }); c.render = () => { c.fixedW = c.cfg.size ?? 8; }; };
const label: Build = c => {
  const el = h('span', 'mm-label'); c.el = el; c.follow = true; c.drag = true;
  c.render = () => { el.textContent = c.cfg.text; el.classList.toggle('ink', c.cfg.muted === false); };
};

const segmented: Build = (c, ctx) => {
  const el = h('div', 'mm-seg', { role: 'radiogroup' }), thumb = h('i', 'mm-seg-thumb', { 'aria-hidden': 'true' });
  c.el = el; c.follow = true; c.hasValue = true;
  arrows(el, 'button', b => b.click());
  c.render = () => {
    ctx.dropSlots(c.key + '/');
    el.setAttribute('aria-label', c.cfg.label ?? 'Options');
    const opts = (c.cfg.options as OptionInput[]).map(opt);
    el.replaceChildren(thumb, ...opts.map((o, i) => {
      const b = h('button', '', { type: 'button', role: 'radio', 'data-v': o.value });
      if (o.icon) { const s = h('span', 'mm-ic'); ctx.slot(`${c.key}/opt/${i}/icon`, o.icon, s); b.append(s); }
      if (o.label && !(o.icon && o.label === o.value && c.cfg.iconOnly)) b.append(o.label);
      b.addEventListener('click', () => { if (c.value !== o.value) { c.value = o.value; c.apply(); ctx.emit(c, c.value); } });
      return b;
    }));
    if (c.value === undefined || !opts.some(o => o.value === c.value)) c.value = opts[0]?.value;
  };
  c.apply = () => {
    let on: HTMLElement | null = null;
    el.querySelectorAll<HTMLElement>('button').forEach(b => { const v = b.dataset.v === c.value; b.setAttribute('aria-checked', String(v)); b.tabIndex = v ? 0 : -1; if (v) on = b; });
    const place = () => { if (on) { thumb.style.width = on.offsetWidth + 'px'; thumb.style.transform = `translateX(${on.offsetLeft}px)`; } };
    place(); requestAnimationFrame(place);
  };
};

const sw: Build = (c, ctx) => {
  const el = h('div', 'mm-labeled'), lab = h('span', 'mm-label'), b = h('button', 'mm-switch', { type: 'button', role: 'switch' });
  el.append(lab, b); c.el = el; c.follow = true; c.hasValue = true; c.drag = true; c.value = !!c.cfg.value;
  b.addEventListener('click', () => { c.value = !c.value; c.apply(); ctx.emit(c, c.value); });
  c.render = () => { lab.textContent = c.cfg.label ?? ''; lab.hidden = !c.cfg.label; b.setAttribute('aria-label', c.cfg.label ?? 'Toggle'); };
  c.apply = () => b.setAttribute('aria-checked', String(!!c.value));
};

const slider: Build = (c, ctx) => {
  const el = h('div', 'mm-labeled'), lab = h('span', 'mm-label'), tr = h('div', 'mm-slider', { role: 'slider', tabindex: 0 }),
    fill = h('div', 'mm-fill'), knob = h('div', 'mm-knob'), out = h('span', 'mm-value');
  tr.append(fill, knob); el.append(lab, tr, out); el.dataset.mmNodrag = '';
  c.el = el; c.follow = true; c.hasValue = true;
  const lim = () => { const min = c.cfg.min ?? 0, max = c.cfg.max ?? 100; return { min, max, step: c.cfg.step ?? (max - min > 10 ? 1 : (max - min) / 100) }; };
  const set = (v: number) => { const { min, max, step } = lim(); v = snapStep(v, min, max, step); if (v !== c.value) { c.value = v; c.apply(); ctx.emit(c, v); } };
  const at = (e: PointerEvent) => {
    const r = tr.getBoundingClientRect(), a = ctx.angleOf(c), w = tr.offsetWidth;
    const local = (e.clientX - (r.left + r.width / 2)) * Math.cos(a) + (e.clientY - (r.top + r.height / 2)) * Math.sin(a) + w / 2;
    const { min, max } = lim(); set(min + clamp(local / w, 0, 1) * (max - min));
  };
  tr.addEventListener('pointerdown', e => { if (e.button) return; e.stopPropagation(); tr.classList.add('drag'); tr.setPointerCapture(e.pointerId); at(e); });
  tr.addEventListener('pointermove', e => { if (tr.classList.contains('drag')) at(e); });
  const end = () => tr.classList.remove('drag');
  tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end);
  tr.addEventListener('keydown', e => {
    const { min, max, step } = lim(), v = c.value as number;
    const d: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
    if (e.key in d) set(v + d[e.key]); else if (e.key === 'Home') set(min); else if (e.key === 'End') set(max); else return;
    e.preventDefault(); e.stopPropagation();
  });
  c.render = () => {
    lab.textContent = c.cfg.label ?? ''; lab.hidden = !c.cfg.label; tr.style.width = (c.cfg.width ?? 120) + 'px'; out.hidden = c.cfg.showValue === false;
    const { min, max } = lim(); tr.setAttribute('aria-valuemin', String(min)); tr.setAttribute('aria-valuemax', String(max));
    tr.setAttribute('aria-label', c.cfg.label ?? 'Value');
    if (typeof c.value !== 'number') c.value = c.cfg.value ?? (min + max) / 2;
  };
  c.apply = () => {
    const { min, max, step } = lim(), v = c.value as number, f = max > min ? clamp((v - min) / (max - min), 0, 1) : 0;
    fill.style.width = f * 100 + '%'; knob.style.left = f * 100 + '%';
    const txt = c.cfg.format ? c.cfg.format(v) : fmtNum(v, step);
    out.textContent = txt; tr.setAttribute('aria-valuenow', String(v)); tr.setAttribute('aria-valuetext', txt);
  };
};

const stepper: Build = (c, ctx) => {
  const el = h('div', 'mm-labeled'), lab = h('span', 'mm-label'), box = h('div', 'mm-stepper', { role: 'spinbutton', tabindex: 0 }),
    dn = h('button', '', { type: 'button', 'aria-label': 'Decrease', tabindex: -1 }, ic('minus')), out = h('span', 'mm-value'),
    up = h('button', '', { type: 'button', 'aria-label': 'Increase', tabindex: -1 }, ic('plus'));
  box.append(dn, out, up); el.append(lab, box); c.el = el; c.follow = true; c.hasValue = true; c.drag = true;
  const lim = () => ({ min: c.cfg.min ?? -Infinity, max: c.cfg.max ?? Infinity, step: c.cfg.step ?? 1 });
  const by = (n: number) => { const { min, max, step } = lim(), v = clamp(+(((c.value as number) + n * step).toFixed(6)), min, max); if (v !== c.value) { c.value = v; c.apply(); ctx.emit(c, v); } };
  dn.addEventListener('click', () => by(-1)); up.addEventListener('click', () => by(1));
  box.addEventListener('keydown', e => {
    const d: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    if (e.key in d) { e.preventDefault(); e.stopPropagation(); by(d[e.key]); }
  });
  c.render = () => {
    lab.textContent = c.cfg.label ?? ''; lab.hidden = !c.cfg.label; box.setAttribute('aria-label', c.cfg.label ?? 'Value');
    if (typeof c.value !== 'number') c.value = c.cfg.value ?? Math.max(0, lim().min);
  };
  c.apply = () => {
    const { min, max, step } = lim(), v = c.value as number, txt = c.cfg.format ? c.cfg.format(v) : fmtNum(v, step);
    out.textContent = txt; box.setAttribute('aria-valuenow', String(v)); box.setAttribute('aria-valuetext', txt);
    (dn as HTMLButtonElement).disabled = v <= min; (up as HTMLButtonElement).disabled = v >= max;
  };
};

const dots = (thumbs: boolean): Build => (c, ctx) => {
  const el = h('div', 'mm-dots', { role: 'radiogroup' }); c.el = el; c.follow = true; c.hasValue = true;
  arrows(el, 'button', b => b.click());
  c.render = () => {
    el.setAttribute('aria-label', c.cfg.label ?? (thumbs ? 'Images' : 'Colours'));
    const os = (c.cfg.options as any[]).map(o => typeof o === 'string' ? { value: o, src: o, label: undefined } : o);
    el.replaceChildren(...os.map((o, i) => {
      const b = h('button', 'mm-dot', { type: 'button', role: 'radio', 'data-v': o.value, 'aria-label': o.label ?? (thumbs ? `Image ${i + 1}` : o.value) });
      b.style.setProperty('--c', thumbs ? `url("${String(o.src).replace(/"/g, '%22')}")` : o.value);
      b.addEventListener('click', () => { if (c.value !== o.value) { c.value = o.value; c.apply(); ctx.emit(c, c.value); } });
      return b;
    }));
    if (c.value === undefined) c.value = os[0]?.value;
  };
  c.apply = () => el.querySelectorAll<HTMLElement>('button').forEach(b => { const v = b.dataset.v === c.value; b.setAttribute('aria-checked', String(v)); b.tabIndex = v ? 0 : -1; });
};

const field: Build = (c, ctx) => {
  const el = h('label', 'mm-field'), icon = h('span', 'mm-ic'), input = h('input', '', { type: 'text', spellcheck: 'false' });
  el.append(icon, input); el.dataset.mmNodrag = ''; c.el = el; c.follow = true; c.hasValue = true; c.value = c.cfg.value ?? '';
  input.addEventListener('input', () => { c.value = input.value; ctx.emit(c, c.value); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') c.cfg.onSubmit?.(input.value); e.stopPropagation(); });
  c.render = () => {
    el.style.width = (c.cfg.width ?? 160) + 'px'; input.placeholder = c.cfg.placeholder ?? ''; input.setAttribute('aria-label', c.cfg.label ?? c.cfg.placeholder ?? 'Text');
    ctx.slot(c.key + '/icon', c.cfg.icon === undefined ? 'search' : c.cfg.icon, icon); icon.hidden = c.cfg.icon === null;
  };
  c.apply = () => { if (input.value !== c.value) input.value = String(c.value ?? ''); };
};

const search: Build = (c, ctx) => {
  const el = h('div', 'mm-search', { role: 'button', tabindex: 0, 'aria-expanded': 'false' }), input = h('input', '', { type: 'text', tabindex: -1, spellcheck: 'false' });
  el.append(ic('search'), input); c.el = el; c.follow = false; c.hasValue = true; c.open = false; c.value = c.cfg.value ?? ''; c.dent = true; c.drag = true;
  (c as any).input = input;
  el.addEventListener('pointerdown', e => { if (c.open && e.target !== input) { e.preventDefault(); input.focus({ preventScroll: true }); } });
  el.addEventListener('click', () => { if (!c.open) ctx.setSearch(c, true); });
  el.addEventListener('keydown', e => { if (!c.open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctx.setSearch(c, true); } });
  input.addEventListener('input', () => { c.value = input.value; ctx.emit(c, c.value); });
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { ctx.setSearch(c, false); el.focus({ preventScroll: true }); }
    if (e.key === 'Enter') c.cfg.onSubmit?.(input.value);
  });
  input.addEventListener('blur', () => setTimeout(() => { if (c.open && !input.value && document.activeElement !== input) ctx.setSearch(c, false); }, 0));
  c.render = () => { input.placeholder = c.cfg.placeholder ?? 'Search'; el.setAttribute('aria-label', c.cfg.label ?? 'Search'); input.setAttribute('aria-label', c.cfg.label ?? 'Search'); };
  c.apply = () => { if (input.value !== c.value) input.value = String(c.value ?? ''); };
};

const status: Build = c => {
  const el = h('span', 'mm-status', { role: 'status' }); c.el = el; c.follow = true; c.drag = true;
  c.render = () => {
    el.textContent = c.cfg.label; el.classList.toggle('pulse', c.cfg.pulse !== false);
    const t = c.cfg.tone ?? 'success'; el.style.setProperty('--tone', t === 'neutral' ? 'var(--mm-muted)' : `var(--mm-${t})`);
  };
};

const avatars: Build = c => {
  const el = h('div', 'mm-avatars', { role: 'group' }); c.el = el; c.follow = true; c.drag = true;
  const COLORS = ['#facc15', '#38bdf8', '#fb923c', '#a3e635', '#f472b6', '#a78bfa'];
  c.render = () => {
    const ps = c.cfg.people as { name: string; initials?: string; src?: string; color?: string }[], max = c.cfg.max ?? 3, shown = ps.slice(0, ps.length > max ? max - 1 : max);
    el.setAttribute('aria-label', ps.map(p => p.name).join(', '));
    el.replaceChildren(...shown.map((p, i) => {
      const s = h('span', '', { title: p.name });
      if (p.src) s.style.setProperty('--c', `url("${p.src.replace(/"/g, '%22')}")`); else { s.style.setProperty('--c', p.color ?? COLORS[i % COLORS.length]); s.textContent = p.initials ?? p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
      return s;
    }));
    if (ps.length > shown.length) el.append(h('span', 'more', { title: ps.slice(shown.length).map(p => p.name).join(', ') }, '+' + (ps.length - shown.length)));
  };
};

const progress: Build = (c, ctx) => {
  const el = h('div', 'mm-ring', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }), num = h('span');
  el.innerHTML = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="11"/><circle class="arc" cx="14" cy="14" r="11" stroke-linecap="round" stroke-dasharray="69.12" stroke-dashoffset="69.12"/></svg>';
  el.append(num); c.el = el; c.hasValue = true; c.value = c.cfg.value ?? 0; c.drag = true;
  el.addEventListener('click', e => { if (c.cfg.onClick) { c.cfg.onClick(e); ctx.action(c); } });
  c.render = () => { el.setAttribute('aria-label', c.cfg.label ?? 'Progress'); el.classList.toggle('clickable', !!c.cfg.onClick); num.hidden = c.cfg.showValue === false; c.dent = !!c.cfg.onClick; };
  c.apply = () => {
    const f = clamp(Number(c.value) || 0, 0, 1);
    (el.querySelector('.arc') as SVGElement).style.strokeDashoffset = String(69.12 * (1 - f));
    num.textContent = String(Math.round(f * 100)); el.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  };
};

const custom: Build = (c, ctx) => {
  const el = h('div', 'mm-custom'); c.el = el; c.follow = false;
  c.render = () => {
    c.drag = !!c.cfg.draggable; if (!c.drag) el.dataset.mmNodrag = ''; else delete el.dataset.mmNodrag;
    c.fixedW = c.cfg.width; if (c.cfg.width) el.style.width = c.cfg.width + 'px';
    if (c.cfg.label) el.setAttribute('aria-label', c.cfg.label);
    ctx.slot(c.key + '/render', c.cfg.render, el);
  };
};

/* ---------- panel triggers ---------- */
function trigger(c: Ctl, ctx: Ctx, pillLabel?: () => string) {
  const usePill = () => c.cfg.trigger === 'pill' || (c.cfg.trigger !== 'icon' && (!c.cfg.icon || !!pillLabel));
  let el: HTMLElement;
  const make = () => {
    const pill = usePill();
    el = h('button', pill ? 'mm-pill' : 'mm-btn', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    el.addEventListener('click', () => ctx.toggle(c));
    c.el = el; c.trigger = el; c.dent = true; c.drag = true; c.follow = pill;
  };
  make();
  return () => {
    ctx.dropSlots(c.key + '/t/');
    el.setAttribute('aria-label', c.cfg.label);
    el.replaceChildren();
    if (usePill()) {
      if (c.cfg.icon) { const i = h('span', 'mm-ic'); ctx.slot(c.key + '/t/icon', c.cfg.icon, i); el.append(i); }
      const chev = ic('chevron'); chev.className = 'mm-chev';
      el.append(pillLabel ? pillLabel() : c.cfg.label, chev);
    } else {
      const i = h('span', 'mm-ic'); ctx.slot(c.key + '/t/icon', c.cfg.icon, i); el.append(i);
    }
  };
}
const head = (title: string | false | undefined, fallback: string, right?: Node) =>
  title === false ? null : h('div', 'mm-ph', {}, h('span', '', {}, title ?? fallback), ...(right ? [right] : []));

function rowsKeys(root: HTMLElement) { arrows(root, '[data-mm-focus]'); }

const menu: Build = (c, ctx) => {
  const renderTrigger = trigger(c, ctx);
  c.render = () => renderTrigger();
  c.panel = {
    build(pc) {
      ctx.dropSlots(c.key + '/p/');
      const list = h('div', 'mm-rows', { role: 'menu', 'aria-label': c.cfg.label });
      (c.cfg.items as (MenuEntry | 'separator')[]).forEach((m, i) => {
        if (m === 'separator') { list.append(h('div', 'mm-rsep', { role: 'separator' })); return; }
        const row = h('button', 'mm-row' + (m.danger ? ' danger' : ''), { type: 'button', role: m.checked !== undefined ? 'menuitemcheckbox' : 'menuitem', 'data-mm-focus': '', 'aria-disabled': m.disabled ? 'true' : undefined, 'aria-checked': m.checked !== undefined ? String(m.checked) : undefined });
        if (m.checked !== undefined) row.append(Object.assign(ic('check'), { className: 'mm-ic mm-check' }));
        if (m.icon) { const s = h('span', 'mm-ic'); ctx.slot(`${c.key}/p/${i}/icon`, m.icon, s); row.append(s); }
        row.append(h('span', 'mm-rl', {}, m.label));
        if (m.shortcut) row.append(h('kbd', '', {}, m.shortcut)); else if (m.hint) row.append(h('span', 'mm-hint', {}, m.hint));
        row.addEventListener('click', () => {
          const cur = (c.cfg.items as (MenuEntry | 'separator')[])[i]; if (cur === 'separator' || cur?.disabled) return;
          cur?.onSelect?.(); ctx.action(c, cur.id ?? cur.label); if (c.cfg.closeOnSelect !== false) ctx.closePanel(true);
        });
        list.append(row);
      });
      rowsKeys(list);
      const hd = c.cfg.title ? head(c.cfg.title, c.cfg.label) : null;
      pc.replaceChildren(...(hd ? [hd] : []), list);
    },
    onOpen: pc => pc.querySelector<HTMLElement>('[data-mm-focus]'),
  };
};

const select: Build = (c, ctx) => {
  c.hasValue = true;
  const opts = () => (c.cfg.options as OptionInput[]).map(opt);
  const renderTrigger = trigger(c, ctx, () => opts().find(o => o.value === c.value)?.label ?? c.cfg.label);
  c.render = () => { if (c.value === undefined || !opts().some(o => o.value === c.value)) c.value = opts()[0]?.value; renderTrigger(); };
  c.apply = () => {
    renderTrigger();
    c.pc?.querySelectorAll<HTMLElement>('[data-v]').forEach(r => r.setAttribute('aria-checked', String(r.dataset.v === c.value)));
  };
  c.panel = {
    build(pc) {
      ctx.dropSlots(c.key + '/p/');
      const list = h('div', 'mm-rows', { role: 'menu', 'aria-label': c.cfg.label });
      opts().forEach((o, i) => {
        const row = h('button', 'mm-row', { type: 'button', role: 'menuitemradio', 'data-mm-focus': '', 'data-v': o.value, 'aria-checked': String(o.value === c.value) });
        row.append(Object.assign(ic('check'), { className: 'mm-ic mm-check' }));
        if (o.icon) { const s = h('span', 'mm-ic'); ctx.slot(`${c.key}/p/${i}/icon`, o.icon, s); row.append(s); }
        row.append(h('span', 'mm-rl', {}, o.label ?? o.value));
        row.addEventListener('click', () => { if (c.value !== o.value) { c.value = o.value; c.apply(); ctx.emit(c, c.value); } ctx.closePanel(true); });
        list.append(row);
      });
      rowsKeys(list);
      const hd = c.cfg.title ? head(c.cfg.title, c.cfg.label) : null;
      pc.replaceChildren(...(hd ? [hd] : []), list);
    },
    onOpen: pc => pc.querySelector<HTMLElement>('[aria-checked=true]') ?? pc.querySelector<HTMLElement>('[data-mm-focus]'),
  };
};

const grid: Build = (c, ctx) => {
  const renderTrigger = trigger(c, ctx);
  c.render = () => renderTrigger();
  c.panel = {
    build(pc) {
      ctx.dropSlots(c.key + '/p/');
      const g = h('div', 'mm-tiles', { role: 'menu', 'aria-label': c.cfg.label });
      g.style.setProperty('--cols', String(c.cfg.columns ?? Math.min(3, c.cfg.items.length)));
      (c.cfg.items as any[]).forEach((t, i) => {
        const b = h('button', 'mm-tile', { type: 'button', role: 'menuitem', 'data-mm-focus': '' }), s = h('span', 'mm-ic');
        ctx.slot(`${c.key}/p/${i}/icon`, t.icon, s); b.append(s, t.label);
        b.addEventListener('click', () => { const t = c.cfg.items[i]; t?.onSelect?.(); if (t) ctx.action(c, t.id ?? t.label); if (c.cfg.closeOnSelect !== false) ctx.closePanel(true); });
        g.append(b);
      });
      rowsKeys(g);
      const hd = head(c.cfg.title, c.cfg.label);
      pc.replaceChildren(...(hd ? [hd] : []), g);
    },
    onOpen: pc => pc.querySelector<HTMLElement>('[data-mm-focus]'),
  };
};

const SWATCHES = ['#111111', '#6b6b73', '#e4e4e7', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
const color: Build = (c, ctx) => {
  c.hasValue = true;
  const renderTrigger = trigger(c, ctx);
  const os = () => (c.cfg.options as string[] | undefined) ?? SWATCHES;
  let hex: HTMLElement | null = null, prev: HTMLElement | null = null;
  c.render = () => { if (c.value === undefined) c.value = os()[Math.min(8, os().length - 1)]; renderTrigger(); };
  c.apply = () => {
    if (hex) hex.textContent = String(c.value).toUpperCase();
    if (prev) prev.style.background = String(c.value);
    c.pc?.querySelectorAll<HTMLElement>('[data-v]').forEach(b => { const v = b.dataset.v === c.value; b.setAttribute('aria-checked', String(v)); b.tabIndex = v ? 0 : -1; });
    c.trigger?.style.setProperty('--mm-swatch', String(c.value));
  };
  c.panel = {
    build(pc) {
      hex = h('span'); prev = h('div', 'mm-prev', {}, h('span', '', {}, 'Preview'), h('span', '', {}, '100%'));
      const g = h('div', 'mm-swg', { role: 'radiogroup', 'aria-label': c.cfg.label });
      g.style.setProperty('--cols', String(c.cfg.columns ?? 6));
      os().forEach(col => {
        const b = h('button', '', { type: 'button', role: 'radio', 'data-v': col, 'aria-label': col });
        b.style.setProperty('--c', col);
        b.addEventListener('click', () => { if (c.value !== col) { c.value = col; c.apply(); ctx.emit(c, col); } });
        g.append(b);
      });
      arrows(g, 'button', b => b.click());
      pc.replaceChildren(...[head(c.cfg.title, c.cfg.label, hex)].filter(Boolean) as Node[], g, prev);
      c.apply();
    },
    onOpen: pc => pc.querySelector<HTMLElement>('[aria-checked=true]'),
  };
};

const command: Build = (c, ctx) => {
  const renderTrigger = trigger(c, ctx);
  c.render = () => renderTrigger();
  let input: HTMLInputElement, list: HTMLElement, empty: HTMLElement;
  const filter = () => {
    const q = input.value.trim().toLowerCase(); let n = 0, first = null as HTMLElement | null;
    list.querySelectorAll<HTMLElement>('.mm-row').forEach(r => {
      const show = !q || (r.dataset.k ?? '').includes(q); r.hidden = !show; r.classList.remove('active');
      if (show) { n++; first ??= r; }
    });
    (first as HTMLElement | null)?.classList.add('active'); empty.hidden = n > 0;
    c.cfg.onQuery?.(input.value);
  };
  const pick = (i: number) => { const t = c.cfg.items[i]; t?.onSelect?.(); if (t) ctx.action(c, t.id ?? t.label); ctx.closePanel(true); };
  c.panel = {
    build(pc) {
      ctx.dropSlots(c.key + '/p/');
      input = h('input', '', { type: 'text', placeholder: c.cfg.placeholder ?? 'Search', 'aria-label': c.cfg.label, spellcheck: 'false' });
      const box = h('div', 'mm-cmd', {}, ic('search'), input);
      list = h('div', 'mm-rows', { role: 'listbox', 'aria-label': c.cfg.label });
      empty = h('div', 'mm-empty', {}, c.cfg.empty ?? 'No results'); empty.hidden = true;
      (c.cfg.items as any[]).forEach((it, i) => {
        const row = h('button', 'mm-row', { type: 'button', role: 'option', 'data-mm-focus': '', 'data-i': i, 'data-k': [it.label, it.hint, ...(it.keywords ?? [])].filter(Boolean).join(' ').toLowerCase() });
        if (it.icon) { const s = h('span', 'mm-ic'); ctx.slot(`${c.key}/p/${i}/icon`, it.icon, s); row.append(s); }
        row.append(h('span', 'mm-rl', {}, it.label));
        if (it.hint) row.append(h('span', 'mm-hint', {}, it.hint));
        row.addEventListener('click', () => pick(i));
        list.append(row);
      });
      input.addEventListener('input', filter);
      input.addEventListener('keydown', e => {
        const rows = [...list.querySelectorAll<HTMLElement>('.mm-row:not([hidden])')], i = rows.findIndex(r => r.classList.contains('active'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); e.stopPropagation(); rows[i]?.classList.remove('active');
          const n = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]; n?.classList.add('active'); n?.scrollIntoView?.({ block: 'nearest' });
        } else if (e.key === 'Enter') { e.preventDefault(); const r = rows[Math.max(0, i)]; if (r) pick(+r.dataset.i!); }
      });
      const hd = c.cfg.title ? head(c.cfg.title, c.cfg.label) : null;
      pc.replaceChildren(...(hd ? [hd] : []), box, list, empty);
      filter();
    },
    onOpen: () => { if (input) { input.value = ''; filter(); } return input; },
  };
};

const panel: Build = (c, ctx) => {
  const renderTrigger = trigger(c, ctx);
  c.render = () => renderTrigger();
  c.panel = {
    build(pc) {
      const body = h('div', 'mm-custom'), hd = c.cfg.title ? head(c.cfg.title, c.cfg.label) : null;
      pc.replaceChildren(...(hd ? [hd] : []), body);
      ctx.slot(c.key + '/p/content', c.cfg.content, body);
    },
    onOpen: pc => pc.querySelector<HTMLElement>('input,button,[tabindex]:not([tabindex="-1"]),select,textarea,a[href]'),
  };
};

const BUILDERS: Record<IslandItemType, Build> = {
  button, pill, separator, spacer, label, segmented, switch: sw, slider, stepper, swatches: dots(false), thumbs: dots(true),
  field, search, status, avatars, progress, custom, menu, select, grid, color, command, panel,
};

export function createControl(key: string, cfg: IslandItem, ctx: Ctx): Ctl {
  const c = {
    key, type: cfg.type, cfg, el: null as unknown as HTMLElement, w: 32, follow: false, dent: false, drag: false,
    hasValue: false, sig: '', x: 0, y: 0, angle: 0, u: 0,
    apply() {}, render() {},
  } as Ctl;
  const build = BUILDERS[cfg.type];
  if (!build) throw new Error(`[marmit] unknown item type "${(cfg as { type: string }).type}"`);
  build(c, ctx);
  if (c.hasValue && 'value' in cfg && (cfg as { value?: unknown }).value !== undefined) c.value = (cfg as { value?: unknown }).value;
  c.el.classList.add('mm-item');
  c.sig = signature(cfg as unknown as Record<string, unknown>);
  c.render(); c.apply();
  return c;
}

/** apply a new config to an existing control; returns true if its size may have changed */
export function updateControl(c: Ctl, cfg: IslandItem) {
  const prevValue = c.cfg.value;
  c.cfg = cfg;
  const sig = signature(cfg as unknown as Record<string, unknown>);
  let changed = false;
  if (sig !== c.sig) { c.sig = sig; c.render(); changed = true; if (c.panel && c.pc) c.panel.build(c.pc); }
  const v = (cfg as { value?: unknown }).value;
  if (c.hasValue && v !== undefined && v !== prevValue && v !== c.value) { c.value = v; changed = true; }
  c.apply();
  return changed;
}

/** every slot key a config list will ask for, with its value: adapters use this to render portals during render */
export function collectSlots(items: IslandItem[], visit: (key: string, value: unknown) => void) {
  items.forEach((it, idx) => {
    const k = itemKey(it, idx), a = it as any;
    const v = (sub: string, val: unknown) => { if (val !== undefined && val !== null) visit(k + sub, val); };
    switch (it.type) {
      case 'button': v('/icon', a.icon); break;
      case 'pill': v('/icon', a.icon); break;
      case 'segmented': (a.options as OptionInput[]).forEach((o, i) => typeof o === 'object' && v(`/opt/${i}/icon`, o.icon)); break;
      case 'field': v('/icon', a.icon); break;
      case 'custom': v('/render', a.render); break;
      case 'menu': case 'grid': case 'command': case 'color': case 'select': case 'panel':
        v('/t/icon', a.icon);
        if (it.type === 'panel') v('/p/content', a.content);
        else if (it.type === 'select') (a.options as OptionInput[]).forEach((o, i) => typeof o === 'object' && v(`/p/${i}/icon`, o.icon));
        else if (it.type !== 'color') (a.items as any[]).forEach((m, i) => m && typeof m === 'object' && v(`/p/${i}/icon`, m.icon));
        break;
    }
  });
}
export const itemKey = (it: IslandItem, idx: number) => it.id ?? `${it.type}#${idx}`;

/** values the core draws itself; anything else goes to the framework adapter */
export const isNative = (v: unknown) => v == null || v === false || typeof v === 'string' || typeof v === 'number' || typeof v === 'function' || (typeof Node !== 'undefined' && v instanceof Node);

/** inline style for an adapter's host element, per mode */
export const hostStyle = (mode: string | undefined) => mode === 'inline' ? 'display:contents' : mode === 'contained' ? 'position:absolute;inset:0;pointer-events:none' : 'display:none';
