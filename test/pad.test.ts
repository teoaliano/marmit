import { describe, expect, it } from 'vitest';
import { padAxis, padFromPoint, padNorm, padSnapPoint, padToPoint } from '../src/core/parts/pad';

const X = padAxis(undefined, 'X'), Y = padAxis(undefined, 'Y');

describe('pad', () => {
  it('fills axis defaults: −1..1, step (max − min) / 200', () => {
    expect(X).toMatchObject({ min: -1, max: 1, step: 0.01, label: 'X' });
    expect(padAxis({ min: 0, max: 100 }, 'Y')).toMatchObject({ min: 0, max: 100, step: 0.5, label: 'Y' });
    expect(() => padAxis({ min: 1, max: 1 }, 'X')).toThrow(RangeError);
  });
  it('maps the surface with y inverted: the top is max', () => {
    expect(padFromPoint(0, 0, X, Y)).toEqual({ x: -1, y: 1 });
    expect(padFromPoint(1, 1, X, Y)).toEqual({ x: 1, y: -1 });
    expect(padFromPoint(0.5, 0.5, X, Y)).toEqual({ x: 0, y: 0 });
    expect(padFromPoint(0.25, 0.1, X, Y)).toEqual({ x: -0.5, y: 0.8 });
    expect(padFromPoint(-2, 3, X, Y)).toEqual({ x: -1, y: -1 });
    expect(padToPoint({ x: -0.5, y: 0.8 }, X, Y)).toEqual({ fx: 0.25, fy: expect.closeTo(0.1, 9) });
  });
  it('snaps to the step grid anchored at min', () => {
    const A = padAxis({ min: 3, max: 13, step: 2 }, 'X');
    expect(padFromPoint(0.32, 0, A, A).x).toBe(7); // 6.2 → nearest of 3, 5, 7…
    expect(padNorm({ x: 0.123456, y: 4 }, X, Y)).toEqual({ x: 0.12, y: 1 });
    expect(padNorm({ x: 'a', y: NaN }, X, Y, { x: 0.5, y: -0.5 })).toEqual({ x: 0.5, y: -0.5 });
    expect(padNorm(null, X, Y)).toEqual({ x: 0, y: 0 });
  });
  it('a still click snaps to an interior 6×6 crossing within 8px', () => {
    expect(padSnapPoint(62, 55, 180, 180)).toEqual({ x: 60, y: 60 });
    expect(padSnapPoint(69, 60, 180, 180)).toBeUndefined(); // 9px away
    expect(padSnapPoint(4, 60, 180, 180)).toBeUndefined(); // edge line, not interior
    expect(padSnapPoint(176, 90, 180, 180)).toBeUndefined();
    expect(padSnapPoint(150, 30, 180, 180)).toEqual({ x: 150, y: 30 });
  });
});
