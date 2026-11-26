// Design tweaks: edit any part's declared CSS (or a token's definition) live on the page, then copy the changes.
// Overrides are real CSS rules (scoped under .mm, !important) so every specimen, state card and live island follows.
// They persist in localStorage. TWEAKS.declared() reads what the stylesheet says for a property — e.g. var(--mm-tint)
// rather than the computed rgba — by replaying the cascade (specificity, then source order).
window.TWEAKS = (() => {
  const KEY = 'marmit-tweaks', listeners = new Set();
  let state = { parts: {}, tokens: { dark: {}, light: {} } };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.parts && s?.tokens) state = s; } catch { /* private mode */ }
  const style = document.createElement('style'); style.id = 'marmit-tweaks';

  const TOKENS = ['--mm-bar', '--mm-ink', '--mm-accent', '--mm-on-accent', '--mm-knob', '--mm-tint', '--mm-tint-2', '--mm-line', '--mm-track', '--mm-muted', '--mm-success', '--mm-warning', '--mm-danger', '--mm-shadow'];
  const THEME_SEL = { dark: '.mm:not([data-theme=light])', light: '.mm[data-theme=light]' };

  function css() {
    const out = [];
    for (const [sel, props] of Object.entries(state.parts)) {
      const body = Object.entries(props).map(([p, v]) => `${p}: ${v} !important;`).join(' ');
      if (body) out.push(`.mm ${sel} { ${body} }`);
    }
    for (const t of ['dark', 'light']) {
      const body = Object.entries(state.tokens[t]).map(([p, v]) => `${p}: ${v} !important;`).join(' ');
      if (body) out.push(`${THEME_SEL[t]} { ${body} }`);
    }
    return out.join('\n');
  }
  function apply() {
    style.textContent = css();
    if (!style.isConnected) document.head.append(style);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
    requestAnimationFrame(() => listeners.forEach(f => f()));
  }

  /* ---- what the stylesheet declares ---- */
  const sheetRules = () => {
    const src = document.getElementById('marmit-styles')?.sheet, out = [];
    const walk = rules => { for (const r of rules) { if (r.selectorText) out.push(r); else if (r.cssRules && r.media && !/prefers-color-scheme/.test(r.media.mediaText)) walk(r.cssRules); } };
    if (src) walk(src.cssRules);
    return out;
  };
  const spec = s => {
    s = s.replace(/::?[\w-]+\(([^()]*)\)/g, (m, inner) => /^:(not|is|has)/.test(m) ? ' ' + inner : m);   // :not(x) counts as x
    const ids = (s.match(/#[\w-]+/g) || []).length, cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
    const tags = (s.replace(/\[[^\]]*\]|\.[\w-]+|#[\w-]+|:[\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return ids * 1e6 + cls * 1e3 + tags;
  };
  const ALIASES = { background: ['background', 'background-color'], 'background-color': ['background-color', 'background'], 'font-size': ['font-size', 'font'], 'font-weight': ['font-weight', 'font'] };
  /** declared value of prop on node: { value, from } — the winning stylesheet declaration, a tweak, or null */
  function declared(node, prop, target) {
    if (target && state.parts[target]?.[prop]) return { value: state.parts[target][prop], from: 'tweak' };
    let best = null;
    sheetRules().forEach((r, order) => {
      const names = ALIASES[prop] ?? [prop];
      let v = ''; for (const n of names) { v = r.style.getPropertyValue(n); if (v) { if (n === 'font') v = `(font: ${v})`; break; } }
      if (!v) return;
      for (const part of r.selectorText.split(',')) {
        let ok = false; try { ok = node.matches(part.trim()); } catch { /* selector the DOM can't test */ }
        if (!ok) continue;
        const sp = spec(part);
        if (!best || sp > best.sp || (sp === best.sp && order >= best.order)) best = { value: v.trim(), from: part.trim(), sp, order };
      }
    });
    return best;
  }
  /** a token's own definition for a theme (light falls back to the base .mm definition) */
  function tokenDef(name, theme) {
    if (state.tokens[theme][name]) return { value: state.tokens[theme][name], from: 'tweak' };
    const rules = sheetRules();
    const find = sel => rules.find(r => r.selectorText === sel && r.style.getPropertyValue(name))?.style.getPropertyValue(name).trim();
    if (theme === 'light') { const v = find('.mm[data-theme="light"]') ?? find('.mm[data-theme=light]'); if (v) return { value: v, from: '.mm[data-theme=light]' }; }
    const v = find('.mm'); return v ? { value: v, from: theme === 'light' ? '.mm (shared)' : '.mm' } : null;
  }

  return {
    TOKENS,
    declared, tokenDef,
    setPart(target, prop, value) {
      const p = (state.parts[target] ??= {});
      if (value === '' || value == null) delete p[prop]; else p[prop] = value;
      if (!Object.keys(p).length) delete state.parts[target];
      apply();
    },
    setToken(theme, name, value) {
      if (value === '' || value == null) delete state.tokens[theme][name]; else state.tokens[theme][name] = value;
      apply();
    },
    isTweaked: (target, prop) => !!state.parts[target]?.[prop],
    count: () => Object.values(state.parts).reduce((n, p) => n + Object.keys(p).length, 0) + Object.keys(state.tokens.dark).length + Object.keys(state.tokens.light).length,
    css,
    /** the changes, written to send: a short list, then the CSS */
    report() {
      const lines = [];
      for (const [sel, props] of Object.entries(state.parts)) for (const [p, v] of Object.entries(props)) lines.push(`- ${sel} → ${p}: ${v}`);
      for (const t of ['dark', 'light']) for (const [p, v] of Object.entries(state.tokens[t])) lines.push(`- token ${p} (${t}) → ${v}`);
      return `marmit design tweaks (${lines.length})\n${lines.join('\n')}\n\n\`\`\`css\n${css()}\n\`\`\`\n`;
    },
    reset() { state = { parts: {}, tokens: { dark: {}, light: {} } }; apply(); },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    start() { apply(); },
  };
})();
