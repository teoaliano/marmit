/* marmit/svelte (Svelte 5). An action, so there is nothing to compile:

   <div use:island={{ items, side: 'bottom' }}></div>

   Icons and panel content take strings, DOM nodes, render functions, or { component, props } for a Svelte component. */
import { mount, unmount, type Component } from 'svelte';
import { createIsland } from '../core/island';
import { hostStyle } from '../core/controls';
import type { IslandController, IslandOptions } from '../core/types';

export * from '../core/index';

export type SvelteSlot = { component: Component<any>; props?: Record<string, unknown> };
export type IslandActionOptions = Omit<IslandOptions, 'container' | 'slotHost' | 'mountSlot'> & { onReady?: (island: IslandController) => void };

function mountSlot(value: unknown, el: HTMLElement) {
  if (value && typeof value === 'object' && 'component' in value) {
    const v = value as SvelteSlot, inst = mount(v.component, { target: el, props: v.props ?? {} });
    return () => { unmount(inst); };
  }
}

export function island(node: HTMLElement, options: IslandActionOptions) {
  const mode = options.mode ?? 'overlay';
  node.style.cssText += ';' + hostStyle(mode);
  const { onReady, ...rest } = options;
  const ctl = createIsland({ ...rest, container: mode === 'overlay' ? document.body : node, mountSlot });
  onReady?.(ctl);
  return {
    update(next: IslandActionOptions) { const { onReady: _r, ...o } = next; ctl.update(o); },
    destroy() { ctl.destroy(); },
  };
}
