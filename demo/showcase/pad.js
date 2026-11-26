SHOWCASE.add({
  id: 'pad', title: 'Pad (2D)',
  desc: 'Open a pad and click or drag on the surface; grab the point to move it without a jump. Shift-drag locks to the axis you move along most; a click near a grid crossing snaps to it. Double-click or Home resets, Escape mid-drag puts it back, arrows step (Shift ×10). Scrub the X / Y labels sideways, or type in the fields.',
  mount(stage, out) {
    // earlier rows stack above later ones, so an open panel covers the rows under it
    const host = (cap) => { const p = document.createElement('div'); p.className = 'cap'; p.textContent = cap; const d = document.createElement('div'); d.style.cssText = `position:relative`; stage.append(p, d); return d; };
    const all = {};
    const make = (cap, items) => {
      const isl = Marmit.createIsland({ mode: 'inline', container: host(cap), items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const a = make('Default: −1…1 both axes, step 0.01; the trigger icon previews the point', [
      { type: 'pad', id: 'pad', label: 'Position' },
    ]);
    const b = make('Offset 0…100 px both axes, beside other items', [
      { type: 'button', id: 'shape', label: 'Shape', icon: 'shape' },
      { type: 'separator' },
      { type: 'pad', id: 'offset', label: 'Shadow offset', title: 'Shadow offset', x: { min: 0, max: 100, step: 1, unit: 'px' }, y: { min: 0, max: 100, step: 1, unit: 'px' }, value: { x: 24, y: 60 } },
      { type: 'pad', id: 'focal', label: 'Focal point', trigger: 'pill', x: { min: 0, max: 100, step: 1, unit: '%', label: 'H' }, y: { min: 0, max: 100, step: 1, unit: '%', label: 'V' }, value: { x: 50, y: 50 } },
    ]);
    const c = make('dragLabels: false (labels are plain; click one to type)', [
      { type: 'pad', id: 'tilt', label: 'Tilt', dragLabels: false, value: { x: 0.3, y: -0.4 } },
    ]);
    stage.style.paddingBottom = '300px'; // room for the last row's panel
    out(all);
    return [a, b, c];
  },
});
