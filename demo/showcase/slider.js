SHOWCASE.add({
  id: 'slider', title: 'Slider',
  desc: 'Sliders in real bars. The default is the fill pill: drag anywhere (relative, Shift for fine), tap the value to type. The last row mixes the three variants: fill, notched (one cell per value) and knob (drag up, double-click to reset). Arrows step, Shift steps ten.',
  mount(stage, out) {
    const host = (cap) => { const p = document.createElement('div'); p.className = 'cap'; p.textContent = cap; const d = document.createElement('div'); stage.append(p, d); return d; };
    const all = {};
    const make = (cap, items) => {
      const isl = Marmit.createIsland({ mode: 'inline', container: host(cap), items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const a = make('units: °  ×  s  %  px', [
      { type: 'slider', id: 'rotate', label: 'Rotate', min: -180, max: 180, step: 1, value: 45, unit: '°', width: 170 },
      { type: 'separator' },
      { type: 'slider', id: 'scale', label: 'Scale', min: 0.1, max: 3, step: 0.01, value: 1.5, unit: '×', width: 170 },
      { type: 'separator' },
      { type: 'slider', id: 'duration', label: 'Duration', min: 0, max: 2, step: 0.05, value: 0.3, unit: 's', width: 170 },
    ]);
    const b = make('% and px', [
      { type: 'slider', id: 'opacity', label: 'Opacity', min: 0, max: 100, step: 1, value: 80, unit: '%' },
      { type: 'separator' },
      { type: 'slider', id: 'radius', label: 'Radius', min: 0, max: 48, step: 2, value: 12, unit: 'px' },
    ]);
    const c = make('few steps (0–5, step 1) vs many (0–1000, step 1)', [
      { type: 'slider', id: 'stars', label: 'Stars', min: 0, max: 5, step: 1, value: 3 },
      { type: 'separator' },
      { type: 'slider', id: 'weight', label: 'Weight', min: 0, max: 1000, step: 1, value: 400, width: 200 },
    ]);
    const d = make('not editable · custom format · no value shown', [
      { type: 'slider', id: 'locked', label: 'Fixed', min: 0, max: 1, step: 0.01, value: 0.25, editable: false },
      { type: 'separator' },
      { type: 'slider', id: 'gain', label: 'Gain', min: -24, max: 24, step: 0.5, value: 0, format: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
      { type: 'separator' },
      { type: 'slider', id: 'bare', min: 0, max: 10, value: 5, showValue: false, width: 120 },
    ]);
    const e = make('the three variants together: fill · notched · knob', [
      { type: 'slider', id: 'mix', label: 'Mix', min: 0, max: 100, step: 1, value: 65, unit: '%' },
      { type: 'separator' },
      { type: 'slider', id: 'voices', variant: 'notched', label: 'Voices', min: 1, max: 8, step: 1, value: 3 },
      { type: 'separator' },
      { type: 'slider', id: 'drive', variant: 'knob', label: 'Drive', min: -12, max: 12, step: .5, value: 3, unit: 'dB' },
      { type: 'slider', id: 'tone', variant: 'knob', label: 'Tone', min: 0, max: 100, step: 1, value: 40, unit: '%' },
    ]);
    out(all);
    return [a, b, c, d, e];
  },
});
