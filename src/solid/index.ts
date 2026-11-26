/* islandkit/solid (Solid 1.6+). <Island items={[…]} /> — JSX icons are DOM nodes in Solid, so they just work. */
import { createEffect, onCleanup, untrack, type JSX } from 'solid-js';
import { createIsland } from '../core/island';
import { hostStyle } from '../core/controls';
import type { IslandController, IslandOptions } from '../core/types';

export * from '../core/index';

export interface IslandProps extends Omit<IslandOptions, 'container' | 'slotHost' | 'mountSlot'> {
  container?: HTMLElement | null;
  ref?: (island: IslandController) => void;
}

const KEYS = ['items', 'mode', 'side', 'align', 'margin', 'draggable', 'stretchy', 'collapsible', 'collapsed', 'theme', 'physics', 'label', 'zIndex', 'panelDirection', 'className',
  'onChange', 'onAction', 'onSideChange', 'onOpenChange', 'onCollapsedChange'] as const;

export function Island(props: IslandProps): JSX.Element {
  if (typeof document === 'undefined') return null as unknown as JSX.Element;
  const host = document.createElement('div');
  host.dataset.islandkitHost = '';
  host.style.cssText = hostStyle(props.mode);
  let ctl: IslandController | null = null;
  const read = () => { const o: Record<string, unknown> = {}; for (const k of KEYS) { const v = props[k as keyof IslandProps]; if (v !== undefined) o[k] = v; } return o as unknown as IslandOptions; };
  // effects never run on the server, so this is SSR-safe; the first run creates, later runs update
  createEffect(() => {
    const o = read();
    if (ctl) { ctl.update(o); return; }
    untrack(() => {
      const mode = props.mode ?? 'overlay';
      ctl = createIsland({ ...o, container: mode === 'overlay' ? props.container ?? document.body : props.container ?? host });
      props.ref?.(ctl);
    });
  });
  onCleanup(() => { ctl?.destroy(); ctl = null; });
  return host as unknown as JSX.Element;
}
