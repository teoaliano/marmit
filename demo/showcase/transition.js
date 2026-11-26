// transition section: the easing / spring editor
SHOWCASE.add({
  id: 'transition',
  title: 'Transition',
  desc: 'Open each pill. Drag the curve handles (arrow keys nudge, Esc mid-drag reverts), scrub or type the four numbers, paste "0.4, 0, 0.2, 1" into one, or pick a preset. Copy on one transition and paste on another: the tab comes with it.',
  mount(stage, out) {
    const row = (cap) => {
      const wrap = document.createElement('div'); wrap.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:14px;position:relative`;
      if (cap) { const p = document.createElement('p'); p.className = 'cap'; p.textContent = cap; wrap.append(p); }
      const host = document.createElement('div'); wrap.append(host); stage.append(wrap); return host;
    };
    const all = {};
    const make = (cap, items) => {
      const isl = Marmit.createIsland({ mode: 'inline', container: row(cap), items, onChange: (id, v) => { all[id] = v; out(all); } });
      Object.assign(all, isl.values()); return isl;
    };
    const islands = [
      make('all three tabs, alongside other bar items', [
        { type: 'button', id: 'play', label: 'Play', icon: 'play' },
        { type: 'transition', id: 'enter', label: 'Enter', value: { type: 'easing', duration: 0.3, ease: [0.33, 0, 0, 1] } },
        { type: 'separator' },
        { type: 'transition', id: 'hover', label: 'Hover', value: { type: 'spring', visualDuration: 0.5, bounce: 0.35 } },
        { type: 'transition', id: 'drag', label: 'Drag', value: { type: 'spring', stiffness: 180, damping: 12, mass: 1 } },
      ]),
      make("modes: ['easing'] (no tabs)", [
        { type: 'label', text: 'Fade' },
        { type: 'transition', id: 'fade', label: 'Fade', modes: ['easing'], value: { type: 'easing', duration: 0.6, ease: [0.6, -0.85, 0, 1.65] } },
      ]),
      make("modes: ['time', 'physics'], titled", [
        { type: 'transition', id: 'sheet', label: 'Sheet', title: 'Sheet spring', modes: ['time', 'physics'] },
      ]),
    ];
    out(all);
    return islands;
  },
});
