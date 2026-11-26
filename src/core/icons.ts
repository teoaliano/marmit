/* Built-in icons: 14×14, drawn with currentColor. Pass the name as a string anywhere an icon is accepted. */
const s = (body: string, w = 1.6) => `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const fill = (body: string) => `<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">${body}</svg>`;

export const icons: Record<string, string> = {
  plus: s('<path d="M7 2.5v9M2.5 7h9"/>', 2),
  minus: s('<path d="M2.5 7h9"/>', 2),
  undo: s('<path d="M5 3 2 6l3 3M2 6h6.5a3.5 3.5 0 0 1 0 7H6"/>'),
  redo: s('<path d="m9 3 3 3-3 3M12 6H5.5a3.5 3.5 0 0 0 0 7H8"/>'),
  grid: s('<rect x="2" y="2" width="4" height="4" rx="1"/><rect x="8" y="2" width="4" height="4" rx="1"/><rect x="2" y="8" width="4" height="4" rx="1"/><rect x="8" y="8" width="4" height="4" rx="1"/>', 1.5),
  search: s('<circle cx="6" cy="6" r="3.8"/><path d="m9 9 3 3"/>'),
  more: fill('<circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11" cy="7" r="1.3"/>'),
  close: s('<path d="m3.5 3.5 7 7M10.5 3.5l-7 7"/>', 1.8),
  chevron: s('<path d="M4 5.5 7 8.5l3-3"/>', 1.8),
  check: s('<path d="m3 7.2 2.6 2.6L11 4.4"/>', 1.8),
  comment: s('<path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h7A1.5 1.5 0 0 1 12 3.5v5A1.5 1.5 0 0 1 10.5 10H6l-3 2.5V10h.5A1.5 1.5 0 0 1 2 8.5z"/>', 1.5),
  invite: s('<circle cx="6" cy="4.5" r="2.3"/><path d="M1.8 12.2c.5-2.3 2.2-3.5 4.2-3.5s2.6.6 3.2 1.4M11 8.5v4M9 10.5h4"/>', 1.5),
  palette: s('<path d="M7 1.5a5.5 5.5 0 1 0 0 11c1 0 1.3-.8.9-1.5-.5-.8 0-1.8 1-1.8h1.4a2.2 2.2 0 0 0 2.2-2.2c0-3-2.5-5.5-5.5-5.5Z"/><circle cx="4.3" cy="6" r=".8" fill="currentColor"/><circle cx="6.6" cy="4" r=".8" fill="currentColor"/><circle cx="9.4" cy="5" r=".8" fill="currentColor"/>', 1.5),
  text: s('<path d="M3 12 7 2.5l4 9.5M4.6 8.5h4.8"/>', 1.5),
  image: s('<rect x="1.5" y="2.5" width="11" height="9" rx="2"/><path d="m2 11 3-3 2.5 2.5L9 9l3 2.5"/><circle cx="9.3" cy="5.3" r="1"/>', 1.4),
  shape: s('<rect x="2.5" y="2.5" width="9" height="9" rx="1.2"/>', 1.5),
  frame: s('<path d="M4.5 1.5v11M9.5 1.5v11M1.5 4.5h11M1.5 9.5h11"/>', 1.5),
  sticky: s('<path d="M2.5 2.5h9v5.5l-3.5 3.5h-5.5zM8 11.5V8h3.5"/>', 1.4),
  embed: s('<path d="M4.8 4 2 7l2.8 3M9.2 4 12 7l-2.8 3M8 2.5l-2 9"/>', 1.4),
  play: fill('<path d="M4 2.3v9.4a.7.7 0 0 0 1.05.6l7.6-4.7a.7.7 0 0 0 0-1.2L5.05 1.7A.7.7 0 0 0 4 2.3z"/>'),
  pause: fill('<rect x="3" y="2" width="3" height="10" rx="1"/><rect x="8" y="2" width="3" height="10" rx="1"/>'),
  bell: s('<path d="M3.5 10V6.5a3.5 3.5 0 0 1 7 0V10l1 1h-9zM5.8 12.5h2.4"/>', 1.5),
  share: s('<path d="M7 9V2M4.2 4.6 7 1.8l2.8 2.8M2.5 7.5v3.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7.5"/>', 1.5),
  settings: s('<circle cx="7" cy="7" r="2"/><path d="M7 1.2v1.6M7 11.2v1.6M1.2 7h1.6M11.2 7h1.6M2.9 2.9 4 4M10 10l1.1 1.1M2.9 11.1 4 10M10 4l1.1-1.1"/>', 1.5),
  sun: s('<circle cx="7" cy="7" r="2.6"/><path d="M7 .9v1.5M7 11.6v1.5M.9 7h1.5M11.6 7h1.5M2.7 2.7l1 1M10.3 10.3l1 1M2.7 11.3l1-1M10.3 3.7l1-1"/>', 1.4),
  moon: s('<path d="M11.8 8.6A5.2 5.2 0 0 1 5.4 2.2a5.2 5.2 0 1 0 6.4 6.4z"/>', 1.5),
  layers: s('<path d="M7 1.8 1.8 4.6 7 7.4l5.2-2.8zM1.8 7.2 7 10l5.2-2.8M1.8 9.6 7 12.4l5.2-2.8"/>', 1.4),
  pen: s('<path d="M9.3 2.2a1.5 1.5 0 0 1 2.1 2.1L4.6 11.1 2 12l.9-2.6z"/>', 1.5),
  trash: s('<path d="M2.5 3.8h9M5.5 3.8V2.5h3v1.3M3.6 3.8l.6 8h5.6l.6-8"/>', 1.4),
  copy: s('<rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.5"/><path d="M9.5 4.5V3A1 1 0 0 0 8.5 2H3a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h1.5"/>', 1.4),
  download: s('<path d="M7 2v7M4.2 6.4 7 9.2l2.8-2.8M2.5 11.8h9"/>', 1.5),
  eye: s('<path d="M1.2 7S3.3 3 7 3s5.8 4 5.8 4-2.1 4-5.8 4-5.8-4-5.8-4z"/><circle cx="7" cy="7" r="1.7"/>', 1.4),
  lock: s('<rect x="2.5" y="6" width="9" height="6.5" rx="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6"/>', 1.4),
  cursor: s('<path d="m2.5 2 3.6 10 1.6-4.2L12 6.2z"/>', 1.4),
  hand: s('<path d="M4.3 7.5V3.2a1 1 0 0 1 2 0V7M6.3 6.4V2.4a1 1 0 0 1 2 0v4M8.3 6.6V3.4a1 1 0 0 1 2 0v5.2c0 2.3-1.6 3.9-3.8 3.9-1.5 0-2.4-.6-3.2-1.8L1.9 8.6a1 1 0 0 1 1.6-1.1l.8.9"/>', 1.3),
  zoomIn: s('<circle cx="6" cy="6" r="3.8"/><path d="m9 9 3 3M4.4 6h3.2M6 4.4v3.2"/>', 1.5),
  zoomOut: s('<circle cx="6" cy="6" r="3.8"/><path d="m9 9 3 3M4.4 6h3.2"/>', 1.5),
  sparkle: s('<path d="M7 1.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5C5.4 5.6 6.6 4.4 7 1.5zM11.3 9.4c.15.9.55 1.3 1.45 1.45-.9.15-1.3.55-1.45 1.45-.15-.9-.55-1.3-1.45-1.45.9-.15 1.3-.55 1.45-1.45z"/>', 1.2),
  heart: s('<path d="M7 12S1.5 8.8 1.5 5.1A2.9 2.9 0 0 1 7 3.6a2.9 2.9 0 0 1 5.5 1.5C12.5 8.8 7 12 7 12z"/>', 1.4),
  home: s('<path d="M2 6.2 7 2l5 4.2V12a.5.5 0 0 1-.5.5h-3V9h-3v3.5h-3A.5.5 0 0 1 2 12z"/>', 1.4),
  link: s('<path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8 2.5L7 3.5M8 6a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11.5l1-1"/>', 1.4),
  filter: s('<path d="M1.8 2.5h10.4L8.3 7.3v4.2l-2.6-1.3V7.3z"/>', 1.4),
  sliders: s('<path d="M2 4h6M11 4h1M2 10h1M6 10h6"/><circle cx="9.5" cy="4" r="1.5"/><circle cx="4.5" cy="10" r="1.5"/>', 1.4),
  mic: s('<rect x="5" y="1.5" width="4" height="7" rx="2"/><path d="M3 7a4 4 0 0 0 8 0M7 11v1.8"/>', 1.4),
  video: s('<rect x="1.5" y="3.5" width="8" height="7" rx="1.5"/><path d="m9.5 6 3-1.8v5.6l-3-1.8"/>', 1.4),
};

const tpl = typeof document !== 'undefined' ? document.createElement('template') : null;
/** a string slot: an icon name, SVG markup, or plain text */
export function stringSlot(v: string, into: HTMLElement) {
  if (icons[v]) { into.innerHTML = icons[v]; return; }
  if (/^\s*<svg[\s>]/i.test(v) && tpl) {
    tpl.innerHTML = v.trim();
    const svg = tpl.content.firstElementChild;
    if (svg) { svg.setAttribute('aria-hidden', 'true'); into.replaceChildren(svg); return; }
  }
  into.textContent = v;
}
