SHOWCASE.add({
  id: 'anchor', title: 'Anchor',
  desc: 'Click a dot to set both alignments at once. Tab to it, then use the arrow keys to move one cell (no wrapping); only the chosen cell is in the tab order.',
  mount(stage, out) {
    // earlier rows stack above later ones, so an open panel covers the rows under it
    const host = (cap) => { const p = document.createElement('div'); p.className = 'cap'; p.textContent = cap; const d = document.createElement('div'); d.style.cssText = `position:relative`; stage.append(p, d); return d; };
    const all = {};
    const make = (cap, items) => {
      const isl = Marmit.createIsland({ mode: 'inline', container: host(cap), items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const a = make('Alone, default center', [
      { type: 'anchor', id: 'origin', label: 'Origin' },
    ]);
    const b = make('Beside other bar items, starting top left', [
      { type: 'button', id: 'frame', label: 'Frame', icon: 'frame' },
      { type: 'button', id: 'text', label: 'Text', icon: 'text' },
      { type: 'separator' },
      { type: 'anchor', id: 'align', label: 'Alignment', value: { x: 'left', y: 'top' } },
      { type: 'separator' },
      { type: 'button', id: 'lock', label: 'Lock', icon: 'lock', toggle: true },
    ]);
    out(all);
    return [a, b];
  },
});
