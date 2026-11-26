// gradient section: four starting gradients, each with a box painted by Marmit.gradientCss(value)
SHOWCASE.add({
  id: 'gradient', title: 'Gradient',
  desc: 'Open a gradient from its chip. Click the bar to add a stop, drag a handle along it, pull it up or down to remove it; Alt+↑/↓ on a row moves its colour. The box beside each bar is painted with Marmit.gradientCss(value).',
  mount(stage, out) {
    const presets = [
      { id: 'duo', label: 'Two stops', value: { shape: 'linear', angle: 90, stops: [{ at: 0, color: '#6366f1' }, { at: 100, color: '#ec4899' }] } },
      { id: 'sunset', label: 'Sunset', value: { shape: 'linear', angle: 180, stops: [
        { at: 0, color: '#1e1b4b' }, { at: 38, color: '#9d174d' }, { at: 70, color: '#f97316' }, { at: 100, color: '#fde68a' }] } },
      { id: 'glow', label: 'Radial', value: { shape: 'radial', angle: 0, stops: [{ at: 0, color: '#fef08a' }, { at: 45, color: 'rgb(34 197 94 / 70%)' }, { at: 100, color: 'transparent' }] } },
      { id: 'wheel', label: 'Conic', maxStops: 6, value: { shape: 'conic', angle: 0, stops: [
        { at: 0, color: 'hsl(0 90% 60%)' }, { at: 33, color: 'hsl(120 90% 45%)' }, { at: 67, color: 'hsl(240 90% 65%)' }, { at: 100, color: 'hsl(360 90% 60%)' }] } },
    ];
    const all = {}, islands = [];
    presets.forEach((p, i) => {
      // earlier rows stack above later ones, so an open panel covers the bars below it
      const row = document.createElement('div'); row.style.cssText = `display:flex;align-items:center;gap:16px;position:relative`;
      const host = document.createElement('div'), box = document.createElement('div');
      box.style.cssText = 'width:88px;height:56px;border-radius:12px;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .1);' +
        'background-color:#fff;background-image:repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%);background-size:10px 10px';
      const paint = v => { box.style.backgroundImage = Marmit.gradientCss(v) + ', repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%)'; box.style.backgroundSize = '100% 100%, 10px 10px'; box.title = Marmit.gradientCss(v); };
      row.append(host, box); stage.append(row);
      const isl = Marmit.createIsland({ mode: 'inline', container: host, items: [
        { type: 'gradient', id: p.id, label: p.label, value: p.value, maxStops: p.maxStops },
      ], onChange: (id, v) => { paint(v); all[id] = v; out(all); } });
      paint(p.value); all[p.id] = isl.values()[p.id]; islands.push(isl);
    });
    out(all);
    return islands;
  },
});
