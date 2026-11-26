/* marmit (React 18+). <Island items={…} /> — icons and panel content can be any React node. */
import { createElement, forwardRef, Fragment, useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, isValidElement, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createIsland } from '../core/island';
import { collectSlots, isNative } from '../core/controls';
import type { IslandController, IslandOptions } from '../core/types';

export * from '../core/index';

export interface IslandProps extends Omit<IslandOptions, 'container' | 'slotHost' | 'mountSlot'> {
  /** contained mode: the element the island docks inside (defaults to the element the component renders in) */
  container?: HTMLElement | null;
  /** class/style for the wrapper the component renders (contained/inline modes) */
  hostClassName?: string;
  hostStyle?: CSSProperties;
}

const useIso = typeof document !== 'undefined' ? useLayoutEffect : useEffect;
const HOST: Record<string, CSSProperties> = {
  overlay: { display: 'none' },
  contained: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  inline: { display: 'contents' },
};

export const Island = forwardRef<IslandController | null, IslandProps>(function Island(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<IslandController | null>(null);
  const hosts = useRef(new Map<string, HTMLElement>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const mode = props.mode ?? 'overlay';
  const slotHost = (key: string) => {
    let el = hosts.current.get(key);
    if (!el) { el = document.createElement('span'); el.style.display = 'contents'; hosts.current.set(key, el); }
    return el;
  };
  const opts = (): IslandOptions => {
    const { hostClassName: _c, hostStyle: _s, container, ...rest } = props;
    return { ...rest, slotHost };
  };
  useIso(() => {
    const container = mode === 'overlay' ? props.container ?? document.body : props.container ?? host.current;
    ctl.current = createIsland({ ...opts(), container });
    rerender();   // now the portal hosts exist
    return () => { ctl.current?.destroy(); ctl.current = null; hosts.current.clear(); };
  }, [mode]);
  useIso(() => { ctl.current?.update(opts()); });
  useImperativeHandle(ref, () => ctl.current!, [mode, ctl.current]);

  const portals: ReactNode[] = [];
  if (ctl.current) collectSlots(props.items, (key, value) => {
    if (!isNative(value) && (isValidElement(value) || typeof value === 'object')) portals.push(createPortal(value as ReactNode, slotHost(key), key));
  });
  return createElement(Fragment, null,
    createElement('div', { ref: host, className: props.hostClassName, style: { ...HOST[mode], ...props.hostStyle }, 'data-marmit-host': '' }),
    ...portals);
});
