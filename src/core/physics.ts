/* The material the island is made of: damped springs, a bendable rod (the bar's spine), and the outline drawn round it.
   Ported from the gooey-island motion study; the comments there are kept where they explain a choice. */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** damping for stiffness k at damping ratio z */
export const crit = (k: number, z: number) => 2 * Math.sqrt(k) * z;

let reduced = false;
if (typeof matchMedia !== 'undefined') {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener?.('change', e => { reduced = e.matches; });
}
export const isReduced = () => reduced;

/** A damped spring, stepped with fixed substeps. Stiffness and damping are passed per step so options apply live. */
export class Spring {
  x: number; t: number; v = 0;
  constructor(x = 0, public eps = 0.05) { this.x = this.t = x; }
  step(h: number, k: number, c: number) {
    if (reduced) { this.x = this.t; this.v = 0; return; }
    this.v += (-k * (this.x - this.t) - c * this.v) * h; this.x += this.v * h;
  }
  get rest() { return Math.abs(this.x - this.t) < this.eps && Math.abs(this.v) < this.eps * 20; }
  snap(x = this.t) { this.x = this.t = x; this.v = 0; }
}

export interface Pt { x: number; y: number }
export type Walls = [number, number, number, number];

/* ---------- the stick: a bar that bends like a rubber rod ----------
   The middle is held: it follows the bar's position and angle exactly. Each half is a stiff arm whose tip is a weight on a
   spring, so when the middle moves or turns the tips lag behind, and each half bends from the middle out, the way a rod
   bends. The arms keep their length. The shape is laid through n points for drawing. */
const BEAM = (x: number) => (6 * x * x - 4 * x * x * x + x * x * x * x) / 3;   // a loaded half-rod: 0 and flat at the middle, 1 at the tip
const BEAM_LEN = (() => { let s = 0; for (let i = 0; i < 64; i++) { const x = (i + .5) / 64, d = 4 * x - 4 * x * x + 4 / 3 * x * x * x; s += d * d / 64; } return s / 2; })();

interface Tip { j: number; x: number; y: number; vx: number; vy: number; hx: number; hy: number }

export class Stick {
  half = 1; cx = 0; cy = 0; th = 0; ox = 0; oy = 0;
  pcx?: number; pcy?: number; pth?: number;
  tips: Tip[];
  ns: Pt[];
  constructor(public n: number) {
    this.tips = [-1, 1].map(j => ({ j, x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0 }));
    this.ns = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  }
  /** where the middle is and which way the bar points; (ox, oy) moves where the tips rest, which bends it on purpose */
  aim(cx: number, cy: number, th: number, ox = 0, oy = 0) { this.cx = cx; this.cy = cy; this.th = th; this.ox = ox; this.oy = oy; }
  home(t: Tip): [number, number] {
    return [this.cx + t.j * this.half * Math.cos(this.th) + this.ox, this.cy + t.j * this.half * Math.sin(this.th) + this.oy];
  }
  snap() {
    for (const t of this.tips) { [t.x, t.y] = this.home(t); t.hx = t.x; t.hy = t.y; t.vx = t.vy = 0; }
    this.pcx = this.cx; this.pcy = this.cy; this.pth = this.th;
  }
  step(h: number, k: number, z: number, walls: Walls) {
    if (reduced) return this.snap();
    if (!(h > 0)) return;
    const c = crit(k, z), [x0, y0, x1, y1] = walls;
    // turning carries the ends round with it, so only travel makes them lag: the bar bows away from where it's heading
    const d = this.th - (this.pth ?? this.th), px = this.pcx ?? this.cx, py = this.pcy ?? this.cy;
    if (d) {
      const cs = Math.cos(d), sn = Math.sin(d), turn = (x: number, y: number): [number, number] => [px + (x - px) * cs - (y - py) * sn, py + (x - px) * sn + (y - py) * cs];
      for (const t of this.tips) {
        [t.x, t.y] = turn(t.x, t.y); [t.hx, t.hy] = turn(t.hx, t.hy);
        const vx = t.vx; t.vx = vx * cs - t.vy * sn; t.vy = vx * sn + t.vy * cs;
      }
    }
    this.pcx = this.cx; this.pcy = this.cy; this.pth = this.th;
    for (const t of this.tips) {
      // damped mostly against the rod's own motion, so the tips keep their swing and flex back past the middle
      const [x, y] = this.home(t), hvx = (x - t.hx) / h * .7, hvy = (y - t.hy) / h * .7; t.hx = x; t.hy = y;
      t.vx += (-k * (t.x - x) - c * (t.vx - hvx)) * h; t.vy += (-k * (t.y - y) - c * (t.vy - hvy)) * h;
      t.x += t.vx * h; t.y += t.vy * h;
      if (t.x < x0) { t.x = x0; t.vx = Math.max(0, t.vx); } else if (t.x > x1) { t.x = x1; t.vx = Math.min(0, t.vx); }
      if (t.y < y0) { t.y = y0; t.vy = Math.max(0, t.vy); } else if (t.y > y1) { t.y = y1; t.vy = Math.min(0, t.vy); }
    }
  }
  get still() {
    return this.tips.every(t => {
      const [x, y] = this.home(t);
      return Math.abs(t.x - x) < .1 && Math.abs(t.y - y) < .1 && Math.abs(t.vx) + Math.abs(t.vy) < 2;
    });
  }
  /** lay the points along the bent rod; give is how far an arm may stretch (0 keeps its length). bow pushes the rod
      sideways by that much at `at` (-1..1 along it) while its ends hold, the way a rod gives when pulled at one spot */
  shape(give: number, walls: Walls, bow = 0, at = 0) {
    const c = Math.cos(this.th), s = Math.sin(this.th), m = (this.n - 1) / 2, L = Math.max(this.half, 1e-3), vmax = L * .8;
    const arms = this.tips.map(t => {
      const dx = t.x - this.cx, dy = t.y - this.cy;
      const v = vmax * Math.tanh((-dx * s + dy * c) / vmax);
      const len = clamp((dx * c + dy * s) * t.j, L, L * (1 + .35 * give));
      return [Math.max(len * .5, len - v * v * BEAM_LEN / len), v] as const;
    });
    this.ns.forEach((p, i) => {
      const a = (i - m) / m, x = Math.abs(a), [u, v] = arms[a < 0 ? 0 : 1], along = Math.sign(a) * x * u;
      // the bow keeps the rod's own curve, squeezed toward the near end and stretched toward the far one so it peaks at `at`
      const side = v * BEAM(x) + (bow && bow * (1 - BEAM(Math.min(1, a < at ? (at - a) / (1 + at) : (a - at) / (1 - at)))));
      p.x = clamp(this.cx + along * c - side * s, walls[0], walls[2]);
      p.y = clamp(this.cy + along * s + side * c, walls[1], walls[3]);
    });
  }
}

/** Catmull-Rom through the points, as one cubic Bézier per segment */
function seg(ns: Pt[], i: number) {
  const n = ns.length, b = ns[i], c = ns[i + 1];
  const a = i > 0 ? ns[i - 1] : { x: 2 * b.x - c.x, y: 2 * b.y - c.y }, d = i + 2 < n ? ns[i + 2] : { x: 2 * c.x - b.x, y: 2 * c.y - b.y };
  return [b.x, b.y, b.x + (c.x - a.x) / 6, b.y + (c.y - a.y) / 6, c.x - (d.x - b.x) / 6, c.y - (d.y - b.y) / 6, c.x, c.y];
}

/** the point and direction at u, measured in points along the spine */
export function spineAt(ns: Pt[], u: number, fallbackAngle = 0): [number, number, number] {
  if (!Number.isFinite(u)) u = 0;
  const i = clamp(Math.floor(u), 0, ns.length - 2), t = clamp(u - i, 0, 1), m = 1 - t, s = seg(ns, i);
  const x = m * m * m * s[0] + 3 * m * m * t * s[2] + 3 * m * t * t * s[4] + t * t * t * s[6];
  const y = m * m * m * s[1] + 3 * m * m * t * s[3] + 3 * m * t * t * s[5] + t * t * t * s[7];
  const dx = 3 * m * m * (s[2] - s[0]) + 6 * m * t * (s[4] - s[2]) + 3 * t * t * (s[6] - s[4]);
  const dy = 3 * m * m * (s[3] - s[1]) + 6 * m * t * (s[5] - s[3]) + 3 * t * t * (s[7] - s[5]);
  return [x, y, Math.abs(dx) + Math.abs(dy) < 1e-6 ? fallbackAngle : Math.atan2(dy, dx)];
}

/** closest spine position (in points) to (x, y), or -1 if further than r from the spine */
export function spineHit(ns: Pt[], x: number, y: number, r: number) {
  let best = Infinity, bu = -1;
  for (let u = 0; u <= ns.length - 1; u += .25) {
    const [px, py] = spineAt(ns, u), d = Math.hypot(x - px, y - py);
    if (d < best) { best = d; bu = u; }
  }
  return best <= r ? bu : -1;
}

const f = (v: number) => (Number.isFinite(v) ? v : 0).toFixed(2);
/** The bar as a filled outline round its centre line: at(s) gives the point and direction for s in 0..1, r(s) the
    half-thickness, off(s) how far that slice is pushed sideways. The ends are round. A thick stroke can't change shape
    along its length; this can, which is what lets a press dent it. */
export function outline(at: (s: number) => [number, number, number], r: (s: number) => number, n: number, off: (s: number) => number = () => 0) {
  n = Math.max(2, Math.min(400, n | 0));
  const top: string[] = [], bot: string[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, [x, y, a] = at(s), w = r(s), o = off(s), sx = -Math.sin(a), sy = Math.cos(a);
    top.push(f(x + sx * (o - w)) + ' ' + f(y + sy * (o - w)));
    bot.push(f(x + sx * (o + w)) + ' ' + f(y + sy * (o + w)));
  }
  const r1 = f(r(1)), r0 = f(r(0));
  return `M${top.join('L')}A${r1} ${r1} 0 0 1 ${bot[n]}L${bot.reverse().join('L')}A${r0} ${r0} 0 0 1 ${top[0]}Z`;
}

/** The press dent: one round curve, deepest under the button and easing out either side. */
export const dip = (dist: number, depth: number, width: number) => {
  if (!depth) return 0;
  const q = dist / (width * .65);
  return depth * Math.exp(-.5 * q * q);
};

/* ---------- one animation loop for every island on the page, running only while something moves ---------- */
export interface System { tick(h: number, n: number): boolean }
const systems = new Set<System>();
let raf = 0, last = 0;
export function addSystem(s: System) { systems.add(s); }
export function removeSystem(s: System) { systems.delete(s); }
export function kick() {
  if (!raf && typeof requestAnimationFrame !== 'undefined') { last = performance.now(); raf = requestAnimationFrame(loop); }
}
function loop(now: number) {
  const dt = clamp((now - last) / 1000, 0, .04); last = now;
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  let live = false;
  for (const s of systems) {
    try { if (s.tick(h, n)) live = true; } catch (err) { console.error('[marmit]', err); }
  }
  raf = live ? requestAnimationFrame(loop) : 0;
}
