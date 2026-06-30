(function(){
  const DATA = window.__MINEWIND_DATA__;
  const essences = DATA.essences;
  const tierLegend = DATA.tierLegend;
  const meta = DATA.meta;

  // ---- i18n state ----
  const I18N = window.__I18N__;
  const LANG_KEY = 'minewind-lang';
  function detectLang(){
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && I18N.strings[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0,2).toLowerCase();
    return I18N.strings[nav] ? nav : 'en'; // browser language, English as fallback
  }
  let lang = detectLang();
  let S = I18N.strings[lang];
  function tr(key){
    const dig = (obj) => key.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : undefined, obj);
    const v = dig(S);
    if (v != null) return v;
    const f = dig(I18N.strings.fr);
    return f != null ? f : key;
  }
  function fmt(str, vars){ return String(str).replace(/\{(\w+)\}/g, (m,k) => (vars && vars[k] != null) ? vars[k] : m); }

  const TYPE_KEYS = ['spell','weapon','armor'];
  const typeColor = {
    spell: 'var(--sigil-spell)',
    weapon: 'var(--sigil-weapon)',
    armor: 'var(--sigil-armor)'
  };
  const typeLabelKey = {
    spell: 'typeSpell',
    weapon: 'typeWeapon',
    armor: 'typeArmor'
  };

  // ---- inline SVG icons (replace the emoji glyphs) ----
  const ICONS = {
    spell: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.4 4.8 3.6 8 8 8-4.4.4-7.6 3.6-8 8-.4-4.4-3.6-7.6-8-8 4.4-.4 7.6-3.6 8-8z"/></svg>',
    weapon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 4 7V3h4l10.5 10.5"/><path d="m13 19 6-6"/><path d="m16 16 5 5"/><path d="m19.5 20.5 1-1"/></svg>',
    armor: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7.5-3.5 7.5-9.5V5L12 2.5 4.5 5v7.5C4.5 18.5 12 22 12 22z"/></svg>',
    star: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.3 4.5 3.5 7.7 8 8-4.5.3-7.7 3.5-8 8-.3-4.5-3.5-7.7-8-8 4.5-.3 7.7-3.5 8-8z"/></svg>',
    sun: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
    moon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    book: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/></svg>'
  };
  const typeIcon = {
    spell: ICONS.spell,
    weapon: ICONS.weapon,
    armor: ICONS.armor
  };

  const legendGrid = document.getElementById('legend-grid');

  // ---- meta line ----
  function renderMeta(){
    document.getElementById('meta-line').innerHTML =
      `${meta.totalEssences} ${escapeHtml(tr('essencesWord'))} · ${escapeHtml(tr('metaUpdated'))} ${meta.updated} · <a href="${meta.discord}" target="_blank" rel="noopener">${escapeHtml(tr('metaDiscord'))}</a>`;
  }

  // ---- legend (values are stored in French in data.js; translate the fragments) ----
  function translateLegend(value){
    if (value === 'Pas encore échangé') return tr('notTraded');
    return value.replace('ou moins', tr('orLess'));
  }

  // tier code -> observed price (from the legend), to show prices instead of tier letters
  const tierValue = {};
  tierLegend.forEach(row => { tierValue[row.tier] = row.value; });
  function renderLegend(){
    legendGrid.innerHTML = tierLegend.map(row => `
      <div class="legend-item">
        <span class="legend-tier">${escapeHtml(row.tier)}</span>
        <span class="legend-value">${escapeHtml(translateLegend(row.value))}</span>
      </div>
    `).join('');
  }

  // ---- search index: precompute searchable string per essence ----
  function norm(s){
    return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  essences.forEach(e => {
    const haystack = [e.name, ...(e.aliases||[])].map(norm).join(' | ');
    e.__search = haystack;
    e.__nameNorm = norm(e.name);
  });

  const resultsEl = document.getElementById('results');
  const idlePanel = document.getElementById('idle-panel');
  const searchInput = document.getElementById('search-input');
  const searchCount = document.getElementById('search-count');

  let openCardKey = null;

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  const levelLabels = ['I','II','III','IV','V'];

  function renderPriceRow(e){
    // Special-case the "(no ess form)" + free-text note pattern (Ghost Block, Poseidon Block, Living Wings, Jump, Speed)
    const levels = e.prices;
    const firstIsNoForm = (levels[0] || '').toLowerCase().includes('no ess form');

    if (firstIsNoForm && levels[1] && !/^[A-Z]+$|^X$|^Z$/.test(levels[1].trim())){
      // levels[1] holds an explanatory note rather than a tier
      return `<div class="price-row"><div class="price-pill note">${escapeHtml(levels[1])}</div></div>`;
    }

    let pills = levels.map((val, i) => {
      const trimmed = (val||'').trim();
      if (!trimmed){
        return `<div class="price-pill empty"><span class="lvl-label">${levelLabels[i]}</span><span class="lvl-value">—</span></div>`;
      }
      // known tier code -> show the observed price instead of the tier letter
      const mapped = tierValue[trimmed];
      if (mapped != null){
        return `<div class="price-pill filled" title="${escapeHtml(trimmed)}"><span class="lvl-label">${levelLabels[i]}</span><span class="lvl-value">${escapeHtml(translateLegend(mapped))}</span></div>`;
      }
      // long free-text values (rare anomalies) get their own note styling
      if (trimmed.length > 10){
        return `<div class="price-pill note">${escapeHtml(trimmed)}</div>`;
      }
      return `<div class="price-pill filled"><span class="lvl-label">${levelLabels[i]}</span><span class="lvl-value">${escapeHtml(trimmed)}</span></div>`;
    });

    return `<div class="price-row">${pills.join('')}</div>`;
  }

  function renderCard(e, idx){
    const key = e.name;
    const isOpen = openCardKey === key;
    const types = (e.type||'').split(',').map(s => s.trim()).filter(c => TYPE_KEYS.includes(c));
    const primaryType = types[0] || '';
    const color = typeColor[primaryType] || 'var(--gold)';

    const typeBadges = types.map(t => `<span class="type-badge" style="color:${typeColor[t]}" title="${escapeHtml(tr(typeLabelKey[t]))}">${typeIcon[t]||''}</span>`).join('');

    const capNote = e.cap ? `<div class="cap-note">${escapeHtml(fmt(tr('capNote'), {cap: e.cap, lvl: levelLabelFromCap(e.cap)}))}</div>` : '';

    const aliasTags = (e.aliases && e.aliases.length)
      ? `<div>
           <div class="detail-block-label">${escapeHtml(tr('labelAliases'))}</div>
           <div class="alias-tags">${e.aliases.map(a => `<span class="alias-tag">${escapeHtml(a)}</span>`).join('')}</div>
         </div>`
      : '';

    const soulNote = e.soul
      ? `<div><div class="detail-block-label">${escapeHtml(tr('labelSoul'))}</div><div class="soul-note">${escapeHtml(e.soul)}</div></div>`
      : '';

    const sectionNote = e.section
      ? `<div><div class="detail-block-label">${escapeHtml(tr('labelSection'))}</div><div class="soul-note">${escapeHtml(e.section)}</div></div>`
      : '';

    const levelsRangeNote = e.levelsRange
      ? `<div><div class="detail-block-label">${escapeHtml(tr('labelLevels'))}</div><div class="soul-note">${escapeHtml(tr('levelWord'))} ${escapeHtml(e.levelsRange)}</div></div>`
      : '';

    return `
      <article class="essence-card" data-open="${isOpen}" data-key="${escapeHtml(key)}" style="--type-color:${color}">
        <div class="card-top">
          <div>
            <div class="card-heading">
              <span class="card-name">${escapeHtml(e.name)}</span>
              <span class="card-types">${typeBadges}</span>
            </div>
            ${e.section ? `<div class="card-section">${escapeHtml(e.section)}</div>` : ''}
          </div>
        </div>
        ${e.description ? `<p class="card-desc">${escapeHtml(e.description)}</p>` : ''}
        ${renderPriceRow(e)}
        ${capNote}
        <div class="card-detail">
          <div class="detail-inner">
            ${levelsRangeNote}
            ${sectionNote}
            ${soulNote}
            ${aliasTags}
          </div>
        </div>
      </article>
    `;
  }

  function levelLabelFromCap(cap){
    const n = parseInt(cap, 10);
    if (!n) return '?';
    return levelLabels[n-1] || cap;
  }

  function runSearch(query){
    const q = norm(query);
    if (!q){
      return [];
    }
    const scored = [];
    for (const e of essences){
      let score = -1;
      if (e.__nameNorm === q) score = 100;
      else if (e.__nameNorm.startsWith(q)) score = 90;
      else if (e.__search.split(' | ').some(a => a === q)) score = 85;
      else if (e.__search.split(' | ').some(a => a.startsWith(q))) score = 75;
      else if (e.__search.includes(q)) score = 50;
      if (score > 0) scored.push([score, e]);
    }
    scored.sort((a,b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
    return scored.map(s => s[1]);
  }

  function render(){
    const query = searchInput.value;
    if (!query.trim()){
      idlePanel.style.display = '';
      resultsEl.innerHTML = '';
      searchCount.textContent = `${essences.length} ${tr('essencesWord')}`;
      return;
    }
    idlePanel.style.display = 'none';
    const matches = runSearch(query);
    searchCount.textContent = matches.length === 1 ? tr('resultOne') : fmt(tr('resultMany'), {n: matches.length});

    if (matches.length === 0){
      resultsEl.innerHTML = `
        <div class="empty-state">
          <span class="glyph">${ICONS.star}</span>
          <div class="msg">${escapeHtml(tr('emptyMsg'))}</div>
          <div class="hint">${escapeHtml(tr('emptyHint'))}</div>
        </div>`;
      return;
    }

    const capped = matches.slice(0, 60);
    resultsEl.innerHTML = capped.map(renderCard).join('');
  }

  searchInput.addEventListener('input', render);

  resultsEl.addEventListener('click', (ev) => {
    const card = ev.target.closest('.essence-card');
    if (!card) return;
    const key = card.getAttribute('data-key');
    openCardKey = (openCardKey === key) ? null : key;
    render();
  });

  function pickRandom(filterFn){
    const pool = essences.filter(filterFn);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    searchInput.value = pick.name;
    openCardKey = pick.name;
    render();
    resultsEl.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  document.getElementById('random-btn').addEventListener('click', () => pickRandom(() => true));
  document.getElementById('surprise-btn').addEventListener('click', () => pickRandom(e => (e.type||'').includes('weapon')));
  document.getElementById('surprise-spell-btn').addEventListener('click', () => pickRandom(e => (e.type||'').includes('spell')));

  // ---- theme toggle (dark / light) ----
  const THEME_KEY = 'minewind-theme';
  const themeToggle = document.getElementById('theme-toggle');
  function detectTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  }
  let theme = detectTheme();
  function applyTheme(){
    document.documentElement.setAttribute('data-theme', theme);
    // show the icon of the theme you'll switch TO
    themeToggle.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    themeToggle.setAttribute('title', theme === 'dark' ? 'Light theme' : 'Dark theme');
  }
  themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
  });
  applyTheme();

  // ---- beginner guide ----
  const guideToggle = document.getElementById('guide-toggle');
  const guideBody = document.getElementById('guide-body');
  let guideOpen = false;
  function renderGuide(){
    const g = S.guide || I18N.strings.fr.guide;
    guideToggle.innerHTML = `${ICONS.book}<span>${escapeHtml(tr('guideTitle'))}</span><span class="guide-caret" aria-hidden="true">▾</span>`;
    const moneyRows = g.money.rows.map(r =>
      `<div class="guide-row"><span class="guide-key">${escapeHtml(r[0])}</span><span class="guide-val">${escapeHtml(r[1])}</span></div>`
    ).join('');
    guideBody.innerHTML = `
      <div class="guide-item">
        <div class="guide-item-title">${escapeHtml(g.money.title)}</div>
        <p class="guide-item-body">${escapeHtml(g.money.intro)}</p>
        <div class="guide-rows">${moneyRows}</div>
      </div>
      <div class="guide-item">
        <div class="guide-item-title">${escapeHtml(g.essence.title)}</div>
        <p class="guide-item-body">${escapeHtml(g.essence.body)}</p>
      </div>
      <div class="guide-item">
        <div class="guide-item-title">${escapeHtml(g.dura.title)}</div>
        <p class="guide-item-body">${escapeHtml(g.dura.body)}</p>
      </div>`;
  }
  guideToggle.addEventListener('click', () => {
    guideOpen = !guideOpen;
    guideBody.hidden = !guideOpen;
    guideToggle.classList.toggle('open', guideOpen);
    guideToggle.setAttribute('aria-expanded', guideOpen ? 'true' : 'false');
  });

  // ---- language switcher ----
  const langSwitch = document.getElementById('lang-switch');
  function buildLangSwitch(){
    langSwitch.innerHTML = I18N.langs.map(l =>
      `<button class="lang-btn${l.code === lang ? ' active' : ''}" data-lang="${l.code}" title="${escapeHtml(l.name)}">${escapeHtml(l.label)}</button>`
    ).join('');
  }
  function applyStatic(){
    document.documentElement.lang = lang;
    document.title = tr('docTitle');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = fmt(tr(el.getAttribute('data-i18n')), {n: essences.length});
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', tr(el.getAttribute('data-i18n-placeholder')));
    });
  }
  function applyLanguage(){
    applyStatic();
    buildLangSwitch();
    renderMeta();
    renderLegend();
    renderGuide();
    render();
    document.dispatchEvent(new CustomEvent('codexlang', { detail: lang }));
  }
  langSwitch.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.lang-btn');
    if (!btn) return;
    const code = btn.getAttribute('data-lang');
    if (!I18N.strings[code] || code === lang) return;
    lang = code;
    S = I18N.strings[code];
    localStorage.setItem(LANG_KEY, code);
    applyLanguage();
  });

  applyLanguage();
})();
