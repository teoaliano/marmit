// The catalog: every marmit component taken apart. Each entry is real config; render.js clones the rendered control
// for its anatomy, parts and states, and mounts a live one. States force pseudo-classes through generated .st-* rules.
// force: [[class, selector?]] — the class goes on the specimen's control, or on the parts matching selector.
(() => {
  const H = 'st-hover', F = 'st-focus', A = 'st-active';
  const thumb = (a, b) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`);
  const C = CATALOG;

  C.group('atoms', 'Atoms', 'The smallest pieces. Every control is assembled from these; change one here and it changes everywhere it is used.');
  C.group('bar', 'Bar controls', 'Controls that sit on the bar. Each is a 32px item; the bar insets them by 4px on every side.');
  C.group('panel', 'Panel controls', 'A trigger on the bar plus a panel that grows out of it through a gooey neck.');
  C.group('shell', 'Shell', 'The material around the controls: the bar itself, panels, tooltips, the search droplet, the collapse tab.');

  /* ---------------- atoms ---------------- */
  C.add({ group: 'atoms', id: 'a-icon-button', name: 'Icon button', code: '.mm-btn',
    desc: 'A 32px round hit area holding a 14px icon. The base of buttons, menu triggers and the link toggle.',
    variants: [{ type: 'button', label: 'Add', icon: 'plus' }, { type: 'button', label: 'Grid', icon: 'grid', toggle: true, value: true }, { type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', label: 'Add', icon: 'plus', disabled: true }],
    parts: [[':scope', 'Hit area'], ['.mm-ic', 'Icon']],
    states: [{ name: 'default' }, { name: 'hover', force: [[H]] }, { name: 'pressed', force: [[A], ['pressed']] }, { name: 'focus', note: 'keyboard only', force: [[F]] }, { name: 'on', v: 1 }, { name: 'menu open', force: [['@aria-expanded=true']] }, { name: 'menu floating', note: 'panel detached', force: [['mm-detached']] }, { name: 'primary', v: 2 }, { name: 'disabled', v: 3 }] });

  C.add({ group: 'atoms', id: 'a-pill', name: 'Pill', code: '.mm-pill',
    desc: 'A labelled rounded button. Soft by default, solid for the main action; also the trigger for pill-style menus.',
    variants: [{ type: 'pill', label: 'Share' }, { type: 'pill', label: 'Share', icon: 'share' }, { type: 'pill', label: 'Publish', variant: 'solid' }, { type: 'pill', label: 'Share', disabled: true }],
    parts: [[':scope', 'Pill'], ['.mm-ic', 'Icon']],
    states: [{ name: 'default' }, { name: 'with icon', v: 1 }, { name: 'hover', force: [[H]] }, { name: 'pressed', force: [[A]] }, { name: 'focus', force: [[F]] }, { name: 'solid', v: 2 }, { name: 'solid hover', v: 2, force: [[H]] }, { name: 'disabled', v: 3 }] });

  C.add({ group: 'atoms', id: 'a-badge', name: 'Badge', code: '.mm-badge',
    desc: 'A count or a dot pinned to a button’s corner.',
    variants: [{ type: 'button', label: 'Bell', icon: 'bell', badge: 3 }, { type: 'button', label: 'Bell', icon: 'bell', badge: true }, { type: 'button', label: 'Bell', icon: 'bell', badge: '99+' }],
    parts: [[':scope', 'Button'], ['.mm-badge', 'Badge']],
    states: [{ name: 'count' }, { name: 'dot', v: 1 }, { name: 'long', v: 2 }] });

  C.add({ group: 'atoms', id: 'a-label', name: 'Label and separator', code: '.mm-label · .mm-sep',
    desc: 'Text that names a group, and the 1px rule that divides groups (a 9.5px slot on the bar).',
    variants: [{ type: 'label', text: 'Label' }, { type: 'label', text: 'Muted', muted: true }, { type: 'separator' }],
    parts: [[':scope', 'Label']], explode: false,
    states: [{ name: 'label' }, { name: 'muted', v: 1 }, { name: 'separator', v: 2 }] });

  C.add({ group: 'atoms', id: 'a-value', name: 'Value and unit', code: '.mm-value · .mm-unit',
    desc: 'A number in tabular figures, with its unit in the muted tone. A word unit gets a space ("12 px"), a symbol doesn’t ("45°").',
    variants: [{ type: 'slider', variant: 'knob', label: 'Radius', value: 12, min: 0, max: 40, unit: 'px' }, { type: 'slider', variant: 'knob', label: 'Rotate', value: 45, min: 0, max: 360, unit: '°' }],
    pick: n => n.querySelector('.mm-value'), parts: [[':scope', 'Value'], ['.mm-unit', 'Unit']],
    states: [{ name: 'word unit' }, { name: 'symbol unit', v: 1 }, { name: 'hover (editable)', force: [[H]] }] });

  C.add({ group: 'atoms', id: 'a-switch', name: 'Switch', code: '.mm-switch',
    desc: 'An on/off toggle with a sliding knob.',
    variants: [{ type: 'switch', value: false }, { type: 'switch', value: true }, { type: 'switch', value: true, disabled: true }],
    pick: n => n.querySelector('.mm-switch'), parts: [[':scope', 'Track']],
    states: [{ name: 'off' }, { name: 'on', v: 1 }, { name: 'hover', force: [[H]] }, { name: 'focus', force: [[F]] }, { name: 'disabled', v: 2 }] });

  C.add({ group: 'atoms', id: 'a-segment', name: 'Segment and thumb', code: '.mm-seg',
    desc: 'A track of options with a sliding thumb behind the chosen one. Used by segmented controls and every tab row in panels.',
    variants: [{ type: 'segmented', options: ['Day', 'Week', 'Month'], value: 'Week' }, { type: 'segmented', options: [{ value: 'a', icon: 'grid', label: 'Grid' }, { value: 'b', icon: 'frame', label: 'Frame' }], value: 'a' }],
    parts: [[':scope', 'Track'], ['.mm-seg-thumb', 'Thumb'], ['[role=radio]', 'Option']],
    states: [{ name: 'default' }, { name: 'option hover', force: [[H, '[role=radio]:not([aria-checked=true])']] }, { name: 'option focus', force: [[F, '[aria-checked=true]']] }, { name: 'icons', v: 1 }] });

  C.add({ group: 'atoms', id: 'a-dot', name: 'Swatch dot and thumbnail', code: '.mm-dot',
    desc: 'A round colour or image choice. The chosen one gets a ring.',
    variants: [{ type: 'swatches', options: ['#3b82f6'], value: '' }, { type: 'swatches', options: ['#3b82f6'], value: '#3b82f6' }, { type: 'thumbs', options: [thumb('#f97316', '#7c3aed')], value: '' }, { type: 'thumbs', options: [thumb('#f97316', '#7c3aed')] }],
    pick: n => n.querySelector('.mm-dot'), parts: [[':scope', 'Dot']],
    states: [{ name: 'colour' }, { name: 'colour, chosen', v: 1 }, { name: 'hover', force: [[H]] }, { name: 'focus', force: [[F]] }, { name: 'image', v: 2 }, { name: 'image, chosen', v: 3 }] });

  C.add({ group: 'atoms', id: 'a-input', name: 'Text input', code: '.mm-field',
    desc: 'A tinted pill holding an icon and a borderless input. Focus lights the pill; no ring for a mouse click.',
    variants: [{ type: 'field', placeholder: 'Layer name', icon: 'search', width: 150 }, { type: 'field', placeholder: 'Layer name', value: 'Header', width: 150 }, { type: 'field', placeholder: 'Disabled', width: 150, disabled: true }],
    parts: [[':scope', 'Field'], ['.mm-ic', 'Icon'], ['input', 'Input']],
    states: [{ name: 'empty' }, { name: 'filled', v: 1 }, { name: 'focused', force: [['st-focus-within']] }, { name: 'disabled', v: 2 }] });

  C.add({ group: 'atoms', id: 'a-chevron', name: 'Chevron and check', code: '.mm-chev · .mm-check',
    desc: 'The disclosure arrow on pill triggers (it flips when open) and the tick on chosen rows.',
    variants: [{ type: 'select', label: 'Fit', options: ['Fill', 'Fit'], value: 'Fill' }],
    parts: [[':scope', 'Trigger'], ['.mm-chev', 'Chevron']],
    states: [{ name: 'closed' }, { name: 'open', force: [['@aria-expanded=true']] }] });

  C.add({ group: 'atoms', id: 'a-rows', name: 'Panel rows, heading, tiles', code: '.mm-row · .mm-ph · .mm-tile',
    desc: 'The pieces panels are built from: a heading, rows with icon, label, shortcut or hint, a rule between groups, and grid tiles.',
    variants: [{ type: 'menu', label: 'More', icon: 'more', title: 'Heading', items: [{ label: 'Duplicate', icon: 'copy', shortcut: '⌘D' }, { label: 'Rename', icon: 'pen', hint: 'F2' }, 'separator', { label: 'Show grid', checked: true }, { label: 'Delete', icon: 'trash', danger: true }, { label: 'Disabled', disabled: true }] },
      { type: 'grid', label: 'Insert', icon: 'plus', items: [{ label: 'Text', icon: 'text' }, { label: 'Image', icon: 'image' }, { label: 'Shape', icon: 'shape' }] }],
    explode: false,
    panel: { parts: [['.mm-ph', 'Heading'], ['.mm-row', 'Row'], ['.mm-row .mm-ic', 'Row icon'], ['.mm-rl', 'Row label'], ['kbd', 'Shortcut'], ['.mm-hint', 'Hint'], ['.mm-rsep', 'Rule'], ['.mm-check', 'Check']],
      states: [{ name: 'row hover', force: [[H, '.mm-row']] }, { name: 'row active (keyboard)', force: [['active', '.mm-row']] }, { name: 'row focus', force: [[F, '.mm-row']] }, { name: 'danger row hover', force: [[H, '.mm-row.danger']] }, { name: 'tiles', v: 1 }, { name: 'tile hover', v: 1, force: [[H, '.mm-tile']] }] } });

  /* ---------------- bar controls ---------------- */
  C.add({ group: 'bar', id: 'button', name: 'Button', code: "type: 'button'",
    desc: 'An icon button: plain, primary, toggle (a pressed state that stays), with a count or dot badge.',
    variants: [{ type: 'button', label: 'Add', icon: 'plus' }, { type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', label: 'Grid', icon: 'grid', toggle: true, value: true }, { type: 'button', label: 'Bell', icon: 'bell', badge: 3 }, { type: 'button', label: 'Chat', icon: 'comment', badge: true }, { type: 'button', label: 'Add', icon: 'plus', disabled: true }],
    parts: [[':scope', 'Hit area'], ['.mm-ic', 'Icon']],
    states: [{ name: 'default' }, { name: 'hover', force: [[H]] }, { name: 'pressed', note: 'the bar dents too', force: [[A], ['pressed']] }, { name: 'focus', force: [[F]] }, { name: 'primary', v: 1 }, { name: 'primary hover', v: 1, force: [[H]] }, { name: 'toggled on', v: 2 }, { name: 'badge', v: 3 }, { name: 'dot', v: 4 }, { name: 'disabled', v: 5 }],
    live: [{ type: 'button', id: 'add', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', id: 'grid', label: 'Grid', icon: 'grid', toggle: true }, { type: 'button', id: 'bell', label: 'Notifications', icon: 'bell', badge: 3 }] });

  C.add({ group: 'bar', id: 'pill', name: 'Pill', code: "type: 'pill'",
    desc: 'A text button, soft or solid, with an optional icon.',
    variants: [{ type: 'pill', label: 'Share', icon: 'share' }, { type: 'pill', label: 'Publish', variant: 'solid' }, { type: 'pill', label: 'Save draft', disabled: true }],
    parts: [[':scope', 'Pill'], ['.mm-ic', 'Icon']],
    states: [{ name: 'soft' }, { name: 'hover', force: [[H]] }, { name: 'pressed', force: [[A]] }, { name: 'focus', force: [[F]] }, { name: 'solid', v: 1 }, { name: 'disabled', v: 2 }],
    live: [{ type: 'pill', id: 'share', label: 'Share', icon: 'share' }, { type: 'pill', id: 'publish', label: 'Publish', variant: 'solid' }] });

  C.add({ group: 'bar', id: 'segmented', name: 'Segmented', code: "type: 'segmented'",
    desc: 'Pick one of a few. The thumb slides; arrow keys move it.',
    variants: [{ type: 'segmented', options: ['Day', 'Week', 'Month'], value: 'Week' }, { type: 'segmented', options: [{ value: 'a', icon: 'grid', label: 'Grid' }, { value: 'b', icon: 'frame', label: 'Frame' }, { value: 'c', icon: 'text', label: 'Text' }], value: 'b' }, { type: 'segmented', options: ['On', 'Off'], value: 'On', disabled: true }],
    parts: [[':scope', 'Track'], ['.mm-seg-thumb', 'Thumb'], ['[role=radio]', 'Option']],
    states: [{ name: 'default' }, { name: 'option hover', force: [[H, '[role=radio]:not([aria-checked=true])']] }, { name: 'focus', force: [[F, '[aria-checked=true]']] }, { name: 'icons', v: 1 }, { name: 'disabled', v: 2 }],
    live: [{ type: 'segmented', id: 'range', options: ['Day', 'Week', 'Month'], value: 'Week' }] });

  C.add({ group: 'bar', id: 'switch', name: 'Switch', code: "type: 'switch'",
    desc: 'A labelled on/off.',
    variants: [{ type: 'switch', label: 'Snap', value: true }, { type: 'switch', label: 'Snap', value: false }, { type: 'switch', label: 'Snap', disabled: true }],
    parts: [[':scope', 'Item'], ['.mm-label', 'Label'], ['.mm-switch', 'Switch']],
    states: [{ name: 'on' }, { name: 'off', v: 1 }, { name: 'hover', force: [[H, '.mm-switch']] }, { name: 'focus', force: [[F, '.mm-switch']] }, { name: 'disabled', v: 2 }],
    live: [{ type: 'switch', id: 'snap', label: 'Snap', value: true }] });

  C.add({ group: 'bar', id: 'slider', name: 'Slider · fill', code: "variant: 'fill' (default)",
    desc: 'The whole item is the slider: a pill that fills, with the label and value inside; where the fill covers the text it flips to the bar colour. Drag anywhere, relative to where you grabbed (a press never jumps); Shift is 10× finer; past an end it stretches like rubber. Tap the value to type. Ranges across zero fill outward from a zero mark; up to 10 steps show notch dots.',
    variants: [{ type: 'slider', label: 'Opacity', value: 72, min: 0, max: 100, unit: '%' }, { type: 'slider', label: 'Rotate', value: 45, min: -180, max: 180, unit: '°' }, { type: 'slider', label: 'Stars', value: 3, min: 0, max: 5, step: 1 }, { type: 'slider', label: 'Opacity', value: 72, min: 0, max: 100, unit: '%', disabled: true }],
    parts: [[':scope', 'Pill'], ['.mm-sf-base', 'Base'], ['.mm-sf-fill', 'Fill'], ['.mm-sf-tx:not(.on) .mm-sf-l', 'Label'], ['.mm-sf-tx:not(.on) .mm-sf-v', 'Value'], ['.mm-sf-tx:not(.on) .mm-unit', 'Unit'], ['.mm-sf-mk', 'Mark']],
    states: [{ name: 'rest' }, { name: 'hover', force: [[H]] }, { name: 'dragging', force: [['drag']] }, { name: 'focus', note: 'keyboard', force: [[F]] }, { name: 'across zero', v: 1 }, { name: 'few steps', v: 2 }, { name: 'disabled', v: 3 }],
    live: [{ type: 'slider', id: 'op', label: 'Opacity', value: 72, min: 0, max: 100, unit: '%' }, { type: 'slider', id: 'rot', label: 'Rotate', value: 45, min: -180, max: 180, unit: '°' }, { type: 'slider', id: 'stars', label: 'Stars', value: 3, min: 0, max: 5, step: 1, width: 120 }] });

  C.add({ group: 'bar', id: 'slider-notched', name: 'Slider · notched', code: "variant: 'notched'",
    desc: 'One cell per value, for small stepped ranges where each step matters: the more exact alternative to fill. Click or drag over the cells; the cell under the pointer is the value. Up to 24 steps (more fall back to fill).',
    variants: [{ type: 'slider', variant: 'notched', label: 'Stars', value: 3, min: 0, max: 5, step: 1 }, { type: 'slider', variant: 'notched', label: 'Quality', value: 12, min: 0, max: 16, step: 1, unit: '/16' }, { type: 'slider', variant: 'notched', label: 'Offset', value: 2, min: -4, max: 4, step: 1 }],
    parts: [[':scope', 'Item'], ['.mm-label', 'Label'], ['.mm-sn', 'Cells'], ['.mm-sn i', 'Cell'], ['.mm-sn i.on', 'Lit cell'], ['.mm-value', 'Value']],
    states: [{ name: 'few (≤ 10)' }, { name: 'many (16)', v: 1 }, { name: 'across zero', v: 2 }, { name: 'focus', note: 'keyboard', force: [[F, '.mm-sn']] }, { name: 'dragging', force: [['drag', '.mm-sn']] }],
    live: [{ type: 'slider', variant: 'notched', id: 'stars', label: 'Stars', value: 3, min: 0, max: 5, step: 1 }, { type: 'slider', variant: 'notched', id: 'q', label: 'Quality', value: 12, min: 0, max: 16, step: 1 }] });

  C.add({ group: 'bar', id: 'slider-knob', name: 'Slider · knob', code: "variant: 'knob'",
    desc: 'A compact 28px rotary knob, Ableton-style: drag up or right to turn it up (Shift is finer), double-click to reset to its first value. A 270° arc shows the value; with few steps the ring is cut into one segment per step, and a range across zero lights from the top.',
    variants: [{ type: 'slider', variant: 'knob', label: 'Gain', value: 3, min: -12, max: 12, step: .5, unit: 'dB' }, { type: 'slider', variant: 'knob', label: 'Mix', value: 65, min: 0, max: 100, unit: '%' }, { type: 'slider', variant: 'knob', label: 'Voices', value: 3, min: 1, max: 8, step: 1 }, { type: 'slider', variant: 'knob', value: 40, min: 0, max: 100, showValue: false }],
    parts: [[':scope', 'Item'], ['.mm-label', 'Label'], ['.mm-kn', 'Knob'], ['.mm-kn-a0', 'Ring'], ['.mm-kn-a1', 'Value arc'], ['.mm-kn-cap', 'Cap'], ['.mm-kn-ptr', 'Pointer'], ['.mm-value', 'Value']],
    states: [{ name: 'across zero' }, { name: 'unipolar', v: 1 }, { name: 'few steps', v: 2 }, { name: 'hover', v: 1, force: [[H, '.mm-kn']] }, { name: 'dragging', v: 1, force: [['drag', '.mm-kn']] }, { name: 'focus', v: 1, force: [[F, '.mm-kn']] }, { name: 'knob only', v: 3 }],
    live: [{ type: 'slider', variant: 'knob', id: 'gain', label: 'Gain', value: 3, min: -12, max: 12, step: .5, unit: 'dB' }, { type: 'separator' }, { type: 'slider', variant: 'knob', id: 'mix', label: 'Mix', value: 65, min: 0, max: 100, unit: '%' }, { type: 'slider', variant: 'knob', id: 'v', label: 'Voices', value: 3, min: 1, max: 8, step: 1 }] });

  C.add({ group: 'panel', id: 'knobs', name: 'Knobs panel', code: "type: 'knobs'",
    desc: 'A trigger whose panel holds stacked knobs (label above, knob, value below), like an Ableton device. Each knob is the slider’s knob: drag up or right, Shift for fine, double press to reset, arrows step, click the value to type. Value: { [knob id]: number }.',
    variants: [{ type: 'knobs', label: 'EQ', icon: 'settings', knobs: [{ id: 'low', label: 'Low', min: -12, max: 12, step: .5, value: 2, unit: 'dB' }, { id: 'mid', label: 'Mid', min: -12, max: 12, step: .5, value: -3, unit: 'dB' }, { id: 'high', label: 'High', min: -12, max: 12, step: .5, value: 0, unit: 'dB' }, { id: 'mix', label: 'Mix', min: 0, max: 100, value: 100, unit: '%' }] },
      { type: 'knobs', label: 'Voice', trigger: 'pill', columns: 3, knobs: [{ id: 'v', label: 'Voices', min: 1, max: 8, step: 1, value: 3 }, { id: 'd', label: 'Detune', min: 0, max: 100, value: 24, unit: '%' }, { id: 's', label: 'Spread', min: 0, max: 100, value: 60, unit: '%' }, { id: 'a', label: 'Attack', min: 0, max: 2, step: .01, value: .05, unit: 's' }, { id: 'r', label: 'Release', min: 0, max: 4, step: .01, value: .8, unit: 's' }, { id: 'g', label: 'Gain', min: -24, max: 6, step: .5, value: 0, unit: 'dB' }] }],
    parts: [[':scope', 'Trigger']], explode: false,
    states: [{ name: 'icon trigger' }, { name: 'hover', force: [[H]] }, { name: 'open', force: [['@aria-expanded=true']] }, { name: 'pill trigger', v: 1 }],
    panel: { states: [{ name: 'knob hover', force: [[H, '.mm-knobs > .mm-sknob'], [H, '.mm-kn']] }, { name: '6 knobs, 3 columns', v: 1 }] },
    live: [{ type: 'knobs', id: 'eq', label: 'EQ', icon: 'settings', knobs: [{ id: 'low', label: 'Low', min: -12, max: 12, step: .5, value: 2, unit: 'dB' }, { id: 'mid', label: 'Mid', min: -12, max: 12, step: .5, value: -3, unit: 'dB' }, { id: 'high', label: 'High', min: -12, max: 12, step: .5, value: 0, unit: 'dB' }, { id: 'mix', label: 'Mix', min: 0, max: 100, value: 100, unit: '%' }] },
      { type: 'slider', variant: 'knob', id: 'gain', label: 'Gain', min: -12, max: 12, step: .5, value: 0, unit: 'dB' }] });

  C.add({ group: 'bar', id: 'stepper', name: 'Stepper', code: "type: 'stepper'",
    desc: 'Minus, value, plus. Arrow keys and Page keys step.',
    variants: [{ type: 'stepper', label: 'Zoom', value: 100, min: 25, max: 400, step: 25, format: v => v + '%' }, { type: 'stepper', value: 3, min: 0, max: 9 }],
    parts: [[':scope', 'Item'], ['.mm-label', 'Label'], ['.mm-stepper', 'Box'], ['.mm-stepper button', 'Step button'], ['.mm-value', 'Value']],
    states: [{ name: 'default' }, { name: 'button hover', force: [[H, '.mm-stepper button']] }, { name: 'focus', force: [[F, '.mm-stepper']] }, { name: 'no label', v: 1 }],
    live: [{ type: 'stepper', id: 'zoom', label: 'Zoom', min: 25, max: 400, step: 25, value: 100, format: v => v + '%' }] });

  C.add({ group: 'bar', id: 'swatches', name: 'Swatches and thumbnails', code: "type: 'swatches' · 'thumbs'",
    desc: 'A row of colour dots or image thumbnails; one is chosen.',
    variants: [{ type: 'swatches', options: ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6'], value: '#22c55e' }, { type: 'thumbs', options: [thumb('#f97316', '#7c3aed'), thumb('#06b6d4', '#1e3a8a'), thumb('#facc15', '#be123c')] }],
    parts: [[':scope', 'Row'], ['.mm-dot', 'Dot'], ['.mm-dot[aria-checked=true]', 'Chosen']],
    states: [{ name: 'swatches' }, { name: 'dot hover', force: [[H, '.mm-dot:not([aria-checked=true])']] }, { name: 'focus', force: [[F, '[aria-checked=true]']] }, { name: 'thumbnails', v: 1 }],
    live: [{ type: 'swatches', id: 'swatch', options: ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6'] }, { type: 'separator' }, { type: 'thumbs', id: 'thumb', options: [thumb('#f97316', '#7c3aed'), thumb('#06b6d4', '#1e3a8a')] }] });

  C.add({ group: 'bar', id: 'field', name: 'Text field', code: "type: 'field'",
    desc: 'A text input on the bar.',
    variants: [{ type: 'field', placeholder: 'Layer name', width: 150 }, { type: 'field', placeholder: 'Layer name', value: 'Header', icon: 'text', width: 150 }, { type: 'field', placeholder: 'Disabled', width: 150, disabled: true }],
    parts: [[':scope', 'Field'], ['.mm-ic', 'Icon'], ['input', 'Input']],
    states: [{ name: 'empty' }, { name: 'focused', force: [['st-focus-within']] }, { name: 'filled', v: 1 }, { name: 'disabled', v: 2 }],
    live: [{ type: 'field', id: 'name', placeholder: 'Layer name', width: 150 }] });

  C.add({ group: 'bar', id: 'search', name: 'Search', code: "type: 'search'",
    desc: 'An icon that melts open into a field; a close droplet pinches off its end. See Shell → Search droplet for the open state.',
    variants: [{ type: 'search', placeholder: 'Search' }],
    parts: [[':scope', 'Search'], ['.mm-ic', 'Icon']],
    states: [{ name: 'closed' }, { name: 'hover', force: [[H]] }, { name: 'focus', force: [[F]] }, { name: 'open', note: 'width animates to 200', force: [['open']] }],
    live: [{ type: 'button', label: 'Add', icon: 'plus' }, { type: 'separator' }, { type: 'search', id: 'q', placeholder: 'Search' }] });

  C.add({ group: 'bar', id: 'status', name: 'Status, avatars, progress', code: "type: 'status' · 'avatars' · 'progress'",
    desc: 'Read-outs: a live dot with a label, a stack of people, a progress ring.',
    variants: [{ type: 'status', label: 'Live' }, { type: 'status', label: 'Saving', tone: 'warning' }, { type: 'status', label: 'Offline', tone: 'danger', pulse: false }, { type: 'avatars', people: [{ name: 'Ada K' }, { name: 'Jane Lee' }, { name: 'Bo R' }, { name: 'Cy D' }, { name: 'Eve M' }], max: 3 }, { type: 'progress', label: 'Upload', value: .62 }, { type: 'progress', label: 'Done', value: 1 }],
    parts: [[':scope', 'Status']],
    states: [{ name: 'success (pulse)' }, { name: 'warning', v: 1 }, { name: 'danger, still', v: 2 }, { name: 'avatars (max 3)', v: 3 }, { name: 'progress 62%', v: 4 }, { name: 'complete', v: 5 }],
    live: [{ type: 'status', label: 'Live' }, { type: 'separator' }, { type: 'avatars', people: [{ name: 'Ada K' }, { name: 'Jane Lee' }, { name: 'Bo R' }] }, { type: 'separator' }, { type: 'progress', id: 'up', label: 'Upload', value: .4 }] });

  C.add({ group: 'bar', id: 'fields', name: 'Fields row', code: "type: 'fields'",
    desc: 'Numeric fields in a row (X / Y / Z). Drag a letter to scrub, click to type; the link keeps them in proportion.',
    variants: [{ type: 'fields', label: 'Scale', axes: ['x', 'y', 'z'], min: .1, max: 3, step: .01, unit: '×', value: { x: 1.25, y: 1, z: .5 }, linked: true }, { type: 'fields', axes: ['x', 'y'], unit: 'px', step: 1, value: { x: 120, y: -40 }, linkable: false }],
    parts: [[':scope', 'Row'], ['.mm-label', 'Label'], ['.mm-fld', 'Field'], ['.mm-fld-ax', 'Axis letter (scrub)'], ['.mm-fld-v', 'Value'], ['.mm-fields-link', 'Link']],
    states: [{ name: 'linked' }, { name: 'field hover', force: [[H, '.mm-fld']] }, { name: 'letter scrubbing', force: [['mm-scrubbing', '.mm-fld-ax']] }, { name: 'value focus', force: [[F, '.mm-fld-v'], ['st-focus-within', '.mm-fld']] }, { name: 'unlinked, no label', v: 1 }],
    live: [{ type: 'fields', id: 'scale', label: 'Scale', axes: ['x', 'y', 'z'], min: .1, max: 3, step: .01, unit: '×', value: { x: 1.25, y: 1, z: .5 }, linked: true }] });

  C.add({ group: 'bar', id: 'anchor', name: 'Anchor', code: "type: 'anchor'",
    desc: 'A 3 × 3 grid that sets horizontal and vertical alignment in one click; arrow keys move one cell. Small on the bar, or display: \'panel\' for a button (its icon maps the choice) that opens a big grid.',
    variants: [{ type: 'anchor', value: { x: 'center', y: 'center' } }, { type: 'anchor', value: { x: 'left', y: 'top' } }, { type: 'anchor', value: { x: 'right', y: 'bottom' }, disabled: true },
      { type: 'anchor', display: 'panel', label: 'Align', value: { x: 'left', y: 'top' } }, { type: 'anchor', display: 'panel', label: 'Origin', trigger: 'pill', value: { x: 'center', y: 'bottom' } }],
    states: [{ name: 'center' }, { name: 'top left', v: 1 }, { name: 'cell hover', force: [[H, '.mm-anchor-cell:not([aria-checked=true])']] }, { name: 'focus', force: [[F, '[aria-checked=true]']] }, { name: 'disabled', v: 2 },
      { name: 'panel trigger', v: 3 }, { name: 'panel trigger, open', v: 3, force: [['@aria-expanded=true']] }, { name: 'pill trigger', v: 4 }],
    panel: { v: 3, states: [{ name: 'cell hover', v: 3, force: [[H, '.mm-anchor-cell:not([aria-checked=true])']] }, { name: 'focus', v: 3, force: [[F, '.mm-anchor-cell[aria-checked=true]']] }, { name: 'center bottom', v: 4 }] },
    live: [{ type: 'anchor', id: 'align', value: { x: 'center', y: 'center' } }, { type: 'separator' }, { type: 'anchor', id: 'origin', display: 'panel', label: 'Origin', value: { x: 'left', y: 'top' } }, { type: 'anchor', id: 'pin', display: 'panel', label: 'Pin', trigger: 'pill', value: { x: 'right', y: 'bottom' } }] });

  /* ---------------- panel controls ---------------- */
  const trig = [[H], [F]];
  C.add({ group: 'panel', id: 'menu', name: 'Menu', code: "type: 'menu'",
    desc: 'Actions in a list: icons, shortcuts, checks, a danger row, separators. Icon or pill trigger.',
    variants: [{ type: 'menu', label: 'More', icon: 'more', items: [{ label: 'Duplicate', icon: 'copy', shortcut: '⌘D' }, { label: 'Rename', icon: 'pen', shortcut: '⏎' }, 'separator', { label: 'Delete', icon: 'trash', shortcut: '⌫', danger: true }] },
      { type: 'menu', label: 'View', trigger: 'pill', items: [{ label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, 'separator', { label: 'Show grid', checked: true }, { label: 'Snap to pixels', checked: false }] }],
    parts: [[':scope', 'Trigger'], ['.mm-ic', 'Icon']],
    states: [{ name: 'icon trigger' }, { name: 'hover', force: [trig[0]] }, { name: 'focus', force: [trig[1]] }, { name: 'open', force: [['@aria-expanded=true']] }, { name: 'floating', note: 'panel detached', force: [['mm-detached']] }, { name: 'pill trigger', v: 1 }, { name: 'pill open', v: 1, force: [['@aria-expanded=true']] }, { name: 'pill floating', v: 1, force: [['mm-detached']] }],
    panel: { parts: [['.mm-rows', 'List'], ['.mm-row', 'Row'], ['kbd', 'Shortcut'], ['.mm-rsep', 'Separator'], ['.mm-row.danger', 'Danger row']],
      states: [{ name: 'row hover', force: [[H, '.mm-row']] }, { name: 'danger hover', force: [[H, '.mm-row.danger']] }, { name: 'checks', v: 1 }] },
    live: [{ type: 'menu', id: 'more', label: 'More', icon: 'more', items: [{ label: 'Duplicate', icon: 'copy', shortcut: '⌘D' }, 'separator', { label: 'Delete', icon: 'trash', danger: true }] }, { type: 'menu', id: 'view', label: 'View', trigger: 'pill', items: [{ label: 'Show grid', checked: true }, { label: 'Snap to pixels' }] }] });

  C.add({ group: 'panel', id: 'menu-hover', name: 'Menu that opens on hover', code: "openOn: 'hover'",
    desc: 'Any panel trigger can open on hover: after a short rest on the trigger (at once when moving between hover menus), staying open while the pointer is on the trigger or the panel. A click pins it open. Touch still opens on tap.',
    live: [{ type: 'menu', id: 'file', label: 'File', trigger: 'pill', openOn: 'hover', items: [{ label: 'New', icon: 'plus', shortcut: '⌘N' }, { label: 'Duplicate', icon: 'copy', shortcut: '⌘D' }] },
      { type: 'menu', id: 'edit', label: 'Edit', trigger: 'pill', openOn: 'hover', items: [{ label: 'Undo', icon: 'undo', shortcut: '⌘Z' }, { label: 'Redo', icon: 'redo', shortcut: '⇧⌘Z' }] },
      { type: 'menu', id: 'view', label: 'View', trigger: 'pill', openOn: 'hover', items: [{ label: 'Show grid', checked: true }, { label: 'Snap to pixels' }] }] });

  C.add({ group: 'panel', id: 'select', name: 'Select', code: "type: 'select'",
    desc: 'A pill showing the current choice; its panel lists the options with a check.',
    variants: [{ type: 'select', label: 'Fit', options: ['Fill', 'Fit', 'Stretch'], value: 'Fill' }],
    parts: [[':scope', 'Trigger'], ['.mm-chev', 'Chevron']],
    states: [{ name: 'default' }, { name: 'hover', force: [[H]] }, { name: 'focus', force: [[F]] }, { name: 'open', force: [['@aria-expanded=true']] }],
    panel: { parts: [['.mm-row', 'Option'], ['.mm-check', 'Check'], ['.mm-rl', 'Label']], states: [{ name: 'option hover', force: [[H, '.mm-row:not([aria-checked=true])']] }] },
    live: [{ type: 'select', id: 'fit', label: 'Fit', options: ['Fill', 'Fit', 'Stretch'], value: 'Fill' }] });

  C.add({ group: 'panel', id: 'grid', name: 'Insert grid', code: "type: 'grid'",
    desc: 'A grid of big tiles, for inserting things.',
    variants: [{ type: 'grid', label: 'Insert', icon: 'plus', items: [{ label: 'Text', icon: 'text' }, { label: 'Image', icon: 'image' }, { label: 'Shape', icon: 'shape' }, { label: 'Frame', icon: 'frame' }, { label: 'Sticky', icon: 'sticky' }, { label: 'Embed', icon: 'embed' }] }],
    parts: [[':scope', 'Trigger']], states: [{ name: 'default' }, { name: 'open', force: [['@aria-expanded=true']] }],
    panel: { parts: [['.mm-ph', 'Heading'], ['.mm-tiles', 'Grid'], ['.mm-tile', 'Tile'], ['.mm-tile .mm-ic', 'Tile icon']], states: [{ name: 'tile hover', force: [[H, '.mm-tile']] }, { name: 'tile focus', force: [[F, '.mm-tile']] }] },
    live: [{ type: 'grid', id: 'insert', label: 'Insert', icon: 'plus', items: [{ label: 'Text', icon: 'text' }, { label: 'Image', icon: 'image' }, { label: 'Shape', icon: 'shape' }] }] });

  C.add({ group: 'panel', id: 'command', name: 'Command search', code: "type: 'command'",
    desc: 'A search field over a filtered list, with hints on the right and an empty state.',
    variants: [{ type: 'command', label: 'Search', icon: 'search', placeholder: 'Search layers', items: [{ label: 'Header', icon: 'frame', hint: 'Frame' }, { label: 'Table', icon: 'grid', hint: 'Frame' }, { label: 'Colours', icon: 'palette', hint: 'Style' }] }],
    parts: [[':scope', 'Trigger']], states: [{ name: 'default' }, { name: 'open', force: [['@aria-expanded=true']] }],
    panel: { parts: [['.mm-cmd', 'Search box'], ['.mm-cmd input', 'Input'], ['.mm-row', 'Result'], ['.mm-row.active', 'Highlighted'], ['.mm-hint', 'Hint'], ['.mm-empty', 'Empty']] },
    live: [{ type: 'command', id: 'find', label: 'Search', icon: 'search', placeholder: 'Search layers', items: [{ label: 'Header', icon: 'frame', hint: 'Frame' }, { label: 'Colours', icon: 'palette', hint: 'Style' }] }] });

  C.add({ group: 'panel', id: 'color', name: 'Colour picker', code: "type: 'color'",
    desc: 'Format tabs, a 2D field, hue and opacity, an eyedropper, channel fields you can scrub, preset swatches. picker:false keeps only the swatches.',
    variants: [{ type: 'color', label: 'Fill', value: '#3B82F6' }, { type: 'color', label: 'Tag', value: '#22c55e', picker: false }, { type: 'color', label: 'Fill', icon: 'palette', value: '#F97316CC' }],
    parts: [[':scope', 'Trigger'], ['.mm-col-dot', 'Swatch dot'], ['.mm-chev', 'Chevron']],
    states: [{ name: 'pill' }, { name: 'hover', force: [[H]] }, { name: 'open', force: [['@aria-expanded=true']] }, { name: 'icon trigger', v: 2 }],
    panel: { parts: [['.mm-ph', 'Heading + value'], ['.mm-col-fmt', 'Format tabs'], ['.mm-col-plane', '2D field'], ['.mm-col-mark', 'Marker'], ['.mm-col-range.hue', 'Hue'], ['.mm-col-range.op', 'Opacity'], ['.mm-col-eye', 'Eyedropper'], ['.mm-col-fld', 'Channel field'], ['.mm-swg', 'Swatches']],
      states: [{ name: 'swatches only', v: 1 }] },
    live: [{ type: 'color', id: 'fill', label: 'Fill', value: '#3B82F6' }, { type: 'color', id: 'tag', label: 'Tag', value: '#22c55e', picker: false }] });

  C.add({ group: 'panel', id: 'pad', name: '2D pad', code: "type: 'pad'",
    desc: 'Drag a point on a surface; scrub or type X and Y below it. The trigger icon previews the point.',
    variants: [{ type: 'pad', label: 'Position', value: { x: .3, y: -.4 } }, { type: 'pad', label: 'Offset', trigger: 'pill', x: { min: 0, max: 100, step: 1, unit: 'px' }, y: { min: 0, max: 100, step: 1, unit: 'px' }, value: { x: 24, y: 60 } }],
    parts: [[':scope', 'Trigger'], ['.mm-pad-mini', 'Preview icon']],
    states: [{ name: 'icon' }, { name: 'hover', force: [[H]] }, { name: 'open', force: [['@aria-expanded=true']] }, { name: 'pill', v: 1 }],
    panel: { parts: [['.mm-pad', 'Surface'], ['.mm-pad-grid', 'Grid'], ['.mm-pad-guides', 'Guides'], ['.mm-pad-dot', 'Point'], ['.mm-pad-field', 'Axis field'], ['.mm-pad-lab', 'Axis label (scrub)']],
      states: [{ name: 'surface focus', force: [[F, '.mm-pad']] }, { name: 'units', v: 1 }] },
    live: [{ type: 'pad', id: 'pos', label: 'Position' }, { type: 'pad', id: 'offset', label: 'Offset', trigger: 'pill', x: { min: 0, max: 100, step: 1, unit: 'px' }, y: { min: 0, max: 100, step: 1, unit: 'px' }, value: { x: 24, y: 60 } }] });

  C.add({ group: 'panel', id: 'transition', name: 'Transition', code: "type: 'transition'",
    desc: 'Easing curve, spring by time, or spring by physics; presets you can save; copy and paste between transitions.',
    variants: [{ type: 'transition', label: 'Enter', value: { type: 'easing', duration: .3, ease: [.33, 0, 0, 1] } }, { type: 'transition', label: 'Hover', value: { type: 'spring', visualDuration: .5, bounce: .35 } }, { type: 'transition', label: 'Drag', value: { type: 'spring', stiffness: 180, damping: 12, mass: 1 } }],
    parts: [[':scope', 'Trigger'], ['.mm-tr-glyph', 'Curve glyph'], ['.mm-chev', 'Chevron']],
    states: [{ name: 'easing' }, { name: 'spring by time', v: 1 }, { name: 'spring by physics', v: 2 }, { name: 'hover', force: [[H]] }, { name: 'open', force: [['@aria-expanded=true']] }],
    panel: { parts: [['.mm-tr-acts', 'Copy / paste'], ['.mm-tr-seg', 'Mode tabs'], ['.mm-tr-stage', 'Curve stage'], ['.mm-tr-h', 'Handle'], ['.mm-tr-fields', 'X1 Y1 X2 Y2'], ['.mm-tr-row', 'Slider row'], ['.mm-tr-pb, .mm-tr-pi', 'Presets']],
      states: [{ name: 'time', v: 1 }, { name: 'physics', v: 2 }, { name: 'handle hover', force: [[H, '.mm-tr-h']] }] },
    live: [{ type: 'transition', id: 'enter', label: 'Enter', value: { type: 'easing', duration: .3, ease: [.33, 0, 0, 1] } }, { type: 'transition', id: 'hover', label: 'Hover', value: { type: 'spring', visualDuration: .5, bounce: .35 } }] });

  C.add({ group: 'panel', id: 'gradient', name: 'Gradient', code: "type: 'gradient'",
    desc: 'Shape tabs, angle, flip and rotate; a stop bar you click to add to, drag along, pull away from; a row per stop.',
    variants: [{ type: 'gradient', label: 'Sunset', value: { shape: 'linear', angle: 180, stops: [{ at: 0, color: '#1e1b4b' }, { at: 38, color: '#9d174d' }, { at: 70, color: '#f97316' }, { at: 100, color: '#fde68a' }] } }, { type: 'gradient', label: 'Glow', trigger: 'icon', value: { shape: 'radial', angle: 0, stops: [{ at: 0, color: '#fef08a' }, { at: 100, color: '#22c55e' }] } }],
    parts: [[':scope', 'Trigger'], ['.mm-gchip', 'Gradient chip'], ['.mm-chev', 'Chevron']],
    states: [{ name: 'pill' }, { name: 'hover', force: [[H]] }, { name: 'open', force: [['@aria-expanded=true']] }, { name: 'icon (chip only)', v: 1 }],
    panel: { parts: [['.mm-gseg', 'Shape tabs'], ['.mm-gangle', 'Angle'], ['.mm-gbtn', 'Tool button'], ['.mm-gbar', 'Stop bar'], ['.mm-ghandle', 'Stop handle'], ['.mm-gstop', 'Stop row'], ['.mm-ggrip', 'Grip'], ['.mm-gsw', 'Colour chip'], ['.mm-ghex', 'Colour text'], ['.mm-gpos', 'Position']],
      states: [{ name: 'stop row hover', force: [[H, '.mm-gstop']] }, { name: 'radial', v: 1 }] },
    live: [{ type: 'gradient', id: 'g', label: 'Sunset', value: { shape: 'linear', angle: 180, stops: [{ at: 0, color: '#1e1b4b' }, { at: 50, color: '#f97316' }, { at: 100, color: '#fde68a' }] } }] });

  C.add({ group: 'panel', id: 'panel', name: 'Custom panel', code: "type: 'panel'",
    desc: 'A trigger whose panel holds anything you render into it (here: a small form of other marmit bars).',
    variants: [{ type: 'panel', label: 'Settings', icon: 'settings', title: 'Settings', content: '<div style="padding:4px 2px;width:180px;color:var(--mm-muted)">Any content: a node, a string, or a render function.</div>' }],
    parts: [[':scope', 'Trigger']], states: [{ name: 'default' }, { name: 'open', force: [['@aria-expanded=true']] }],
    panel: { parts: [['.mm-ph', 'Heading'], ['.mm-custom', 'Your content']] },
    live: [{ type: 'panel', id: 'set', label: 'Settings', icon: 'settings', title: 'Settings', content: el => { el.textContent = 'Anything goes in here.'; el.style.cssText = 'padding:4px 2px;width:180px;color:var(--mm-muted)'; } }] });

  /* ---------------- shell ---------------- */
  C.add({ group: 'shell', id: 'bar', name: 'Bar', code: 'createIsland()',
    desc: 'The material: a 40px pill that the items ride on. It bends where you pull it, dents where you press, and reshapes as items come and go. Horizontal or vertical, dark or light.',
    live: false,
    custom(wrap, { el }) {
      const rows = [
        ['horizontal', { items: [{ type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', label: 'Undo', icon: 'undo' }, { type: 'separator' }, { type: 'pill', label: 'Share' }] }],
        ['vertical (side: left)', { side: 'left', items: [{ type: 'button', label: 'Add', icon: 'plus' }, { type: 'button', label: 'Undo', icon: 'undo' }, { type: 'button', label: 'Redo', icon: 'redo' }] }],
        ['light theme', { theme: 'light', items: [{ type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', label: 'Undo', icon: 'undo' }, { type: 'separator' }, { type: 'pill', label: 'Share' }] }],
        ['one item', { items: [{ type: 'button', label: 'Add', icon: 'plus' }] }],
      ];
      wrap.append(el('h3', '', 'Variants'));
      const g = el('div', 'grid'); wrap.append(g);
      for (const [name, opts] of rows) {
        const c = el('div', 'card'), host = el('div'); c.append(host, el('div', 'lab', name)); g.append(c);
        SHOWCASE.islands.push(Marmit.createIsland({ mode: 'inline', container: host, label: name, ...opts }));
      }
      wrap.append(el('h3', '', 'Contained, docked and collapsible'));
      const stage = el('div', 'stage'); stage.style.height = '260px'; stage.style.padding = '0'; stage.style.overflow = 'hidden'; wrap.append(stage);
      SHOWCASE.islands.push(Marmit.createIsland({ mode: 'contained', container: stage, side: 'bottom', collapsible: true, label: 'Docked', items: [{ type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'button', label: 'Undo', icon: 'undo' }, { type: 'separator' }, { type: 'menu', label: 'View', trigger: 'pill', items: [{ label: 'Show grid', checked: true }] }] }));
      wrap.append(el('p', 'out', 'Drag the bar and throw it at another edge; hover it to reveal the collapse tab.'));
    } });

  C.add({ group: 'shell', id: 'panel-shell', name: 'Panel and neck', code: '.mm-panel',
    desc: 'A panel grows out of its trigger: the bar, a gooey neck and the panel melt into one shape. The panel sits at least 2 × blur from the bar.',
    live: false,
    custom(wrap, { el }) {
      const stage = el('div', 'stage'); stage.style.minHeight = '300px'; stage.style.justifyContent = 'flex-start'; wrap.append(stage);
      const host = el('div'); stage.append(host);
      const isl = Marmit.createIsland({ mode: 'inline', container: host, label: 'Panel shell', items: [{ type: 'button', label: 'Undo', icon: 'undo' }, { type: 'menu', id: 'm', label: 'View', trigger: 'pill', items: [{ label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, { label: 'Zoom out', icon: 'zoomOut', shortcut: '⌘−' }, 'separator', { label: 'Show grid', checked: true }] }, { type: 'button', label: 'More', icon: 'more' }] });
      SHOWCASE.islands.push(isl);
      setTimeout(() => isl.open('m'), 400);
      wrap.append(el('p', 'out', 'Opened on load. Click outside to close, click View to reopen.'));
    } });

  C.add({ group: 'shell', id: 'detached', name: 'Detached panel', code: "detachable · onDetachChange",
    desc: 'Every panel heading has a detach button. Detached, the panel floats free as its own window: drag it by its heading, minimise it to the heading, dock it back into the bar, or close it. Its trigger stays ringed and brings the window back. detachable: false turns it off.',
    variants: [{ type: 'menu', label: 'View', trigger: 'pill', items: [{ label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, 'separator', { label: 'Show grid', checked: true }] }],
    parts: [[':scope', 'Trigger']], explode: false,
    states: [{ name: 'trigger, detached', force: [['mm-detached']] }],
    panel: { parts: [['.mm-ph', 'Heading (drag handle)'], ['.mm-pacts', 'Window buttons'], ['.mm-pact.dk', 'Detach']] },
    custom(wrap, { el, plate, card }) {
      wrap.append(el('h3', '', 'Window'));
      const g = el('div', 'grid'); wrap.append(g);
      for (const min of [false, true]) {
        const host = el('div'); host.style.cssText = 'position:relative;width:240px;height:' + (min ? 60 : 200) + 'px';
        const c = card(host, min ? 'minimised' : 'detached'); g.append(c);
        const isl = Marmit.createIsland({ mode: 'inline', container: el('div'), items: [{ type: 'menu', id: 'm', label: 'View', trigger: 'pill', items: [{ label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, 'separator', { label: 'Show grid', checked: true }] }] });
        isl.open('m');
        const pc = isl.el.querySelector('.mm-pc.on'), p = plate('bare'), win = el('div', 'mm-win in' + (min ? ' min' : '')); win.style.position = 'relative';
        win.append(pc.cloneNode(true)); p.append(win); host.append(p); isl.destroy();
      }
    },
    live: [{ type: 'button', label: 'Undo', icon: 'undo' }, { type: 'menu', id: 'view', label: 'View', trigger: 'pill', items: [{ label: 'Zoom in', icon: 'zoomIn', shortcut: '⌘+' }, 'separator', { label: 'Show grid', checked: true }] }, { type: 'color', id: 'fill', label: 'Fill', value: '#3B82F6' }] });

  C.add({ group: 'shell', id: 'tooltip', name: 'Tooltip', code: '.mm-tip',
    desc: 'Shown after a short hover on icon-only items (instantly for neighbours once one is showing), placed on the stage side of the bar. Long text wraps at 240px.',
    variants: [{ type: 'button', label: 'Undo', icon: 'undo' }], live: [{ type: 'button', label: 'Undo', icon: 'undo' }, { type: 'button', label: 'Redo', icon: 'redo' }, { type: 'button', label: 'Notifications', icon: 'bell', tooltip: 'A longer tooltip wraps once it reaches its maximum width of 240px.' }],
    custom(wrap, { el, plate, card }) {
      wrap.append(el('h3', '', 'Specimens'));
      const g = el('div', 'grid'); wrap.append(g);
      for (const [t, n] of [['Undo', 'short'], ['A longer tooltip wraps once it reaches its maximum width of 240px.', 'wrapping']]) {
        const p = plate('bare'), tip = el('div', 'mm-tip on'); tip.textContent = t; p.append(tip); g.append(card(p, n));
      }
    } });

  C.add({ group: 'shell', id: 'droplet', name: 'Search droplet', code: '.mm-close',
    desc: 'When search opens, the bar melts wider and a close droplet travels out of its end on a thickening neck, then stays joined to it.',
    live: false,
    custom(wrap, { el }) {
      const stage = el('div', 'stage'); wrap.append(stage);
      const host = el('div'); stage.append(host);
      const isl = Marmit.createIsland({ mode: 'inline', container: host, label: 'Search', items: [{ type: 'button', label: 'Add', icon: 'plus', variant: 'primary' }, { type: 'separator' }, { type: 'search', id: 'q', placeholder: 'Search' }] });
      SHOWCASE.islands.push(isl);
      wrap.append(el('p', 'out', 'Click the search icon to open it; × or Escape closes it.'));
    } });
})();
