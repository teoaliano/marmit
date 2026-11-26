import { describe, expect, it } from 'vitest';
import { channels, detect, format, fromChannels, fromHsv, inGamut, maxChroma, parse, toHsv, toRgb } from '../src/core/parts/color-math';

const rt = (s: string) => format(parse(s)!, detect(s));

describe('color parse / format', () => {
  it('detects formats', () => {
    expect(detect('#fff')).toBe('hex');
    expect(detect('rgb(1 2 3)')).toBe('rgb');
    expect(detect('rgba(1,2,3,.5)')).toBe('rgb');
    expect(detect('hsla(1, 2%, 3%)')).toBe('hsl');
    expect(detect('oklch(0.5 0.1 20)')).toBe('oklch');
    expect(detect('color(display-p3 1 0 0)')).toBe('p3');
  });
  it('round-trips hex (3, 4, 6, 8 digits) as uppercase', () => {
    expect(rt('#3b82f6')).toBe('#3B82F6');
    expect(rt('#fff')).toBe('#FFFFFF');
    expect(rt('#f008')).toBe('#FF000088');
    expect(rt('#3B82F680')).toBe('#3B82F680');
    for (let i = 0; i < 200; i++) {
      const hx = '#' + [0, 0, 0].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
      expect(rt(hx)).toBe(hx);
    }
  });
  it('round-trips rgb, space or comma, with integers', () => {
    expect(rt('rgb(59 130 246)')).toBe('rgb(59 130 246)');
    expect(rt('rgb(59, 130, 246)')).toBe('rgb(59 130 246)');
    expect(rt('rgba(59, 130, 246, 0.5)')).toBe('rgb(59 130 246 / 0.5)');
    expect(rt('rgb(100% 0% 0% / 25%)')).toBe('rgb(255 0 0 / 0.25)');
    expect(parse('rgb(10, 20%, 30)')).toBeNull();
  });
  it('round-trips hsl to 2 decimals', () => {
    expect(rt('hsl(210 50% 40%)')).toBe('hsl(210 50% 40%)');
    expect(rt('hsla(120, 100%, 25%, .3)')).toBe('hsl(120 100% 25% / 0.3)');
    expect(rt('hsl(0.5turn 20% 70%)')).toBe('hsl(180 20% 70%)');
    expect(parse('hsl(210 50 40)')).toBeNull();
  });
  it('round-trips oklch (l, c 4 dp, h 2 dp); C may be % of 0.4', () => {
    expect(rt('oklch(0.6231 0.1881 259.81)')).toBe('oklch(0.6231 0.1881 259.81)');
    expect(rt('oklch(62.31% 50% 259.814 / 0.5)')).toBe('oklch(0.6231 0.2 259.81 / 0.5)');
    expect(rt('oklch(0.4 0.5 30)')).toBe('oklch(0.4 0.5 30)'); // not gamut mapped
  });
  it('round-trips display-p3 to 5 decimals', () => {
    expect(rt('color(display-p3 1 0 0)')).toBe('color(display-p3 1 0 0)');
    expect(rt('color(display-p3 0.12345 0.5 0.98765 / 0.75)')).toBe('color(display-p3 0.12345 0.5 0.98765 / 0.75)');
  });
  it('converts between formats', () => {
    const red = parse('#FF0000')!;
    expect(format(red, 'oklch')).toBe('oklch(0.628 0.2577 29.23)');
    expect(format(red, 'rgb')).toBe('rgb(255 0 0)');
    expect(format(red, 'hsl')).toBe('hsl(0 100% 50%)');
    expect(format(parse('rgb(0 0 255)')!, 'hex')).toBe('#0000FF');
    // P3 red is outside sRGB: hex output loses chroma to fit, it doesn't clip channels
    expect(format(parse('color(display-p3 1 0 0)')!, 'hex')).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('reads transparent and rejects junk', () => {
    expect(parse('transparent')).toEqual({ l: 0, c: 0, h: 0, a: 0 });
    expect(format(parse('transparent')!, 'rgb')).toBe('rgb(0 0 0 / 0)');
    for (const s of ['', 'red', '#12', '#12345', 'rgb(1 2)', 'rgb(1 2 3 4)', 'oklch(1, 2, 3)', 'color(srgb 1 0 0)', 'rgb(1 2 3 / x)']) expect(parse(s)).toBeNull();
  });
});

describe('alpha output', () => {
  it('appears only below 1, to at most 4 decimals', () => {
    const c = parse('#3B82F6')!;
    expect(format({ ...c, a: 1 }, 'rgb')).toBe('rgb(59 130 246)');
    expect(format({ ...c, a: 0.123456 }, 'rgb')).toBe('rgb(59 130 246 / 0.1235)');
    expect(format({ ...c, a: 0.5 }, 'oklch')).toMatch(/ \/ 0\.5\)$/);
    expect(format({ ...c, a: 0.5 }, 'hex')).toBe('#3B82F680');
    expect(format({ ...c, a: 0 }, 'hex')).toBe('#3B82F600');
  });
});

describe('hue preservation', () => {
  it('greys from HSL and HSV keep the hue they were made with', () => {
    const g = fromChannels([200, 0, 50], 'hsl');
    expect(g.c).toBe(0);
    expect(channels(g, 'hsl')[0]).toBeCloseTo(200, 1);
    const v = fromHsv(120, 0, .5);
    expect(toHsv(v)[0]).toBeCloseTo(120, 1);
    expect(fromHsv(120, 0, 0).h).toBeGreaterThan(0);
  });
  it('rgb greys have zero chroma', () => {
    expect(parse('#808080')!.c).toBe(0);
    expect(parse('#FFFFFF')!.l).toBeCloseTo(1, 5);
  });
});

describe('max chroma', () => {
  it('sits on the gamut edge', () => {
    for (const [l, h] of [[.5, 30], [.7, 140], [.4, 260], [.9, 100]]) {
      const c = maxChroma(l, h);
      expect(inGamut({ l, c, h, a: 1 })).toBe(true);
      expect(inGamut({ l, c: c + .002, h, a: 1 })).toBe(false);
      expect(maxChroma(l, h, 'p3')).toBeGreaterThanOrEqual(c);
    }
  });
  it('is zero at black and white', () => {
    expect(maxChroma(0, 30)).toBe(0);
    expect(maxChroma(1, 30)).toBe(0);
  });
  it('sRGB red is at the edge', () => {
    const red = parse('#FF0000')!;
    expect(maxChroma(red.l, red.h)).toBeCloseTo(red.c, 3);
    expect(toRgb(red).map(v => +v.toFixed(4) + 0)).toEqual([1, 0, 0]);
  });
});
