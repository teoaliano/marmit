/* knobs: a trigger on the bar whose panel holds a grid of stacked knobs (label above, knob, value below), the way an
   Ableton device lays out its controls. Each knob is the slider's knob variant, so dragging, Shift, double-press reset,
   keys and click-to-type all behave the same. The value is one object: { [knob id]: number }. */
import { h, head, trigger, type Build, type Ctl, type Ctx } from './dom';
import { sliderVariant } from './slider';

export const knobs: Build = (c, ctx) => {
  c.hasValue = true;
  const renderTrigger = trigger(c, ctx);
  const subs = new Map<string, Ctl>();
  const specs = () => (c.cfg.knobs ?? []) as { id: string; value?: number; min?: number; max?: number }[];
  const vals = () => (c.value ?? {}) as Record<string, number>;
  const initial = () => {
    const v: Record<string, number> = { ...vals() };
    for (const k of specs()) if (typeof v[k.id] !== 'number') v[k.id] = k.value ?? ((k.min ?? 0) + (k.max ?? 100)) / 2;
    return v;
  };
  c.render = () => { renderTrigger(); c.value = initial(); };
  c.apply = () => {
    const v = vals();
    subs.forEach((s, id) => { if (typeof v[id] === 'number' && s.value !== v[id]) { s.value = v[id]; s.apply(); } });
  };
  c.panel = {
    build(pc) {
      subs.clear();
      const grid = h('div', 'mm-knobs', { role: 'group', 'aria-label': c.cfg.label });
      grid.style.setProperty('--cols', String(c.cfg.columns ?? Math.min(4, Math.max(1, specs().length))));
      for (const k of specs()) {
        // a knob of its own, reporting into this item's value object
        const sub = { key: c.key + '/' + k.id, type: 'slider', cfg: { ...k, variant: 'knob', stack: true }, value: vals()[k.id], hasValue: true,
          apply() {}, render() {}, w: 0, follow: false, dent: false, drag: false, sig: '', x: 0, y: 0, angle: 0, u: 0 } as unknown as Ctl;
        const subCtx: Ctx = { ...ctx, emit: (_s, v) => { c.value = { ...vals(), [k.id]: v as number }; ctx.emit(c, c.value); }, angleOf: () => 0, relayout: () => {} };
        sliderVariant(sub, subCtx, 'knob');
        sub.render(); sub.apply();
        subs.set(k.id, sub); grid.append(sub.el);
      }
      pc.replaceChildren(...[head(c.cfg.title, c.cfg.label)].filter(Boolean) as Node[], grid);
    },
    onOpen: pc => pc.querySelector<HTMLElement>('.mm-kn'),
  };
};
