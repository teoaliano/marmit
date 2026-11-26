/* Number handling shared by every control that edits numbers: one step grid, one keyboard rule, one scrub gesture and
   one click-to-type field, so a value behaves the same wherever it appears. */
import { clamp } from '../physics';

/** snap to the step grid anchored at `min` (not 0), clamped; landing exactly on min or max is kept */
export function snapGrid(v: number, step: number, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(v)) return Number.isFinite(min) ? min : 0;
  v = clamp(v, min, max);
  if (v === min || v === max || !(step > 0)) return v;
  const base = Number.isFinite(min) ? min : 0;
  return clamp(Number((base + Math.round((v - base) / step) * step).toPrecision(14)), min, max);
}

/** decimals needed to show values on this grid: the most decimals among step, min and max */
export function decimals(...ns: (number | undefined)[]) {
  let d = 0;
  for (const n of ns) {
    if (n === undefined || !Number.isFinite(n)) continue;
    const s = String(n), e = s.match(/e-(\d+)$/);
    d = Math.max(d, e ? +e[1] + ((s.split('e')[0].split('.')[1] || '').length) : (s.split('.')[1] || '').length);
  }
  return Math.min(d, 10);
}

/** a unit after a value: a space only before a word unit ("2 px"), none before a symbol ("45°", "1.5×", "80%") */
export const withUnit = (text: string, unit?: string) => !unit ? text : /^\p{L}/u.test(unit) ? `${text} ${unit}` : text + unit;

/** the value a key press moves to, or null if the key isn't a stepping key. Arrows step once; Page keys or Shift step
    ten times. Stepping lands on the next grid point, so an off-grid value snaps first. Home/End go to the ends. */
export function stepKey(key: string, v: number, min: number, max: number, step: number, shift: boolean): number | null {
  if (key === 'Home') return Number.isFinite(min) ? min : null;
  if (key === 'End') return Number.isFinite(max) ? max : null;
  const dir = ({ ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 } as Record<string, number>)[key];
  if (!dir) return null;
  const n = key.startsWith('Page') || shift ? 10 : 1, base = Number.isFinite(min) ? min : 0, g = (v - base) / step;
  const i = dir > 0 ? Math.floor(g + 1e-9) + n : Math.ceil(g - 1e-9) - n;
  return snapGrid(base + i * step, step, min, max);
}

export interface ScrubOptions {
  get(): number;
  /** write a value; return what was actually stored (after clamping and snapping) */
  set(v: number): number;
  /** value per pixel of drag (Shift multiplies it by 10) */
  perPx(): number;
  /** pixels of travel before a press becomes a drag (default 3) */
  threshold?: number;
  onStart?(): void;
  onEnd?(changed: boolean): void;
  /** a press that never became a drag */
  onTap?(e: PointerEvent): void;
}

/** Drag a handle sideways to change a number, like a label you can scrub. Escape during the drag puts the value back,
    and the click that follows a drag is swallowed. Sub-step motion accumulates, so slow drags still move. */
export function scrub(handle: HTMLElement, o: ScrubOptions) {
  let st: { id: number; x: number; last: number; start: number; acc: number; on: boolean } | null = null;
  const threshold = o.threshold ?? 3;
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', e => {
    if (e.button) return;
    e.stopPropagation(); e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    handle.setPointerCapture(e.pointerId);
    const v = o.get(); st = { id: e.pointerId, x: e.clientX, last: e.clientX, start: v, acc: v, on: false };
  });
  handle.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.on) { if (Math.abs(e.clientX - st.x) < threshold) return; st.on = true; st.last = e.clientX; handle.classList.add('mm-scrubbing'); document.documentElement.classList.add('mm-scrub'); o.onStart?.(); }
    const dx = e.clientX - st.last; st.last = e.clientX;
    const per = o.perPx() * (e.shiftKey ? 10 : 1);
    st.acc += dx * per;
    const stored = o.set(st.acc);
    // keep the sub-step remainder, so slow drags still move; resync only when the stored value is more than half a
    // step away (it was clamped at an end), so dragging back responds at once
    if (Math.abs(stored - st.acc) > Math.abs(o.perPx()) / 2) st.acc = stored;
  });
  const end = (e: PointerEvent, cancel = false) => {
    if (!st || e.pointerId !== st.id) return;
    const was = st; st = null;
    handle.classList.remove('mm-scrubbing'); document.documentElement.classList.remove('mm-scrub');
    if (was.on) {
      if (cancel) o.set(was.start);
      o.onEnd?.(o.get() !== was.start);
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      handle.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => handle.removeEventListener('click', swallow, { capture: true }), 0);
    } else o.onTap?.(e);
  };
  handle.addEventListener('pointerup', e => end(e));
  handle.addEventListener('pointercancel', e => end(e, true));
  handle.addEventListener('keydown', e => {
    if (e.key === 'Escape' && st?.on) { e.preventDefault(); e.stopPropagation(); const id = st.id; end({ pointerId: id } as PointerEvent, true); try { handle.releasePointerCapture(id); } catch { /* gone */ } }
  });
  // Escape anywhere while scrubbing
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && st?.on) { e.preventDefault(); e.stopPropagation(); const id = st.id; end({ pointerId: id } as PointerEvent, true); try { handle.releasePointerCapture(id); } catch { /* gone */ } } };
  addEventListener('keydown', esc, true);
  return () => removeEventListener('keydown', esc, true);
}

export interface EditOptions {
  get(): number;
  /** commit a typed number (already finite); the control clamps and snaps */
  commit(v: number): void;
  /** the text shown in the input when it opens */
  text(): string;
  /** step keys inside the input; return the stepped value or null */
  step?(key: string, v: number, shift: boolean): number | null;
  label?: string;
}

/** Click a value to type a new one: it turns into a focused input with its text selected. Enter or blur commits,
    Escape cancels; text that isn't a number is ignored. A trailing unit ("50%") is allowed. */
export function clickToType(valueEl: HTMLElement, o: EditOptions) {
  let input: HTMLInputElement | null = null;
  const open = () => {
    if (input) return;
    input = document.createElement('input');
    input.type = 'text'; input.className = 'mm-num-input'; input.spellcheck = false; input.inputMode = 'decimal';
    input.setAttribute('aria-label', o.label ?? 'Value');
    input.value = o.text();
    input.style.width = Math.max(3, input.value.length + 1) + 'ch';
    valueEl.hidden = true; valueEl.after(input);
    input.focus({ preventScroll: true }); input.select();
    let done = false;
    const close = (commit: boolean) => {
      if (done || !input) return; done = true;
      const t = input.value.trim().replace(/[^\d.eE+-]+$/u, ''), n = parseFloat(t);
      if (commit && t !== o.text() && Number.isFinite(n)) o.commit(n);
      input.remove(); input = null; valueEl.hidden = false;
    };
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); close(true); valueEl.focus?.({ preventScroll: true }); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); valueEl.focus?.({ preventScroll: true }); }
      else if (o.step && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key.startsWith('Page'))) {
        const cur = parseFloat(input!.value), nv = o.step(e.key, Number.isFinite(cur) ? cur : o.get(), e.shiftKey);
        if (nv !== null) { e.preventDefault(); o.commit(nv); input!.value = o.text(); input!.select(); }
      }
    });
    input.addEventListener('input', () => { input!.style.width = Math.max(3, input!.value.length + 1) + 'ch'; });
    input.addEventListener('blur', () => close(true));
    input.addEventListener('pointerdown', e => e.stopPropagation());
  };
  valueEl.addEventListener('click', e => { e.stopPropagation(); open(); });
  valueEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(); } });
  return { open, get editing() { return !!input; } };
}
