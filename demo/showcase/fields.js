SHOWCASE.add({
  id: 'fields', title: 'Fields row',
  desc: 'Drag a letter sideways to scrub (Shift ×10), click a value to type, or focus it and use ↑ ↓ / Page keys. With the link on, editing one axis scales the others by the same ratio (by the same offset when it was 0), never past any axis’s limits.',
  mount(stage, out) {
    const host = (cap) => { const p = document.createElement('div'); p.className = 'cap'; p.textContent = cap; const d = document.createElement('div'); stage.append(p, d); return d; };
    const all = {};
    const make = (cap, items) => {
      const isl = Marmit.createIsland({ mode: 'inline', container: host(cap), items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const a = make('Scale XYZ, linked, 0.1–3', [
      { type: 'fields', id: 'scale', label: 'Scale', axes: ['x', 'y', 'z'], min: 0.1, max: 3, step: 0.01, unit: '×', linked: true,
        value: { x: 1.25, y: 1, z: 0.5 } },
    ]);
    const b = make('Position XY (px), unlinked, beside other bar items', [
      { type: 'button', id: 'move', label: 'Move', icon: 'cursor' },
      { type: 'separator' },
      { type: 'fields', id: 'position', label: 'Position', axes: ['x', 'y'], step: 1, unit: 'px', value: { x: 120, y: -40 }, fieldWidth: 72 },
      { type: 'separator' },
      { type: 'fields', id: 'rotation', label: 'Rotation', axes: [{ key: 'deg', label: 'R' }], min: -180, max: 180, unit: '°', value: { deg: 15 } },
    ]);
    const c = make('Padding T / R / B / L, linked from zero (additive)', [
      { type: 'fields', id: 'padding', label: 'Padding', axes: [{ key: 'top', label: 'T' }, { key: 'right', label: 'R' }, { key: 'bottom', label: 'B' }, { key: 'left', label: 'L' }],
        min: 0, max: 64, step: 1, unit: 'px', linked: true, value: { top: 0, right: 8, bottom: 0, left: 8 }, fieldWidth: 56 },
    ]);
    const d = make('no label, no link button', [
      { type: 'fields', id: 'offset', axes: ['x', 'y'], min: -1, max: 1, step: 0.05, linkable: false, value: { x: 0.25, y: -0.5 } },
    ]);
    out(all);
    return [a, b, c, d];
  },
});
