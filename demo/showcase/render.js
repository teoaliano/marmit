// Renders the page: foundations, every CATALOG entry taken apart, then the SHOWCASE compositions, with a sticky index.
(() => {
  const { createIsland } = Marmit;
  const main = document.getElementById('main'), toc = document.getElementById('toc');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  let specTheme = 'dark';

  /* ---------- forced pseudo-states ----------
     Copy every marmit rule that uses :hover / :active / :focus-visible / :focus-within / :focus, with the pseudo-class
     swapped for a class (.st-hover …). A specimen then shows a state by carrying that class, through the real CSS. */
  function forceStates() {
    const src = document.getElementById('marmit-styles')?.sheet; if (!src) return;
    const out = [], map = [[/:focus-visible/g, '.st-focus'], [/:focus-within/g, '.st-focus-within'], [/:hover/g, '.st-hover'], [/:active/g, '.st-active'], [/:focus(?![-\w])/g, '.st-focus']];
    const walk = (rules, wrap) => {
      for (const r of rules) {
        if (r.selectorText && /:(hover|active|focus)/.test(r.selectorText)) {
          let sel = r.selectorText; for (const [re, cls] of map) sel = sel.replace(re, cls);
          out.push(wrap(`${sel} { ${r.style.cssText} }`));
        } else if (r.cssRules && r.media) walk(r.cssRules, x => wrap(`@media ${r.media.mediaText} { ${x} }`));
      }
    };
    walk(src.cssRules, x => x);
    const st = el('style'); st.id = 'forced-states'; st.textContent = out.join('\n'); document.head.append(st);
  }

  /* ---------- sources: a hidden island per entry holds every variant, so specimens are clones of real controls ---------- */
  const shelf = el('div'); shelf.style.cssText = 'position:absolute;left:-10000px;top:0;width:2400px;display:flex;flex-direction:column;gap:80px;padding:60px';
  document.body.append(shelf);
  function source(items, opts = {}) {
    const host = el('div'); shelf.append(host);
    return createIsland({ mode: 'inline', container: host, injectStyles: true, label: 'source', ...opts, items });
  }
  const itemEl = (isl, id) => isl.el.querySelector(`.mm-items > [data-mm-key="${CSS.escape(id)}"]`);
  const plate = (kind = 'plate') => { const p = el('div', `mm spec ${kind}`); p.dataset.theme = specTheme; p.dataset.mode = 'inline'; return p; };
  const strip = n => { n.removeAttribute('id'); n.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); n.querySelectorAll('[tabindex]').forEach(x => x.setAttribute('tabindex', '-1')); return n; };
  const clone = n => strip(n.cloneNode(true));
  // canvases don't clone their pixels
  const cloneDeep = n => {
    const c = clone(n), a = [...n.querySelectorAll('canvas')], b = [...c.querySelectorAll('canvas')];
    // a canvas paints on the next frame after its panel opens: copy its pixels now and again once it has painted
    const copy = () => a.forEach((cv, i) => { b[i].width = cv.width; b[i].height = cv.height; b[i].getContext('2d')?.drawImage(cv, 0, 0); });
    copy(); if (a.length) setTimeout(copy, 300);
    return c;
  };
  function panelOf(isl, id) {
    isl.open(id);
    const pc = [...isl.el.querySelectorAll('.mm-pc')].find(x => x.classList.contains('on'));
    const p = el('div', 'mm-panel on'); if (pc) p.append(cloneDeep(pc)); isl.close();
    return p;
  }

  /* ---------- computed spec of one part ---------- */
  const px = v => (Math.round(parseFloat(v) * 10) / 10) + '';
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function short(c) {
    // any CSS colour (oklch, color-mix…) to hex via a 1px canvas
    if (!/^rgba?\(/.test(c)) { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; c = `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${(d[3] / 255).toFixed(2)})`; }
    const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c.length > 26 ? c.slice(0, 26) + '…' : c;
    const [r, g, b, a] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number), hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    return a !== undefined && a < 1 ? `${hex} ${Math.round(a * 100)}%` : hex;
  }


  /* ---------- an entry ---------- */
  // token edits re-read every token card
  const refreshers = new Set();
  TWEAKS.onChange(() => refreshers.forEach(f => f()));

  function card(specimen, label, note) { const c = el('div', 'card'); c.append(specimen, el('div', 'lab', `${label}${note ? `<small>${note}</small>` : ''}`)); return c; }

  function renderEntry(e) {
    const sec = el('section', 'sc'); sec.id = e.id;
    sec.append(el('h2', '', `${e.name} <code>${e.code ?? ''}</code>`), el('p', '', e.desc ?? ''));
    main.append(sec);
    const variants = e.variants ?? (e.item ? [e.item] : []);
    const ids = variants.map((v, i) => v.id ?? `${e.id}-${i}`);
    const src = variants.length ? source(variants.map((v, i) => ({ ...v, id: ids[i] })), e.island) : null;
    const pick = e.pick ?? (x => x);          // the specimen is the control, or one part of it (atoms)
    const make = (i, force) => {
      const node = pick(clone(itemEl(src, ids[i])));
      const p = plate(e.plate ?? (e.pick ? 'plate' : 'plate')); p.append(node);
      // a forced state is a class, or an attribute when written '@name=value' (open triggers show through aria-expanded)
      for (const [cls, sel] of force ?? []) (sel ? [...p.querySelectorAll(sel)] : [node]).forEach(x => cls[0] === '@' ? x.setAttribute(...cls.slice(1).split('=')) : x.classList.add(cls));
      return p;
    };
    if (src) {
      if (e.states?.length) {
        sec.append(el('h3', '', 'States'));
        const g = el('div', 'grid');
        for (const s of e.states) g.append(card(make(s.v ?? 0, s.force), s.name, s.note));
        sec.append(g);
      }
      if (e.panel) {
        sec.append(el('h3', '', 'Panel'));
        const p = plate('bare'); p.append(panelOf(src, ids[e.panel.v ?? 0]));
        const g0 = el('div', 'grid'); g0.append(card(p, 'open')); sec.append(g0);
        if (e.panel.states?.length) {
          sec.append(el('h3', '', 'Panel states'));
          const g = el('div', 'grid');
          for (const s of e.panel.states) {
            const q = plate('bare'); q.append(panelOf(src, ids[s.v ?? e.panel.v ?? 0]));
            for (const [cls, sel] of s.force ?? []) [...q.querySelectorAll(sel)].slice(0, s.first === false ? undefined : 1).forEach(x => x.classList.add(cls));
            g.append(card(q, s.name, s.note));
          }
          sec.append(g);
        }
      }
    }
    if (e.custom) { const wrap = el('div'); sec.append(wrap); e.custom(wrap, { plate, el, source, itemEl, clone, card }); }
    // every component ends with a live, interactive bar: its own live list, or else its variants
    if (e.live !== false && (e.live || variants.length)) {
      sec.append(el('h3', '', 'Live'));
      const stage = el('div', 'stage'), out = el('div', 'out'); sec.append(stage, out);
      const host = el('div'); stage.append(host);
      const items = typeof e.live === 'function' ? e.live() : e.live ?? variants.map((v, i) => ({ ...v, id: v.id ?? `${e.id}-live-${i}` }));
      const isl = createIsland({ mode: 'inline', container: host, label: e.name, ...(e.liveIsland ?? {}), items,
        onChange: (id, v, all) => out.textContent = JSON.stringify(all), onAction: (id, x) => out.textContent = 'action ' + id + (x ? ' → ' + x : '') });
      SHOWCASE.islands.push(isl);
    }
  }

  /* ---------- foundations ---------- */
  function foundations() {
    const sec = el('section', 'sc'); sec.id = 'tokens'; main.append(sec);
    sec.append(el('h2', '', 'Tokens <code>--mm-*</code>'), el('p', '', 'The custom properties every part is painted with. Edit a definition (a colour, or a relation to another token) and every component follows. Escape puts it back.'));
    // each token: its definition for that theme (editable; a relation like color-mix(… var(--mm-ink) 11% …) stays a
    // relation) and the colour it resolves to
    const probe = plate('bare'); probe.style.cssText = 'position:absolute;left:-9999px'; document.body.append(probe);
    for (const theme of ['dark', 'light']) {
      sec.append(el('h3', '', `Colour · ${theme}`));
      const g = el('div', 'tokens'); sec.append(g);
      for (const n of TWEAKS.TOKENS) {
        const t = el('div', 'tok'), sw = el('div', 'sw'), info = el('div', 'tokinfo'), inp = el('input'), out = el('span', 'cmp');
        inp.spellcheck = false; inp.setAttribute('aria-label', `${n} (${theme})`);
        info.append(el('b', '', n), inp, out); t.append(sw, info); g.append(t);
        const read = () => {
          const d = TWEAKS.tokenDef(n, theme);
          if (document.activeElement !== inp) inp.value = d?.value ?? '';
          inp.title = d ? `from ${d.from}` : ''; t.classList.toggle('tw', d?.from === 'tweak');
          probe.dataset.theme = theme; const x = el('div'); x.style.background = `var(${n})`; probe.append(x);
          const c = getComputedStyle(x).backgroundColor; x.remove(); sw.style.background = c; out.innerHTML = short(c);
        };
        inp.addEventListener('change', () => TWEAKS.setToken(theme, n, inp.value.trim()));
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { TWEAKS.setToken(theme, n, ''); inp.blur(); } });
        read(); refreshers.add(read);
      }
    }
    sec.append(el('h3', '', 'Metrics'), el('div', 'kv', `
      <span>bar height</span><b>40px</b><span>item height</span><b>32px — every control is a 32px item</b>
      <span>bar inset</span><b>4px on all four sides (item to bar edge)</b><span>item gap</span><b>4px</b>
      <span>separator</span><b>9.5px slot, 1px line</b><span>panel gap</span><b>14px (≥ 2 × blur)</b>
      <span>panel radius</span><b>18px</b><span>type</span><b>500 13px system UI; values tabular</b>
      <span>ease (CSS)</span><b>cubic-bezier(.32, .72, 0, 1)</b><span>spring</span><b>stiffness ${Marmit.DEFAULT_PHYSICS.stiffness}, damping ${Marmit.DEFAULT_PHYSICS.damping}</b>`));
    sec.append(el('h3', '', 'Physics defaults'));
    sec.append(el('div', 'kv', Object.entries(Marmit.DEFAULT_PHYSICS).map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')));

    const ic = el('section', 'sc'); ic.id = 'icons'; main.append(ic);
    ic.append(el('h2', '', 'Icons <code>icons</code>'), el('p', '', 'Built-in 14 × 14 icons drawn with currentColor. Pass the name as a string anywhere an icon is accepted.'));
    const g = el('div', 'icons'); ic.append(g);
    for (const [name, svg] of Object.entries(Marmit.icons)) {
      const p = plate(); const b = el('span', 'mm-btn mm-item', `<span class="mm-ic">${svg}</span>`); b.style.display = 'grid'; b.style.placeItems = 'center'; p.append(b);
      g.append(card(p, name));
    }
  }

  /* ---------- page ---------- */
  function addToc(groupTitle, links) {
    toc.append(el('div', 'grp', groupTitle));
    for (const [id, title, code] of links) { const a = el('a', '', `${title}${code ? `<small>${code}</small>` : ''}`); a.href = '#' + id; toc.append(a); }
  }
  function head(id, title, desc) { const h = el('h2', 'grp-head', title); h.id = id; main.append(h, el('p', '', desc ?? '')); }

  function render() {
    main.replaceChildren(); [...toc.querySelectorAll('.grp, a')].forEach(x => x.remove());
    SHOWCASE.islands.forEach(i => i.destroy()); SHOWCASE.islands.length = 0;
    shelf.replaceChildren();
    head('foundations', 'Foundations', 'What everything is made of.');
    foundations();
    addToc('Foundations', [['tokens', 'Tokens'], ['icons', 'Icons']]);
    for (const g of CATALOG.groups) {
      const es = CATALOG.entries.filter(e => e.group === g.id); if (!es.length) continue;
      head('g-' + g.id, g.title, g.desc); addToc(g.title, es.map(e => [e.id, e.name, e.code]));
      for (const e of es) { try { renderEntry(e); } catch (err) { console.error('[catalog]', e.id, err); main.append(el('p', 'out', `${e.id}: ${err.message}`)); } }
    }
    head('compositions', 'Compositions', 'Components assembled into real bars, interactive. Values print under each stage.');
    addToc('Compositions', SHOWCASE.sections.map(s => ['c-' + s.id, s.title]));
    for (const s of SHOWCASE.sections) {
      // composition ids share names with catalog entries (slider, fields…): prefix them so links and anchors are unique
      const sec = el('section', 'sc'); sec.id = 'c-' + s.id;
      sec.innerHTML = `<h2></h2><p></p><div class="stage"></div><div class="out" aria-live="polite"></div>`;
      sec.querySelector('h2').textContent = s.title; sec.querySelector('p').textContent = s.desc ?? '';
      main.append(sec);
      const outEl = sec.querySelector('.out'), out = v => { outEl.textContent = typeof v === 'string' ? v : JSON.stringify(v); };
      try { [].concat(s.mount(sec.querySelector('.stage'), out) ?? []).forEach(i => i && SHOWCASE.islands.push(i)); }
      catch (err) { console.error('[showcase]', s.id, err); outEl.textContent = 'error: ' + err.message; }
    }
    // the index follows the scroll
    const links = [...toc.querySelectorAll('a')], targets = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
    const spy = () => {
      let cur = targets[0]; for (const t of targets) if (t.getBoundingClientRect().top < 120) cur = t;
      links.forEach(a => { const on = a.hash === '#' + cur?.id; if (on !== a.classList.contains('on')) { a.classList.toggle('on', on); if (on) a.scrollIntoView({ block: 'nearest' }); } });
    };
    removeEventListener('scroll', window.__spy ?? (() => {})); window.__spy = spy; addEventListener('scroll', spy, { passive: true }); spy();
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  // the stylesheet arrives with the first island; force states after it exists
  source([{ type: 'button', label: 'x', icon: 'plus' }]); forceStates(); TWEAKS.start();
  render();
  // the tweaks bar: how many changes, copy them to send, reset them
  const bar = document.getElementById('tweaksBar'), cnt = bar.querySelector('b');
  const sync = () => { const n = TWEAKS.count(); cnt.textContent = n ? `${n} tweak${n > 1 ? 's' : ''}` : 'no tweaks'; bar.classList.toggle('has', !!n); };
  TWEAKS.onChange(sync); sync();
  bar.querySelector('[data-a=copy]').addEventListener('click', e => {
    const t = TWEAKS.report(), b = e.currentTarget;
    (navigator.clipboard?.writeText(t) ?? Promise.reject()).then(() => { b.textContent = 'copied ✓'; setTimeout(() => b.textContent = 'copy', 1400); })
      .catch(() => { const ta = el('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); b.textContent = 'copied ✓'; setTimeout(() => b.textContent = 'copy', 1400); });
  });
  bar.querySelector('[data-a=reset]').addEventListener('click', () => { if (TWEAKS.count() && confirm('Reset every tweak?')) TWEAKS.reset(); });
  document.getElementById('themeSwitch').addEventListener('click', e => {
    specTheme = specTheme === 'dark' ? 'light' : 'dark'; e.currentTarget.textContent = 'specimens: ' + specTheme;
    document.querySelectorAll('.mm.spec').forEach(p => p.dataset.theme = specTheme);
    SHOWCASE.islands.forEach(i => i.update({ theme: specTheme }));
  });
})();
