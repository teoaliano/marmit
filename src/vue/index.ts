/* marmit/vue (Vue 3.3+). <Island :items="…" @change="…" /> — icons and panel content can be VNodes or components. */
import { defineComponent, h, isVNode, onBeforeUnmount, onMounted, ref, shallowRef, Teleport, watch, type Component, type PropType, type VNode } from 'vue';
import { createIsland } from '../core/island';
import { collectSlots, hostStyle, isNative } from '../core/controls';
import type { IslandController, IslandItem, IslandOptions, Physics, Side, Theme } from '../core/types';

export * from '../core/index';

const KEYS = ['mode', 'side', 'align', 'margin', 'draggable', 'stretchy', 'collapsible', 'collapsed', 'theme', 'physics', 'label', 'zIndex', 'panelDirection', 'className', 'injectStyles'] as const;

export const Island = defineComponent({
  name: 'Island',
  props: {
    items: { type: Array as PropType<IslandItem[]>, required: true },
    mode: String as PropType<IslandOptions['mode']>,
    side: String as PropType<Side>,
    align: String as PropType<IslandOptions['align']>,
    margin: Number,
    draggable: { type: Boolean, default: undefined },
    stretchy: { type: Boolean, default: undefined },
    collapsible: { type: Boolean, default: undefined },
    collapsed: { type: Boolean, default: undefined },
    theme: [String, Object] as PropType<IslandOptions['theme'] | Partial<Theme>>,
    physics: Object as PropType<Partial<Physics>>,
    label: String,
    zIndex: Number,
    panelDirection: String as PropType<IslandOptions['panelDirection']>,
    className: String,
    injectStyles: { type: Boolean, default: undefined },
    container: Object as PropType<HTMLElement | null>,
  },
  emits: ['change', 'action', 'sideChange', 'openChange', 'update:collapsed', 'update:side'],
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement>();
    const ctl = shallowRef<IslandController | null>(null);
    const hosts = new Map<string, HTMLElement>();
    const slotHost = (key: string) => {
      let el = hosts.get(key);
      if (!el) { el = document.createElement('span'); el.style.display = 'contents'; hosts.set(key, el); }
      return el;
    };
    const opts = (): IslandOptions => {
      const o: Record<string, unknown> = { items: props.items, slotHost };
      for (const k of KEYS) if (props[k] !== undefined) o[k] = props[k];
      o.onChange = (id: string, value: unknown, values: Record<string, unknown>) => emit('change', id, value, values);
      o.onAction = (id: string, entry?: string) => emit('action', id, entry);
      o.onSideChange = (side: Side) => { emit('sideChange', side); emit('update:side', side); };
      o.onOpenChange = (id: string | null) => emit('openChange', id);
      o.onCollapsedChange = (v: boolean) => emit('update:collapsed', v);
      return o as unknown as IslandOptions;
    };
    onMounted(() => {
      const mode = props.mode ?? 'overlay';
      ctl.value = createIsland({ ...opts(), container: mode === 'overlay' ? props.container ?? document.body : props.container ?? host.value! });
    });
    watch(() => [props.items, ...KEYS.map(k => props[k])], () => ctl.value?.update(opts()), { deep: true });
    onBeforeUnmount(() => { ctl.value?.destroy(); ctl.value = null; });
    expose({
      get controller() { return ctl.value; },
      get: (id: string) => ctl.value?.get(id), set: (id: string, v: unknown) => ctl.value?.set(id, v), values: () => ctl.value?.values() ?? {},
      open: (id: string) => ctl.value?.open(id), close: () => ctl.value?.close(), collapse: (v?: boolean) => ctl.value?.collapse(v), setSide: (s: Side) => ctl.value?.setSide(s),
    });
    return () => {
      const teleports: VNode[] = [];
      if (ctl.value) collectSlots(props.items, (key, value) => {
        if (isNative(value) || typeof value !== 'object') return;
        teleports.push(h(Teleport, { to: slotHost(key), key }, [isVNode(value) ? value : h(value as Component)]));
      });
      return h('div', { ref: host, style: hostStyle(props.mode), 'data-marmit-host': '' }, teleports);
    };
  },
});
