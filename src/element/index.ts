/* islandkit/element — a custom element, for any stack that renders HTML (Angular, Astro, HTMX, Rails, Django, Lit…).

   <island-kit side="bottom" collapsible></island-kit>
   <script> document.querySelector('island-kit').options = { items: [...] } </script>

   Options can also come from a JSON child:  <island-kit><script type="application/json">{"items":[…]}</script></island-kit>
   Events: change {id, value, values} · action {id, entry} · sidechange {side} · openchange {id} · collapsechange {collapsed} */
import { createIsland } from '../core/island';
import type { IslandController, IslandOptions, Side } from '../core/types';

const BOOLS = ['draggable', 'stretchy', 'collapsible', 'collapsed'] as const;
const ATTRS = ['side', 'mode', 'theme', 'align', 'margin', 'label', 'z-index', 'panel-direction', ...BOOLS];

const Base = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export class IslandElement extends Base {
  static observedAttributes = ATTRS;
  private ctl: IslandController | null = null;
  private opts: Partial<IslandOptions> = {};

  /** The full options object (items, callbacks, physics…). Setting it updates the island. */
  get options() { return this.opts; }
  set options(v: Partial<IslandOptions>) { this.opts = v; this.ctl?.update(this.collect()); }
  /** The live controller, once connected. */
  get controller() { return this.ctl; }
  get(id: string) { return this.ctl?.get(id); }
  set(id: string, value: unknown) { this.ctl?.set(id, value); }
  values() { return this.ctl?.values() ?? {}; }
  open(id: string) { this.ctl?.open(id); }
  close() { this.ctl?.close(); }
  collapse(v?: boolean) { this.ctl?.collapse(v); }
  setSide(side: Side) { this.ctl?.setSide(side); }

  private collect(): IslandOptions {
    const a = (n: string) => this.getAttribute(n);
    const fromAttrs: Partial<IslandOptions> = {};
    if (a('side')) fromAttrs.side = a('side') as Side;
    if (a('mode')) fromAttrs.mode = a('mode') as IslandOptions['mode'];
    if (a('theme')) fromAttrs.theme = a('theme') as 'dark';
    if (a('align')) fromAttrs.align = a('align') as 'center';
    if (a('margin')) fromAttrs.margin = Number(a('margin'));
    if (a('label')) fromAttrs.label = a('label')!;
    if (a('z-index')) fromAttrs.zIndex = Number(a('z-index'));
    if (a('panel-direction')) fromAttrs.panelDirection = a('panel-direction') as 'auto';
    for (const b of BOOLS) if (this.hasAttribute(b)) fromAttrs[b] = a(b) !== 'false';
    const json = this.querySelector(':scope > script[type="application/json"]');
    let parsed: Partial<IslandOptions> = {};
    if (json?.textContent?.trim()) { try { parsed = JSON.parse(json.textContent); } catch (err) { console.error('[islandkit] bad JSON options', err); } }
    const fire = (type: string, detail: unknown) => this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
    const user = this.opts;
    return {
      items: [], ...parsed, ...fromAttrs, ...user,
      onChange: (id, value, values) => { user.onChange?.(id, value, values); fire('change', { id, value, values }); },
      onAction: (id, entry) => { user.onAction?.(id, entry); fire('action', { id, entry }); },
      onSideChange: side => { user.onSideChange?.(side); fire('sidechange', { side }); },
      onOpenChange: id => { user.onOpenChange?.(id); fire('openchange', { id }); },
      onCollapsedChange: collapsed => { user.onCollapsedChange?.(collapsed); fire('collapsechange', { collapsed }); },
    };
  }
  connectedCallback() {
    if (this.ctl) return;
    const o = this.collect(), mode = o.mode ?? 'overlay';
    this.style.cssText += mode === 'inline' ? ';display:inline-block;vertical-align:middle' : mode === 'contained' ? ';position:absolute;inset:0;pointer-events:none' : ';display:none';
    this.ctl = createIsland({ ...o, container: mode === 'overlay' ? document.body : this });
  }
  disconnectedCallback() { this.ctl?.destroy(); this.ctl = null; }
  attributeChangedCallback() { this.ctl?.update(this.collect()); }
}

/** Registers <island-kit> (or your own tag name). Safe to call more than once. */
export function defineIslandElement(tag = 'island-kit') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, class extends IslandElement {});
}

declare global { interface HTMLElementTagNameMap { 'island-kit': IslandElement } }
