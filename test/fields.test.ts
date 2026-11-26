import { describe, expect, it, afterEach } from 'vitest';
import { linkScale } from '../src/core/parts/fields';
import { createIsland } from '../src/core/index';

afterEach(() => { document.body.innerHTML = ''; });
const L = (min: number, max: number, step: number) => ({ min, max, step });

describe('linkScale', () => {
  const s3 = [L(0.1, 3, 0.01), L(0.1, 3, 0.01), L(0.1, 3, 0.01)];
  it('scales every axis by the edited axis’s ratio', () => {
    expect(linkScale([1, 2, 0.5], 0, 1.5, s3)).toEqual([1.5, 3, 0.75]);
  });
  it('limits the ratio so no axis leaves its range, keeping proportions', () => {
    // y would reach 4: the ratio stops at 1.5 (y = 3)
    expect(linkScale([1, 2, 0.5], 0, 2, s3)).toEqual([1.5, 3, 0.75]);
    // shrinking: z hits 0.1 first, ratio 0.2
    expect(linkScale([1, 2, 0.5], 1, 0.2, s3)).toEqual([0.2, 0.4, 0.1]);
  });
  it('is additive when the edited axis starts at 0', () => {
    const p = [L(0, 64, 1), L(0, 64, 1), L(0, 64, 1), L(0, 64, 1)];
    expect(linkScale([0, 8, 0, 8], 0, 4, p)).toEqual([4, 12, 4, 12]);
    // the offset is limited too: 8 + 60 would pass 64
    expect(linkScale([0, 8, 0, 8], 2, 60, p)).toEqual([56, 64, 56, 64]);
  });
  it('leaves axes at 0 alone when scaling', () => {
    const u = [L(-10, 10, 1), L(-10, 10, 1)];
    expect(linkScale([2, 0], 0, 6, u)).toEqual([6, 0]);
  });
  it('handles negative values and flips through min/max correctly', () => {
    const u = [L(-10, 10, 1), L(-10, 10, 1)];
    expect(linkScale([2, -4], 0, 4, u)).toEqual([4, -8]);
    expect(linkScale([2, -4], 0, 8, u)).toEqual([5, -10]);
  });
  it('snaps each result to its own grid', () => {
    expect(linkScale([1, 3], 0, 1.333, [L(0, 10, 0.01), L(0, 10, 0.1)])).toEqual([1.33, 4]);
  });
});


describe('fields control', () => {
  it('emits one value object per change and follows controller.set', () => {
    const seen: unknown[] = [];
    const isl = createIsland({ mode: 'inline', container: document.body, items: [
      { type: 'fields', id: 's', axes: ['x', 'y'], min: 0, max: 10, step: 0.5, linked: true, value: { x: 2, y: 4 } },
    ], onChange: (_id, v) => seen.push(v) });
    expect(isl.get('s')).toEqual({ x: 2, y: 4 });
    const val = document.querySelector<HTMLElement>('.mm-fld-v')!;
    val.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(seen).toEqual([{ x: 2.5, y: 5 }]);
    isl.set('s', { x: 1.26, y: 3 });
    expect(isl.get('s')).toEqual({ x: 1.5, y: 3 });
    expect(val.textContent).toBe('1.5');
    isl.destroy();
  });
});
