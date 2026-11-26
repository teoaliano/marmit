import { afterEach, describe, expect, it } from 'vitest';
import { createIsland } from '../src/core/index';
import {
  DEFAULTS, builtIns, fit, intensify, intensity, keyNudge, matches, modeOf, nextCustomName, normalize, nudge, parseCurve,
  pickPreset, presetName, settle, springAt, toPhysics, type CustomPreset, type Ease,
} from '../src/core/parts/transition-math';

afterEach(() => { document.body.innerHTML = ''; });

describe('spring maths', () => {
  it('time → physics: stiffness from the duration, damping from the bounce, mass 1', () => {
    const p = toPhysics({ visualDuration: 0.5, bounce: 0.25 }), w = 2 * Math.PI / 0.6;
    expect(p.stiffness).toBeCloseTo(w * w, 9);
    expect(p.damping).toBeCloseTo(2 * 0.75 * w, 9);
    expect(p.mass).toBe(1);
  });
  it('floors the duration at 0.05 and keeps damping ≥ 5% of critical', () => {
    expect(toPhysics({ visualDuration: 0, bounce: 0 }).stiffness).toBeCloseTo((2 * Math.PI / 0.06) ** 2, 6);
    const p = toPhysics({ visualDuration: 0.3, bounce: 2 });
    expect(p.damping).toBeCloseTo(2 * 0.05 * Math.sqrt(p.stiffness), 9);
  });
  it('passes physics springs through', () => {
    expect(toPhysics({ stiffness: 300, damping: 20, mass: 2 })).toEqual({ stiffness: 300, damping: 20, mass: 2 });
  });
  it('step response starts at 0 and settles on 1 in all three damping regimes', () => {
    for (const damping of [5, 2 * Math.sqrt(100), 60]) {
      const p = { stiffness: 100, damping, mass: 1 };
      expect(springAt(0, p)).toBe(0);
      expect(springAt(10, p)).toBeCloseTo(1, 3);
    }
    // under-damped overshoots, over-damped never does
    const under = { stiffness: 100, damping: 4, mass: 1 }, over = { stiffness: 100, damping: 60, mass: 1 };
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => springAt(i / 100, under)))).toBeGreaterThan(1.3);
    expect(Math.max(...Array.from({ length: 500 }, (_, i) => springAt(i / 100, over)))).toBeLessThanOrEqual(1);
  });
  it('settle time: ln(200) over the decay rate, clamped 0.05–10, to 0.01', () => {
    const p = { stiffness: 200, damping: 25, mass: 1 }, z = 25 / (2 * Math.sqrt(200));
    expect(settle(p)).toBe(Math.round(Math.log(200) / (z * Math.sqrt(200)) * 100) / 100);
    expect(settle({ stiffness: 1, damping: 0.001, mass: 10 })).toBe(10);
    expect(settle({ stiffness: 1e6, damping: 2e3, mass: 0.1 })).toBe(0.05);
    // over-damped: the slow root decides
    const o = { stiffness: 100, damping: 60, mass: 1 }, zo = 3, w = 10;
    expect(settle(o)).toBe(Math.round(Math.log(200) / (zo * w - w * Math.sqrt(zo * zo - 1)) * 100) / 100);
  });
});

describe('bézier', () => {
  it('fits overshoot by shrinking the scale', () => {
    expect(fit([0.33, 0, 0, 1], 248, 144).scale).toBe(Math.min(248 - 24, (72 - 12) / 0.5));
    const big = fit([0.6, -0.85, 0, 1.65], 248, 144);
    expect(big.scale).toBeCloseTo((72 - 12) / 1.35, 9);
    expect(big.start).toEqual({ x: 124 - 0.5 * big.scale, y: 72 + 0.5 * big.scale });
  });
  it('drags clamp x to [0,1] and y to [-1,2] at 2dp, and leave a still axis alone', () => {
    const e: Ease = [0.333, 0.123, 0.5, 1];
    expect(nudge(e, 0, 1000, 0, 100)).toEqual([1, 0.123, 0.5, 1]);
    expect(nudge(e, 0, 0, -1000, 100)).toEqual([0.333, 2, 0.5, 1]);
    expect(nudge(e, 1, -1000, 1000, 100)).toEqual([0.333, 0.123, 0, -1]);
    expect(nudge(e, 1, 12.345, 0, 100)).toEqual([0.333, 0.123, 0.62, 1]);
    expect(nudge(e, 0, 5, 5, 0)).toEqual(e);
  });
  it('arrow keys nudge 0.01, Shift 0.1; ArrowUp raises y', () => {
    const e: Ease = [0.5, 0.5, 0.5, 0.5];
    expect(keyNudge(e, 0, 'ArrowUp', false)).toEqual([0.5, 0.51, 0.5, 0.5]);
    expect(keyNudge(e, 1, 'ArrowLeft', true)).toEqual([0.5, 0.5, 0.4, 0.5]);
    expect(keyNudge(e, 0, 'Enter', false)).toBeNull();
  });
  it('parses a whole curve: four numbers, x inside [0,1], y clamped', () => {
    expect(parseCurve('0.4, 0, 0.2, 1')).toEqual([0.4, 0, 0.2, 1]);
    expect(parseCurve(' .25,-3 ,1, 5 ')).toEqual([0.25, -1, 1, 2]);
    expect(parseCurve('1.2, 0, 0.2, 1')).toBeNull();
    expect(parseCurve('0.4, 0, 0.2')).toBeNull();
    expect(parseCurve('0.4, 0, a, 1')).toBeNull();
    expect(parseCurve('cubic-bezier(0.4, 0, 0.2, 1)')).toBeNull();
  });
  it('normalises broken values into one mode shape', () => {
    expect(normalize({ type: 'easing', ease: [NaN, 0, 2, 1] })).toEqual({ type: 'easing', duration: 0.3, ease: [0, 0, 1, 1] });
    expect(modeOf({ type: 'spring', stiffness: 1 })).toBe('physics');
    expect(modeOf({ type: 'spring', stiffness: 1, bounce: 0 })).toBe('time');
  });
});

describe('intensity', () => {
  it('k scales the handles from their endpoints: 0 linear, 1 itself, 2 twice as strong', () => {
    const e: Ease = [0.4, 0.1, 0.2, 1];
    expect(intensify(e, 0)).toEqual([0, 0, 1, 1]);
    expect(intensify(e, 1)).toEqual(e);
    expect(intensify(e, 2)).toEqual([0.8, 0.2, 0, 1]);
    expect(intensify([0.6, -0.85, 0, 1.65], 2)).toEqual([1, -1, 0, 2]);
  });
  it('an outside change re-bases at 50; the slider maps from that base', () => {
    const t = intensity(), e: Ease = [0.4, 0.1, 0.2, 1];
    expect(t.read(e)).toBe(50);
    const s = t.apply(e, 0);
    expect(s).toEqual([0, 0, 1, 1]);
    expect(t.read(s)).toBe(0);
    expect(t.apply(s, 100)).toEqual([0.8, 0.2, 0, 1]);
    expect(t.read([0.1, 0.2, 0.3, 0.4])).toBe(50);
  });
});

describe('presets', () => {
  it('match within ±0.005; easing ignores duration', () => {
    const glide = builtIns('easing').find(p => p.name === 'Glide')!.value;
    expect(matches(glide, { type: 'easing', duration: 2, ease: [0.334, 0.004, 0, 1] }, 'easing')).toBe(true);
    expect(matches(glide, { type: 'easing', duration: 0.3, ease: [0.336, 0, 0, 1] }, 'easing')).toBe(false);
    expect(presetName({ type: 'spring', visualDuration: 0.5, bounce: 0.35 }, 'time', [])).toBe('Gentle');
    expect(presetName({ type: 'spring', stiffness: 120, damping: 14, mass: 1 }, 'physics', [])).toBe('Gentle');
    expect(presetName({ type: 'spring', stiffness: 121, damping: 14, mass: 1 }, 'physics', [])).toBe('Custom');
  });
  it('built-ins win over saved; saved names are next after the highest', () => {
    const cs: CustomPreset[] = [
      { id: 'a', name: 'Custom 3', mode: 'easing', value: { type: 'easing', duration: 0.3, ease: [0.1, 0.2, 0.3, 0.4] } },
      { id: 'b', name: 'Custom 7', mode: 'time', value: DEFAULTS.time },
    ];
    expect(presetName({ type: 'easing', duration: 1, ease: [0.1, 0.2, 0.3, 0.4] }, 'easing', cs)).toBe('Custom 3');
    expect(nextCustomName(cs, 'easing')).toBe('Custom 4');
    expect(nextCustomName(cs, 'physics')).toBe('Custom 1');
  });
  it('picking an easing keeps the duration', () => {
    const v = pickPreset({ type: 'easing', duration: 0.8, ease: [0, 0, 1, 1] }, builtIns('easing')[0].value, 'easing');
    expect(v).toEqual({ type: 'easing', duration: 0.8, ease: [0.33, 0, 0, 1] });
    expect(pickPreset(DEFAULTS.time, builtIns('easing')[0].value, 'easing')).toMatchObject({ duration: 0.3 });
  });
});

describe('transition control', () => {
  it('cleans its value, honours modes and follows controller.set', () => {
    const host = document.createElement('div'); document.body.append(host);
    const isl = createIsland({ mode: 'inline', container: host, items: [
      { type: 'transition', id: 't', label: 'T' },
      { type: 'transition', id: 'e', label: 'E', modes: ['easing'], value: { type: 'spring', visualDuration: 1, bounce: 0 } },
    ] });
    expect(isl.get('t')).toEqual(DEFAULTS.easing);
    expect(isl.get('e')).toEqual(DEFAULTS.easing);
    isl.set('t', { type: 'spring', stiffness: 120, damping: 14, mass: 1, extra: 1 } as never);
    expect(isl.get('t')).toEqual({ type: 'spring', stiffness: 120, damping: 14, mass: 1 });
    expect(host.ownerDocument.querySelector('.mm-pill')?.textContent).toContain('Gentle');
    isl.destroy();
  });
});
