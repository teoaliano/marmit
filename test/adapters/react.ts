import { createElement as h, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Island, type IslandController } from '../../src/react/index';

function Star() { return h('svg', { viewBox: '0 0 14 14', fill: 'currentColor' }, h('path', { d: 'M7 1.5l1.7 3.6 3.8.4-2.9 2.6.8 3.8L7 10l-3.4 1.9.8-3.8L1.5 5.5l3.8-.4z' })); }
function App() {
  const [zoom, setZoom] = useState(100);
  const [starred, setStarred] = useState(false);
  const ref = useRef<IslandController>(null);
  (window as any).reactIsland = ref;
  return h('div', { style: { padding: 40 } },
    h('p', { id: 'state' }, `zoom ${zoom} starred ${starred}`),
    h(Island, {
      ref, mode: 'inline',
      items: [
        { type: 'button', id: 'star', label: 'Star', icon: h(Star), toggle: true, value: starred, onChange: setStarred },
        { type: 'separator' },
        { type: 'stepper', id: 'zoom', min: 25, max: 400, step: 25, value: zoom, onChange: setZoom, format: v => v + '%' },
        { type: 'panel', id: 'about', label: 'About', icon: 'sparkle', title: 'React content', content: h('div', { id: 'react-panel', style: { width: 200 } }, `Zoom is ${zoom}%`) },
      ],
    }),
    h(Island, { side: 'bottom', items: [{ type: 'button', label: 'React dock', icon: h(Star) }, { type: 'pill', label: `Zoom ${zoom}%` }] }),
  );
}
createRoot(document.getElementById('app')!).render(h(App));
