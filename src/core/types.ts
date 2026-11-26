export type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * Anything that can be drawn into a slot (an icon, a panel's content, a custom item):
 * - a string: a built-in icon name (`'plus'`), SVG markup (`'<svg…>'`), or plain text
 * - a DOM Node (Solid JSX elements are Nodes, so they work as-is)
 * - a function `(el) => cleanup | Node | void` that renders into the element it is given
 * - anything else (a React element, a Vue VNode, `{ component, props }` for Svelte) is handed to the framework adapter
 */
export type Slot = string | Node | ((el: HTMLElement) => void | Node | (() => void)) | object | null | undefined;

export interface Option<V extends string = string> { value: V; label?: string; icon?: Slot }
export type OptionInput = string | Option;

interface Base {
  /** Stable key. Required to read or set the item's value through the controller; recommended everywhere. */
  id?: string;
  /** Shown after a short hover. Defaults to `label` for icon-only items. */
  tooltip?: string | false;
  disabled?: boolean;
  hidden?: boolean;
}

/* ---------------- bar controls ---------------- */

export interface ButtonItem extends Base {
  type: 'button';
  /** Accessible name; also the tooltip. */
  label: string;
  icon?: Slot;
  /** `primary` is the filled accent button. */
  variant?: 'default' | 'primary';
  /** Makes it a pressed/unpressed toggle; `value` is then a boolean. */
  toggle?: boolean;
  value?: boolean;
  /** A small count or dot on the button. `true` draws a dot. */
  badge?: number | string | boolean;
  onClick?: (e: MouseEvent) => void;
  onChange?: (value: boolean) => void;
}

export interface PillItem extends Base {
  type: 'pill';
  label: string;
  icon?: Slot;
  variant?: 'soft' | 'solid';
  onClick?: (e: MouseEvent) => void;
}

export interface SeparatorItem { type: 'separator'; id?: string; hidden?: boolean }
export interface SpacerItem { type: 'spacer'; id?: string; size?: number; hidden?: boolean }

export interface LabelItem extends Base { type: 'label'; text: string; muted?: boolean }

export interface SegmentedItem extends Base {
  type: 'segmented';
  label?: string;
  options: OptionInput[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface SwitchItem extends Base {
  type: 'switch';
  label?: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

export interface SliderItem extends Base {
  type: 'slider';
  label?: string;
  min?: number; max?: number; step?: number;
  value?: number;
  /** Track width in px (default 120). */
  width?: number;
  /** Show the number after the track (default true). */
  showValue?: boolean;
  format?: (value: number) => string;
  onChange?: (value: number) => void;
}

export interface StepperItem extends Base {
  type: 'stepper';
  label?: string;
  min?: number; max?: number; step?: number;
  value?: number;
  format?: (value: number) => string;
  onChange?: (value: number) => void;
}

export interface SwatchesItem extends Base {
  type: 'swatches';
  label?: string;
  /** CSS colours. */
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface ThumbsItem extends Base {
  type: 'thumbs';
  label?: string;
  /** Image URLs (or `{ value, src, label }`). */
  options: (string | { value: string; src: string; label?: string })[];
  value?: string;
  onChange?: (value: string) => void;
}

export interface FieldItem extends Base {
  type: 'field';
  label?: string;
  placeholder?: string;
  icon?: Slot;
  value?: string;
  width?: number;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

/** An icon that melts open into a search field; a close droplet pinches off the end of the bar. */
export interface SearchItem extends Base {
  type: 'search';
  label?: string;
  placeholder?: string;
  value?: string;
  /** Open width of the field (default 200). */
  width?: number;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export interface StatusItem extends Base {
  type: 'status';
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  pulse?: boolean;
}

export interface AvatarsItem extends Base {
  type: 'avatars';
  people: { name: string; initials?: string; src?: string; color?: string }[];
  /** Show at most this many, then "+n". */
  max?: number;
}

export interface ProgressItem extends Base {
  type: 'progress';
  label?: string;
  /** 0..1 */
  value?: number;
  showValue?: boolean;
  onClick?: (e: MouseEvent) => void;
}

export interface CustomItem extends Base {
  type: 'custom';
  label?: string;
  /** What to draw on the bar. */
  render: Slot;
  /** Fixed size along the bar; otherwise the rendered element is measured. */
  width?: number;
  /** Let a drag start from this item (default false). */
  draggable?: boolean;
}

/* ---------------- panel triggers: a panel grows out of the bar, joined to it by a gooey neck ---------------- */

interface TriggerBase extends Base {
  /** Accessible name of the trigger, and the panel's default title. */
  label: string;
  icon?: Slot;
  /** How the trigger looks on the bar: an icon button (default when there's an icon) or a pill with a chevron. */
  trigger?: 'icon' | 'pill';
  /** Panel heading; `false` hides it. */
  title?: string | false;
}

export interface MenuEntry {
  id?: string;
  label: string;
  icon?: Slot;
  shortcut?: string;
  hint?: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuItem extends TriggerBase {
  type: 'menu';
  items: (MenuEntry | 'separator')[];
  /** Close the panel after an entry is chosen (default true). */
  closeOnSelect?: boolean;
}

export interface SelectItem extends Base {
  type: 'select';
  label: string;
  icon?: Slot;
  options: OptionInput[];
  value?: string;
  title?: string | false;
  onChange?: (value: string) => void;
}

export interface GridItem extends TriggerBase {
  type: 'grid';
  items: { id?: string; label: string; icon?: Slot; onSelect?: () => void }[];
  columns?: number;
  closeOnSelect?: boolean;
}

export interface ColorItem extends TriggerBase {
  type: 'color';
  options?: string[];
  value?: string;
  columns?: number;
  onChange?: (value: string) => void;
}

export interface CommandItem extends TriggerBase {
  type: 'command';
  placeholder?: string;
  items: { id?: string; label: string; icon?: Slot; hint?: string; keywords?: string[]; onSelect?: () => void }[];
  empty?: string;
  onQuery?: (query: string) => void;
}

export interface PanelItem extends TriggerBase {
  type: 'panel';
  /** Anything a Slot takes. It is rendered once and kept while the panel is closed. */
  content: Slot;
}

export type IslandItem =
  | ButtonItem | PillItem | SeparatorItem | SpacerItem | LabelItem
  | SegmentedItem | SwitchItem | SliderItem | StepperItem | SwatchesItem | ThumbsItem
  | FieldItem | SearchItem | StatusItem | AvatarsItem | ProgressItem | CustomItem
  | MenuItem | SelectItem | GridItem | ColorItem | CommandItem | PanelItem;

export type IslandItemType = IslandItem['type'];

export interface Theme {
  bar: string; ink: string; accent: string; onAccent: string;
  success: string; warning: string; danger: string; knob: string; shadow: string;
  font: string;
}

/** The motion dials, same names as the motion study. All optional. */
export interface Physics {
  /** main spring stiffness (150) */
  stiffness: number;
  /** main spring damping (10); lower overshoots more */
  damping: number;
  /** goo melt radius (7); 0 turns the goo off */
  blur: number;
  /** how far the material can stretch (0..2) */
  stretch: number;
  /** press dent depth in px (2.5); 0 turns it off */
  dent: number;
  /** press dent width (16) */
  dentWidth: number;
  /** how soft the rod is in flight and while dragged (0.3); 0 is rigid */
  bend: number;
  /** pull: how far the bar can be pulled before it stops giving (32) */
  reach: number;
  /** pull: how far the middle bows toward the pull (0.4) */
  pullBend: number;
  /** re-dock: how much a move between neighbouring sides curves toward their corner (0.25) */
  arc: number;
  /** re-dock: radius of the slide round a corner (40) */
  corner: number;
  /** re-dock: how far a swing bows away from the corner (0.15) */
  lift: number;
  /** search: gap between the open bar and its close droplet (14) */
  dropletGap: number;
  /** search: thickness of the neck holding the droplet (12); 0 lets it float free */
  string: number;
  /** panel: gap between bar and panel (10); the neck spans it */
  panelGap: number;
  /** panel: thickness of the neck joining panel and bar (26) */
  neck: number;
}

export interface IslandOptions {
  items: IslandItem[];
  /**
   * - `overlay` (default): fixed to the viewport, docked to a side, like a floating dock
   * - `contained`: fills `container` (or the adapter's parent element) and docks inside it
   * - `inline`: sits in the document flow like any element; panels still float out of it
   */
  mode?: 'overlay' | 'contained' | 'inline';
  /** Where to mount. Overlay defaults to document.body. Adapters set this for you. */
  container?: HTMLElement | null;
  /** Side the bar docks to. In inline mode it sets the direction: left/right make a vertical bar. */
  side?: Side;
  /** Position along the side (default center). */
  align?: 'start' | 'center' | 'end';
  /** Gap between the bar and the edge it docks to (default 24). */
  margin?: number;
  /** Drag the bar and throw it at another edge to re-dock (overlay/contained; default true). */
  draggable?: boolean;
  /** When not draggable: pulling the bar bends it like taffy and it wobbles back (default true). */
  stretchy?: boolean;
  /** Which way panels open in inline mode. Default: toward the larger free space. */
  panelDirection?: 'auto' | Side;
  /** A tab to slide the bar off its edge and back (overlay/contained). */
  collapsible?: boolean;
  collapsed?: boolean;
  theme?: 'dark' | 'light' | 'auto' | Partial<Theme>;
  physics?: Partial<Physics>;
  /** Accessible name of the toolbar. */
  label?: string;
  className?: string;
  zIndex?: number;
  /** Inject the stylesheet into the document head (default true). Set false if you import `marmit/styles.css`. */
  injectStyles?: boolean;
  onChange?: (id: string, value: unknown, values: Record<string, unknown>) => void;
  /** Buttons, pills, menu entries, grid tiles and commands: `entry` is the chosen entry's id (or label). */
  onAction?: (id: string, entry?: string) => void;
  onSideChange?: (side: Side) => void;
  onOpenChange?: (id: string | null) => void;
  onCollapsedChange?: (collapsed: boolean) => void;

  /** Adapter hook: return a host element for a non-DOM slot value (React portals, Vue teleports). */
  slotHost?: (key: string, value: unknown) => HTMLElement | null | undefined;
  /** Adapter hook: render a non-DOM slot value imperatively into `el`; return a cleanup. */
  mountSlot?: (value: unknown, el: HTMLElement) => void | (() => void);
}

export interface IslandController {
  /** The island's root element. */
  readonly el: HTMLElement;
  update(options: Partial<IslandOptions>): void;
  get<T = unknown>(id: string): T;
  set(id: string, value: unknown): void;
  values(): Record<string, unknown>;
  readonly side: Side;
  setSide(side: Side): void;
  open(id: string): void;
  close(): void;
  readonly openId: string | null;
  collapse(collapsed?: boolean): void;
  destroy(): void;
}
