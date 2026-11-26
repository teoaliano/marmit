/* color control: a bar trigger showing the colour, and a panel with format tabs, a 2D field, hue and opacity, an
   eyedropper, channel fields and preset swatches. The value is a CSS colour string in the current format; the panel
   works on an OKLCH model so switching formats never loses the colour. `picker: false` keeps only the swatches. */
import type { ColorFormat } from '../types';
import { arrows, h, head, trigger, type Build } from './dom';
import { scrub } from './num';
import {
  ACHROMA, ALPHA, CHANNELS, clamp01, channels, detect, format, fromChannels, fromHsv, gamutOf, hslRgb, hsvRgb, limit,
  maxChroma, parse, toGamut, toHsv, toRgb, type Channel, type Lch, type Space,
} from './color-math';

const SWATCHES = ['#111111', '#6b6b73', '#e4e4e7', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
const FORMATS: { value: ColorFormat; label: string; aria?: string }[] = [
  { value: 'hex', label: 'Hex' }, { value: 'rgb', label: 'RGB' }, { value: 'hsl', label: 'HSL' }, { value: 'oklch', label: 'OKLCH' }, { value: 'p3', label: 'P3', aria: 'Display P3' },
];
const FW = 240, FH = 150;
const PLANE_LABEL = { hsv: 'saturation and brightness', hsl: 'saturation and lightness', oklch: 'chroma and lightness' };
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

interface Fld { root: HTMLElement; input: HTMLInputElement; sync(): void }

export const color: Build = (c, ctx) => {
  c.hasValue = true;
  const renderTrigger = trigger(c, ctx);
  const os = () => (c.cfg.options as string[] | undefined) ?? SWATCHES;
  const fmts = () => { const f = (c.cfg.formats as ColorFormat[] | undefined)?.filter(x => FORMATS.some(o => o.value === x)); return f?.length ? f : FORMATS.map(o => o.value); };
  const picker = () => c.cfg.picker !== false;
  let col: Lch = { l: 0, c: 0, h: 0, a: 1 }, fmt: ColorFormat = 'hex', last: string | undefined;
  let draw = () => {}, cleanup = () => {};
  const dot = h('span', 'mm-col-dot', { 'aria-hidden': 'true' });

  /** take c.value written from outside (config, controller.set): parse it and follow its format */
  const adopt = () => {
    const s = String(c.value ?? '');
    if (s === last) return;
    last = s;
    const p = parse(s); if (!p) return;
    // a grey keeps the hue it had, so the hue slider doesn't jump (hsl() carries its own hue)
    col = p.c < ACHROMA && detect(s) !== 'hsl' ? { ...p, h: col.h } : p;
    fmt = detect(s);
    // a format the tabs don't offer is rewritten in the first one that is
    if (picker() && !fmts().includes(fmt)) { fmt = fmts()[0]; c.value = last = format(col, fmt); }
  };
  /** the one way a user change lands: keep the model in the format's gamut, write it out, emit */
  const set = (x: Lch, f: ColorFormat = fmt, raw?: string) => {
    fmt = f; col = f === 'oklch' ? x : toGamut(x, gamutOf(f));
    const s = raw ?? format(col, fmt), was = c.value;
    c.value = last = s; c.apply();
    if (s !== was) ctx.emit(c, s);
  };

  c.render = () => {
    if (c.value === undefined) c.value = os()[Math.min(8, os().length - 1)];
    renderTrigger();
    const t = c.trigger!; t.classList.add('mm-col-trig'); t.classList.toggle('mm-col-bare', !c.cfg.icon);
    if (t.classList.contains('mm-pill')) t.prepend(dot); else t.append(dot);
  };
  c.apply = () => {
    adopt();
    c.trigger?.style.setProperty('--mm-swatch', String(c.value));
    draw();
  };
  c.destroy = () => cleanup();

  c.panel = {
    build(pc) {
      cleanup();
      const offs: (() => void)[] = [];
      cleanup = () => { offs.splice(0).forEach(f => f()); draw = () => {}; };
      const readout = h('span', 'mm-col-out');
      const hd = head(c.cfg.title, c.cfg.label, readout);

      /* ---- preset swatches (both modes) ---- */
      const g = h('div', 'mm-swg', { role: 'radiogroup', 'aria-label': picker() ? `${c.cfg.label} presets` : c.cfg.label });
      // the picker fits up to 8 a row, spread so the rows come out even (12 → 6 + 6, not 8 + 4)
      const n = os().length;
      g.style.setProperty('--cols', String(c.cfg.columns ?? (picker() ? Math.ceil(n / Math.ceil(n / 8)) || 8 : 6)));
      const sw = os().map(v => {
        const p = parse(v), b = h('button', '', { type: 'button', role: 'radio', 'data-v': v, 'aria-label': v });
        b.style.setProperty('--c', v);
        b.addEventListener('click', () => {
          if (!p) return;
          // swatches-only keeps the swatch string as given; the picker writes it in the current format
          if (!picker()) { if (c.value !== v) set(p, detect(v), v); }
          else set(p.c < ACHROMA ? { ...p, h: col.h } : p);
        });
        g.append(b);
        return { b, hex: p && format(p, 'hex') };
      });
      arrows(g, 'button', b => b.click());
      const drawSw = () => {
        const cur = format(col, 'hex');
        sw.forEach(({ b, hex }) => { const on = picker() ? hex === cur : b.dataset.v === c.value; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
        if (!sw.some(s => s.b.tabIndex === 0) && sw[0]) sw[0].b.tabIndex = 0;
      };

      if (!picker()) {
        const prev = h('div', 'mm-prev'), pa = h('span');
        prev.append(h('span', '', {}, 'Preview'), pa);
        pc.replaceChildren(...[hd].filter(Boolean) as Node[], g, prev);
        draw = () => {
          readout.textContent = String(c.value).toUpperCase(); prev.style.background = String(c.value);
          pa.textContent = Math.round(col.a * 100) + '%'; drawSw();
        };
        draw();
        return;
      }

      /* ---- format tabs ---- */
      const seg = h('div', 'mm-seg mm-col-fmt', { role: 'radiogroup', 'aria-label': 'Colour format' }), thumb = h('i', 'mm-seg-thumb', { 'aria-hidden': 'true' });
      seg.append(thumb);
      const tabs = FORMATS.filter(o => fmts().includes(o.value)).map(o => {
        const b = h('button', '', { type: 'button', role: 'radio', 'data-v': o.value, 'aria-label': o.aria }, o.label);
        b.addEventListener('click', () => { if (fmt !== o.value) set(col, o.value); });
        seg.append(b); return b;
      });
      arrows(seg, 'button', b => b.click());
      seg.hidden = tabs.length < 2;
      let thumbAt = '';
      const placeThumb = () => {
        const on = tabs.find(b => b.dataset.v === fmt); if (!on || !on.offsetWidth) return;
        const key = on.offsetLeft + ':' + on.offsetWidth; if (key === thumbAt) return;
        // no slide the first time it's placed (the panel just opened)
        if (!thumbAt) thumb.style.transition = 'none';
        thumbAt = key; thumb.style.width = on.offsetWidth + 'px'; thumb.style.transform = `translateX(${on.offsetLeft}px)`;
        if (thumb.style.transition) { void thumb.offsetWidth; thumb.style.transition = ''; }
      };

      /* ---- 2D field ---- */
      const plane = h('div', 'mm-col-plane', { role: 'group', tabindex: 0, 'aria-roledescription': '2D slider' });
      let cv = h('canvas', '', { width: FW, height: FH, 'aria-hidden': 'true' });
      const mark = h('span', 'mm-col-mark', { 'aria-hidden': 'true' });
      plane.append(cv, mark);
      const fam = () => fmt === 'oklch' ? 'oklch' : fmt === 'hsl' ? 'hsl' : 'hsv';
      const sp = (): Space => gamutOf(fmt);
      // the last x, kept for colours where it is undefined (black, white, a hue with no chroma)
      let memX = 0;
      const hueNow = () => fam() === 'oklch' ? col.h : fam() === 'hsl' ? channels(col, 'hsl')[0] : toHsv(col, sp())[0];
      const xy = () => {
        if (fam() === 'hsv') { const [, s, v] = toHsv(col, sp()); if (v > 0) memX = s; return { x: memX, y: 1 - v }; }
        if (fam() === 'hsl') { const [, s, l] = channels(col, 'hsl'); if (l > 0 && l < 100) memX = s / 100; return { x: memX, y: 1 - l / 100 }; }
        const m = maxChroma(col.l, col.h, sp()); if (m > 0) memX = clamp01(col.c / m);
        return { x: memX, y: 1 - col.l };
      };
      const fromXY = (x: number, y: number, hue = hueNow()): Lch => {
        memX = x;
        if (fam() === 'hsv') return fromHsv(hue, x, 1 - y, col.a, sp());
        if (fam() === 'hsl') return fromChannels([hue, x * 100, (1 - y) * 100], 'hsl', col.a);
        return { ...col, l: 1 - y, c: x * maxChroma(1 - y, hue, sp()), h: hue };
      };
      const at = (e: PointerEvent) => { const r = plane.getBoundingClientRect(); set(fromXY(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height))); };
      plane.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); plane.focus({ preventScroll: true }); plane.setPointerCapture(e.pointerId); plane.classList.add('drag'); at(e); });
      plane.addEventListener('pointermove', e => { if (plane.hasPointerCapture(e.pointerId)) at(e); });
      const up = (e: PointerEvent) => { plane.classList.remove('drag'); if (plane.hasPointerCapture(e.pointerId)) plane.releasePointerCapture(e.pointerId); };
      plane.addEventListener('pointerup', up); plane.addEventListener('pointercancel', up);
      plane.addEventListener('keydown', e => {
        const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
        if (!d || e.altKey || e.metaKey || e.ctrlKey) return;
        e.preventDefault(); e.stopPropagation();
        const k = e.shiftKey ? .1 : .01, p = xy();
        set(fromXY(clamp01(p.x + d[0] * k), clamp01(p.y + d[1] * k)));
      });
      // a canvas's colour space is fixed by its first getContext, so a new space needs a new canvas
      let cvSpace: Space | undefined, g2: CanvasRenderingContext2D | null = null, out: Space = 'srgb', painted = '', raf = 0;
      const ctx2 = (s: Space) => {
        if (cvSpace === s) return g2;
        if (cvSpace) { const n = cv.cloneNode() as HTMLCanvasElement; cv.replaceWith(n); cv = n; }
        cvSpace = s;
        try { g2 = cv.getContext('2d', { colorSpace: s === 'p3' ? 'display-p3' : 'srgb' } as CanvasRenderingContext2DSettings); } catch { g2 = null; }
        out = (g2 as any)?.getContextAttributes?.().colorSpace === 'display-p3' ? 'p3' : 'srgb';
        return g2;
      };
      const paint = () => {
        const f = fam(), s = sp(), hue = hueNow(), key = `${f}:${s}:${hue}`;
        if (key === painted) return;
        const g = ctx2(s); if (!g) return;
        painted = key;
        const img = g.createImageData(FW, FH), px = img.data;
        for (let j = 0; j < FH; j++) {
          const v = 1 - j / (FH - 1), mc = f === 'oklch' ? maxChroma(v, hue, s) : 0;
          for (let i = 0; i < FW; i++) {
            const x = i / (FW - 1);
            const rgb = f === 'hsv' && out === s ? hsvRgb(hue, x, v) : f === 'hsl' && out === 'srgb' ? hslRgb(hue, x, v)
              : toRgb(f === 'hsv' ? fromHsv(hue, x, v, 1, s) : f === 'hsl' ? fromChannels([hue, x * 100, v * 100], 'hsl') : { l: v, c: x * mc, h: hue, a: 1 }, out);
            const o = (j * FW + i) * 4;
            px[o] = Math.round(clamp01(rgb[0]) * 255); px[o + 1] = Math.round(clamp01(rgb[1]) * 255); px[o + 2] = Math.round(clamp01(rgb[2]) * 255); px[o + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
      };
      offs.push(() => cancelAnimationFrame(raf));

      /* ---- hue and opacity ---- */
      const range = (label: string, max: number, step: number, cls: string) => h('input', 'mm-col-range ' + cls, { type: 'range', min: 0, max, step, 'aria-label': label });
      const hue = range('Hue', 360, .1, 'hue'), op = range('Opacity', 100, 1, 'op');
      hue.addEventListener('input', () => { const p = xy(); set(fromXY(p.x, p.y, +hue.value)); });
      op.addEventListener('input', () => set({ ...col, a: +op.value / 100 }));
      const tracks = h('div', 'mm-col-tracks', {}, hue);
      if (c.cfg.alpha !== false) tracks.append(op);
      let hueBg = '';
      const hueTrack = (p: { x: number; y: number }) => {
        const f = fam(), s = sp(), stops = Array.from({ length: 73 }, (_, i) => {
          const g = i * 5;
          if (f === 'hsl') return `hsl(${g} ${(p.x * 100).toFixed(2)}% ${((1 - p.y) * 100).toFixed(2)}%)`;
          if (f === 'hsv') return format(fromHsv(g, p.x, 1 - p.y, 1, s), s === 'p3' ? 'p3' : 'rgb');
          return format({ l: col.l, c: p.x * maxChroma(col.l, g, s), h: g, a: 1 }, 'oklch');
        });
        return `linear-gradient(to right${f === 'oklch' ? ' in oklab' : s === 'p3' ? ' in display-p3' : ''}, ${stops.join(', ')})`;
      };

      /* ---- channel fields ---- */
      const isOpen = () => !!c.pc?.classList.contains('on');
      /** a text field: focus selects all; change or Enter commits; bad text is flagged and reverts on blur */
      const textField = (label: string, show: () => string, commit: (t: string) => boolean, cls = '') => {
        const root = h('label', 'mm-fld mm-col-fld ' + cls), input = h('input', 'mm-col-in', { type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': label });
        root.append(input);
        let shown = '';
        const reset = () => { input.value = shown = show(); input.removeAttribute('aria-invalid'); };
        // closing the panel (outside click, Escape) blurs the field: that reverts instead of committing
        const go = () => { if (!isOpen()) return reset(); if (commit(input.value.trim())) reset(); else input.setAttribute('aria-invalid', 'true'); };
        input.addEventListener('change', go);
        input.addEventListener('focus', () => input.select());
        input.addEventListener('blur', () => { if (input.getAttribute('aria-invalid')) reset(); });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); go(); input.select(); }
          // Escape first throws away an edit; with nothing to revert it falls through and closes the panel
          else if (e.key === 'Escape' && input.value !== shown) { e.preventDefault(); reset(); input.select(); }
        });
        const sync = () => {
          const focused = document.activeElement === input;
          if (focused && input.value !== shown) return; // don't overwrite what's being typed
          const all = input.selectionStart === 0 && input.selectionEnd === input.value.length;
          reset(); if (focused && all) input.select();
        };
        return { root, input, sync, reset };
      };
      /** a number field: the channel letter (or Alpha's %) scrubs, ↑↓ step to the next multiple, Shift ×10 */
      const numField = (ch: Channel, label: string, read: () => number, write: (v: number) => void, unit = false): Fld => {
        const strip = (t: string) => t ? Number(t.replace(/\s*(%|°|deg)$/i, '')) : NaN;
        const put = (v: number) => { const b = limit(ch, Number(v.toFixed(ch.digits))); if (b !== Number(read().toFixed(ch.digits))) write(b); f.reset(); };
        const f = textField(label, () => read().toFixed(ch.digits), t => { const n = strip(t); if (Number.isFinite(n)) put(n); return Number.isFinite(n); }, unit ? 'unit' : '');
        const { input } = f;
        input.setAttribute('role', 'spinbutton'); input.inputMode = 'decimal';
        input.setAttribute('aria-valuemin', '0'); if (Number.isFinite(ch.max)) input.setAttribute('aria-valuemax', String(ch.max));
        input.addEventListener('keydown', e => {
          if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.metaKey || e.ctrlKey) return;
          e.preventDefault(); e.stopPropagation();
          const n = strip(input.value.trim()), q = (Number.isFinite(n) ? n : read()) / ch.step, k = e.shiftKey ? 10 : 1;
          put((e.key === 'ArrowUp' ? Math.floor(q + 1e-9) + k : Math.ceil(q - 1e-9) - k) * ch.step);
          input.select();
        });
        const handle = h('span', 'mm-fld-ax', { 'aria-hidden': 'true' }, ch.name);
        if (unit) f.root.append(handle); else f.root.prepend(handle);
        offs.push(scrub(handle, { get: read, set: v => { put(v); return read(); }, perPx: () => ch.step }));
        return { root: f.root, input, sync: () => { input.setAttribute('aria-valuenow', read().toFixed(ch.digits)); f.sync(); } };
      };
      // channel values typed in one format are kept while the colour still matches them, so a lossy round trip
      // (RGB → OKLCH → RGB) doesn't make the numbers drift
      let cache: { key: string; values: number[] } | null = null;
      const cur = (f: Exclude<ColorFormat, 'hex'>) => cache?.key === format({ ...col, a: 1 }, f) ? cache.values : channels(col, f);
      const alphaF = numField(ALPHA, 'Alpha percentage', () => col.a * 100, v => set({ ...col, a: v / 100 }), true);
      const hexF = (): Fld => textField('Hex value', () => format({ ...col, a: 1 }, 'hex'), t => {
        const hx = t.replace(/^#?/, '#');
        if (/^#[\da-f]+$/i.test(hx)) {
          const p = parse(hx); if (!p) return false;
          // 3 or 6 digits keep the current alpha; 4 or 8 set it
          const x = { ...p, a: hx.length === 5 || hx.length === 9 ? p.a : col.a };
          if (format(x, 'hex') !== format(col, 'hex')) set(x.c < ACHROMA ? { ...x, h: col.h } : x);
          return true;
        }
        const p = parse(t); if (p) set(p, detect(t));
        return !!p;
      }, 'hex');
      const flds = h('div', 'mm-col-flds');
      let chF: Fld[] = [], chFor: ColorFormat | undefined;
      const buildFields = () => {
        const f = fmt, tab = FORMATS.find(o => o.value === f)!;
        const made = f === 'hex' ? [hexF()] : CHANNELS[f].map((ch, i) => numField(ch, `${tab.aria ?? tab.label} ${ch.label}`, () => cur(f)[i], v => {
          const vals = cur(f).slice(); vals[i] = v;
          const x = fromChannels(vals, f, col.a), keep = f === 'oklch' || f === 'hsl' || x.c > ACHROMA ? x : { ...x, h: col.h };
          cache = { key: format({ ...keep, a: 1 }, f), values: vals };
          set(keep);
        }));
        const fi = chF.findIndex(x => x.input === document.activeElement);
        chF.forEach(x => x.root.remove());
        flds.prepend(...made.map(x => x.root));
        chF = made; chFor = f; cache = null;
        if (fi >= 0) { const n = made[fi] ?? made[0]; n.sync(); n.input.focus({ preventScroll: true }); n.input.select(); }
      };
      if (c.cfg.alpha !== false) flds.append(alphaF.root);

      const row = h('div', 'mm-col-row');
      const ED = (globalThis as any).EyeDropper;
      if (ED) {
        const eye = h('button', 'mm-btn mm-col-eye', { type: 'button', 'aria-label': 'Pick a colour from the screen' });
        eye.innerHTML = EYE;
        let pending: AbortController | undefined;
        eye.addEventListener('click', async () => {
          pending?.abort();
          const ac = pending = new AbortController();
          try {
            const p = parse((await new ED().open({ signal: ac.signal })).sRGBHex);
            if (p && !ac.signal.aborted) set({ ...p, a: col.a });
          } catch { /* cancelled */ }
          if (pending === ac) pending = undefined;
        });
        offs.push(() => pending?.abort());
        row.append(eye);
      }
      row.append(flds);

      const wrap = h('div', 'mm-col', {}, ...[hd].filter(Boolean) as Node[], seg, plane, tracks, row);
      if (os().length) wrap.append(g);
      pc.replaceChildren(wrap);

      draw = () => {
        readout.textContent = String(c.value);
        const p = xy(), hv = hueNow(), solid = format({ ...col, a: 1 }, 'oklch');
        plane.setAttribute('aria-label', `${c.cfg.label} colour field: arrow keys adjust ${PLANE_LABEL[fam()]}`);
        plane.setAttribute('aria-valuetext', `${Math.round(p.x * 100)}%, ${Math.round((1 - p.y) * 100)}%`);
        mark.style.left = p.x * 100 + '%'; mark.style.top = p.y * 100 + '%'; mark.style.background = solid;
        hue.value = String(hv); op.value = String(col.a * 100);
        hue.setAttribute('aria-valuetext', `${Math.round(hv)} degrees`); op.setAttribute('aria-valuetext', `${Math.round(col.a * 100)} percent`);
        const hk = `${fam()}:${sp()}:${p.x.toFixed(4)}:${p.y.toFixed(4)}:${col.l.toFixed(4)}`;
        if (hk !== hueBg) { hueBg = hk; hue.style.setProperty('--mm-col-track', hueTrack(p)); }
        wrap.style.setProperty('--mm-col-solid', solid);
        tabs.forEach(b => { const on = b.dataset.v === fmt; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
        placeThumb(); requestAnimationFrame(placeThumb);
        if (chFor !== fmt) buildFields();
        chF.forEach(x => x.sync()); alphaF.sync(); drawSw();
        cancelAnimationFrame(raf); raf = requestAnimationFrame(paint);
      };
      draw();
    },
    onOpen: pc => pc.querySelector<HTMLElement>('.mm-col-fmt:not([hidden]) [aria-checked=true]') ?? pc.querySelector<HTMLElement>('.mm-col-plane') ?? pc.querySelector<HTMLElement>('[aria-checked=true]'),
  };
};
