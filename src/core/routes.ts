/* Routes for re-docking the bar on another side of its stage. A route is a list of points the bar's middle passes,
   evenly spaced in progress, and the bar's angle at each. Ported from the gooey-island motion study. */
import { clamp } from './physics';
import type { Side } from './types';

export const RN = 96;
export const horiz = (d: Side) => d === 'top' || d === 'bottom';

export interface Route {
  pts: [number, number][]; angs: number[];
  qx: number; qy: number; kind: 'slide' | 'swing' | 'arc' | 'line';
  ax: number; ay: number; bx: number; by: number; t0: number; t1: number; from: Side; bent: boolean;
  cum?: number[]; tot?: number;
}

export interface RouteEnv {
  dockAt(d: Side): [number, number];
  arc: number; corner: number; lift: number;
}

const lerpAt = (n: number, p: number) => { const f = clamp(p, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)); return [i, f - i] as const; };
export const along = (r: Route, p: number): [number, number] => {
  const [i, t] = lerpAt(r.pts.length, p), a = r.pts[i], b = r.pts[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};
export const angAt = (r: Route, p: number) => { const [i, t] = lerpAt(r.angs.length, p); return r.angs[i] + (r.angs[i + 1] - r.angs[i]) * t; };
export const slope = (r: Route, p: number): [number, number] => {
  const e = 1 / (RN - 1), a = along(r, Math.max(0, p - e)), b = along(r, Math.min(1, p + e)), d = Math.min(1, p + e) - Math.max(0, p - e) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};
const blendAng = (t0: number, t1: number, p: number) => Math.atan2((1 - p) * Math.sin(t0) + p * Math.sin(t1), (1 - p) * Math.cos(t0) + p * Math.cos(t1));
const quad = (ax: number, ay: number, qx: number, qy: number, bx: number, by: number) => Array.from({ length: RN }, (_, i) => {
  const p = i / (RN - 1), m = 1 - p;
  return [m * m * ax + 2 * m * p * qx + p * p * bx, m * m * ay + 2 * m * p * qy + p * p * by] as [number, number];
});
/** resample a polyline so equal steps of progress are equal distances: the bar keeps its pace round a corner */
function even(raw: [number, number][]) {
  const L = [0];
  for (let i = 1; i < raw.length; i++) L.push(L[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const tot = L[L.length - 1] || 1, out: [number, number][] = []; let j = 0;
  for (let i = 0; i < RN; i++) {
    const s = tot * i / (RN - 1); while (j < raw.length - 2 && L[j + 1] < s) j++;
    const t = clamp((s - L[j]) / ((L[j + 1] - L[j]) || 1), 0, 1);
    out.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * t, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * t]);
  }
  return out;
}

/* slide: down the wall, round the corner on a tight curve, along the floor. The bar points the way it travels, so its
   leading end turns into the floor first and the rest follows it round. Only when that lands the items in reading order. */
function slideRoute(env: RouteEnv, ax: number, ay: number, from: Side, d: Side, t0: number, t1: number) {
  const [bx, by] = env.dockAt(d), v = horiz(d) ? from : d, hz = horiz(d) ? d : from, kx = env.dockAt(v)[0], ky = env.dockAt(hz)[1];
  const l1 = Math.hypot(kx - ax, ky - ay), l2 = Math.hypot(bx - kx, by - ky);
  const R = Math.min(env.corner, l1 - 1, l2 - 1);
  if (!(R > 0)) return null;
  const u1 = [(kx - ax) / l1, (ky - ay) / l1], u2 = [(bx - kx) / l2, (by - ky) / l2];
  const p1: [number, number] = [kx - u1[0] * R, ky - u1[1] * R], p2 = [kx + u2[0] * R, ky + u2[1] * R];
  const raw: [number, number][] = [[ax, ay], p1];
  for (let i = 1; i <= 24; i++) { const t = i / 24, m = 1 - t; raw.push([m * m * p1[0] + 2 * m * t * kx + t * t * p2[0], m * m * p1[1] + 2 * m * t * ky + t * t * p2[1]]); }
  raw.push([bx, by]);
  const pts = even(raw), angs: number[] = []; let prev = t0;
  for (let i = 0; i < RN; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(RN - 1, i + 1)];
    let g = Math.atan2(b[1] - a[1], b[0] - a[0]);
    while (g - prev > Math.PI / 2) g -= Math.PI; while (prev - g > Math.PI / 2) g += Math.PI;
    angs.push(prev = g);
  }
  const off = Math.round((angs[RN - 1] - t1) / (2 * Math.PI));
  if (Math.abs(angs[RN - 1] - off * 2 * Math.PI - t1) > .1) return null;
  for (let i = 0; i < RN; i++) { angs[i] -= off * 2 * Math.PI; const w = Math.min(1, i / 8); angs[i] = t0 + (angs[i] - t0) * w; }
  return { pts, angs, qx: kx, qy: ky, kind: 'slide' as const };
}

const TYPES: Record<string, 'slide' | 'swing' | 'swing-back' | 'across'> = {
  'left>bottom': 'slide', 'right>top': 'slide', 'bottom>left': 'slide', 'top>right': 'slide',
  'bottom>right': 'swing', 'top>left': 'swing', 'right>bottom': 'swing-back', 'left>top': 'swing-back',
  'left>right': 'across', 'right>left': 'across', 'top>bottom': 'across', 'bottom>top': 'across',
};

export function makeRoute(env: RouteEnv, ax: number, ay: number, from: Side, d: Side, t0: number): Route {
  const [bx, by] = env.dockAt(d), t1 = horiz(d) ? 0 : Math.PI / 2, bent = from !== d && horiz(from) !== horiz(d);
  let r: Omit<Route, 'ax' | 'ay' | 'bx' | 'by' | 't0' | 't1' | 'from' | 'bent'> | null = null;
  const kind = TYPES[from + '>' + d];
  if (kind === 'slide') r = slideRoute(env, ax, ay, from, d, t0, t1);
  if (!r && (kind === 'swing' || kind === 'swing-back')) {
    // lift off one wall and swing to the next, bowing away from their corner
    const mx = (ax + bx) / 2, my = (ay + by) / 2, v = horiz(d) ? from : d, hz = horiz(d) ? d : from, kx = env.dockAt(v)[0], ky = env.dockAt(hz)[1];
    const qx = mx + (mx - kx) * env.lift, qy = my + (my - ky) * env.lift;
    r = { pts: quad(ax, ay, qx, qy, bx, by), angs: Array.from({ length: RN }, (_, i) => { const p = i / (RN - 1); return blendAng(t0, t1, p * p * (3 - 2 * p)); }), qx, qy, kind: 'swing' };
  }
  if (!r) {
    // the curve leans only partway toward the corner, so the bar sweeps across in one gentle arc, turning as it goes
    let qx = (ax + bx) / 2, qy = (ay + by) / 2;
    if (bent) { const v = horiz(d) ? from : d, hz = horiz(d) ? d : from; qx += (env.dockAt(v)[0] - qx) * env.arc; qy += (env.dockAt(hz)[1] - qy) * env.arc; }
    r = { pts: quad(ax, ay, qx, qy, bx, by), angs: Array.from({ length: RN }, (_, i) => blendAng(t0, t1, i / (RN - 1))), qx, qy, kind: bent ? 'arc' : 'line' };
  }
  return Object.assign(r, { ax, ay, bx, by, t0, t1, from, bent });
}
