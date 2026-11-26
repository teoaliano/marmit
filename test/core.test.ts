import { describe, expect, it, vi, afterEach } from 'vitest';
import { createIsland, collectSlots, type IslandItem } from '../src/core/index';
import { signature } from '../src/core/controls';
import { outline, Spring, Stick } from '../src/core/physics';

afterEach(() => { document.body.innerHTML = ''; });

const items = (): IslandItem[] => [
  { type: 'button', id: 'add', label: 'Add', icon: 'plus', variant: 'primary' },
  { type: 'button', id: 'grid', label: 'Grid', icon: 'grid', toggle: true },
  { type: 'separator' },
  { type: 'segmented', id: 'range', options: ['Day', 'Week'], value: 'Week' },
  { type: 'slider', id: 'size', min: 0, max: 10, value: 4 },
  { type: 'select', id: 'fit', label: 'Fit', options: ['Fill', 'Fit'] },
  { type: 'menu', id: 'more', label: 'More', icon: 'more', items: [{ label: 'Delete', danger: true }] },
];

describe('physics', () => {
  it('a spring settles on its target', () => {
    const s = new Spring(0); s.t = 10;
    for (let i = 0; i < 4000; i++) s.step(1 / 240, 150, 2 * Math.sqrt(150));
    expect(s.x).toBeCloseTo(10, 2); expect(s.rest).toBe(true);
  });
  it('a straight stick lays its points evenly', () => {
    const st = new Stick(5); st.half = 100; st.aim(200, 50, 0); st.snap(); st.shape(0, [-1e9, -1e9, 1e9, 1e9]);
    expect(st.ns.map(p => Math.round(p.x))).toEqual([100, 150, 200, 250, 300]);
    expect(st.ns.every(p => Math.abs(p.y - 50) < 1e-9)).toBe(true);
  });
  it('the outline is a closed path', () => {
    const d = outline(s => [s * 100, 0, 0], () => 20, 10);
    expect(d.startsWith('M')).toBe(true); expect(d.endsWith('Z')).toBe(true); expect(d).not.toContain('NaN');
  });
});

describe('controller', () => {
  it('mounts a toolbar with every item', () => {
    const isl = createIsland({ items: items() });
    expect(isl.el.getAttribute('role')).toBe('toolbar');
    expect(isl.el.querySelectorAll('.mm-items > .mm-item').length).toBe(7);
    expect(isl.el.querySelector('[aria-label="Add"] svg')).toBeTruthy();
    isl.destroy();
    expect(document.querySelector('.mm')).toBeNull();
  });
  it('reads initial values and defaults', () => {
    const isl = createIsland({ items: items() });
    expect(isl.values()).toEqual({ grid: false, range: 'Week', size: 4, fit: 'Fill' });
    isl.destroy();
  });
  it('reports user changes through item and island callbacks', () => {
    const onChange = vi.fn(), itemChange = vi.fn();
    const its = items(); (its[1] as any).onChange = itemChange;
    const isl = createIsland({ items: its, onChange });
    (isl.el.querySelector('[aria-label="Grid"]') as HTMLButtonElement).click();
    expect(itemChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledWith('grid', true, expect.objectContaining({ grid: true }));
    (isl.el.querySelectorAll('.mm-seg button')[0] as HTMLButtonElement).click();
    expect(isl.get('range')).toBe('Day');
    isl.destroy();
  });
  it('set() changes a value without firing onChange', () => {
    const onChange = vi.fn(), isl = createIsland({ items: items(), onChange });
    isl.set('size', 9); isl.set('range', 'Day');
    expect(isl.get('size')).toBe(9);
    expect(isl.el.querySelector('.mm-seg [aria-checked=true]')!.textContent).toBe('Day');
    expect(onChange).not.toHaveBeenCalled();
    isl.destroy();
  });
  it('update() keeps elements of items whose id survives, and follows controlled values', () => {
    const isl = createIsland({ items: items() });
    const before = isl.el.querySelector('[data-mm-key="grid"]');
    const next = items(); (next[1] as any).value = true; next.splice(0, 1);
    isl.update({ items: next });
    expect(isl.el.querySelector('[data-mm-key="grid"]')).toBe(before);
    expect(isl.el.querySelector('[data-mm-key="add"]')).toBeNull();
    expect(isl.get('grid')).toBe(true);
    isl.destroy();
  });
  it('re-renders an item only when its structure changes', () => {
    const isl = createIsland({ items: [{ type: 'pill', id: 'p', label: 'Share', onClick: () => {} }] });
    const el = isl.el.querySelector('[data-mm-key="p"]')!;
    isl.update({ items: [{ type: 'pill', id: 'p', label: 'Share', onClick: () => {} }] });
    expect(el.textContent).toBe('Share');
    isl.update({ items: [{ type: 'pill', id: 'p', label: 'Shared' }] });
    expect(el.textContent).toBe('Shared');
    isl.destroy();
  });
  it('opens and closes a panel, and reports it', () => {
    const onOpenChange = vi.fn(), onAction = vi.fn(), isl = createIsland({ items: items(), onOpenChange, onAction });
    isl.open('more');
    expect(isl.openId).toBe('more');
    expect(isl.el.querySelector('[data-mm-key="more"]')!.getAttribute('aria-expanded')).toBe('true');
    (isl.el.querySelector('.mm-pc.on .mm-row') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith('more', 'Delete');
    expect(isl.openId).toBeNull();
    expect(onOpenChange.mock.calls.map(c => c[0])).toEqual(['more', null]);
    isl.destroy();
  });
  it('select keeps its trigger label in sync', () => {
    const isl = createIsland({ items: items() });
    isl.open('fit');
    (isl.el.querySelectorAll('.mm-pc.on .mm-row')[1] as HTMLButtonElement).click();
    expect(isl.get('fit')).toBe('Fit');
    expect(isl.el.querySelector('[data-mm-key="fit"]')!.textContent).toContain('Fit');
    isl.destroy();
  });
  it('custom render functions get an element and their cleanup runs on destroy', () => {
    const cleanup = vi.fn();
    const isl = createIsland({ items: [{ type: 'custom', id: 'c', width: 50, render: el => { el.textContent = 'hi'; return cleanup; } }] });
    expect(isl.el.querySelector('.mm-custom')!.textContent).toBe('hi');
    isl.destroy();
    expect(cleanup).toHaveBeenCalled();
  });
  it('applies a theme object as custom properties', () => {
    const isl = createIsland({ items: [], theme: { bar: 'rebeccapurple', accent: 'gold' } });
    expect(isl.el.style.getPropertyValue('--mm-bar')).toBe('rebeccapurple');
    isl.update({ theme: 'light' });
    expect(isl.el.dataset.theme).toBe('light');
    expect(isl.el.style.getPropertyValue('--mm-bar')).toBe('');
    isl.destroy();
  });
});

describe('adapter contract', () => {
  it('collectSlots names every key the engine asks the adapter for', () => {
    const marker = { adapterValue: true };
    const its: IslandItem[] = [
      { type: 'button', id: 'b', label: 'B', icon: marker },
      { type: 'segmented', id: 's', options: [{ value: 'a', icon: marker }] },
      { type: 'menu', id: 'm', label: 'M', icon: marker, items: [{ label: 'x', icon: marker }, 'separator', { label: 'y', icon: marker }] },
      { type: 'panel', id: 'p', label: 'P', icon: marker, content: marker },
      { type: 'custom', id: 'c', render: marker },
    ];
    const expected: string[] = []; collectSlots(its, k => expected.push(k));
    const asked: string[] = [];
    const isl = createIsland({ items: its, slotHost: key => { asked.push(key); return document.createElement('span'); } });
    isl.open('m'); isl.open('p');
    expect(new Set(asked)).toEqual(new Set(expected));
    isl.destroy();
  });
  it('signature ignores functions and values', () => {
    expect(signature({ label: 'a', onClick: () => 1, value: 1 })).toBe(signature({ label: 'a', onClick: () => 2, value: 2 }));
    expect(signature({ label: 'a' })).not.toBe(signature({ label: 'b' }));
  });
});
