// Conditional controls: an item shows only while another item's value matches, and the bar reshapes around it.
SHOWCASE.add({
  id: 'visible-when',
  title: 'Conditional controls (visibleWhen)',
  desc: 'Outline width only exists while Outline is on, and the px slider only for Custom. Hidden items keep their values, and the bar melts to its new length.',
  mount(stage, out) {
    const { createIsland } = Marmit;
    const host = document.createElement('div'); stage.append(host);
    const isl = createIsland({
      mode: 'inline', container: host, label: 'Conditional controls',
      onChange: (id, v, all) => out(all),
      items: [
        { type: 'switch', id: 'outline', label: 'Outline', value: true },
        { type: 'slider', id: 'outlineWidth', label: 'Width', min: 0, max: 12, step: 1, value: 2, width: 80, visibleWhen: { field: 'outline' } },
        { type: 'separator', visibleWhen: { field: 'outline' } },
        { type: 'segmented', id: 'size', options: ['S', 'M', 'L', 'Custom'], value: 'M' },
        { type: 'slider', id: 'customSize', label: 'px', min: 8, max: 96, step: 1, value: 24, width: 80, visibleWhen: { field: 'size', is: 'Custom' } },
      ],
    });
    out(isl.values());
    return isl;
  },
});
