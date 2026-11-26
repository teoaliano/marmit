/* Colour maths for the color control. The model is OKLCH + alpha; every format converts through it. sRGB and Display
   P3 share the sRGB transfer curve and differ only in their primaries. */
import type { ColorFormat } from '../types';

export type Space = 'srgb' | 'p3';
export interface Lch { l: number; c: number; h: number; a: number }

export const clamp01 = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const wrap = (h: number) => (h % 360 + 360) % 360;
/** below this chroma a colour has no meaningful hue */
export const ACHROMA = 1e-7;

type M3 = number[][];
const mul = (m: M3, v: number[]) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const toLin = (v: number) => Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * ((Math.abs(v) + 0.055) / 1.055) ** 2.4;
const toGam = (v: number) => Math.abs(v) <= 0.0031308 ? 12.92 * v : Math.sign(v) * (1.055 * Math.abs(v) ** (1 / 2.4) - 0.055);
const SRGB_XYZ = [[0.4123907993, 0.3575843394, 0.1804807884], [0.2126390059, 0.7151686788, 0.0721923154], [0.0193308187, 0.1191947798, 0.9505321522]];
const P3_XYZ = [[0.4865709486, 0.2656676932, 0.1982172852], [0.2289745641, 0.6917385218, 0.0792869141], [0, 0.0451133819, 1.0439443689]];
const XYZ_SRGB = [[3.2409699419, -1.5373831776, -0.4986107603], [-0.9692436363, 1.8759675015, 0.0415550574], [0.0556300797, -0.2039769589, 1.0569715142]];
const XYZ_P3 = [[2.4934969119, -0.9313836179, -0.4027107845], [-0.8294889696, 1.7626640603, 0.0236246858], [0.0358458302, -0.0761723893, 0.956884524]];
const XYZ_LMS = [[0.819022438, 0.3619062601, -0.1288737815], [0.0329836539, 0.9292868616, 0.0361446664], [0.0481771894, 0.2642395318, 0.6335478285]];
const LMS_LAB = [[0.2104542553, 0.793617785, -0.0040720468], [1.9779984951, -2.428592205, 0.4505937099], [0.0259040371, 0.7827717662, -0.808675766]];
const LAB_LMS = [[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.291485548]];
const LMS_XYZ = [[1.2268798734, -0.5578149966, 0.2813910502], [-0.0405757626, 1.1122868294, -0.0717110667], [-0.0763729497, -0.421493324, 1.5869240244]];

/** gamma-encoded r,g,b (0–1) in `space` → OKLCH. An achromatic result gets hue 0; callers keep the old hue. */
export function fromRgb(rgb: number[], a = 1, space: Space = 'srgb'): Lch {
  const [L, A, B] = mul(LMS_LAB, mul(XYZ_LMS, mul(space === 'p3' ? P3_XYZ : SRGB_XYZ, rgb.map(toLin))).map(Math.cbrt));
  const c = Math.hypot(A, B);
  return { l: clamp01(L), c: c < ACHROMA ? 0 : c, h: c < ACHROMA ? 0 : wrap(Math.atan2(B, A) * 180 / Math.PI), a: clamp01(a) };
}
/** OKLCH → gamma-encoded r,g,b in `space`, not clipped (out of gamut falls outside 0–1) */
export function toRgb(x: Lch, space: Space = 'srgb') {
  const r = x.h * Math.PI / 180, A = x.c * Math.cos(r), B = x.c * Math.sin(r);
  return mul(space === 'p3' ? XYZ_P3 : XYZ_SRGB, mul(LMS_XYZ, mul(LAB_LMS, [x.l, A, B]).map(v => v ** 3))).map(toGam);
}
export const inGamut = (x: Lch, space: Space = 'srgb') => toRgb(x, space).every(v => v >= -1e-5 && v <= 1 + 1e-5);
/** bring a colour into gamut by lowering its chroma (binary search), keeping L and H */
export function toGamut(x: Lch, space: Space = 'srgb'): Lch {
  if (inGamut(x, space)) return x;
  let lo = 0, hi = x.c;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (inGamut({ ...x, c: m }, space)) lo = m; else hi = m; }
  return { ...x, c: lo };
}
/** the most chroma a lightness and hue can have inside the gamut */
export const maxChroma = (l: number, h: number, space: Space = 'srgb') => l <= 0 || l >= 1 ? 0 : toGamut({ l, c: 0.5, h, a: 1 }, space).c;

/** the gamut a format edits in: OKLCH and P3 reach Display P3, the rest stay in sRGB */
export const gamutOf = (f: ColorFormat): Space => f === 'oklch' || f === 'p3' ? 'p3' : 'srgb';
export function detect(s: string): ColorFormat {
  const t = s.trim();
  return /^oklch\(/i.test(t) ? 'oklch' : /^color\(display-p3\s/i.test(t) ? 'p3' : /^rgba?\(/i.test(t) ? 'rgb' : /^hsla?\(/i.test(t) ? 'hsl' : 'hex';
}

/* ---------- HSV / HSL ---------- */
export const hsvRgb = (h: number, s: number, v: number) => [5, 3, 1].map(n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); });
export const hslRgb = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
};
/** OKLCH hue of a fully saturated HSL hue (sRGB) */
const okHue = (h: number) => fromRgb(hslRgb(h, .5, .5)).h;
/** the inverse of okHue, by binary search: the HSL hue whose OKLCH hue is `h` (keeps the hue of greys) */
function hslHue(h: number) {
  const o = okHue(0), d = wrap(h - o);
  let lo = 0, hi = 360;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (wrap(okHue(m) - o) < d) lo = m; else hi = m; }
  return lo;
}
const rgbHue = ([r, g, b]: number[], max: number, d: number) => wrap((max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60);

/** HSV (h 0–360, s/v 0–1) of a colour, in `space` */
export function toHsv(x: Lch, space: Space = 'srgb') {
  const rgb = toRgb(toGamut(x, space), space).map(v => clamp01(v)), max = Math.max(...rgb), d = max - Math.min(...rgb);
  return d < 1e-6 ? [x.h ? hslHue(x.h) : 0, 0, max] : [rgbHue(rgb, max, d), d / max, max];
}
export function fromHsv(h: number, s: number, v: number, a = 1, space: Space = 'srgb'): Lch {
  const x = fromRgb(hsvRgb(h, s, v), a, space);
  return x.c ? x : { ...x, h: okHue(h) };
}
function fromHsl(h: number, s: number, l: number, a = 1): Lch {
  const x = fromRgb(hslRgb(h, s, l), a);
  return x.c ? x : { ...x, h: okHue(h) };
}

/* ---------- channels (the numbers in the fields) ---------- */
export interface Channel { name: string; label: string; max: number; step: number; digits: number; wrap?: boolean }
const hue = (digits: number): Channel => ({ name: 'H', label: 'Hue', max: 360, step: 1, digits, wrap: true });
const rgbCh = (max: number, step: number, digits: number) => ['Red', 'Green', 'Blue'].map(label => ({ name: label[0], label, max, step, digits }));
export const CHANNELS: Record<Exclude<ColorFormat, 'hex'>, Channel[]> = {
  rgb: rgbCh(255, 1, 0),
  hsl: [hue(0), { name: 'S', label: 'Saturation', max: 100, step: 1, digits: 0 }, { name: 'L', label: 'Lightness', max: 100, step: 1, digits: 0 }],
  oklch: [{ name: 'L', label: 'Lightness', max: 1, step: .01, digits: 3 }, { name: 'C', label: 'Chroma', max: Infinity, step: .005, digits: 3 }, hue(1)],
  p3: rgbCh(1, .01, 3),
};
export const ALPHA: Channel = { name: '%', label: 'Opacity', max: 100, step: 1, digits: 0 };
/** keep a channel value in range: hue wraps, the rest clamp */
export const limit = (ch: Channel, v: number) => ch.wrap ? wrap(v) : clamp01(v, 0, ch.max);

/** a colour's channel values in a format (hex has none of its own: it reads as rgb) */
export function channels(x: Lch, f: ColorFormat): number[] {
  if (f === 'oklch') return [x.l, x.c, x.h];
  const sp = gamutOf(f), rgb = toRgb(toGamut(x, sp), sp).map(v => clamp01(v));
  if (f === 'p3') return rgb;
  if (f !== 'hsl') return rgb.map(v => v * 255);
  const max = Math.max(...rgb), d = max - Math.min(...rgb), l = max - d / 2;
  if (d < 1e-6) return [x.h ? hslHue(x.h) : 0, 0, l * 100];
  return [rgbHue(rgb, max, d), Math.min(100, d / (1 - Math.abs(2 * l - 1)) * 100), l * 100];
}
export function fromChannels(vals: number[], f: Exclude<ColorFormat, 'hex'>, a = 1): Lch {
  const [p, q, r] = vals.map((v, i) => limit(CHANNELS[f][i], v));
  if (f === 'oklch') return { l: p, c: q, h: r, a: clamp01(a) };
  if (f === 'hsl') return fromHsl(p, q / 100, r / 100, a);
  return f === 'rgb' ? fromRgb([p / 255, q / 255, r / 255], a) : fromRgb([p, q, r], a, 'p3');
}

/* ---------- parse / format ---------- */
const NUM = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(%|deg|grad|rad|turn)?$/i;
/** one CSS number: `%` scales to `pct` (so 50% of 255 = 127.5); angles are allowed only when `angle` */
function num(s: string, pct = 1, angle = false): number | null {
  const m = s.match(NUM), n = parseFloat(s);
  if (!m || !Number.isFinite(n)) return null;
  const u = m[1]?.toLowerCase();
  if (angle) return u === 'rad' ? n * 180 / Math.PI : u === 'turn' ? n * 360 : u === 'grad' ? n * .9 : !u || u === 'deg' ? n : null;
  return u === '%' ? n * pct / 100 : !u ? n : null;
}

/** parse any supported CSS colour; null when it isn't one */
export function parse(input: string): Lch | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { l: 0, c: 0, h: 0, a: 0 };
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(s)) {
    let hx = s.slice(1);
    if (hx.length <= 4) hx = [...hx].map(d => d + d).join('');
    const v = hx.match(/../g)!.map(d => parseInt(d, 16) / 255);
    return fromRgb(v.slice(0, 3), v[3] ?? 1);
  }
  const m = s.match(/^(oklch|rgba?|hsla?|color)\(([^()]*)\)$/);
  if (!m) return null;
  const fn = m[1], isP3 = fn === 'color';
  let body = m[2].trim();
  if (isP3) { if (!body.startsWith('display-p3 ')) return null; body = body.slice(11).trim(); }
  const comma = body.includes(',');
  if (comma && (isP3 || fn === 'oklch' || body.includes('/'))) return null;
  const parts = comma ? body.split(',').map(p => p.trim()) : body.split(/\s*\/\s*/);
  if (!comma && parts.length > 2) return null;
  const ch = comma ? parts.slice(0, 3) : parts[0].split(/\s+/);
  if (ch.length !== 3 || (comma && parts.length !== 3 && parts.length !== 4)) return null;
  // legacy comma rgb() may not mix numbers and percentages
  if (comma && fn.startsWith('rgb') && ch.some(p => p.endsWith('%')) && !ch.every(p => p.endsWith('%'))) return null;
  const aStr = comma ? parts[3] : parts[1], a = aStr === undefined ? 1 : num(aStr);
  if (a === null) return null;
  if (fn === 'oklch') {
    const l = num(ch[0]), c = num(ch[1], .4), h = num(ch[2], 1, true);
    return l === null || c === null || h === null ? null : { l: clamp01(l), c: Math.max(0, c), h: wrap(h), a: clamp01(a) };
  }
  if (fn.startsWith('hsl')) {
    const h = num(ch[0], 1, true), sat = num(ch[1]), l = num(ch[2]);
    if (h === null || sat === null || l === null || !ch[1].endsWith('%') || !ch[2].endsWith('%')) return null;
    return fromHsl(wrap(h), clamp01(sat), clamp01(l), a);
  }
  const v = ch.map(p => num(p, isP3 ? 1 : 255));
  if (v.some(x => x === null)) return null;
  return fromRgb((v as number[]).map(x => isP3 ? x : clamp01(x / 255)), a, isP3 ? 'p3' : 'srgb');
}

const r = (v: number, d = 4) => Number(v.toFixed(d));
/** write a colour in a format. Alpha appears only below 1. Out-of-gamut colours lose chroma to fit (not OKLCH). */
export function format(x: Lch, f: ColorFormat): string {
  const al = x.a < 1 ? ` / ${r(x.a)}` : '';
  if (f === 'oklch') return `oklch(${r(x.l)} ${r(x.c)} ${r(x.h, 2)}${al})`;
  if (f === 'hsl') { const [h, s, l] = channels(x, 'hsl'); return `hsl(${r(h, 2)} ${r(s, 2)}% ${r(l, 2)}%${al})`; }
  const sp = gamutOf(f), rgb = toRgb(toGamut(x, sp), sp);
  if (f === 'p3') return `color(display-p3 ${rgb.map(v => r(clamp01(v), 5)).join(' ')}${al})`;
  const b = rgb.map(v => Math.round(clamp01(v) * 255));
  if (f === 'rgb') return `rgb(${b.join(' ')}${al})`;
  if (x.a < 1) b.push(Math.round(x.a * 255));
  return ('#' + b.map(v => v.toString(16).padStart(2, '0')).join('')).toUpperCase();
}
