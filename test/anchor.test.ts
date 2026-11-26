import { describe, expect, it, afterEach } from 'vitest';
import { anchorLabel, anchorMove, anchorNorm } from '../src/core/parts/anchor';
import { createIsland } from '../src/core/index';

afterEach(() => { document.body.innerHTML = ''; });

describe('anchor', () => {
  it('normalises invalid values to the default, then to center', () => {
    expect(anchorNorm(undefined)).toEqual({ x: 'center', y: 'center' });
    expect(anchorNorm({ x: 'left', y: 'middle' })).toEqual({ x: 'left', y: 'center' });
    expect(anchorNorm({ x: 'nope' }, { x: 'right', y: 'bottom' })).toEqual({ x: 'right', y: 'bottom' });
    expect(anchorNorm('top')).toEqual({ x: 'center', y: 'center' });
  });
  it('arrows move one cell without wrapping', () => {
    expect(anchorMove({ x: 'center', y: 'center' }, 'ArrowLeft')).toEqual({ x: 'left', y: 'center' });
    expect(anchorMove({ x: 'left', y: 'center' }, 'ArrowLeft')).toEqual({ x: 'left', y: 'center' });
    expect(anchorMove({ x: 'right', y: 'top' }, 'ArrowRight')).toEqual({ x: 'right', y: 'top' });
    expect(anchorMove({ x: 'right', y: 'top' }, 'ArrowUp')).toEqual({ x: 'right', y: 'top' });
    expect(anchorMove({ x: 'right', y: 'top' }, 'ArrowDown')).toEqual({ x: 'right', y: 'center' });
    expect(anchorMove({ x: 'left', y: 'bottom' }, 'ArrowDown')).toEqual({ x: 'left', y: 'bottom' });
    expect(anchorMove({ x: 'left', y: 'bottom' }, 'Tab')).toBeNull();
  });
  it('labels the cells', () => {
    expect(anchorLabel('left', 'top')).toBe('Top left');
    expect(anchorLabel('center', 'center')).toBe('Center');
    expect(anchorLabel('right', 'center')).toBe('Center right');
    expect(anchorLabel('center', 'bottom')).toBe('Bottom center');
  });
  it('renders nine radios, one tabbable, and follows set() and keys', () => {
    const changes: unknown[] = [];
    const isl = createIsland({ mode: 'inline', container: document.body, items: [{ type: 'anchor', id: 'a', value: { x: 'left', y: 'top' } }], onChange: (_, v) => changes.push(v) });
    const radios = [...document.querySelectorAll<HTMLElement>('.mm-anchor [role=radio]')];
    expect(radios).toHaveLength(9);
    expect(radios.filter(r => r.tabIndex === 0).map(r => r.getAttribute('aria-label'))).toEqual(['Top left']);
    isl.set('a', { x: 'bogus', y: 'bottom' } as never);
    expect(isl.get('a')).toEqual({ x: 'left', y: 'bottom' }); // the bad axis falls back to the item's own value
    radios[6].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(isl.get('a')).toEqual({ x: 'center', y: 'bottom' });
    expect(radios[7].tabIndex).toBe(0);
    radios[0].click();
    expect(changes.at(-1)).toEqual({ x: 'left', y: 'top' });
    isl.destroy();
  });
});
