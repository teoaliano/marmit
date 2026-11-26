import { describe, expect, it, afterEach } from 'vitest';
import { createIsland, gradientCss, type GradientValue } from '../src/core/index';
import { addStop, colorAt, flipStops, mixColor, moveColor, normalizeGradient, parseColor, sortStops, widestGap, wrapAngle } from '../src/core/parts/gradient';

afterEach(() => { document.body.innerHTML = ''; });

describe('gradient colours', () => {
  it('parses hex, rgb() and hsl()', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0, 1]);
    expect(parseColor('#00ff0080')).toEqual([0, 255, 0, 128 / 255]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual([10, 20, 30, .5]);
    expect(parseColor('rgba(100%, 0%, 0%, .25)')).toEqual([255, 0, 0, .25]);
    expect(parseColor('hsl(120, 100%, 50%)')!.map(Math.round)).toEqual([0, 255, 0, 1]);
    expect(parseColor('hsl(0.5turn 100% 50%)')!.map(Math.round)).toEqual([0, 255, 255, 1]);
    expect(parseColor('nonsense')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });
  it('mixes in linear-light sRGB', () => {
    // black and white meet at linear 0.5, which is #bcbcbc in sRGB (a plain sRGB mix would give #808080)
    expect(mixColor('#000', '#fff', .5)).toBe('#bcbcbc');
    expect(mixColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mixColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    expect(mixColor('rgb(0 0 0 / 0)', '#000', .5)).toBe('#00000080');
  });
  it('reads the colour at a position, holding the end colours outside the stops', () => {
    const stops = [{ at: 20, color: '#000000' }, { at: 60, color: '#ffffff' }];
    expect(colorAt(stops, 0)).toBe('#000000');
    expect(colorAt(stops, 40)).toBe('#bcbcbc');
    expect(colorAt(stops, 90)).toBe('#ffffff');
  });
});

describe('gradient stops', () => {
  it('puts "+" in the middle of the widest gap', () => {
    expect(widestGap([{ at: 0, color: 'a' }, { at: 100, color: 'b' }])).toBe(50);
    expect(widestGap([{ at: 0, color: 'a' }, { at: 10, color: 'b' }, { at: 100, color: 'c' }])).toBe(55);
    expect(widestGap([{ at: 60, color: 'a' }, { at: 100, color: 'b' }])).toBe(30); // the gap before the first stop counts
    expect(widestGap([{ at: 0, color: 'a' }, { at: 25, color: 'b' }, { at: 50, color: 'c' }, { at: 75, color: 'd' }, { at: 100, color: 'e' }])).toBe(13); // first of equal gaps
  });
  it('flips positions and keeps them sorted', () => {
    expect(flipStops([{ at: 0, color: 'a' }, { at: 30, color: 'b' }, { at: 100, color: 'c' }]))
      .toEqual([{ at: 0, color: 'c' }, { at: 70, color: 'b' }, { at: 100, color: 'a' }]);
  });
  it('sorts stably by position', () => {
    expect(sortStops([{ at: 50, color: 'x' }, { at: 10, color: 'y' }, { at: 50, color: 'z' }]).map(s => s.color)).toEqual(['y', 'x', 'z']);
  });
  it('reorders rows by moving colours between fixed positions', () => {
    const s = [{ at: 0, color: 'a' }, { at: 30, color: 'b' }, { at: 60, color: 'c' }, { at: 100, color: 'd' }];
    expect(moveColor(s, 0, 2)).toEqual([{ at: 0, color: 'b' }, { at: 30, color: 'c' }, { at: 60, color: 'a' }, { at: 100, color: 'd' }]);
    expect(moveColor(s, 3, 0).map(x => x.color)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveColor(s, 1, 99).map(x => x.color)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('adds an interpolated stop, and nothing at the cap', () => {
    const two = [{ at: 0, color: '#000000' }, { at: 100, color: '#ffffff' }];
    expect(addStop(two, 49.6)).toEqual([two[0], { at: 50, color: '#bcbcbc' }, two[1]]);
    const three = addStop(two, 50, 3);
    expect(three).toHaveLength(3);
    expect(addStop(three, 20, 3)).toBe(three);
    expect(addStop(two, 20, 1)).toHaveLength(2); // a cap below 2 means 2
  });
  it('normalises values: shape, angle, stop count and range', () => {
    expect(normalizeGradient({ shape: 'diamond' as never, angle: -90, stops: [{ at: 120, color: 'red' }, { at: -5, color: 'blue' }] }))
      .toEqual({ shape: 'linear', angle: 270, stops: [{ at: 0, color: 'blue' }, { at: 100, color: 'red' }] });
    expect(normalizeGradient({ stops: [{ at: 5, color: 'red' }] }).stops).toHaveLength(2);
    const many = Array.from({ length: 12 }, (_, i) => ({ at: i * 9, color: '#' + String(i).padStart(6, '0') }));
    const n = normalizeGradient({ stops: many }, 4).stops;
    expect(n.map(s => s.at)).toEqual([0, 36, 63, 99]);
    expect(wrapAngle(450)).toBe(90); expect(wrapAngle(-1)).toBe(359);
  });
});

describe('gradientCss', () => {
  const stops = [{ at: 0, color: '#ff0000' }, { at: 100, color: 'blue' }];
  it('writes each shape', () => {
    expect(gradientCss({ shape: 'linear', angle: 45, stops })).toBe('linear-gradient(45deg, #ff0000 0%, blue 100%)');
    expect(gradientCss({ shape: 'radial', angle: 45, stops })).toBe('radial-gradient(circle, #ff0000 0%, blue 100%)');
    expect(gradientCss({ shape: 'conic', angle: 120, stops })).toBe('conic-gradient(from 120deg, #ff0000 0%, blue 100%)');
  });
});

describe('gradient control', () => {
  const value: GradientValue = { shape: 'linear', angle: 90, stops: [{ at: 0, color: '#000000' }, { at: 100, color: '#ffffff' }] };
  it('reads, sets and normalises through the controller', () => {
    const isl = createIsland({ mode: 'inline', container: document.body, items: [{ type: 'gradient', id: 'g', label: 'Fill', value }] });
    expect(isl.get('g')).toEqual(value);
    isl.set('g', { shape: 'conic', angle: 400, stops: [{ at: 80, color: 'red' }, { at: 10, color: 'blue' }] });
    expect(isl.get('g')).toEqual({ shape: 'conic', angle: 40, stops: [{ at: 10, color: 'blue' }, { at: 80, color: 'red' }] });
    const chip = document.querySelector<HTMLElement>('.mm-gchip')!;
    expect(chip.style.getPropertyValue('--g')).toContain('conic-gradient');
    isl.destroy();
  });
});
