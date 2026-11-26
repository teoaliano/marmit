/* transition control: an easing / spring editor in a panel. Tabs for Easing (a bézier with two handles, its four
   numbers and an intensity dial), Time (a spring by feel) and Physics (a spring by stiffness, damping and mass), a
   duration, named presets you can save to, and copy / paste between transitions. The maths lives in transition-math. */
import type { Transition, TransitionMode } from '../types';
import { arrows, h, head, ic, trigger, type Build } from './dom';
import { clickToType, decimals, scrub, snapGrid, stepKey, withUnit } from './num';
import {
  DEFAULTS, MODES, MODE_LABEL, builtIns, durationOf, fit, intensity, keyNudge, matches, modeOf, nextCustomName, normalize,
  nudge, parseCurve, pickPreset, presetName, settle, springAt, tangentEnd, toPhysics, clampY,
  type CustomPreset, type Ease,
} from './transition-math';

/* ---------- shared across every transition control ---------- */
/** one clipboard for all transition controls (not the system clipboard): a copied value with its tab */
let clip: { value: Transition; mode: TransitionMode } | null = null;
/** each live control's "something shared changed" hook: the clipboard or the saved presets */
const peers = new Set<() => void>();
const KEY = 'marmit:transition-presets';
let customs: CustomPreset[] | null = null;
const loadCustoms = () => {
  if (customs) return customs;
  customs = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && Array.isArray(raw.presets)) for (const p of raw.presets)
      if (p && typeof p.name === 'string' && MODES.includes(p.mode)) customs.push({ id: String(p.id ?? Math.random()), name: p.name, mode: p.mode, value: normalize(p.value, p.mode) });
  } catch { /* storage blocked or bad JSON: start empty */ }
  return customs;
};
const saveCustoms = () => {
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, presets: customs })); } catch { /* storage blocked */ }
  peers.forEach(f => f());
};


const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const sv = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el;
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const n2 = (v: number) => String(Number(v.toFixed(2)));
const f1 = (v: number) => v.toFixed(1);

/** a small curve drawing in a w×h box: the bézier itself, or a spring sampled across its settle time */
function curvePath(v: Transition, w: number, hh: number, pad = 1.5) {
  let pts: [number, number][];
  if (v.type === 'easing') { const [a, b, c, d] = v.ease; pts = [[0, 0], [a, b], [c, d], [1, 1]]; }
  else { const p = toPhysics(v), s = settle(p); pts = Array.from({ length: 25 }, (_, i) => [i / 24, springAt(i / 24 * s, p)]); }
  const lo = Math.min(0, ...pts.map(p => p[1])), hi = Math.max(1, ...pts.map(p => p[1]));
  const xy = pts.map(([x, y]) => `${f1(pad + x * (w - pad * 2))} ${f1(hh - pad - (y - lo) / (hi - lo) * (hh - pad * 2))}`);
  return v.type === 'easing' ? `M${xy[0]}C${xy.slice(1).join(' ')}` : `M${xy.join('L')}`;
}
const thumb = (v: Transition, w = 28, hh = 16) => { const s = sv('svg', { viewBox: `0 0 ${w} ${hh}`, class: 'mm-tr-thumb', 'aria-hidden': 'true' }); s.append(sv('path', { d: curvePath(v, w, hh) })); return s; };

/* ---------- a slider row inside the panel: label, marmit track, click-to-type value ---------- */
interface RowSlider { el: HTMLElement; sync(): void }
function rowSlider(o: { label: string; min: number; max: () => number; step: number; unit?: string; get(): number; set(v: number): void }): RowSlider {
  const tr = h('div', 'mm-slider', { role: 'slider', tabindex: 0, 'aria-label': o.label }), fill = h('div', 'mm-fill'), knob = h('div', 'mm-knob');
  const val = h('span', 'mm-tr-v'), lab = h('span', 'mm-tr-l', {}, o.label);
  tr.append(fill, knob);
  const el = h('div', 'mm-tr-row', {}, lab, tr, val);
  const dec = () => decimals(o.step, o.min, o.max()), txt = () => o.get().toFixed(dec());
  const put = (v: number) => o.set(snapGrid(v, o.step, o.min, o.max()));
  const at = (x: number, r: DOMRect) => o.min + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (o.max() - o.min);
  let d: { id: number; x: number; on: boolean; r: DOMRect } | null = null;
  tr.addEventListener('pointerdown', e => {
    if (e.button) return; e.preventDefault(); tr.focus({ preventScroll: true }); tr.setPointerCapture(e.pointerId);
    d = { id: e.pointerId, x: e.clientX, on: false, r: tr.getBoundingClientRect() };
  });
  tr.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on && Math.abs(e.clientX - d.x) < 3) return;
    d.on = true; tr.classList.add('drag'); put(at(e.clientX, d.r));
  });
  tr.addEventListener('pointerup', e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      // a click: few steps snap to the nearest one, otherwise to a 10% tick when within 3.125% of it
      let v = at(e.clientX, d.r); const lo = o.min, hi = o.max();
      if ((hi - lo) / o.step > 10) { const f = (v - lo) / (hi - lo), t = Math.round(f * 10) / 10; if (Math.abs(f - t) <= 0.03125) v = lo + t * (hi - lo); }
      put(v);
    }
    d = null; tr.classList.remove('drag');
  });
  tr.addEventListener('pointercancel', () => { d = null; tr.classList.remove('drag'); });
  const typer = clickToType(val, { get: o.get, commit: put, text: txt, label: o.label, step: (k, v, s) => stepKey(k, v, o.min, o.max(), o.step, s) });
  tr.addEventListener('keydown', e => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') { e.preventDefault(); typer.open(); return; }
    const v = stepKey(e.key, o.get(), o.min, o.max(), o.step, e.shiftKey);
    if (v === null) return;
    e.preventDefault(); e.stopPropagation(); put(v);
  });
  return {
    el,
    sync() {
      const v = o.get(), hi = o.max(), f = hi > o.min ? Math.min(1, Math.max(0, (v - o.min) / (hi - o.min))) : 0;
      fill.style.width = knob.style.left = f * 100 + '%';
      if (!typer.editing) val.textContent = withUnit(txt(), o.unit);
      tr.setAttribute('aria-valuemin', String(o.min)); tr.setAttribute('aria-valuemax', String(hi));
      tr.setAttribute('aria-valuenow', String(v)); tr.setAttribute('aria-valuetext', withUnit(txt(), o.unit));
    },
  };
}

/* ---------- the control ---------- */
const W = 248, H = 144;

export const transition: Build = (c, ctx) => {
  c.hasValue = true;
  const modes = (): TransitionMode[] => { const m = ((c.cfg.modes ?? MODES) as TransitionMode[]).filter(x => MODES.includes(x)); return m.length ? m : MODES; };
  const val = () => c.value as Transition, mode = () => modeOf(val());
  /** the last value used in each tab, so switching back restores it */
  const last: Partial<Record<TransitionMode, Transition>> = {};
  const fix = () => {
    let v = c.value && typeof c.value === 'object' ? normalize(c.value) : DEFAULTS[modes()[0]];
    if (!modes().includes(modeOf(v))) v = last[modes()[0]] ?? DEFAULTS[modes()[0]];
    c.value = v; last[modeOf(v)] = v;
  };
  const name = () => presetName(val(), mode(), loadCustoms());
  /** a change from inside the editor (handle drag / keys) draws at once; anything else tweens the curve */
  let own = false;
  const set = (v: Transition, fromHandle = false) => {
    v = normalize(v);
    if (JSON.stringify(v) === JSON.stringify(c.value)) return;
    c.value = v; own = fromHandle; c.apply(); own = false; ctx.emit(c, c.value);
  };
  const setEase = (e: Ease, fromHandle = false) => { const v = val(); if (v.type === 'easing') set({ ...v, ease: e }, fromHandle); };

  // bar trigger: a pill with a tiny curve and "Glide 0.3s"
  const glyph = h('span', 'mm-ic mm-tr-glyph', { 'aria-hidden': 'true' }), gp = sv('path');
  const gs = sv('svg', { viewBox: '0 0 14 14' }); gs.append(gp); glyph.append(gs);
  const pillText = () => { const nm = name(); return `${nm !== 'Custom' ? nm : mode() === 'easing' ? 'Ease' : 'Spring'} ${n2(durationOf(val()))}s`; };
  const renderTrigger = trigger(c, ctx, pillText);
  const drawTrigger = () => {
    renderTrigger();
    const t = c.trigger!;
    t.setAttribute('aria-label', `${c.cfg.label}: ${pillText()}`);
    gp.setAttribute('d', curvePath(val(), 14, 14, 2));
    if (!c.cfg.icon && t.classList.contains('mm-pill')) t.prepend(glyph);
  };

  let ui: { sync(): void; peer(): void } | null = null;
  c.render = () => { fix(); drawTrigger(); ui?.sync(); };
  c.apply = () => { fix(); drawTrigger(); ui?.sync(); };
  const onPeer = () => ui?.peer();
  peers.add(onPeer);
  c.destroy = () => { peers.delete(onPeer); };

  c.panel = {
    build(pc) {
      const root = h('div', 'mm-tr');

      /* ---- copy / paste ---- */
      const copyB = h('button', 'mm-tr-act', { type: 'button', 'aria-label': 'Copy transition', title: 'Copy' }, ic('copy'));
      const pasteB = h('button', 'mm-tr-act', { type: 'button', 'aria-label': 'Paste transition', title: 'Paste' });
      const pasteIc = h('span', 'mm-ic');
      pasteIc.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="2.8" width="8" height="9.7" rx="1.5"/><path d="M5.3 2.8V2a.6.6 0 0 1 .6-.6h2.2a.6.6 0 0 1 .6.6v.8M5.5 7h3M5.5 9.3h2"/></svg>';
      pasteB.append(pasteIc);
      const flash = (b: HTMLElement) => {
        const prev = [...b.childNodes]; b.replaceChildren(ic('check')); b.classList.add('done');
        setTimeout(() => { b.replaceChildren(...prev); b.classList.remove('done'); }, 1200);
      };
      copyB.addEventListener('click', () => { clip = { value: clone(val()), mode: mode() }; flash(copyB); peers.forEach(f => f()); });
      pasteB.addEventListener('click', () => { if (!clip || !modes().includes(clip.mode)) return; const v = clone(clip.value); set(v); flash(pasteB); });
      const acts = h('div', 'mm-tr-acts', {}, copyB, pasteB);
      const syncPaste = () => {
        const ok = !!clip && modes().includes(clip.mode);
        pasteB.toggleAttribute('disabled', !ok);
        const what = clip ? `${MODE_LABEL[clip.mode]} · ${presetName(clip.value, clip.mode, loadCustoms())}` : '';
        pasteB.title = clip ? `Paste (now: ${what})` : 'Paste (nothing copied yet)';
        pasteB.setAttribute('aria-label', clip ? `Paste transition: ${what}` : 'Paste transition');
      };

      /* ---- mode tabs ---- */
      const seg = h('div', 'mm-seg mm-tr-seg', { role: 'radiogroup', 'aria-label': 'Transition type' }), segThumb = h('i', 'mm-seg-thumb', { 'aria-hidden': 'true' });
      seg.append(segThumb, ...MODES.map(m => {
        const b = h('button', '', { type: 'button', role: 'radio', 'data-v': m }, MODE_LABEL[m]);
        b.addEventListener('click', () => { const cur = mode(); if (cur === m) return; last[cur] = val(); set(last[m] ?? DEFAULTS[m]); });
        return b;
      }));
      arrows(seg, 'button:not([hidden])', b => b.click());
      let segReady = false;
      const syncSeg = () => {
        const ms = modes(), cur = mode(); let on: HTMLElement | null = null;
        seg.hidden = ms.length < 2;
        seg.querySelectorAll<HTMLElement>('button').forEach(b => {
          const m = b.dataset.v as TransitionMode, a = m === cur;
          b.hidden = !ms.includes(m); b.setAttribute('aria-checked', String(a)); b.tabIndex = a ? 0 : -1; if (a) on = b;
        });
        const place = () => { const b = on as HTMLElement | null; if (b && b.offsetWidth) { segThumb.style.width = b.offsetWidth + 'px'; segThumb.style.transform = `translateX(${b.offsetLeft}px)`; segReady = true; } };
        // the first placement must not slide in from the left
        if (!segReady) { segThumb.style.transition = 'none'; place(); requestAnimationFrame(() => { place(); segThumb.style.transition = ''; }); } else { place(); requestAnimationFrame(place); }
      };
      const top = h('div', 'mm-tr-top', {}, seg);

      /* ---- stage: the bézier editor or the spring preview ---- */
      const stage = h('div', 'mm-tr-stage');
      const bz = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mm-tr-bz', 'aria-hidden': 'true' });
      const box = sv('rect', { class: 'mm-tr-box' }), diag = sv('line', { class: 'mm-tr-diag' }), t1 = sv('line', { class: 'mm-tr-tan' }), t2 = sv('line', { class: 'mm-tr-tan' });
      const curve = sv('path', { class: 'mm-tr-curve' }), e0 = sv('circle', { r: 3, class: 'mm-tr-end' }), e1 = sv('circle', { r: 3, class: 'mm-tr-end' });
      bz.append(box, diag, t1, t2, curve, e0, e1);
      const handles = [0, 1].map(i => h('button', 'mm-tr-h', { type: 'button', 'aria-label': `Handle ${i + 1}` }));
      const sp = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mm-tr-sp', 'aria-hidden': 'true' });
      const spGrid = sv('path', { class: 'mm-tr-grid' }), spTarget = sv('line', { class: 'mm-tr-diag' }), spMark = sv('line', { class: 'mm-tr-mark' }), spCurve = sv('path', { class: 'mm-tr-curve' });
      let gd = ''; for (let k = 1; k < 4; k++) gd += `M${W * k / 4} 0V${H}M0 ${H * k / 4}H${W}`;
      spGrid.setAttribute('d', gd); sp.append(spGrid, spTarget, spMark, spCurve);
      stage.append(bz, sp, ...handles);

      let drawn: Ease | null = null, tween = 0, lastChange = 0;
      const drawEase = (e: Ease) => {
        drawn = e;
        const f = fit(e, W, H), [p1, p2] = f.handles, a = f.start, b = f.end, ul = f.at(0, 1);
        box.setAttribute('x', f1(a.x)); box.setAttribute('y', f1(ul.y)); box.setAttribute('width', f1(b.x - a.x)); box.setAttribute('height', f1(a.y - ul.y));
        diag.setAttribute('x1', f1(a.x)); diag.setAttribute('y1', f1(a.y)); diag.setAttribute('x2', f1(b.x)); diag.setAttribute('y2', f1(b.y));
        const q1 = tangentEnd(a, p1), q2 = tangentEnd(b, p2);
        t1.setAttribute('x1', f1(a.x)); t1.setAttribute('y1', f1(a.y)); t1.setAttribute('x2', f1(q1.x)); t1.setAttribute('y2', f1(q1.y));
        t2.setAttribute('x1', f1(b.x)); t2.setAttribute('y1', f1(b.y)); t2.setAttribute('x2', f1(q2.x)); t2.setAttribute('y2', f1(q2.y));
        curve.setAttribute('d', `M${f1(a.x)} ${f1(a.y)}C${f1(p1.x)} ${f1(p1.y)} ${f1(p2.x)} ${f1(p2.y)} ${f1(b.x)} ${f1(b.y)}`);
        e0.setAttribute('cx', f1(a.x)); e0.setAttribute('cy', f1(a.y)); e1.setAttribute('cx', f1(b.x)); e1.setAttribute('cy', f1(b.y));
        handles.forEach((hb, i) => { const p = f.handles[i]; hb.style.left = p.x / W * 100 + '%'; hb.style.top = p.y / H * 100 + '%'; });
      };
      const showEase = (e: Ease) => {
        const now = performance.now(), quick = now - lastChange < 250; lastChange = now;
        cancelAnimationFrame(tween);
        if (own || !drawn || quick || reduced() || drawn.every((v, i) => v === e[i])) { drawEase(e); return; }
        const from = drawn, t0 = now;
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 250), s = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          drawEase(from.map((v, i) => v + (e[i] - v) * s) as Ease);
          if (k < 1) tween = requestAnimationFrame(step);
        };
        tween = requestAnimationFrame(step);
      };
      const drawSpring = (v: Transition) => {
        const p = toPhysics(v as never), ys: number[] = [];
        for (let i = 0; i <= 100; i++) ys.push(springAt(i / 100 * 2, p));
        const lo = Math.min(...ys), rg = (Math.max(...ys) - lo) || 1, y = (u: number) => H - ((u - lo) / rg * H * 0.6 + H * 0.2);
        const x = (t: number) => 12 + t / 2 * (W - 24);
        spCurve.setAttribute('d', ys.map((u, i) => `${i ? 'L' : 'M'}${f1(x(i / 50))} ${f1(y(u))}`).join(''));
        spTarget.setAttribute('x1', '0'); spTarget.setAttribute('x2', String(W)); spTarget.setAttribute('y1', f1(y(1))); spTarget.setAttribute('y2', f1(y(1)));
        const st = x(Math.min(2, durationOf(v)));
        spMark.setAttribute('x1', f1(st)); spMark.setAttribute('x2', f1(st)); spMark.setAttribute('y1', '0'); spMark.setAttribute('y2', String(H));
      };

      /* handle drag: pointer capture, delta from the press, converted to plot units at the scale of the press */
      let drag: { i: 0 | 1; id: number; x: number; y: number; start: Ease; scale: number; ratio: number } | null = null;
      const endDrag = () => { if (!drag) return; const d = drag; drag = null; try { handles[d.i].releasePointerCapture(d.id); } catch { /* gone */ } handles[d.i].classList.remove('drag'); };
      const revert = () => { if (!drag) return; const s = drag.start; endDrag(); setEase(s, true); };
      handles.forEach((hb, idx) => {
        const i = idx as 0 | 1;
        hb.addEventListener('pointerdown', e => {
          if (e.button || val().type !== 'easing') return;
          e.preventDefault(); e.stopPropagation(); hb.focus({ preventScroll: true }); hb.setPointerCapture(e.pointerId);
          const ease = (val() as { ease: Ease }).ease;
          drag = { i, id: e.pointerId, x: e.clientX, y: e.clientY, start: [...ease] as Ease, scale: fit(ease, W, H).scale, ratio: W / (bz.getBoundingClientRect().width || W) };
          hb.classList.add('drag');
        });
        hb.addEventListener('pointermove', e => {
          const d = drag; if (!d || d.id !== e.pointerId || d.i !== i) return;
          setEase(nudge(d.start, i, (e.clientX - d.x) * d.ratio, (e.clientY - d.y) * d.ratio, d.scale), true);
        });
        hb.addEventListener('pointerup', e => { if (drag?.id === e.pointerId) endDrag(); });
        hb.addEventListener('pointercancel', e => { if (drag?.id === e.pointerId) revert(); });
        hb.addEventListener('keydown', e => {
          // Escape mid-drag puts the curve back (preventDefault keeps the panel open)
          if (e.key === 'Escape' && drag) { e.preventDefault(); revert(); return; }
          if (e.altKey || e.metaKey || e.ctrlKey || val().type !== 'easing') return;
          const n = keyNudge((val() as { ease: Ease }).ease, i, e.key, e.shiftKey);
          if (!n) return;
          e.preventDefault(); e.stopPropagation(); setEase(n, true);
        });
      });

      /* ---- X1 Y1 X2 Y2 ---- */
      const fieldsRow = h('div', 'mm-tr-fields');
      const inputs = ['X1', 'Y1', 'X2', 'Y2'].map((nm, i) => {
        const isX = i % 2 === 0, lim = (v: number) => Number((isX ? Math.min(1, Math.max(0, v)) : clampY(v)).toFixed(3));
        const inp = h('input', 'mm-tr-in', { type: 'text', spellcheck: 'false', inputmode: 'decimal', 'aria-label': `${nm} (${isX ? '0 to 1' : '-1 to 2'})` });
        const fld = h('label', 'mm-tr-f', {}, h('span', 'mm-tr-fl', { 'aria-hidden': 'true' }, nm), inp);
        const cur = () => ((val() as { ease?: Ease }).ease ?? [0, 0, 1, 1])[i];
        const put = (v: number) => { const e = [...(val() as { ease: Ease }).ease] as Ease; e[i] = lim(v); setEase(e); };
        const shown = () => n2(cur());
        const commit = () => {
          const t = inp.value.trim();
          if (t.includes(',')) { const e = parseCurve(t); if (e) setEase(e.map((v, k) => Number(v.toFixed(3))) as Ease); }
          else { const n = parseFloat(t); if (Number.isFinite(n) && t !== shown()) put(n); }
          inp.value = shown();
        };
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('blur', commit);
        inp.addEventListener('keydown', e => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); commit(); inp.select(); }
          // Escape drops a half-typed value; with nothing typed it falls through and closes the panel
          else if (e.key === 'Escape' && inp.value.trim() !== shown()) { e.preventDefault(); inp.value = shown(); inp.select(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const t = parseFloat(inp.value), base = Number.isFinite(t) ? t : cur();
            put(base + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01)); inp.value = shown(); inp.select();
          }
        });
        // a whole curve pasted into any field replaces all four
        inp.addEventListener('paste', e => {
          const e4 = parseCurve(e.clipboardData?.getData('text') ?? '');
          if (e4) { e.preventDefault(); setEase(e4.map(v => Number(v.toFixed(3))) as Ease); inp.value = shown(); inp.select(); }
        });
        // drag the field sideways to scrub it, but only while it isn't being typed in
        fld.addEventListener('pointerdown', e => { if (document.activeElement === inp) e.stopPropagation(); }, true);
        scrub(fld, {
          get: cur, set: v => { put(v); return cur(); }, perPx: () => 0.01,
          onTap: () => inp.focus(),
        });
        fld.addEventListener('click', e => e.preventDefault());
        fieldsRow.append(fld);
        return inp;
      });

      /* ---- sliders ---- */
      const tracker = intensity();
      const easeOf = () => (val() as { ease: Ease }).ease;
      const num = (k: string, d: number) => { const v = (val() as unknown as Record<string, number>)[k]; return typeof v === 'number' ? v : d; };
      const setK = (k: string) => (n: number) => set({ ...val(), [k]: n } as Transition);
      const sIntensity = rowSlider({ label: 'Intensity', min: 0, max: () => 100, step: 1, unit: '%', get: () => val().type === 'easing' ? tracker.read(easeOf()) : 50, set: n => setEase(tracker.apply(easeOf(), n)) });
      const sBounce = rowSlider({ label: 'Bounce', min: 0, max: () => 1, step: 0.05, get: () => num('bounce', 0.2), set: setK('bounce') });
      const sStiff = rowSlider({ label: 'Stiffness', min: 10, max: () => 1000, step: 10, get: () => num('stiffness', 400), set: setK('stiffness') });
      const sDamp = rowSlider({ label: 'Damping', min: 1, max: () => 100, step: 1, get: () => num('damping', 17), set: setK('damping') });
      const sMass = rowSlider({ label: 'Mass', min: 0.1, max: () => 10, step: 0.1, get: () => num('mass', 1), set: setK('mass') });
      const sDur = rowSlider({
        label: 'Duration', min: 0.1, max: () => mode() === 'easing' ? 2 : 5, step: 0.05, unit: 's',
        get: () => num(mode() === 'easing' ? 'duration' : 'visualDuration', 0.3), set: n => setK(mode() === 'easing' ? 'duration' : 'visualDuration')(n),
      });
      const settleV = h('span', 'mm-tr-v');
      const settleRow = h('div', 'mm-tr-row mm-tr-ro', {}, h('span', 'mm-tr-l', {}, 'Duration'), h('span', 'mm-tr-note', {}, 'settles in'), settleV);
      const gEase = h('div', 'mm-tr-g', {}, fieldsRow, sIntensity.el), gTime = h('div', 'mm-tr-g', {}, sBounce.el), gPhys = h('div', 'mm-tr-g', {}, sStiff.el, sDamp.el, sMass.el);

      /* ---- presets ---- */
      const pHead = h('button', 'mm-row mm-tr-ph', { type: 'button', 'aria-expanded': 'false' });
      const pName = h('span', 'mm-tr-meta'), pChev = ic('chevron'); pChev.className = 'mm-ic mm-tr-chev';
      pHead.append(h('span', 'mm-rl', {}, 'Presets'), pName, pChev);
      const pBody = h('div', 'mm-tr-pb'); pBody.hidden = true;
      const tabs = h('div', 'mm-seg mm-tr-seg mm-tr-tabs', { role: 'radiogroup', 'aria-label': 'Preset source' }), tabThumb = h('i', 'mm-seg-thumb', { 'aria-hidden': 'true' });
      let tab: 'defaults' | 'custom' = 'defaults';
      tabs.append(tabThumb, ...(['defaults', 'custom'] as const).map(t => {
        const b = h('button', '', { type: 'button', role: 'radio', 'data-v': t }, t === 'defaults' ? 'Defaults' : 'Custom');
        b.addEventListener('click', () => { if (tab !== t) { tab = t; renderList(); } });
        return b;
      }));
      arrows(tabs, 'button', b => b.click());
      const list = h('div', 'mm-tr-list', { role: 'listbox', 'aria-label': 'Presets' });
      arrows(list, '.mm-tr-pick');
      const saveB = h('button', 'mm-tr-save', { type: 'button' });
      saveB.addEventListener('click', () => {
        const cs = loadCustoms(), m = mode();
        if (cs.some(p => p.mode === m && matches(p.value, val(), m))) return;
        cs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nextCustomName(cs, m), mode: m, value: clone(val()) });
        tab = 'custom'; saveCustoms();
      });
      pBody.append(tabs, list, saveB);
      let listKey = '';
      const renderList = (force = false) => {
        const m = mode(), cs = loadCustoms(), key = `${m}|${tab}|${cs.map(p => p.id).join(',')}`;
        if (key !== listKey || force) {
          listKey = key;
          const rows = tab === 'defaults' ? builtIns(m).map(p => ({ ...p, id: '' })) : cs.filter(p => p.mode === m);
          list.replaceChildren(...rows.map(p => {
            const pick = h('button', 'mm-tr-pick', { type: 'button', role: 'option', 'data-name': p.name, 'aria-selected': 'false' }, thumb(p.value), h('span', 'mm-rl', {}, p.name));
            pick.append(Object.assign(ic('check'), { className: 'mm-ic mm-check' }));
            pick.addEventListener('click', () => set(pickPreset(val(), p.value, m)));
            const row = h('div', 'mm-tr-pi', {}, pick);
            if (p.id) {
              const del = h('button', 'mm-tr-del', { type: 'button', 'aria-label': `Delete ${p.name}`, title: 'Delete' }, ic('trash'));
              del.addEventListener('click', () => { const i = cs.findIndex(x => x.id === p.id); if (i >= 0) { cs.splice(i, 1); saveCustoms(); } });
              row.append(del);
            }
            return row;
          }));
          if (!rows.length) list.append(h('div', 'mm-empty', {}, 'Nothing saved yet'));
          tabs.querySelectorAll<HTMLElement>('button').forEach(b => { const a = b.dataset.v === tab; b.setAttribute('aria-checked', String(a)); b.tabIndex = a ? 0 : -1; });
          const on = tabs.querySelector<HTMLElement>('[aria-checked=true]');
          requestAnimationFrame(() => { if (on?.offsetWidth) { tabThumb.style.width = on.offsetWidth + 'px'; tabThumb.style.transform = `translateX(${on.offsetLeft}px)`; } });
        }
        const nm = name();
        list.querySelectorAll<HTMLElement>('.mm-tr-pick').forEach(b => b.setAttribute('aria-selected', String(b.dataset.name === nm)));
        const saved = cs.find(p => p.mode === m && matches(p.value, val(), m));
        saveB.textContent = saved ? `Saved as ${saved.name}` : `Save current ${m === 'easing' ? 'curve' : 'spring'}`;
        saveB.toggleAttribute('disabled', !!saved);
      };
      /** the tab to open on: Custom when the value is one of yours and not a built-in */
      const pickTab = () => {
        const m = mode(), v = val();
        tab = loadCustoms().some(p => p.mode === m && matches(p.value, v, m)) && !builtIns(m).some(p => matches(p.value, v, m)) ? 'custom' : 'defaults';
      };
      pHead.addEventListener('click', () => {
        const open = pBody.hidden;
        pBody.hidden = !open; pHead.setAttribute('aria-expanded', String(open));
        if (open) { pickTab(); renderList(true); requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; }); }
      });

      const body = h('div', 'mm-tr-body', {}, top, stage, gEase, gTime, gPhys, sDur.el, settleRow, pHead, pBody);
      const hd = head(c.cfg.title, c.cfg.label, acts);
      if (!hd) top.append(acts);
      root.append(...(hd ? [hd] : []), body);
      pc.replaceChildren(root);

      let shownMode: TransitionMode | null = null;
      ui = {
        sync() {
          const m = mode(), v = val(), modeChanged = m !== shownMode; shownMode = m;
          syncSeg();
          stage.classList.toggle('ease', m === 'easing');
          gEase.hidden = m !== 'easing'; gTime.hidden = m !== 'time'; gPhys.hidden = m !== 'physics';
          sDur.el.hidden = m === 'physics'; settleRow.hidden = m !== 'physics';
          if (v.type === 'easing') {
            if (modeChanged) { cancelAnimationFrame(tween); drawEase(v.ease); lastChange = performance.now(); } else showEase(v.ease);
            handles.forEach((hb, i) => hb.setAttribute('aria-label', `Handle ${i + 1}: x ${n2(v.ease[i * 2])}, y ${n2(v.ease[i * 2 + 1])}`));
            inputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = n2(v.ease[i]); });
            sIntensity.sync();
          } else {
            drawSpring(v);
            if (m === 'time') sBounce.sync(); else { sStiff.sync(); sDamp.sync(); sMass.sync(); settleV.textContent = n2(settle(toPhysics(v as never))) + 's'; }
          }
          if (m !== 'physics') sDur.sync();
          pName.textContent = name();
          if (!pBody.hidden) { if (modeChanged) pickTab(); renderList(); }
          syncPaste();
        },
        peer() { syncPaste(); pName.textContent = name(); if (!pBody.hidden) renderList(); drawTrigger(); },
      };
      ui.sync();
    },
    onOpen: pc => { ui?.peer(); return pc.querySelector<HTMLElement>('.mm-tr-seg:not([hidden]) [aria-checked=true]') ?? pc.querySelector<HTMLElement>('.mm-tr-stage.ease .mm-tr-h'); },
  };
};

