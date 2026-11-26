import { createApp, h, ref, defineComponent } from 'vue';
import { Island } from '../../src/vue/index';
const Star = defineComponent({ render: () => h('svg', { viewBox: '0 0 14 14', fill: 'currentColor' }, [h('path', { d: 'M7 1.5l1.7 3.6 3.8.4-2.9 2.6.8 3.8L7 10l-3.4 1.9.8-3.8L1.5 5.5l3.8-.4z' })]) });
createApp(defineComponent({
  setup() {
    const zoom = ref(100), last = ref('');
    return () => h('div', { style: 'padding:40px' }, [
      h('p', { id: 'state' }, `zoom ${zoom.value} last ${last.value}`),
      h(Island, {
        mode: 'inline',
        items: [
          { type: 'button', id: 'star', label: 'Star', icon: Star },
          { type: 'segmented', id: 'view', options: ['Grid', 'List'] },
          { type: 'stepper', id: 'zoom', min: 25, max: 400, step: 25, value: zoom.value, onChange: (v: number) => (zoom.value = v), format: (v: number) => v + '%' },
          { type: 'menu', id: 'more', label: 'More', icon: h(Star), items: [{ label: 'One', icon: h(Star) }, { label: 'Two' }] },
        ],
        onAction: (id: string, e?: string) => (last.value = id + ':' + (e ?? '')),
      }),
    ]);
  },
})).mount('#app');
