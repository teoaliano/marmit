# islandkit

A gooey, spring-driven floating toolbar. One black island carries any mix of controls, grows panels out of itself through a liquid neck, melts a search field open (a close droplet pinches off its end), dents under a press, bends when you pull it, and can be thrown at any edge of the screen to re-dock there.

It works as an app's command dock, a canvas tool bar, a tiny menu bar, or a live control strip. The engine is plain DOM with no dependencies (about 25 kB gzipped, styles included). React, Vue, Svelte, Solid and a web component are thin wrappers round the same core, packaged the way [DialKit](https://www.dialkit.dev/) is: one package, one subpath per stack.

```
npm install islandkit
```

| Stack | Import | Needs |
|---|---|---|
| React 18+ | `import { Island } from 'islandkit'` | `react`, `react-dom` |
| Vue 3.3+ | `import { Island } from 'islandkit/vue'` | `vue` |
| Svelte 5 | `import { island } from 'islandkit/svelte'` | `svelte` |
| Solid 1.6+ | `import { Island } from 'islandkit/solid'` | `solid-js` |
| Web component (Angular, Astro, Lit, HTMX, Rails, Django…) | `import 'islandkit/element/register'` | nothing |
| Plain JS | `import { createIsland } from 'islandkit/vanilla'` | nothing |
| `<script>` tag | `islandkit/vanilla/browser.js` → `window.IslandKit` | nothing |

The stylesheet is injected for you. To ship it yourself (for a strict CSP, say), pass `injectStyles: false` and `import 'islandkit/styles.css'`.

## Quick start

### React

```tsx
import { Island } from 'islandkit';

export function Toolbar() {
  const [zoom, setZoom] = useState(100);
  return (
    <Island
      side="bottom"
      collapsible
      items={[
        { type: 'grid', id: 'insert', label: 'Insert', icon: 'plus', items: [
          { label: 'Text', icon: 'text', onSelect: addText },
          { label: 'Image', icon: <ImageIcon />, onSelect: addImage },   // any React node works as an icon
        ] },
        { type: 'color', id: 'fill', label: 'Fill', icon: 'palette', onChange: setFill },
        { type: 'separator' },
        { type: 'stepper', id: 'zoom', value: zoom, min: 25, max: 400, step: 25, format: v => `${v}%`, onChange: setZoom },
        { type: 'panel', id: 'about', label: 'About', icon: 'sparkle', content: <AboutCard /> },
      ]}
    />
  );
}
```

`ref` gives you the [controller](#controller). Values can be controlled (pass `value` and `onChange`) or left to the island.

### Vue

```vue
<script setup>
import { Island } from 'islandkit/vue';
import StarIcon from './StarIcon.vue';
const zoom = ref(100);
</script>

<template>
  <Island side="bottom" :items="[
    { type: 'button', id: 'star', label: 'Star', icon: StarIcon, toggle: true },
    { type: 'stepper', id: 'zoom', value: zoom, onChange: v => (zoom = v) },
  ]" @action="(id, entry) => console.log(id, entry)" />
</template>
```

Icons and panel content can be components or VNodes. Events: `change`, `action`, `sideChange`, `openChange`, `update:collapsed`, `update:side`.

### Svelte 5

```svelte
<script>
  import { island } from 'islandkit/svelte';
  import Star from './Star.svelte';
  let size = $state(50);
</script>

<div use:island={{
  mode: 'inline',
  items: [
    { type: 'button', label: 'Star', icon: { component: Star, props: { filled: true } } },
    { type: 'slider', id: 'size', value: size, onChange: v => (size = v) },
  ],
}}></div>
```

It's an action, so there's nothing to compile. Svelte components go in as `{ component, props }`.

### Solid

```tsx
import { Island } from 'islandkit/solid';

<Island mode="inline" items={[{ type: 'button', label: 'Star', icon: <StarIcon /> }, { type: 'switch', id: 'snap', label: 'Snap' }]} />
```

Solid's JSX produces real DOM nodes, so icons and content work as they are.

### Web component

```html
<script type="module">import 'https://esm.sh/islandkit/element/register';</script>

<island-kit side="bottom" collapsible>
  <script type="application/json">
    { "items": [ { "type": "button", "id": "add", "label": "Add", "icon": "plus", "variant": "primary" },
                 { "type": "menu", "id": "more", "label": "More", "icon": "more", "items": [{ "label": "Delete", "danger": true }] } ] }
  </script>
</island-kit>

<script>
  const el = document.querySelector('island-kit');
  el.addEventListener('action', e => console.log(e.detail));   // { id: 'more', entry: 'Delete' }
  el.addEventListener('change', e => console.log(e.detail));   // { id, value, values }
  // or set everything from JS, callbacks included: el.options = { items: [...] }
</script>
```

Attributes: `side`, `mode`, `theme`, `align`, `margin`, `label`, `z-index`, `panel-direction`, `draggable`, `stretchy`, `collapsible`, `collapsed`. The element also has the controller methods (`get`, `set`, `values`, `open`, `close`, `collapse`, `setSide`).

### Plain JavaScript

```js
import { createIsland } from 'islandkit/vanilla';

const island = createIsland({
  items: [
    { type: 'button', id: 'undo', label: 'Undo', icon: 'undo', onClick: undo },
    { type: 'search', id: 'q', placeholder: 'Search', onChange: filter },
  ],
});
island.set('q', 'hello');
```

No bundler: load `node_modules/islandkit/dist/vanilla/browser.global.js` with a `<script>` tag (or from a CDN at `https://unpkg.com/islandkit/dist/vanilla/browser.global.js`) and call `IslandKit.createIsland(...)`.

## Modes

| `mode` | What it does |
|---|---|
| `overlay` (default) | Fixed to the viewport and docked to `side`, like a floating dock. Drag it and throw it at another edge. |
| `contained` | Docks inside an element: `container` for vanilla, or the component's parent in the adapters (it must be positioned). Good for canvases and previews. |
| `inline` | Sits in the document flow like any element. Panels still float out of it, opening toward the larger free space. Pulling it bends it and it wobbles back. |

`side` is `'top' | 'right' | 'bottom' | 'left'`. On left and right the bar stands vertical: square controls stay upright, and wide ones (pills, sliders, segmented) turn with the bar.

## Items

Every item takes `id`, `tooltip` (string or `false`), `disabled` and `hidden`. Give an item an `id` to read or set its value; ids also keep elements and focus stable across updates.

**On the bar**

| `type` | Key props | Value |
|---|---|---|
| `button` | `label`, `icon`, `variant: 'primary'`, `toggle`, `badge` (number, string or `true` for a dot), `onClick` | `boolean` when `toggle` |
| `pill` | `label`, `icon`, `variant: 'solid'`, `onClick` | |
| `separator`, `spacer` | `spacer.size` | |
| `label` | `text`, `muted` | |
| `segmented` | `options` (strings or `{ value, label, icon }`) | `string` |
| `switch` | `label` | `boolean` |
| `slider` | `label`, `min`, `max`, `step`, `width`, `showValue`, `format` | `number` |
| `stepper` | `label`, `min`, `max`, `step`, `format` | `number` |
| `swatches` | `options` (CSS colours) | `string` |
| `thumbs` | `options` (image URLs or `{ value, src, label }`) | `string` |
| `field` | `placeholder`, `icon`, `width`, `onSubmit` | `string` |
| `search` | `placeholder`, `width`, `onSubmit`, `onOpenChange`. Melts open from an icon; a close droplet pinches off the bar's end | `string` |
| `status` | `label`, `tone: 'success' \| 'warning' \| 'danger' \| 'neutral'`, `pulse` | |
| `avatars` | `people: { name, initials?, src?, color? }[]`, `max` | |
| `progress` | `label`, `showValue`, `onClick` (a ring) | `0..1` |
| `custom` | `render` (any slot), `width`, `draggable` | |

**Panels** grow out of the bar from their trigger and stay joined to it by a gooey neck. Switching between panels slides the neck across. The trigger is an icon button, or a pill with a chevron when there's no icon (or with `trigger: 'pill'`). Every panel takes `label`, `icon`, `trigger` and `title`.

| `type` | Key props | Value |
|---|---|---|
| `menu` | `items: ({ label, icon, shortcut, hint, danger, checked, disabled, onSelect } \| 'separator')[]`, `closeOnSelect` | |
| `select` | `options`, a pill showing the current choice | `string` |
| `grid` | `items: { label, icon, onSelect }[]`, `columns` (a tile picker, like Insert) | |
| `color` | `options` (CSS colours), `columns` | `string` |
| `command` | `items: { label, icon, hint, keywords, onSelect }[]`, `placeholder`, `empty`, `onQuery` (a filterable list) | |
| `panel` | `content` (any slot: your own UI) | |

**Icons and slots.** Anywhere an icon or content goes, you can pass:

- a built-in icon name: `plus minus undo redo grid search more close chevron check comment invite palette text image shape frame sticky embed play pause bell share settings sun moon layers pen trash copy download eye lock cursor hand zoomIn zoomOut sparkle heart home link filter sliders mic video`
- SVG markup (`'<svg …>'`) or plain text
- a DOM node
- a render function `(el) => cleanup | Node | void`
- a framework value: React nodes, Vue VNodes or components, Svelte `{ component, props }`. Solid JSX is already a DOM node.

## Options

| Option | Default | |
|---|---|---|
| `items` | | the list above |
| `mode` | `'overlay'` | `overlay`, `contained` or `inline` |
| `container` | `document.body` | vanilla only; the adapters set it |
| `side` | `'bottom'` | which edge it docks to; vertical bars on `left` and `right` |
| `align` | `'center'` | `start`, `center` or `end` along that edge |
| `margin` | `24` | gap to the edge |
| `draggable` | `true` | drag and throw to re-dock (overlay and contained) |
| `stretchy` | `true` | when not draggable, pulling bends the bar like taffy |
| `collapsible` / `collapsed` | `false` | a tab that slides the bar off its edge; hover the sliver to peek |
| `panelDirection` | `'auto'` | which way inline panels open |
| `theme` | `'dark'` | `dark`, `light`, `auto`, or an object (see below) |
| `physics` | | the motion dials (see below) |
| `label` | `'Toolbar'` | accessible name |
| `zIndex`, `className`, `injectStyles` | | |
| `onChange(id, value, values)` | | any value changed by the user |
| `onAction(id, entry?)` | | button and pill clicks; menu, grid and command choices (`entry` is the entry's `id` or `label`) |
| `onSideChange`, `onOpenChange`, `onCollapsedChange` | | |

## Controller

`createIsland()` returns it; the React `ref`, the Vue `expose`, Solid's `ref` callback, the Svelte `onReady` option and the custom element itself all give you the same methods.

```ts
island.get(id); island.set(id, value); island.values();   // set() doesn't fire onChange
island.open('insert'); island.close(); island.openId;
island.setSide('left'); island.side;
island.collapse(true);
island.update({ items, theme: 'light' });                 // reconciles by id; untouched items keep their elements
island.destroy();
```

## Theming

```js
createIsland({ theme: { bar: '#0b0b0f', ink: '#f4f4f5', accent: '#a3e635', onAccent: '#0b0b0f', danger: '#f43f5e' }, items });
```

Theme keys: `bar ink accent onAccent success warning danger knob shadow font`. They set `--ik-bar`, `--ik-ink` and the rest on the island's root, so plain CSS works too:

```css
.ik { --ik-bar: #111; --ik-accent: hotpink; }
```

Surfaces, lines and muted text are mixed from `--ik-ink`, so a two-colour theme stays consistent.

## Motion

Every dial from the motion study is a `physics` option:

| Dial | Default | |
|---|---|---|
| `stiffness`, `damping` | `150`, `10` | the main spring; lower damping overshoots more |
| `blur` | `7` | goo melt radius; `0` turns the goo off |
| `stretch` | `0` | how far the material can stretch |
| `dent`, `dentWidth` | `2.5`, `16` | how deep and wide a press dents the bar |
| `bend` | `0.3` | how soft the rod is in flight and while dragged |
| `reach`, `pullBend` | `32`, `0.4` | taffy pull: how far it gives, how much the middle bows |
| `arc`, `corner`, `lift` | `0.25`, `40`, `0.15` | re-dock routes: the arc between sides, slide radius round a corner, swing bow |
| `dropletGap`, `string` | `14`, `12` | search: the close droplet's gap, and its neck thickness (`0` floats free) |
| `panelGap`, `neck` | `10`, `26` | the panel's gap to the bar, and the neck's thickness |

There is one shared `requestAnimationFrame` loop for every island, and it runs only while something moves. The goo filter only switches on while something is melting, sized to just that area. With `prefers-reduced-motion`, every spring snaps to its target.

## Accessibility

- The island is a `toolbar` with an orientation.
- Panel triggers carry `aria-haspopup` and `aria-expanded`. Opening a panel from the keyboard focuses it. Arrow keys move through its rows and tiles, Esc closes it and focus returns to the trigger.
- Segmented controls, swatches and thumbs are radio groups with roving focus.
- The slider and stepper take arrows, Page Up/Down, Home and End.
- Tooltips show on hover and on keyboard focus.
- A collapsed bar's controls are made `inert`.

## Browser support

It needs current evergreen browsers: Chrome/Edge 111+, Safari 16.4+, Firefox 128+. It uses `color-mix()`, `oklch()`, `@property`, `inert` and SVG filters on HTML.

## Develop

```
npm install
npm run build          # dist/ for every entry
npm test               # unit tests (vitest + happy-dom)
npm run typecheck
node test/browser.mjs  # drives demo/index.html in headless Chrome and screenshots each state into test/shots
node test/adapters.mjs # builds a tiny app per framework and checks it in Chrome
open demo/index.html   # after a build
```

Layout: `src/core` holds the engine (`island.ts`), the controls and panels (`controls.ts`), the rod and spring physics (`physics.ts`), the re-dock routes (`routes.ts`), the icons and the stylesheet. Each folder under `src/` beside it is one adapter of 30 to 100 lines.

## License

MIT
