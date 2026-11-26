// The original bar controls, one section per family, so the showcase covers everything marmit has.
(() => {
  const row = (stage, cap, opts) => {
    const p = document.createElement('p'); p.className = 'cap'; p.textContent = cap;
    const d = document.createElement('div'); stage.append(p, d);
    return Marmit.createIsland({ mode: 'inline', container: d, ...opts });
  };
  const thumb = (a, b) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`);
  const watch = out => ({ onChange: (id, v, all) => out(all), onAction: (id, e) => out('action ' + id + (e ? ' → ' + e : '')) });

  SHOWCASE.add({
    id: 'buttons', title: 'Buttons and pills',
    desc: 'Primary, icon, toggle and badge buttons; soft and solid pills. Press one to see the bar dent under it, or pull the bar to bend it at that spot.',
    mount(stage, out) {
      return [
        row(stage, 'icon buttons: primary · plain · toggle · badges', { ...watch(out), items: [
          { type: 'button', id: 'add', label: 'Add', icon: 'plus', variant: 'primary' },
          { type: 'button', id: 'undo', label: 'Undo', icon: 'undo' },
          { type: 'button', id: 'redo', label: 'Redo', icon: 'redo' },
          { type: 'button', id: 'grid', label: 'Grid', icon: 'grid', toggle: true },
          { type: 'button', id: 'bell', label: 'Notifications', icon: 'bell', badge: 3 },
          { type: 'button', id: 'chat', label: 'Comments', icon: 'comment', badge: true },
        ] }),
        row(stage, 'pills: soft · solid, with and without icons', { ...watch(out), items: [
          { type: 'pill', id: 'share', label: 'Share', icon: 'share' },
          { type: 'pill', id: 'draft', label: 'Save draft' },
          { type: 'separator' },
          { type: 'pill', id: 'publish', label: 'Publish', variant: 'solid' },
        ] }),
      ];
    },
  });

  SHOWCASE.add({
    id: 'choice', title: 'Choice: segmented, switch, stepper',
    desc: 'The segmented highlight slides between options; the switch and stepper sit inline with their labels.',
    mount(stage, out) {
      return [
        row(stage, 'segmented · switch · stepper', { ...watch(out), items: [
          { type: 'segmented', id: 'range', options: ['Day', 'Week', 'Month'], value: 'Week' },
          { type: 'separator' },
          { type: 'switch', id: 'snap', label: 'Snap', value: true },
          { type: 'separator' },
          { type: 'stepper', id: 'zoom', min: 25, max: 400, step: 25, value: 100, format: v => v + '%' },
        ] }),
        row(stage, 'segmented with icons', { ...watch(out), items: [
          { type: 'segmented', id: 'align', options: [{ value: 'grid', icon: 'grid', label: 'Grid' }, { value: 'frame', icon: 'frame', label: 'Frame' }, { value: 'text', icon: 'text', label: 'Text' }], value: 'grid' },
        ] }),
      ];
    },
  });

  SHOWCASE.add({
    id: 'pickers', title: 'Inline pickers: swatches and thumbnails',
    desc: 'Small choice sets that live right on the bar, no panel.',
    mount(stage, out) {
      return row(stage, 'swatches · image thumbs', { ...watch(out), items: [
        { type: 'swatches', id: 'swatch', options: ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6'] },
        { type: 'separator' },
        { type: 'thumbs', id: 'thumb', options: [thumb('#f97316', '#7c3aed'), thumb('#06b6d4', '#1e3a8a'), thumb('#facc15', '#be123c')] },
      ] });
    },
  });

  SHOWCASE.add({
    id: 'menus', title: 'Fields, selects and menus',
    desc: 'A text field on the bar, then panels that grow out of it: select, menu, insert grid and a command search.',
    mount(stage, out) {
      return [
        row(stage, 'field · select · menu', { ...watch(out), items: [
          { type: 'field', id: 'name', placeholder: 'Layer name', width: 150 },
          { type: 'select', id: 'fit', label: 'Fit', options: ['Fill', 'Fit', 'Stretch'], value: 'Fill' },
          { type: 'separator' },
          { type: 'menu', id: 'more', label: 'More', icon: 'more', items: [
            { label: 'Duplicate', icon: 'copy', shortcut: '⌘D' }, { label: 'Rename', icon: 'pen', shortcut: '⏎' },
            'separator', { label: 'Delete', icon: 'trash', shortcut: '⌫', danger: true },
          ] },
        ] }),
        row(stage, 'grid · command search · pill menu', { ...watch(out), items: [
          { type: 'grid', id: 'insert', label: 'Insert', icon: 'plus', items: [
            { label: 'Text', icon: 'text' }, { label: 'Image', icon: 'image' }, { label: 'Shape', icon: 'shape' },
            { label: 'Frame', icon: 'frame' }, { label: 'Sticky', icon: 'sticky' }, { label: 'Embed', icon: 'embed' },
          ] },
          { type: 'command', id: 'find', label: 'Search', icon: 'search', placeholder: 'Search layers', items: [
            { label: 'Header', icon: 'frame', hint: 'Frame' }, { label: 'Table', icon: 'grid', hint: 'Frame' }, { label: 'Colours', icon: 'palette', hint: 'Style' },
          ] },
          { type: 'separator' },
          { type: 'menu', id: 'view', label: 'View', trigger: 'pill', items: [
            { label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, { label: 'Zoom out', icon: 'zoomOut', shortcut: '⌘−' },
            'separator', { label: 'Show grid', checked: true }, { label: 'Snap to pixels', checked: false },
          ] },
        ] }),
      ];
    },
  });

  SHOWCASE.add({
    id: 'status', title: 'Status and search',
    desc: 'Live dot, avatar stack and a progress ring (click it). The search icon melts the bar open and a close droplet pinches off.',
    mount(stage, out) {
      let isl;
      const run = () => { const t0 = performance.now(); (function step(now) { const f = Math.min(1, (now - t0) / 2000); isl.set('upload', f); if (f < 1) requestAnimationFrame(step); })(t0); };
      isl = row(stage, 'status · avatars · progress', { ...watch(out), items: [
        { type: 'status', label: 'Live' },
        { type: 'separator' },
        { type: 'avatars', people: [{ name: 'Ada K' }, { name: 'Jane Lee' }, { name: 'Bo R' }, { name: 'Cy D' }, { name: 'Eve M' }] },
        { type: 'separator' },
        { type: 'progress', id: 'upload', label: 'Upload', value: 0, onClick: () => run() },
      ] });
      const s = row(stage, 'search', { ...watch(out), items: [
        { type: 'button', label: 'Add', icon: 'plus', variant: 'primary' },
        { type: 'button', label: 'Undo', icon: 'undo' },
        { type: 'separator' },
        { type: 'search', id: 'q', placeholder: 'Search' },
      ] });
      return [isl, s];
    },
  });
})();
