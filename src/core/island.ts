/* The island: one gooey bar that carries controls, opens panels out of itself, melts a search field open, dents when
   pressed, bends when pulled, and can be thrown at any edge of its stage to re-dock there. Framework-free; the adapters
   are thin wrappers round createIsland(). */
import { addSystem, clamp, crit, dip, isReduced, kick, outline, removeSystem, Spring, spineAt, spineHit, Stick, type Walls } from './physics';
import { along, angAt, horiz, makeRoute, RN, slope, type Route, type RouteEnv } from './routes';
import { createControl, h, isNative, itemKey, updateControl, type Ctl, type Ctx } from './controls';
import { head } from './parts/dom';
import { icons, stringSlot } from './icons';
import { injectStyles, releaseStyles } from './styles';
import type { IslandController, IslandItem, IslandOptions, Physics, Side, Slot, Theme, VisibleWhen } from './types';

const H = 40, P = 4, G = 4, B = 32, N = 9;
/** half the height of a panel's blob heading: the body starts this far below the panel's top */
const HEAD_HALF = 14;
const INF: Walls = [-1e9, -1e9, 1e9, 1e9];

export const DEFAULT_PHYSICS: Physics = {
  stiffness: 410, damping: 36.5, blur: 7, stretch: 0, dent: 2.5, dentWidth: 16, bend: .3, reach: 32, pullBend: .4,
  arc: .25, corner: 40, lift: .15, dropletGap: 14, string: 12, panelGap: 14, neck: 26,
};
const THEME_VARS: Record<keyof Theme, string> = {
  bar: '--mm-bar', ink: '--mm-ink', accent: '--mm-accent', onAccent: '--mm-on-accent', success: '--mm-success',
  warning: '--mm-warning', danger: '--mm-danger', knob: '--mm-knob', shadow: '--mm-shadow', font: '--mm-font',
};
const NORMALS: Record<Side, [number, number]> = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] };

interface SlotRec { value: unknown; into: HTMLElement; cleanup?: () => void; host?: HTMLElement }

let seq = 0;

export function createIsland(input: IslandOptions): IslandController {
  if (typeof document === 'undefined') throw new Error('[marmit] createIsland needs a DOM (call it in the browser, after mount)');
  let o: IslandOptions = { mode: 'overlay', side: 'bottom', align: 'center', margin: 24, draggable: true, stretchy: true, theme: 'dark', panelDirection: 'auto', ...input };
  let ph: Physics = { ...DEFAULT_PHYSICS, ...o.physics };
  const mode = o.mode!, docked = mode !== 'inline';
  if (o.injectStyles !== false) injectStyles();
  const container = o.container ?? (mode === 'overlay' ? document.body : null);
  if (!container) throw new Error(`[marmit] mode "${mode}" needs a container element`);
  if (mode === 'contained' && getComputedStyle(container).position === 'static') container.style.position = 'relative';

  /* ---------------- DOM ---------------- */
  const gid = `mm-goo-${++seq}`;
  const root = h('div', 'mm', { 'data-mode': mode, role: 'toolbar' });
  const defs = h('div'); defs.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="${gid}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"/></filter><filter id="${gid}-h" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3.5"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/></filter></svg>`;
  const filterSvg = defs.firstElementChild as SVGSVGElement, blurEl = filterSvg.querySelector('feGaussianBlur')!;
  const goo = h('div', 'mm-goo', { 'aria-hidden': 'true' });
  goo.innerHTML = '<svg><path/></svg>';
  const gooSvg = goo.firstElementChild as SVGSVGElement, gBar = gooSvg.firstElementChild as SVGPathElement;
  const blob = () => { const b = h('div', 'mm-blob'); goo.append(b); return b; };
  const drop = blob(), neck = blob(), pBlob = blob(), tBlob = blob();
  const crisp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  crisp.setAttribute('class', 'mm-crisp solo'); crisp.setAttribute('aria-hidden', 'true');
  crisp.innerHTML = '<path class="mm-bar"/><path class="mm-string"/>';
  const cBar = crisp.firstElementChild as SVGPathElement, cString = crisp.lastElementChild as SVGPathElement;
  const drop2 = h('div', 'mm-drop2', { 'aria-hidden': 'true' });
  const panelEl = h('div', 'mm-panel'); panelEl.style.display = 'none';
  const itemsWrap = h('div', 'mm-items');
  const closeBtn = h('button', 'mm-item mm-btn mm-close', { type: 'button', 'aria-label': 'Close search', tabindex: -1 });
  closeBtn.innerHTML = `<span class="mm-ic">${icons.close}</span>`;
  const tab = h('button', 'mm-tab', { type: 'button', 'aria-label': 'Hide toolbar' }); tab.innerHTML = icons.chevron;
  const tip = h('div', 'mm-tip', { role: 'tooltip', id: gid + '-tip' });
  const ghosts = (['top', 'right', 'bottom', 'left'] as Side[]).map(d => { const g = h('div', 'mm-ghost', { 'data-side': d }); return g; });
  root.append(filterSvg, ...ghosts, goo, crisp, drop2, panelEl, itemsWrap, closeBtn, tab, tip);
  container.append(root);

  /* ---------------- state ---------------- */
  const bar = new Stick(N), ns = bar.ns;
  let sw = 0, sh = 0, ready = false, destroyed = false;
  let side: Side = o.side!;
  let L = { LEN: H, SPAN: .001, REST: .001 / (N - 1), LENt: H };
  let ctls: Ctl[] = [];
  const byEl = new WeakMap<Element, Ctl>();
  // re-dock
  const prog = new Spring(1, .001), lead = new Spring(1, .001), ex = new Spring(), ey = new Spring();
  let route: Route | null = null, cx = 0, cy = 0, th = 0;
  // drag / pull
  let press: { id: number; x0: number; y0: number; ox: number; oy: number } | null = null, dragging = false, dragKind: 'dock' | 'pull' = 'dock', grabA = 0, pullS = 0;
  let samples: [number, number, number][] = [];
  const pox = new Spring(), poy = new Spring(), pbend = new Spring();
  // press dent
  const dent = new Spring(); let dentU = 0, down = false;
  // search
  const sOff = new Spring(-H / 2), sD = new Spring(H / 2), sW = new Map<Ctl, Spring>();
  let sCtl: Ctl | null = null, closeDown = false;
  // panels
  const PT = new Spring(), PE = new Spring(), PB = new Spring(B), PD = new Spring(B), NX = new Spring();
  let openC: Ctl | null = null, fromC: Ctl | null = null, pSign = -1, pcw = 0, pch = 0;
  // collapse
  let collapsed = !!o.collapsed, hovered = false, peek = false, tabFocus = false;
  const hide = new Spring(collapsed ? 1 : 0, .002), tabS = new Spring(collapsed ? 1 : 0, .002), lift = new Spring();
  // misc
  let kbd = false, gooOn = false, lastRoot = '';
  // inline: when the element's box resizes, the page may move it (a centred parent re-centres it at once). The bar is
  // drawn offset by that move and springs back, so it grows from where it was instead of jumping
  const ancX = new Spring(), ancY = new Spring();
  const slots = new Map<string, SlotRec>();

  const K = () => ph.stiffness, Z = () => ph.damping / (2 * Math.sqrt(ph.stiffness));
  const hz = () => docked ? horiz(side) : !(o.side === 'left' || o.side === 'right');
  /** shown: not hidden, and its visibleWhen (if any) matches the current value of the item it watches */
  const shown = (c: Ctl) => {
    if (c.cfg.hidden) return false;
    const w = c.cfg.visibleWhen as VisibleWhen | undefined; if (!w) return true;
    const src = find(w.field), v = src?.value, any = (x: unknown) => (Array.isArray(x) ? x : [x]).some(y => y === v);
    return w.is !== undefined ? any(w.is) : w.not !== undefined ? !any(w.not) : !!v;
  };
  const vis = () => ctls.filter(shown);
  const env: RouteEnv = { dockAt: d => dockAt(d), get arc() { return ph.arc; }, get corner() { return ph.corner; }, get lift() { return ph.lift; } };

  /* ---------------- slots ---------------- */
  function putSlot(key: string, value: Slot, into: HTMLElement) {
    const prev = slots.get(key);
    if (prev && prev.into === into && prev.value === value) return;
    if (prev && prev.into === into && prev.host && !isNative(value) && o.slotHost) {
      const host = o.slotHost(key, value);
      if (host === prev.host) { prev.value = value; return; }
    }
    prev?.cleanup?.(); slots.delete(key);
    into.replaceChildren();
    const rec: SlotRec = { value, into };
    if (value == null || (value as unknown) === false) { /* empty */ }
    else if (typeof value === 'string' || typeof value === 'number') stringSlot(String(value), into);
    else if (value instanceof Node) into.append(value);
    else if (typeof value === 'function') {
      const r = (value as (el: HTMLElement) => unknown)(into);
      if (r instanceof Node) into.append(r); else if (typeof r === 'function') rec.cleanup = r as () => void;
    } else if (o.slotHost) {
      const host = o.slotHost(key, value);
      if (host) { into.append(host); rec.host = host; }
    } else if (o.mountSlot) {
      const r = o.mountSlot(value, into); if (typeof r === 'function') rec.cleanup = r;
    } else console.warn('[marmit] cannot render slot value without a framework adapter:', value);
    slots.set(key, rec);
  }
  function dropSlots(prefix: string) {
    for (const [k, r] of slots) if (k.startsWith(prefix)) { r.cleanup?.(); slots.delete(k); }
  }

  /* ---------------- control context ---------------- */
  const ctx: Ctx = {
    slot: putSlot,
    dropSlots,
    emit(c, v) {
      c.cfg.onChange?.(v);
      if (c.cfg.id) o.onChange?.(c.cfg.id, v, values());
      if (c.cfg.id && ctls.some(x => x.cfg.visibleWhen?.field === c.cfg.id)) ctls.forEach(flags);
      relayout();
    },
    action(c, entry) { o.onAction?.(c.cfg.id ?? c.key, entry); },
    relayout,
    toggle(c) {
      if (openC === c && hoverC === c) { hoverC = null; return; }   // a click on a hover-opened panel pins it open
      if (openC === c) closePanel(true); else openPanel(c);
    },
    hover(c, on) { hoverIntent(c, on); },
    closePanel,
    setSearch,
    angleOf: c => c.angle,
  };

  /* ---------------- items ---------------- */
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => relayout()) : null;
  function measure(c: Ctl) { if (c.type !== 'search') c.w = c.fixedW ?? (c.el.offsetWidth || B); }
  function flags(c: Ctl) {
    c.el.hidden = !shown(c);
    c.el.classList.toggle('disabled', !!c.cfg.disabled);
    if (c.el instanceof HTMLButtonElement) c.el.disabled = !!c.cfg.disabled;
    if (c.cfg.disabled) c.el.setAttribute('aria-disabled', 'true'); else c.el.removeAttribute('aria-disabled');
  }
  function setup(c: Ctl) {
    byEl.set(c.el, c); c.el.dataset.mmKey = c.key;
    if (c.type === 'search') sW.set(c, new Spring(B, .05)); else ro?.observe(c.el);
    if (c.dent) pressable(c.el, () => c.u);
  }
  function destroyCtl(c: Ctl) {
    if (openC === c || fromC === c) { openC = fromC = null; panelEl.style.display = 'none'; root.classList.remove('mm-raised'); }
    if (sCtl === c) sCtl = null;
    const fl = floats.get(c); if (fl) { fl.win.remove(); floats.delete(c); if (!floats.size) floatRoot.remove(); }
    ro?.unobserve(c.el); if (c.pc) ro?.unobserve(c.pc); c.el.remove(); c.pc?.remove(); sW.delete(c); dropSlots(c.key + '/'); c.destroy?.();
  }
  function setItems(items: IslandItem[]) {
    const old = new Map(ctls.map(c => [c.key, c])), next: Ctl[] = [];
    items.forEach((cfg, i) => {
      const key = itemKey(cfg, i);
      let c = old.get(key);
      if (c && c.type === cfg.type && (c.cfg as { variant?: string }).variant === (cfg as { variant?: string }).variant) { old.delete(key); updateControl(c, cfg); if (c.pc && (openC === c || floats.has(c))) panelHead(c); }
      else { if (c) { old.delete(key); destroyCtl(c); } c = createControl(key, cfg, ctx); setup(c); }
      flags(c); next.push(c);
    });
    old.forEach(destroyCtl);
    next.forEach((c, i) => { if (itemsWrap.children[i] !== c.el) itemsWrap.insertBefore(c.el, itemsWrap.children[i] ?? null); });
    ctls = next;
    ctls.forEach(flags); // visibleWhen reads other items' values, which all exist only now
    relayout();
  }
  /** inline: the element takes the bar's size in the flow. Runs on relayout, before the next frame is drawn, so the
      offset that keeps the bar in place applies from that very frame */
  function sizeRoot() {
    if (!docked) {
      const t = L.LENt + (sCtl?.open ? ph.dropletGap + H : 0), sz = hz() ? `${t}x${H}` : `${H}x${t}`;
      if (sz !== lastRoot) {
        const first = !lastRoot, a = first ? null : root.getBoundingClientRect();
        lastRoot = sz; root.style.width = px(hz() ? t : H); root.style.height = px(hz() ? H : t);
        // keep the bar where it was on screen this frame; the offset then eases to 0 with the bar's own spring
        if (a && !isReduced()) {
          const b = root.getBoundingClientRect(); ancX.x += a.left - b.left; ancY.x += a.top - b.top; ancX.t = ancY.t = 0;
          sim(0); settle(); render(); kick(); // redraw now: the box moved this frame, the drawing must not wait for the next
        }
      }
    }
  }
  function relayout() {
    if (destroyed) return;
    ctls.forEach(measure);
    layout(); sizeRoot();
    kick();
  }

  /* ---------------- layout along the spine ---------------- */
  const widthOf = (c: Ctl, target = false) => c.type === 'search'
    ? (target ? (c.open ? c.cfg.width ?? 200 : B) : Math.max(B - 4, sW.get(c)?.x ?? B))
    : c.fixedW ?? c.w;
  function layout() {
    const v = vis(), ws = v.map(c => widthOf(c)), wt = v.map(c => widthOf(c, true));
    const len = (a: number[]) => a.length ? 2 * P + a.reduce((s, w) => s + w, 0) + (a.length - 1) * G : H;
    const LEN = Math.max(H, len(ws)), SPAN = Math.max(LEN - H, .001), REST = SPAN / (N - 1);
    let a = -LEN / 2 + P;
    v.forEach((c, i) => { const cc = a + ws[i] / 2; a += ws[i] + G; c.u = (cc + SPAN / 2) / REST; });
    L = { LEN, SPAN, REST, LENt: Math.max(H, len(wt)) };
    bar.half = SPAN / 2;
  }
  function spinePos(u: number): [number, number, number] {
    const last = N - 1;
    if (u < 0 || u > last) {
      const e = u < 0 ? 0 : last, [x, y, a] = spineAt(ns, e, th), d = (u - e) * L.REST;
      return [x + Math.cos(a) * d, y + Math.sin(a) * d, a];
    }
    return spineAt(ns, u, th);
  }

  /* ---------------- stage, docks ---------------- */
  function stage() {
    if (mode === 'overlay') { sw = document.documentElement.clientWidth || innerWidth; sh = innerHeight; }
    else if (mode === 'contained') { sw = root.clientWidth; sh = root.clientHeight; }
  }
  const dropRoom = () => sCtl ? clamp(sOff.x + H / 2, 0, ph.dropletGap + H) : 0;
  function dockAt(d: Side): [number, number] {
    const m = o.margin ?? 24, len = L.LEN, al = o.align, dr = dropRoom();
    const at = (size: number) => al === 'start' ? m + len / 2 : al === 'end' ? size - m - dr - len / 2 : size / 2 - dr / 2;
    switch (d) {
      case 'top': return [at(sw), m + H / 2];
      case 'bottom': return [at(sw), sh - m - H / 2];
      case 'left': return [m + H / 2, at(sh)];
      default: return [sw - m - H / 2, at(sh)];
    }
  }
  /** keep the middle far enough from the edges that the whole bar fits at angle t */
  function inside(x: number, y: number, t: number): [number, number] {
    const ex_ = Math.abs(Math.cos(t)) * L.SPAN / 2 + H / 2 + 2, ey_ = Math.abs(Math.sin(t)) * L.SPAN / 2 + H / 2 + 2;
    return [ex_ * 2 < sw ? clamp(x, ex_, sw - ex_) : sw / 2, ey_ * 2 < sh ? clamp(y, ey_, sh - ey_) : sh / 2];
  }
  const nearest = (x: number, y: number): Side => {
    const d: Record<Side, number> = { top: y / sh, bottom: (sh - y) / sh, left: x / sw, right: (sw - x) / sw };
    return (Object.keys(d) as Side[]).reduce((a, b) => d[a] <= d[b] ? a : b);
  };
  const walls = (): Walls => !docked || hide.x > .001 || hide.t > 0 ? INF : [H / 2 + 2, H / 2 + 2, sw - H / 2 - 2, sh - H / 2 - 2];
  /** which way is "into the stage" from the bar: where panels, tooltips and the tab go */
  function normal(): [number, number] {
    if (docked) return NORMALS[side];
    return hz() ? [0, pSign] : [pSign, 0];
  }
  function inlineSign() {
    const pd = o.panelDirection, r = root.getBoundingClientRect();
    if (hz()) {
      if (pd === 'top') return -1; if (pd === 'bottom') return 1;
      const above = r.top, below = innerHeight - r.bottom; return below >= 320 || below >= above ? 1 : -1;
    }
    if (pd === 'left') return -1; if (pd === 'right') return 1;
    const left = r.left, right = innerWidth - r.right; return right >= 320 || right >= left ? 1 : -1;
  }

  function jump(d: Side) {
    side = d; root.dataset.side = d;
    [cx, cy] = dockAt(d); th = horiz(d) ? 0 : Math.PI / 2;
    route = makeRoute(env, cx, cy, d, d, th);
    prog.snap(1); lead.snap(1); ex.snap(0); ey.snap(0);
    bar.aim(cx, cy, th); bar.snap();
  }
  function setSide(d: Side, corner = true) {
    if (!docked) return;
    closePanel(); hideTip();
    let vx = ex.v, vy = ey.v;
    if (route) { const [sx, sy] = slope(route, prog.x); vx += sx * prog.v; vy += sy * prog.v; }
    const from = side; side = d; root.dataset.side = d;
    route = makeRoute(env, cx, cy, corner ? from : d, d, th);
    prog.x = 0; prog.v = 0; prog.t = 0; lead.x = 0; lead.v = 0; lead.t = 1; ex.x = ey.x = 0; ex.v = vx; ey.v = vy;
    root.setAttribute('aria-orientation', horiz(d) ? 'horizontal' : 'vertical');
    if (from !== d) o.onSideChange?.(d);
    kick();
  }

  /* ---------------- search ---------------- */
  function setSearch(c: Ctl, open: boolean) {
    if (!!c.open === open) return;
    const input = (c as Ctl & { input: HTMLInputElement }).input;
    if (open) {
      if (sCtl && sCtl !== c && sCtl.open) setSearch(sCtl, false);
      closePanel(); hideTip();
      if (sCtl !== c) { sOff.snap(-H / 2); sD.snap(H / 2); }
      sCtl = c;
    }
    c.open = open;
    c.el.classList.toggle('open', open); c.el.setAttribute('aria-expanded', String(open));
    input.tabIndex = open ? 0 : -1; closeBtn.tabIndex = open ? 0 : -1; closeBtn.classList.toggle('shown', open);   // not 'on': that's a toggled button's pressed look
    if (open) input.focus({ preventScroll: true });
    else {
      if (input.value) { input.value = ''; c.value = ''; ctx.emit(c, ''); }
      if (document.activeElement === input) input.blur();
    }
    c.cfg.onOpenChange?.(open);
    relayout();
  }
  closeBtn.addEventListener('click', () => { if (sCtl) { const c = sCtl; setSearch(c, false); c.el.focus({ preventScroll: true }); } });

  /* ---------------- panels ---------------- */
  function bounds(): [number, number, number, number] {
    if (docked) return [0, 0, sw, sh];
    const r = root.getBoundingClientRect();
    return [-r.left, -r.top, innerWidth - r.left, innerHeight - r.top];
  }
  function panelTargets() {
    const c = openC ?? fromC; if (!c) return;
    const H_ = hz(), At = H_ ? c.x : c.y, An = H_ ? bar.cy : bar.cx;
    if (openC) {
      const breadth = H_ ? pcw : pch, depth = H_ ? pch : pcw, [x0, y0, x1, y1] = bounds(), lo = H_ ? x0 : y0, hi = H_ ? x1 : y1;
      const barT = H_ ? bar.cx : bar.cy, want = barT + (At - barT) * .5, a = lo + breadth / 2 + 12, b = hi - breadth / 2 - 12;
      PT.t = a <= b ? clamp(want, a, b) : (lo + hi) / 2;
      // never closer than twice the blur: nearer than that, the goo half-bridges the bar's and panel's parallel edges
      // and leaves a soft smudge along the gap
      PE.t = An + pSign * (H / 2 + Math.max(ph.panelGap, ph.blur * 2)); PB.t = breadth; PD.t = depth; NX.t = At;
    } else { PT.t = At; PE.t = An - pSign * B / 2; PB.t = B; PD.t = B; NX.t = At; }
  }
  function measurePanel() { if (openC?.pc) { pcw = openC.pc.offsetWidth; pch = openC.pc.offsetHeight; } }
  function openPanel(c: Ctl) {
    if (!c.panel || collapsed || destroyed) return;
    if (floats.has(c)) { raiseFloat(c); return; }   // detached: the trigger brings its window back instead
    if (sCtl?.open) setSearch(sCtl, false);
    hideTip();
    panelEl.style.display = ''; root.classList.add('mm-raised'); // over neighbouring islands while a panel is out
    if (!c.pc) { c.pc = h('div', 'mm-pc'); panelEl.append(c.pc); c.panel.build(c.pc); ro?.observe(c.pc); }
    panelHead(c);
    const wasClosed = !fromC;
    openC?.trigger?.setAttribute('aria-expanded', 'false');
    openC = fromC = c;
    pSign = docked ? (horiz(side) ? NORMALS[side][1] : NORMALS[side][0]) : inlineSign();
    ctls.forEach(x => !floats.has(x) && x.pc?.classList.toggle('on', x === c));
    c.trigger?.setAttribute('aria-expanded', 'true');
    panelEl.classList.add('on');
    const focusEl = c.panel.onOpen?.(c.pc);
    measurePanel();
    if (wasClosed) {
      const keep = openC; openC = null; panelTargets(); [PT, PE, PB, PD, NX].forEach(s => s.snap()); openC = keep;
    }
    panelTargets();
    if (focusEl && (kbd || c.type === 'command')) focusEl.focus({ preventScroll: true });
    o.onOpenChange?.(c.cfg.id ?? c.key);
    kick();
  }
  function closePanel(focusTrigger = false) {
    if (!openC) return;
    const c = openC, hadFocus = panelEl.contains(document.activeElement);
    openC = null; hoverC = null; clearTimeout(hoverT);
    c.pc?.classList.remove('on'); c.trigger?.setAttribute('aria-expanded', 'false'); panelEl.classList.remove('on');
    if ((focusTrigger || hadFocus) && hadFocus) c.trigger?.focus({ preventScroll: true });
    panelTargets();
    o.onOpenChange?.(null);
    kick();
  }

  /* ---------------- hover-opening panels ----------------
     Open after a short rest on the trigger (at once if another hover panel is already out), stay open while the
     pointer is on the trigger or the panel, close a moment after it leaves both. */
  let hoverC: Ctl | null = null, hoverT: ReturnType<typeof setTimeout> | undefined;
  function hoverIntent(c: Ctl, on: boolean) {
    clearTimeout(hoverT);
    if (on) {
      if (openC === c) return;
      if (openC && openC !== hoverC) return;   // a panel pinned or opened by click stays until clicked away
      hoverT = setTimeout(() => { openPanel(c); if (openC === c) hoverC = c; }, hoverC ? 0 : 140);
    } else if (hoverC === c) hoverT = setTimeout(() => { if (hoverC === c && openC === c) closePanel(); }, 260);
  }
  panelEl.addEventListener('pointerenter', () => { if (hoverC) clearTimeout(hoverT); });
  panelEl.addEventListener('pointerleave', e => { if (hoverC && e.pointerType === 'mouse') hoverIntent(hoverC, false); });

  /* ---------------- detached panels ----------------
     The panel's own content moves into a floating window (so its state and listeners come along), while the panel
     shell melts back into the bar. The window drags by its heading, minimises to the heading, docks back or closes. */
  const floatRoot = h('div', 'mm mm-floats', { 'data-mode': 'float' });
  const floats = new Map<Ctl, { win: HTMLElement; x: number; y: number }>();
  const ib = (name: string, label: string, cls: string, on: () => void) => {
    const b = h('button', 'mm-pact ' + cls, { type: 'button', 'aria-label': label, title: label });
    b.innerHTML = `<span class="mm-ic">${icons[name]}</span>`;
    b.addEventListener('click', e => { e.stopPropagation(); on(); });
    b.addEventListener('pointerdown', e => e.stopPropagation());
    return b;
  };
  /** every detachable panel gets a heading with its window buttons; one the control drew itself is reused */
  function panelHead(c: Ctl) {
    if (!c.pc || c.cfg.detachable === false || c.pc.querySelector('.mm-pacts')) return;   // (a rebuilt panel loses them)
    let ph = c.pc.querySelector<HTMLElement>('.mm-ph');
    if (!ph) { ph = head(typeof c.cfg.title === 'string' ? c.cfg.title : undefined, c.cfg.label ?? '')!; c.pc.prepend(ph); }
    const acts = h('div', 'mm-pacts');
    acts.append(ib('detach', 'Detach panel', 'dk', () => detach(c)), ib('minus', 'Minimise', 'fl', () => minimise(c)),
      ib('dock', 'Dock back', 'fl', () => dock(c, true)), ib('close', 'Close', 'fl', () => dock(c, false)));
    // the heading becomes two blobs on the panel's top edge, half outside it: the title on the left, everything else
    // (a readout, the panel's own buttons, the window buttons) on the right
    const [title, ...rest] = [...ph.childNodes], right = h('div', 'mm-ph-r');
    right.append(...rest, acts);
    if (title instanceof HTMLElement) title.classList.add('mm-ph-t'); else ph.prepend(h('span', 'mm-ph-t'));
    ph.append(right); ph.classList.add('blobbed'); c.pc.classList.add('mm-pc-blob');
    // their material: a body that starts at the heading's middle plus a blob behind each pill, melted by a tight goo
    const bg = h('div', 'mm-pc-bg', { 'aria-hidden': 'true' }), body = h('i', 'b'), bt = h('i'), br = h('i');
    bg.append(body, bt, br); bg.style.setProperty('--mm-head-goo', `url(#${gid}-h)`); c.pc.prepend(bg);
    const lay = () => {
      const t = ph!.querySelector<HTMLElement>('.mm-ph-t');
      for (const [blob, el] of [[bt, t], [br, right]] as const) {
        if (!el || !el.offsetWidth) { blob.style.display = 'none'; continue; }
        blob.style.display = ''; blob.style.left = el.offsetLeft + 'px'; blob.style.top = el.offsetTop + 'px';
        blob.style.width = el.offsetWidth + 'px'; blob.style.height = el.offsetHeight + 'px';
      }
      body.style.top = ph!.offsetTop + ph!.offsetHeight / 2 + 'px';
    };
    lay(); new ResizeObserver(lay).observe(c.pc); new ResizeObserver(lay).observe(right);
    ph.addEventListener('pointerdown', e => dragFloat(c, e));
  }
  function syncFloatLook() {
    floatRoot.dataset.theme = root.dataset.theme;
    for (const v of [...Object.values(THEME_VARS), '--mm-z']) { const x = root.style.getPropertyValue(v); if (x) floatRoot.style.setProperty(v, x); else floatRoot.style.removeProperty(v); }
  }
  function placeFloat(f: { win: HTMLElement; x: number; y: number }) {
    const w = f.win.offsetWidth, ht = f.win.offsetHeight;
    f.x = clamp(f.x, 8 - w + 60, innerWidth - 60); f.y = clamp(f.y, 8, innerHeight - 40);
    f.win.style.transform = `translate(${px(f.x)},${px(f.y)})`;
    void ht;
  }
  function detach(c: Ctl) {
    if (!c.pc || floats.has(c)) return;
    const r = (openC === c ? panelEl : c.pc).getBoundingClientRect();
    const win = h('div', 'mm-win', { role: 'dialog', 'aria-label': (typeof c.cfg.title === 'string' ? c.cfg.title : c.cfg.label) ?? 'Panel' });
    // one object, not two: the shell under the panel goes away in this same frame (no retract into the bar) and the
    // window takes its exact place at full opacity, then lifts a little, so the panel reads as picked up off the bar
    if (openC === c) {
      closePanel(); [PT, PE, PB, PD, NX].forEach(s => s.snap());
      fromC = null; panelEl.style.display = 'none'; root.classList.remove('mm-raised'); kick();
    }
    win.append(c.pc); c.pc.classList.add('on');
    syncFloatLook(); if (!floatRoot.isConnected) document.body.append(floatRoot);
    floatRoot.append(win);
    const f = { win, x: r.left, y: r.top }; floats.set(c, f); placeFloat(f);
    c.el.classList.add('mm-detached');
    win.classList.add('in', 'lift'); win.addEventListener('animationend', () => win.classList.remove('lift'), { once: true });
    o.onDetachChange?.(c.cfg.id ?? c.key, true);
  }
  function raiseFloat(c: Ctl) {
    const f = floats.get(c); if (!f) return;
    f.win.classList.remove('min'); floatRoot.append(f.win);   // last child paints on top
    f.win.classList.remove('flash'); void f.win.offsetWidth; f.win.classList.add('flash');
  }
  function minimise(c: Ctl) { floats.get(c)?.win.classList.toggle('min'); }
  /** back into the bar: `reopen` docks it as the open panel; otherwise it's simply closed */
  function dock(c: Ctl, reopen: boolean) {
    const f = floats.get(c); if (!f || !c.pc) return;
    floats.delete(c); c.el.classList.remove('mm-detached');
    c.pc.classList.remove('on'); panelEl.append(c.pc); f.win.remove();
    if (!floats.size) floatRoot.remove();
    o.onDetachChange?.(c.cfg.id ?? c.key, false);
    if (reopen) openPanel(c); else c.trigger?.focus({ preventScroll: true });
  }
  function dragFloat(c: Ctl, e: PointerEvent) {
    const f = floats.get(c); if (!f || e.button) return;
    if ((e.target as Element).closest('button, input, [role=slider], [role=spinbutton]')) return;
    e.preventDefault(); raiseFloat(c); f.win.classList.remove('flash'); f.win.classList.add('dragging');
    const x0 = e.clientX - f.x, y0 = e.clientY - f.y, el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => { f.x = ev.clientX - x0; f.y = ev.clientY - y0; placeFloat(f); };
    const up = () => { f.win.classList.remove('dragging'); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  /* ---------------- collapse ---------------- */
  function collapse(v = !collapsed) {
    if (!docked || v === collapsed) return;
    collapsed = v; hide.t = v ? 1 : 0;
    if (v) { closePanel(); if (sCtl?.open) setSearch(sCtl, false); hideTip(); }
    root.classList.toggle('mm-collapsed', v);
    itemsWrap.inert = v;
    tab.setAttribute('aria-label', v ? 'Show toolbar' : 'Hide toolbar'); tab.setAttribute('aria-expanded', String(!v));
    o.onCollapsedChange?.(v);
    kick();
  }
  tab.addEventListener('click', () => collapse());
  tab.addEventListener('focus', () => { tabFocus = true; kick(); });
  tab.addEventListener('blur', () => { tabFocus = false; kick(); });

  /* ---------------- press dent ---------------- */
  function pressable(el: HTMLElement, at: () => number) {
    const on = () => { down = true; dentU = at(); dent.t = ph.dent; el.classList.add('pressed'); kick(); };
    el.addEventListener('pointerdown', e => { if (e.button === 0) on(); });
    el.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !(e.target as HTMLElement).matches('input')) on(); });
    el.addEventListener('keyup', release);
  }
  function release() { if (!down && !closeDown) return; down = false; closeDown = false; dent.t = 0; root.querySelectorAll('.pressed').forEach(x => x.classList.remove('pressed')); kick(); }
  closeBtn.addEventListener('pointerdown', e => { if (e.button === 0) { closeDown = true; kick(); } });

  /* ---------------- tooltip ---------------- */
  let tipTimer: ReturnType<typeof setTimeout> | undefined, tipFor: Ctl | null = null, warmUntil = 0;
  const tipText = (c: Ctl) => {
    const t = c.cfg.tooltip; if (t === false) return null; if (typeof t === 'string') return t;
    if (c.type === 'button' || ((c.panel && !c.follow))) return c.cfg.label as string;
    if (c.type === 'search' && !c.open) return c.cfg.label ?? 'Search';
    return null;
  };
  function showTip(c: Ctl) {
    const t = tipText(c); if (!t || dragging || openC === c || collapsed) return;
    tipFor = c; tip.textContent = t; tip.classList.add('on');
    c.el.setAttribute('aria-describedby', tip.id);
    placeTip();
  }
  function placeTip() {
    if (!tipFor) return;
    const [nx, ny] = normal(), w = tip.offsetWidth, ht = tip.offsetHeight, depth = Math.abs(nx) ? w : ht, d = H / 2 + 10 + depth / 2;
    tip.style.transform = `translate(${tipFor.x + nx * d - w / 2}px,${tipFor.y + ny * d - ht / 2}px)`;
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tipFor) { tipFor.el.removeAttribute('aria-describedby'); warmUntil = performance.now() + 300; }
    tipFor = null; tip.classList.remove('on');
  }
  const ctlOf = (t: EventTarget | null) => { let el = t as Element | null; while (el && el !== itemsWrap) { const c = byEl.get(el); if (c) return c; el = el.parentElement; } return null; };
  itemsWrap.addEventListener('pointerover', e => {
    const c = ctlOf(e.target); if (!c || c === tipFor) return;
    hideTip(); if (!tipText(c)) return;
    tipTimer = setTimeout(() => showTip(c), performance.now() < warmUntil ? 0 : 450);
  });
  itemsWrap.addEventListener('pointerout', e => { if (!ctlOf(e.relatedTarget)) hideTip(); });
  itemsWrap.addEventListener('focusin', e => { const c = ctlOf(e.target); if (c && kbd) { hideTip(); showTip(c); } });
  itemsWrap.addEventListener('focusout', hideTip);
  itemsWrap.addEventListener('pointerdown', hideTip);

  /* ---------------- dragging and pulling ---------------- */
  const local = (e: PointerEvent): [number, number] => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onDown(e: PointerEvent) {
    if (e.button !== 0 || press || collapsed) return;
    const t = e.target as Element;
    if (t.closest('[data-mm-nodrag], .mm-panel, .mm-close, .mm-tab')) return;
    const c = ctlOf(t); if (c && (!c.drag || (c.type === 'search' && c.open))) return;
    const canDock = docked && o.draggable !== false, canPull = !canDock && o.stretchy !== false;
    if (!canDock && !canPull) return;
    const p = local(e), u = spineHit(ns, p[0], p[1], H / 2 + 4); if (u < 0) return;
    dragKind = canDock ? 'dock' : 'pull';
    grabA = -L.SPAN / 2 + u * L.REST;
    // where along the bar the pull grabbed (-1..1), kept short of the ends, which are held
    if (dragKind === 'pull') pullS = clamp(grabA / (L.SPAN / 2), -.75, .75);
    const cs = Math.cos(th), sn = Math.sin(th);
    press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ox: p[0] - (cx + grabA * cs), oy: p[1] - (cy + grabA * sn) };
    samples = [];
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  }
  function startDrag() {
    dragging = true; closePanel(); hideTip(); release();
    document.documentElement.classList.add('mm-grabbing'); root.classList.add('mm-dragging');
  }
  function onMove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x0, dy = e.clientY - press.y0;
    if (!dragging) { if (Math.hypot(dx, dy) < 4) return; startDrag(); }
    if (dragKind === 'dock') {
      const p = local(e), cs = Math.cos(th), sn = Math.sin(th);
      [cx, cy] = inside(p[0] - press.ox - grabA * cs, p[1] - press.oy - grabA * sn, th);
      const now = performance.now(); samples.push([now, cx, cy]);
      while (samples.length > 2 && now - samples[0][0] > 100) samples.shift();
      const near = nearest(cx, cy); ghosts.forEach(g => g.classList.toggle('near', g.dataset.side === near));
    } else {
      const m = Math.hypot(dx, dy), R = ph.reach, f = m ? R * (1 - Math.exp(-m / R)) / m : 0, rx = dx * f, ry = dy * f;
      pox.t = rx * .1; poy.t = ry * .1; pbend.t = (ry * Math.cos(th) - rx * Math.sin(th)) * ph.pullBend;
    }
    kick();
  }
  function onUp(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    press = null;
    if (!dragging) return;
    swallowClick();
    dragging = false; document.documentElement.classList.remove('mm-grabbing'); root.classList.remove('mm-dragging');
    ghosts.forEach(g => g.classList.remove('near'));
    if (dragKind === 'dock') {
      // throw: project where the release velocity would carry it, dock to the nearest edge, keep the momentum
      let vx = 0, vy = 0;
      if (samples.length > 1) {
        const [t0, x0, y0] = samples[0], [t1, x1, y1] = samples[samples.length - 1], dt = (t1 - t0) / 1000;
        if (dt > .01) { vx = (x1 - x0) / dt; vy = (y1 - y0) / dt; }
      }
      setSide(nearest(clamp(cx + vx * .15, 0, sw), clamp(cy + vy * .15, 0, sh)), false);
      ex.v = vx * .6; ey.v = vy * .6;
    } else { pox.t = poy.t = pbend.t = 0; }
    kick();
  }
  root.addEventListener('pointerdown', onDown);

  /* ---------------- global listeners ---------------- */
  const onKey = (e: KeyboardEvent) => {
    kbd = true;
    // Escape closes the open panel, unless a control used it first (to cancel a drag, a scrub or an edit): those call
    // preventDefault. So decide after the event has been through the page, not here in the capture phase.
    if (e.key === 'Escape' && openC) setTimeout(() => { if (!e.defaultPrevented && openC && !destroyed) closePanel(true); }, 0);
  };
  const onDocDown = (e: PointerEvent) => {
    kbd = false;
    const t = e.target as Node;
    if (openC && !panelEl.contains(t) && !openC.el.contains(t)) closePanel();
  };
  const onDocUp = () => release();
  const onHover = (e: PointerEvent) => {
    if (!o.collapsible || !docked || dragging) return;
    const [x, y] = local(e), was = hovered, wasPeek = peek;
    hovered = spineHit(ns, x, y, H / 2 + 18) >= 0 || tab.contains(e.target as Node);
    if (collapsed) {
      const [nx, ny] = NORMALS[side], edge = side === 'top' ? y : side === 'bottom' ? sh - y : side === 'left' ? x : sw - x;
      const t0 = nx ? bar.cy - L.LEN / 2 - 40 : bar.cx - L.LEN / 2 - 40, t1 = t0 + L.LEN + 80, along_ = nx ? y : x;
      peek = edge < 56 && along_ > t0 && along_ < t1; void ny;
    } else peek = false;
    if (was !== hovered || wasPeek !== peek) kick();
  };
  const onResize = () => { stage(); relayout(); };
  addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onDocDown, true);
  addEventListener('pointerup', onDocUp); addEventListener('pointercancel', onDocUp); addEventListener('blur', onDocUp);
  addEventListener('pointermove', onHover, { passive: true });
  if (mode === 'overlay') addEventListener('resize', onResize);
  const stageRO = mode === 'contained' && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  stageRO?.observe(root);
  document.fonts?.ready.then(() => !destroyed && relayout());

  /* ---------------- simulation ---------------- */
  function dentStep(h_: number) { const k = K() * (down ? 4 : 1.5); dent.step(h_, k, down ? crit(k, 1) : crit(k, Z())); }
  function sim(h_: number) {
    const k = K(), z = Z(), c = ph.damping;
    // search: the field races open with an overshoot and settles shut; the droplet lags so it pinches off
    for (const [sc, s] of sW) { s.t = sc.open ? sc.cfg.width ?? 200 : B; s.step(h_, k, sc.open ? c : crit(k, Math.max(z, .8))); }
    const sOpen = !!sCtl?.open;
    sOff.t = sOpen ? ph.dropletGap + H / 2 : -H / 2;
    sD.t = sOpen ? H - (closeDown ? 2 * ph.dent : 0) : H / 2;
    sOff.step(h_, k * .6, crit(k * .6, z * 1.1)); sD.step(h_, k * .8, crit(k * .8, z));
    layout();
    let bx: number, by: number;
    if (docked) {
      if (!(dragging && dragKind === 'dock')) {
        const k2 = k * 4; lead.step(h_, k2, crit(k2, 1)); prog.t = lead.x; prog.step(h_, k2, crit(k2, 1));
        const cC = crit(k, Math.max(z, .75)); ex.step(h_, k, cC); ey.step(h_, k, cC);
        if (route) {
          const [x, y] = along(route, prog.x), [dx, dy] = dockAt(side), p = clamp(prog.x, 0, 1);
          th = angAt(route, prog.x);
          [cx, cy] = inside(x + (dx - route.bx) * p + ex.x, y + (dy - route.by) * p + ey.x, th);
        }
      }
      hide.step(h_, k, crit(k, Math.max(z, .55)));
      lift.t = collapsed && peek ? 8 : 0; lift.step(h_, k * 2, crit(k * 2, .8));
      const [nx, ny] = NORMALS[side], out = hide.x * ((o.margin ?? 24) + H - 5) - lift.x;
      bx = cx - nx * out; by = cy - ny * out;
    } else {
      th = hz() ? 0 : Math.PI / 2;
      ancX.step(h_, k, c); ancY.step(h_, k, c);
      cx = (hz() ? L.LEN / 2 : H / 2) + ancX.x; cy = (hz() ? H / 2 : L.LEN / 2) + ancY.x;
      bx = cx; by = cy;
    }
    // pull: the bar bows toward the pointer at the spot it was grabbed while the ends hold back (the bow is laid in
    // settle, peaking under the grab)
    pox.step(h_, k, c); poy.step(h_, k, c); pbend.step(h_, k * 2, crit(k * 2, z));
    const pulling = dragKind === 'pull' && (dragging || !(pox.rest && poy.rest && pbend.rest));
    bar.aim(bx + pox.x, by + poy.x, th);
    bar.step(h_, pulling ? k * 8 : k * 1.2 / Math.max(.1, ph.bend), Math.min(z, 1), walls());
    dentStep(h_);
    // panels
    panelTargets();
    const kn = k * 1.6, cn = crit(kn, Math.max(z, .7));
    PT.step(h_, k, c); PE.step(h_, k, c); PB.step(h_, k, c); PD.step(h_, k, c); NX.step(h_, kn, cn);
    // collapse tab
    tabS.t = o.collapsible && docked && (hovered || collapsed || tabFocus) && !dragging && !openC ? 1 : 0;
    tabS.step(h_, k * 1.4, crit(k * 1.4, .6));
  }
  function settle() {
    if (!ph.bend && !(dragKind === 'pull' && (dragging || !pbend.rest))) bar.snap();
    bar.shape(ph.stretch, walls(), dragKind === 'pull' ? pbend.x : 0, pullS);
    if (docked && !(dragging && dragKind === 'dock')) snake();
  }
  /* a slide lays the bar along its path like a train on a track: every point of it sits on the route, so it wraps the
     corner. The rod's flex rides on top of that */
  function snake() {
    const r = route; if (!r || r.kind !== 'slide' || prog.x >= 1 && prog.rest) return;
    if (!r.cum) { r.cum = [0]; for (let i = 1; i < RN; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])); r.tot = r.cum[RN - 1] || 1; }
    const pts = r.pts, tot = r.tot!, dirAt = (i: number, j: number) => { const l = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) || 1; return [(pts[j][0] - pts[i][0]) / l, (pts[j][1] - pts[i][1]) / l]; };
    const d0 = dirAt(1, 0), d1 = dirAt(RN - 2, RN - 1);
    const at = (s: number) => {
      if (s <= 0) return [pts[0][0] + d0[0] * -s, pts[0][1] + d0[1] * -s, -d0[0], -d0[1]];
      if (s >= tot) return [pts[RN - 1][0] + d1[0] * (s - tot), pts[RN - 1][1] + d1[1] * (s - tot), d1[0], d1[1]];
      const f = s / tot * (RN - 1), i = Math.min(RN - 2, Math.floor(f)), t = f - i, d = dirAt(i, i + 1);
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, d[0], d[1]];
    };
    const sMid = clamp(prog.x, 0, 1) * tot, c = Math.cos(bar.th), s = Math.sin(bar.th), mid = at(sMid);
    const sign = mid[2] * c + mid[3] * s >= 0 ? 1 : -1, m = (N - 1) / 2, w = walls();
    ns.forEach((p, i) => {
      const a = (i - m) / m, qx = bar.cx + a * bar.half * c, qy = bar.cy + a * bar.half * s;
      const [x, y] = at(sMid + sign * a * bar.half);
      p.x = clamp(x - mid[0] + bar.cx + p.x - qx, w[0], w[2]); p.y = clamp(y - mid[1] + bar.cy + p.y - qy, w[1], w[3]);
    });
  }

  /* ---------------- drawing ---------------- */
  const px = (v: number) => v.toFixed(2) + 'px';
  function render() {
    const m = N - 1, dw = ph.dentWidth, dd = dent.x;
    // a one-item bar has a spine shorter than a pixel, whose direction is rounding noise: use the bar's own angle
    const at = (s: number): [number, number, number] => { const p = spineAt(ns, s * m, th); if (L.SPAN < 1) p[2] = th; return p; };
    const path = outline(at, () => H / 2, Math.ceil(L.SPAN / 2.5), s => dip((s * m - dentU) * L.REST, dd, dw));
    cBar.setAttribute('d', path);
    // items ride the spine (and the dent)
    for (const c of vis()) {
      const [x0, y0, a] = spinePos(c.u), off = dip((c.u - dentU) * L.REST, dd, dw);
      c.x = x0 - Math.sin(a) * off; c.y = y0 + Math.cos(a) * off; c.angle = c.follow ? a : 0;
      if (c.type === 'search') c.el.style.width = px(widthOf(c));
      c.el.style.transform = `translate(${px(c.x)},${px(c.y)})` + (c.follow ? ` rotate(${a.toFixed(4)}rad)` : '') + ' scale(var(--mm-press)) translate(-50%,-50%)';
    }
    // goo bounds
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    const grow = (x0: number, y0: number, x1: number, y1: number) => { gx0 = Math.min(gx0, x0); gy0 = Math.min(gy0, y0); gx1 = Math.max(gx1, x1); gy1 = Math.max(gy1, y1); };
    ns.forEach(p => grow(p.x - H / 2 - 4, p.y - H / 2 - 4, p.x + H / 2 + 4, p.y + H / 2 + 4));
    const boxes: [HTMLElement, number, number, number, number, number][] = [];   // el, x, y, w, h, radius (stage coords)
    let wantGoo = false;
    // search droplet
    const sActive = !!sCtl && (sCtl.open || !sOff.rest || sOff.x > -H / 2 + .5);
    if (sActive) {
      const [ex0, ey0, a] = spineAt(ns, m, th), D = H / 2 + sOff.x, d = Math.max(0, sD.x), pop = clamp(sOff.x / (ph.dropletGap + H / 2), 0, 1);
      const dx = ex0 + Math.cos(a) * D, dy = ey0 + Math.sin(a) * D, landed = !!sCtl!.open && pop > .9;
      closeBtn.style.transform = `translate(${px(dx)},${px(dy)}) scale(${(.5 + pop * .5).toFixed(3)}) scale(var(--mm-press)) translate(-50%,-50%)`;
      closeBtn.style.opacity = String(clamp(pop * 1.4 - .4, 0, 1));
      closeBtn.style.display = '';
      if (landed) {
        drop.style.display = 'none'; drop2.style.display = '';
        drop2.style.width = drop2.style.height = px(d); drop2.style.transform = `translate(${px(dx - d / 2)},${px(dy - d / 2)})`;
        if (ph.string > 0) {
          cString.style.display = '';
          cString.setAttribute('d', neckPath(D, d));
          cString.setAttribute('transform', `translate(${ex0.toFixed(2)} ${ey0.toFixed(2)}) rotate(${(a * 180 / Math.PI).toFixed(3)})`);
        } else cString.style.display = 'none';
      } else {
        drop.style.display = ''; drop2.style.display = 'none';
        boxes.push([drop, dx - d / 2, dy - d / 2, d, d, d / 2]); wantGoo = true;
        // the neck is there for the whole trip, thickening as the droplet arrives, so it never appears from nothing
        // when the droplet lands (and thins away the same way when it goes back in)
        const e = pop * pop * (3 - 2 * pop);
        if (ph.string > 0 && D - d / 2 > H / 2 && e > .01) {
          cString.style.display = '';
          cString.setAttribute('d', neckPath(D, d, ph.string * e));
          cString.setAttribute('transform', `translate(${ex0.toFixed(2)} ${ey0.toFixed(2)}) rotate(${(a * 180 / Math.PI).toFixed(3)})`);
        } else cString.style.display = 'none';
      }
    } else { drop.style.display = 'none'; drop2.style.display = 'none'; cString.style.display = 'none'; closeBtn.style.display = 'none'; }
    // panel
    if (fromC && !openC && [PT, PE, PB, PD, NX].every(s => s.rest)) {
      fromC = null; panelEl.style.display = 'none'; root.classList.remove('mm-raised'); ctls.forEach(x => !floats.has(x) && x.pc?.classList.remove('on'));
    }
    if (fromC) {
      const H_ = hz(), b = Math.max(0, PB.x), dp = Math.max(0, PD.x), sg = pSign;
      const near = sg > 0 ? PE.x : PE.x - dp;
      const [l, t, w, ht] = H_ ? [PT.x - b / 2, near, b, dp] : [near, PT.x - b / 2, dp, b];
      const r = Math.min(18, w / 2, ht / 2);
      panelEl.style.width = px(w); panelEl.style.height = px(ht); panelEl.style.borderRadius = px(r); panelEl.style.transform = `translate(${px(l)},${px(t)})`;
      // a blob heading sits half outside the body: the shell (and a neck reaching down to it) starts at its middle
      const hb = fromC.pc?.classList.contains('mm-pc-blob') ? Math.min(HEAD_HALF, ht / 2) : 0;
      boxes.push([pBlob, l, t + hb, w, ht - hb, Math.min(r, (ht - hb) / 2)]); grow(l, t, l + w, t + ht);
      const An = H_ ? bar.cy : bar.cx, s0 = An + sg * (H / 2 - 6), s1 = PE.x + sg * 2 + (H_ && sg > 0 ? hb : 0), span = (s1 - s0) * sg, nw = ph.neck;
      const t0 = (H_ ? l : t) + r + nw / 2, t1 = (H_ ? l + w : t + ht) - r - nw / 2, nxp = t0 <= t1 ? clamp(NX.x, t0, t1) : PT.x;
      if (span > 0) {
        const lo = Math.min(s0, s1);
        boxes.push(H_ ? [neck, nxp - nw / 2, lo, nw, span, nw / 2] : [neck, lo, nxp - nw / 2, span, nw, nw / 2]);
        neck.style.display = '';
      } else neck.style.display = 'none';
      pBlob.style.display = '';
      wantGoo = true;
    } else { pBlob.style.display = 'none'; neck.style.display = 'none'; }
    // collapse tab
    if (o.collapsible && docked) {
      const [nx, ny] = NORMALS[side], H_ = horiz(side), ts = clamp(tabS.x, 0, 1.2);
      const tcx = bar.cx + nx * (H / 2 + 6), tcy = bar.cy + ny * (H / 2 + 6);
      const tw = (H_ ? 46 : 20) * ts, tht = (H_ ? 20 : 46) * ts;
      tab.style.transform = `translate(${px(bar.cx + nx * (H / 2 + 8))},${px(bar.cy + ny * (H / 2 + 8))})` + (H_ ? '' : ' rotate(90deg)') + ' translate(-50%,-50%)';
      tab.classList.toggle('on', tabS.x > .6); tab.style.display = '';
      if (ts > .01) { boxes.push([tBlob, tcx - tw / 2, tcy - tht / 2, tw, tht, 10 * ts]); tBlob.style.display = ''; wantGoo = true; }
      else tBlob.style.display = 'none';
    } else { tab.style.display = 'none'; tBlob.style.display = 'none'; }
    // goo layer: only while something is melting; sized to what's in it so the filter stays cheap
    if (wantGoo !== gooOn) { gooOn = wantGoo; goo.classList.toggle('on', gooOn); crisp.classList.toggle('solo', !gooOn); }
    if (gooOn) {
      boxes.forEach(([, x, y, w, ht]) => grow(x, y, x + w, y + ht));
      const pad = ph.blur * 3 + 16, X0 = gx0 - pad, Y0 = gy0 - pad;
      goo.style.transform = `translate(${px(X0)},${px(Y0)})`; goo.style.width = px(gx1 - gx0 + 2 * pad); goo.style.height = px(gy1 - gy0 + 2 * pad);
      goo.style.filter = ph.blur > 0 ? `url(#${gid}) drop-shadow(0 8px 14px var(--mm-shadow))` : 'drop-shadow(0 8px 14px var(--mm-shadow))';
      gooSvg.style.transform = `translate(${px(-X0)},${px(-Y0)})`;
      gBar.setAttribute('d', path);
      for (const [el, x, y, w, ht, r] of boxes) {
        el.style.width = px(w); el.style.height = px(ht); el.style.borderRadius = px(r);
        el.style.transform = `translate(${px(x - X0)},${px(y - Y0)})`;
      }
    }
    // docking ghosts while dragging
    if (dragging && dragKind === 'dock') {
      ghosts.forEach(g => {
        const d = g.dataset.side as Side, [x, y] = dockAt(d), H_ = horiz(d), w = H_ ? L.LEN : H, ht = H_ ? H : L.LEN;
        g.style.width = px(w); g.style.height = px(ht); g.style.transform = `translate(${px(x - w / 2)},${px(y - ht / 2)})`;
      });
    }
    if (tipFor) placeTip();
    sizeRoot();
  }
  /** the pinched neck from the bar's round end to the droplet, in a frame where the end cap sits at the origin */
  function neckPath(D: number, d: number, thick = ph.string) {
    const R1 = H / 2, R2 = d / 2, a = 1, b = 1, f = (v: number) => v.toFixed(2);
    const p1x = R1 * Math.cos(a), p1y = R1 * Math.sin(a), p2x = D - R2 * Math.cos(b), p2y = R2 * Math.sin(b);
    const half = Math.min(thick / 2, R1 * .9, R2 * .9), mx = (R1 + D - R2) / 2, L1 = (mx - p1x) * .55, L2 = (p2x - mx) * .55;
    const top = `C${f(p1x + L1 * Math.sin(a))} ${f(-(p1y - L1 * Math.cos(a)))} ${f(mx - L1 * .6)} ${f(-half)} ${f(mx)} ${f(-half)} C${f(mx + L2 * .6)} ${f(-half)} ${f(p2x - L2 * Math.sin(b))} ${f(-(p2y - L2 * Math.cos(b)))} ${f(p2x)} ${f(-p2y)}`;
    const bot = `C${f(p2x - L2 * Math.sin(b))} ${f(p2y - L2 * Math.cos(b))} ${f(mx + L2 * .6)} ${f(half)} ${f(mx)} ${f(half)} C${f(mx - L1 * .6)} ${f(half)} ${f(p1x + L1 * Math.sin(a))} ${f(p1y - L1 * Math.cos(a))} ${f(p1x)} ${f(p1y)}`;
    return `M0 -1 L${f(p1x)} ${f(-p1y)} ${top} L${f(D)} 0 L${f(p2x)} ${f(p2y)} ${bot} L0 1Z`;
  }

  const system = {
    tick(h_: number, n: number) {
      if (!ready || destroyed) return false;
      measurePanel();
      for (let i = 0; i < n; i++) sim(h_);
      settle(); render();
      const springs = [prog, lead, ex, ey, pox, poy, pbend, dent, sOff, sD, hide, tabS, lift, ancX, ancY, ...sW.values()];
      if (fromC) springs.push(PT, PE, PB, PD, NX);
      return dragging || (!isReduced() && (!springs.every(s => s.rest) || !bar.still));
    },
  };

  /* ---------------- options ---------------- */
  function applyLook() {
    const t = o.theme;
    root.dataset.theme = typeof t === 'string' ? t : 'dark';
    for (const v of Object.values(THEME_VARS)) root.style.removeProperty(v);
    if (t && typeof t === 'object') for (const [k, v] of Object.entries(t)) if (v && THEME_VARS[k as keyof Theme]) root.style.setProperty(THEME_VARS[k as keyof Theme], v);
    if (o.zIndex !== undefined) root.style.setProperty('--mm-z', String(o.zIndex)); else root.style.removeProperty('--mm-z');
    root.setAttribute('aria-label', o.label ?? 'Toolbar');
    root.setAttribute('aria-orientation', hz() ? 'horizontal' : 'vertical');
    root.classList.toggle('mm-draggable', docked && o.draggable !== false);
    if (o.className) root.classList.add(...o.className.split(/\s+/).filter(Boolean));
    blurEl.setAttribute('stdDeviation', String(Math.max(0, ph.blur)));
    if (floats.size) syncFloatLook();
  }
  function values() {
    const out: Record<string, unknown> = {};
    for (const c of ctls) if (c.hasValue && c.cfg.id) out[c.cfg.id] = c.value;
    return out;
  }
  function find(id: string) { return ctls.find(c => c.cfg.id === id || c.key === id); }

  /* ---------------- start ---------------- */
  applyLook();
  setItems(o.items ?? []);
  stage();
  layout();
  if (docked) { jump(side); if (collapsed) { root.classList.add('mm-collapsed'); itemsWrap.inert = true; } }
  root.setAttribute('aria-orientation', hz() ? 'horizontal' : 'vertical');
  ready = true;
  sim(0); settle(); render();
  addSystem(system); kick();

  const api: IslandController = {
    el: root,
    get side() { return side; },
    get openId() { return openC ? openC.cfg.id ?? openC.key : null; },
    update(next) {
      if (destroyed) return;
      const prev = o;
      o = { ...o, ...next };
      if (next.physics) ph = { ...DEFAULT_PHYSICS, ...o.physics };
      applyLook();
      if (next.items) setItems(next.items);
      if (next.side && next.side !== prev.side && docked) setSide(next.side);
      if (next.side && !docked) { root.dataset.side = next.side; relayout(); }
      if (next.collapsed !== undefined && next.collapsed !== prev.collapsed) collapse(next.collapsed);
      if (next.margin !== undefined || next.align !== undefined) relayout();
      kick();
    },
    get: <T,>(id: string) => find(id)?.value as T,
    set(id, v) {
      const c = find(id); if (!c || !c.hasValue) return;
      c.value = v; c.apply(); ctls.forEach(flags); relayout();
    },
    values,
    setSide: d => setSide(d),
    open(id) {
      const c = find(id); if (!c) return;
      if (c.panel) openPanel(c); else if (c.type === 'search') setSearch(c, true);
    },
    close() { closePanel(); if (sCtl?.open) setSearch(sCtl, false); },
    collapse: v => collapse(v),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      removeSystem(system); hideTip(); clearTimeout(hoverT);
      floats.forEach(f => f.win.remove()); floats.clear(); floatRoot.remove();
      ro?.disconnect(); stageRO?.disconnect();
      removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDocDown, true);
      removeEventListener('pointerup', onDocUp); removeEventListener('pointercancel', onDocUp); removeEventListener('blur', onDocUp);
      removeEventListener('pointermove', onHover); removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
      document.documentElement.classList.remove('mm-grabbing');
      for (const r of slots.values()) r.cleanup?.();
      slots.clear();
      ctls.forEach(c => c.destroy?.());
      root.remove();
      if (o.injectStyles !== false) releaseStyles();
    },
  };
  return api;
}

/** a drag that starts on a button must not press it */
function swallowClick() {
  const f = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  addEventListener('click', f, true); setTimeout(() => removeEventListener('click', f, true), 0);
}
