SHOWCASE.add({
  id: 'color', title: 'Color',
  desc: 'Open a swatch: drag the field, the hue and opacity bars, or type and scrub the channel letters (Shift ×10, ↑ ↓ to step). Switching the format tab rewrites the same colour; the printed value follows it.',
  mount(stage, out) {
    const host = (cap) => { const p = document.createElement('div'); p.className = 'cap'; p.textContent = cap; const d = document.createElement('div'); d.style.position = 'relative'; stage.append(p, d); return d; };
    const all = {};
    const make = (cap, items) => {
      const el = host(cap);
      // an open panel hangs over the rows below it, so lift its row above them
      const isl = Marmit.createIsland({ mode: 'inline', container: el, items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const a = make('default picker from a hex, beside other bar items', [
      { type: 'button', id: 'pen', label: 'Pen', icon: 'pen' },
      { type: 'separator' },
      { type: 'color', id: 'fill', label: 'Fill', value: '#3B82F6' },
      { type: 'color', id: 'stroke', label: 'Stroke', icon: 'shape', trigger: 'icon', value: '#F97316CC' },
    ]);
    const b = make('starts from oklch(), translucent', [
      { type: 'color', id: 'accent', label: 'Accent', value: 'oklch(0.7 0.15 150 / 0.8)' },
    ]);
    const c = make('Display P3 only (wide gamut)', [
      { type: 'color', id: 'glow', label: 'Glow', value: 'color(display-p3 1 0.2 0.4)', formats: ['p3', 'oklch'] },
    ]);
    const d = make('alpha: false, hex / rgb / hsl tabs', [
      { type: 'color', id: 'text', label: 'Text', value: 'hsl(220 15% 20%)', alpha: false, formats: ['hex', 'rgb', 'hsl'] },
    ]);
    const e = make('picker: false (swatches only)', [
      { type: 'color', id: 'tag', label: 'Tag', picker: false, value: '#22c55e' },
    ]);
    out(all);
    return [a, b, c, d, e];
  },
});
