import css from './styles.css';

export const styles: string = css;
let refs = 0, el: HTMLStyleElement | null = null;

/** Adds the stylesheet to the document once, however many islands are mounted. */
export function injectStyles(doc: Document = document) {
  refs++;
  if (el?.isConnected || doc.getElementById('islandkit-styles')) return;
  el = doc.createElement('style');
  el.id = 'islandkit-styles';
  el.textContent = css;
  doc.head.prepend(el);   // first, so app styles win ties
}
export function releaseStyles() {
  if (--refs <= 0) { refs = 0; el?.remove(); el = null; }
}
