import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { Island } from '../../src/solid/index';
const star = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 14 14'); s.setAttribute('fill', 'currentColor'); s.innerHTML = '<path d="M7 1.5l1.7 3.6 3.8.4-2.9 2.6.8 3.8L7 10l-3.4 1.9.8-3.8L1.5 5.5l3.8-.4z"/>'; return s; };
const [n, setN] = createSignal(1);
(window as any).solidBump = () => setN(n() + 1);
render(() => Island({
  mode: 'inline',
  get items() { return [{ type: 'button' as const, id: 'star', label: 'Star', icon: star() }, { type: 'label' as const, text: `count ${n()}` }, { type: 'switch' as const, id: 'on', label: 'On' }]; },
}), document.getElementById('app')!);
