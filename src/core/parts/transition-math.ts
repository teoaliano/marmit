/* The transition editor's maths, kept free of the DOM so it can be tested: spring physics, the bézier plot's fit and
   handle nudging, curve parsing, the intensity mapping and the preset lists. Numbers follow the DialKit fork. */
import type { EasingTransition, PhysicsSpring, TimeSpring, Transition, TransitionMode } from '../types';

export type Ease = [number, number, number, number];
export interface Phys { stiffness: number; damping: number; mass: number }
export const MODES: TransitionMode[] = ['easing', 'time', 'physics'];
export const MODE_LABEL: Record<TransitionMode, string> = { easing: 'Easing', time: 'Time', physics: 'Physics' };

/** where a fresh tab starts */
export const DEFAULTS: { easing: EasingTransition; time: TimeSpring; physics: PhysicsSpring } = {
  easing: { type: 'easing', duration: 0.3, ease: [1, -0.4, 0.5, 1] },
  time: { type: 'spring', visualDuration: 0.3, bounce: 0.2 },
  physics: { type: 'spring', stiffness: 200, damping: 25, mass: 1 },
};

const fin = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const clampY = (v: number) => clamp(v, -1, 2);
const r = (v: number, d: number) => Number(v.toFixed(d));

/** a spring is "physics" when it has stiffness, damping or mass and none of the by-feel fields */
export function modeOf(v: Partial<Transition> & { type?: string }): TransitionMode {
  if (v?.type === 'easing') return 'easing';
  const a = v as Record<string, unknown>, phys = a.stiffness !== undefined || a.damping !== undefined || a.mass !== undefined;
  return phys && a.visualDuration === undefined && a.bounce === undefined ? 'physics' : 'time';
}

/** non-finite entries fall back to linear's, x values are clamped to [0,1] */
export const normEase = (e: unknown): Ease => {
  const a = Array.isArray(e) ? e : [];
  return [0, 1, 2, 3].map(i => { const v = fin(a[i], i < 2 ? 0 : 1); return i % 2 === 0 ? clamp(v, 0, 1) : v; }) as Ease;
};

/** a clean value of exactly one mode's shape, whatever came in */
export function normalize(v: unknown, mode?: TransitionMode): Transition {
  const a = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const m = mode ?? modeOf(a as Partial<Transition>);
  if (m === 'easing') return { type: 'easing', duration: fin(a.duration, DEFAULTS.easing.duration), ease: normEase(a.ease ?? DEFAULTS.easing.ease) };
  if (m === 'time') return { type: 'spring', visualDuration: fin(a.visualDuration, DEFAULTS.time.visualDuration), bounce: fin(a.bounce, DEFAULTS.time.bounce) };
  return { type: 'spring', stiffness: fin(a.stiffness, DEFAULTS.physics.stiffness), damping: fin(a.damping, DEFAULTS.physics.damping), mass: fin(a.mass, DEFAULTS.physics.mass) };
}

/* ---------- springs ---------- */
/** a spring by feel as physics: stiffness from the visual duration, damping from the bounce, mass 1 */
export function toPhysics(v: Partial<TimeSpring & PhysicsSpring>): Phys {
  if (v.stiffness !== undefined || v.damping !== undefined || v.mass !== undefined)
    return { stiffness: v.stiffness ?? 200, damping: v.damping ?? 25, mass: v.mass ?? 1 };
  const d = Math.max(0.05, v.visualDuration ?? 0.3), b = v.bounce ?? 0.3, w = 2 * Math.PI / (d * 1.2), k = w * w;
  return { stiffness: k, damping: 2 * clamp(1 - b, 0.05, 1) * Math.sqrt(k), mass: 1 };
}

/** step response of a damped oscillator released from 0 towards 1, at time t (s) */
export function springAt(t: number, { stiffness: k, damping: c, mass: m }: Phys) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z < 0.9999) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t)); }
  if (z < 1.0001) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const q = w0 * Math.sqrt(z * z - 1), a = -z * w0 + q, b = -z * w0 - q;
  return 1 + (b * Math.exp(a * t) - a * Math.exp(b * t)) / (a - b);
}

/** seconds until the motion is within 0.5% of rest: ln(200) over the decay rate, 0.05–10, to 0.01 */
export function settle(p: Phys) {
  const w0 = Math.sqrt(p.stiffness / p.mass), z = p.damping / (2 * Math.sqrt(p.stiffness * p.mass));
  const decay = z >= 1 ? z * w0 - w0 * Math.sqrt(Math.max(0, z * z - 1)) : z * w0;
  return Math.round(clamp(Math.log(200) / Math.max(decay, 1e-6), 0.05, 10) * 100) / 100;
}

/** how long a value takes to play: its duration, or a physics spring's settle time */
export const durationOf = (v: Transition) => v.type === 'easing' ? v.duration : 'visualDuration' in v ? v.visualDuration : settle(toPhysics(v));

/* ---------- bézier plot ---------- */
/** fit the curve into a w×h box: the scale shrinks when y handles leave [0,1], same scale on both axes */
export function fit(ease: Ease, w: number, h: number) {
  const e = normEase(ease), pad = Math.min(12, w / 4, h / 4), over = Math.max(0.5, Math.abs(e[1] - 0.5), Math.abs(e[3] - 0.5));
  const s = Math.min(w - pad * 2, (h / 2 - pad) / over), at = (x: number, y: number) => ({ x: w / 2 + (x - 0.5) * s, y: h / 2 - (y - 0.5) * s });
  return { scale: s, at, start: at(0, 0), end: at(1, 1), handles: [at(e[0], e[1]), at(e[2], e[3])] };
}

/** move handle `i` by (dx, dy) plot units at `scale` from `start`: x clamps to [0,1], y to [-1,2], both to 2dp; an
    axis with no motion is left exactly as it was */
export function nudge(start: Ease, i: 0 | 1, dx: number, dy: number, scale = 1): Ease {
  const out = [...start] as Ease;
  if (!Number.isFinite(scale) || scale <= 0) return out;
  const q = i * 2, x = start[q] + dx / scale, y = start[q + 1] - dy / scale;
  if (dx !== 0) out[q] = r(clamp(x, 0, 1), 2);
  if (dy !== 0 && Number.isFinite(y)) out[q + 1] = r(clampY(y), 2);
  return out;
}

/** arrow keys on a handle: 0.01, or 0.1 with Shift; ArrowUp raises y */
export function keyNudge(e: Ease, i: 0 | 1, key: string, shift: boolean): Ease | null {
  const d = shift ? 0.1 : 0.01;
  const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  return m[key] ? nudge(e, i, m[key][0], m[key][1]) : null;
}

/** "a, b, c, d" as a curve: four plain numbers, x values inside [0,1] (else null), y values clamped to [-1,2] */
export function parseCurve(text: string): Ease | null {
  const parts = text.split(',').map(s => s.trim());
  if (parts.length !== 4 || parts.some(s => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))) return null;
  const n = parts.map(Number);
  if (!n.every(Number.isFinite) || n[0] < 0 || n[0] > 1 || n[2] < 0 || n[2] > 1) return null;
  n[1] = clampY(n[1]); n[3] = clampY(n[3]);
  return n as Ease;
}

/** the tangent from an endpoint to a handle, stopping `gap` short of the handle's centre */
export function tangentEnd(from: { x: number; y: number }, to: { x: number; y: number }, gap = 5) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  return d <= gap ? { ...from } : { x: to.x - dx / d * gap, y: to.y - dy / d * gap };
}

/* ---------- intensity ---------- */
/** scale both handles towards (k<1) or away from (k>1) their endpoints; 0 is linear, 1 the curve itself */
export function intensify(e: Ease, k: number): Ease {
  const q = Math.max(0, k);
  if (q === 1) return [...e] as Ease;
  const x = (v: number) => r(clamp(v, 0, 1), 3), y = (v: number) => r(clampY(v), 3);
  return [x(q * e[0]), y(q * e[1]), x(1 + q * (e[2] - 1)), y(1 + q * (e[3] - 1))];
}

/** The Intensity slider's memory: when the curve changes from anywhere else, its shape becomes the new base at 50. */
export function intensity() {
  let base: Ease = [0, 0, 1, 1], last: Ease | undefined, q = 50;
  const read = (e: Ease) => { if (!last || last.some((v, i) => v !== e[i])) { base = [...e] as Ease; last = [...e] as Ease; q = 50; } return q; };
  return {
    read,
    apply(e: Ease, v: number): Ease { read(e); q = clamp(Math.round(v), 0, 100); last = intensify(base, q / 50); return [...last] as Ease; },
  };
}

/* ---------- presets ---------- */
export interface EasingPreset { name: string; ease: Ease }
export interface SpringPreset { name: string; physics: Phys; time: { visualDuration: number; bounce: number } }
export interface CustomPreset { id: string; name: string; mode: TransitionMode; value: Transition }

export const EASINGS: EasingPreset[] = ([
  ['Glide', [0.33, 0, 0, 1]], ['Sweep', [0.7, 0.101, 0.3, 0.899]], ['Settle', [0.8, 0.27, 0.2, 0.75]], ['Flip', [0.333, 0, 0.571, 1]],
  ['Natural', [0.8, 0, 0.2, 1]], ['Coast', [0.4, 0, 0, 1]], ['Elastic', [0.6, -0.85, 0, 1.65]], ['Slow', [0, 0, 0, 1]],
  ['Vive', [1, 0, 1, 1]], ['Anticipate', [1, -0.4, 0.35, 0.95]], ['Snappy Out', [0.19, 1, 0.22, 1]], ['Swift Out', [0.175, 0.885, 0.32, 1.1]],
  ['Linear', [0, 0, 1, 1]], ['Ease In', [0.33, 0, 1, 1]], ['Ease Out', [0, 0, 0.67, 1]], ['Ease In Out', [0.33, 0, 0.67, 1]],
  ['Sine In', [0.36, 0, 0.64, 0.48]], ['Sine Out', [0.33, 0.52, 0.64, 1]], ['Sine In Out', [0.36, 0, 0.63, 1]],
  ['Quad In', [0.26, 0, 0.6, 0.2]], ['Quad Out', [0.4, 0.8, 0.74, 1]], ['Quad In Out', [0.48, 0.04, 0.52, 0.96]],
  ['Cubic In', [0.4, 0, 0.68, 0.06]], ['Cubic Out', [0.32, 0.94, 0.6, 1]], ['Cubic In Out', [0.66, 0, 0.34, 1]],
  ['Quart In', [0.52, 0, 0.74, 0]], ['Quart Out', [0.26, 1, 0.48, 1]], ['Quart In Out', [0.76, 0, 0.24, 1]],
  ['Quint In', [0.64, 0, 0.78, 0]], ['Quint Out', [0.22, 1, 0.36, 1]], ['Quint In Out', [0.84, 0, 0.16, 1]],
  ['Expo In', [0.66, 0, 0.86, 0]], ['Expo Out', [0.14, 1, 0.34, 1]], ['Expo In Out', [0.9, 0, 0.1, 1]],
  ['Circ In', [0.54, 0, 1, 0.44]], ['Circ Out', [0, 0.56, 0.46, 1]], ['Circ In Out', [0.88, 0.14, 0.12, 0.86]],
  ['Back In', [0.6, -0.28, 0.73, 0.04]], ['Back Out', [0.17, 0.89, 0.32, 1.27]], ['Back In Out', [0.68, -0.55, 0.27, 1.55]],
] as [string, Ease][]).map(([name, ease]) => ({ name, ease }));

const sp = (name: string, stiffness: number, damping: number, mass: number, visualDuration: number, bounce: number): SpringPreset =>
  ({ name, physics: { stiffness, damping, mass }, time: { visualDuration, bounce } });
export const SPRINGS: SpringPreset[] = [
  sp('Crisp', 170, 26, 1, 0.4, 0), sp('Gentle', 120, 14, 1, 0.5, 0.35), sp('Wobbly', 180, 12, 1, 0.4, 0.55), sp('Stiff', 210, 20, 1, 0.35, 0.3),
  sp('Slow', 280, 60, 1, 1.05, 0), sp('Molasses', 125, 55, 1, 2.2, 0), sp('Buoyant', 900, 80, 10, 0.52, 0.6), sp('Elegant', 150, 19, 1.2, 0.46, 0.3),
  sp('Bob', 131.1, 2.3, 0.1, 0.14, 0.7), sp('Fling', 800, 80, 4, 0.37, 0.3), sp('Swift', 280, 18, 0.3, 0.21, 0), sp('Float', 290, 15, 2, 0.42, 0.7),
  sp('Drift', 26.7, 4.1, 0.2, 0.46, 0.1), sp('Snap', 320, 20, 0.4, 0.19, 0.1), sp('Stern', 550, 30, 1.2, 0.25, 0.4),
];

/** the built-in presets of one mode, as values (easings at duration 0.3) */
export function builtIns(mode: TransitionMode): { name: string; value: Transition }[] {
  if (mode === 'easing') return EASINGS.map(p => ({ name: p.name, value: { type: 'easing', duration: 0.3, ease: [...p.ease] as Ease } }));
  return SPRINGS.map(p => ({ name: p.name, value: { type: 'spring', ...(mode === 'time' ? p.time : p.physics) } as Transition }));
}

const near = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.005;
/** same preset: every field within ±0.005. Easing compares only the curve, so the duration doesn't matter. */
export function matches(a: Transition, b: Transition, mode: TransitionMode) {
  if (mode === 'easing') return a.type === 'easing' && b.type === 'easing' && a.ease.every((v, i) => near(v, b.ease[i]));
  if (a.type !== 'spring' || b.type !== 'spring') return false;
  const A = a as unknown as Record<string, number>, B = b as unknown as Record<string, number>;
  return (mode === 'time' ? ['visualDuration', 'bounce'] : ['stiffness', 'damping', 'mass']).every(k => near(A[k], B[k]));
}

/** the name to show for a value: a built-in first, then a saved one, else "Custom" */
export const presetName = (v: Transition, mode: TransitionMode, customs: CustomPreset[]) =>
  builtIns(mode).find(p => matches(p.value, v, mode))?.name ?? customs.find(p => p.mode === mode && matches(p.value, v, mode))?.name ?? 'Custom';

/** picking a preset: an easing keeps the current duration */
export function pickPreset(cur: Transition, preset: Transition, mode: TransitionMode): Transition {
  if (mode === 'easing') return { type: 'easing', duration: cur.type === 'easing' ? cur.duration : 0.3, ease: [...(preset as EasingTransition).ease] as Ease };
  return normalize(preset, mode);
}

/** "Custom N", one past the highest N already saved in this mode */
export function nextCustomName(customs: CustomPreset[], mode: TransitionMode) {
  let n = 0;
  for (const p of customs) { const m = p.mode === mode && /^Custom (\d+)$/.exec(p.name); if (m) n = Math.max(n, +m[1]); }
  return `Custom ${n + 1}`;
}
