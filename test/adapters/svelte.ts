import { island } from '../../src/svelte/index';
// @ts-ignore compiled by the test bundler
import Icon from './Icon.svelte';
const node = document.getElementById('app')!;
const a = island(node, { mode: 'inline', items: [{ type: 'button', label: 'Svelte', icon: { component: Icon, props: { size: 14 } } }, { type: 'slider', id: 's', label: 'Svelte', value: 30 }] });
(window as any).svelteUpdate = () => a.update({ mode: 'inline', items: [{ type: 'button', label: 'Svelte', icon: 'heart' }, { type: 'slider', id: 's', label: 'Updated', value: 80 }] });
