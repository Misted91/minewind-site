(function(){
  const DATA = window.__MINEWIND_DATA__;
  const I18N = window.__I18N__;
  const essences = DATA.essences;
  const tierLegend = DATA.tierLegend;

  // ---- i18n (mirrors codex.js, kept in sync via the 'codexlang' event) ----
  const LANG_KEY = 'minewind-lang';
  function detectLang(){
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && I18N.strings[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0,2).toLowerCase();
    return I18N.strings[nav] ? nav : 'en';
  }
  let lang = detectLang();
  let S = I18N.strings[lang];
  function tr(key){
    const dig = (o) => key.split('.').reduce((a,k) => (a && a[k] != null) ? a[k] : undefined, o);
    const v = dig(S); if (v != null) return v;
    const f = dig(I18N.strings.fr); return f != null ? f : key;
  }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }

  // ---- data helpers (same conventions as build.js) ----
  const ROMAN = ['I','II','III','IV','V'];
  const tierValue = {};
  tierLegend.forEach(r => { tierValue[r.tier] = r.value; });
  // Rough worth of each tier code, in "s" (1 stack = 64 dragon eggs) — same table as build.js.
  const TIER_STACKS = { X:40, SSS:20, SS:12, S:8, AAA:7, AA:6, A:5, BBB:4, BB:3, B:2, CCC:1, CC:0.5, C:0.25 };
  const essByNorm = {};
  essences.forEach(e => { essByNorm[norm(e.name)] = e; });
  function translateLegend(value){
    if (value === 'Pas encore échangé') return tr('notTraded');
    return value.replace('ou moins', tr('orLess'));
  }
  function priceText(raw){
    const t = (raw||'').trim();
    if (!t) return '—';
    return tierValue[t] != null ? translateLegend(tierValue[t]) : t;
  }
  function levelsOf(name){
    const e = essByNorm[norm(name)];
    if (!e) return [{lvl:1, raw:''}];
    const out = (e.prices||[]).map((raw,i) => ({lvl:i+1, raw:(raw||'').trim()})).filter(x => x.raw);
    return out.length ? out : [{lvl:1, raw:''}];
  }
  function rawOf(name, level){
    const l = levelsOf(name).find(x => x.lvl === level);
    return l ? l.raw : '';
  }

  // ---- state: owned essences, persisted per device ----
  // { items: [{ name, level, qty }] } — one entry per essence+tier.
  const INV_KEY = 'minewind-inventory';
  function load(){
    try {
      const p = JSON.parse(localStorage.getItem(INV_KEY));
      if (p && Array.isArray(p.items)){
        const out = [], seen = new Set();
        p.items.forEach(raw => {
          if (!raw || !raw.name) return;
          const e = essByNorm[norm(raw.name)];
          if (!e) return;
          const level = Math.min(5, Math.max(1, raw.level || 1));
          const id = norm(e.name) + '|' + level;
          if (seen.has(id)) return;
          seen.add(id);
          out.push({ name: e.name, level, qty: Math.min(999, Math.max(1, raw.qty || 1)) });
        });
        return out;
      }
    } catch(e){}
    return [];
  }
  let items = load();
  function save(){
    try { localStorage.setItem(INV_KEY, JSON.stringify({ items })); } catch(e){}
    // let the Équipement tab refresh its "in your inventory" badges
    document.dispatchEvent(new CustomEvent('invchange'));
  }

  // ---- DOM ----
  const invView = document.getElementById('inv-view');
  const invInner = document.getElementById('inv-inner');
  if (!invView || !invInner) return;
  const byId = (id) => document.getElementById(id);

  function lvlOptions(name, sel){
    return levelsOf(name).map(l =>
      `<option value="${l.lvl}"${l.lvl===sel?' selected':''}>${ROMAN[l.lvl-1]} · ${escapeHtml(priceText(l.raw))}</option>`
    ).join('');
  }

  function render(){
    items.sort((a,b) => a.name.localeCompare(b.name) || a.level - b.level);
    const totalQty = items.reduce((a,it) => a + it.qty, 0);
    // estimated total worth in stacks; tiers without an estimate flag a "+"
    let value = 0, undetermined = false;
    items.forEach(it => {
      const code = rawOf(it.name, it.level);
      if (TIER_STACKS[code] != null) value += TIER_STACKS[code] * it.qty;
      else if (code) undetermined = true;
    });
    const valueLabel = items.length
      ? `<span class="stat-cost" title="${escapeHtml(tr('inv.estValue'))}">≈ ${Math.round(value*10)/10}s${undetermined ? ' +' : ''}</span>`
      : '';

    const rows = items.map((it, i) => `
      <div class="inv-row">
        <span class="buy-name">${escapeHtml(it.name)}</span>
        <span class="buy-lvl">${ROMAN[it.level-1]}</span>
        <span class="buy-price">${escapeHtml(priceText(rawOf(it.name, it.level)))}</span>
        <span class="inv-qty">
          <button class="inv-step" type="button" data-inv-dec="${i}" aria-label="−">−</button>
          <span class="inv-count">×${it.qty}</span>
          <button class="inv-step" type="button" data-inv-inc="${i}" aria-label="+">+</button>
        </span>
        <button class="chip-x" type="button" data-inv-rm="${i}" aria-label="×" title="${escapeHtml(tr('inv.remove'))}">×</button>
      </div>`).join('');

    invInner.innerHTML = `
      <div class="inv-panel">
        <div class="inv-head">
          <div>
            <h2 class="inv-title">${escapeHtml(tr('inv.heading'))}</h2>
            <p class="inv-intro">${escapeHtml(tr('inv.intro'))}</p>
          </div>
          <div class="inv-stats">
            ${items.length ? `<span class="stat-own">${totalQty} ${escapeHtml(tr('inv.count'))}</span>` : ''}
            ${valueLabel}
          </div>
        </div>
        <div class="inv-add">
          <input id="inv-ess" class="trade-input" type="text" data-esspick placeholder="${escapeHtml(tr('inv.searchEssence'))}" autocomplete="off" spellcheck="false">
          <select id="inv-lvl" class="trade-select"></select>
          <button id="inv-add-btn" class="trade-publish" type="button">${escapeHtml(tr('inv.add'))}</button>
        </div>
        ${items.length ? `<div class="inv-list">${rows}</div>` : `<p class="inv-empty">${escapeHtml(tr('inv.empty'))}</p>`}
      </div>`;
    syncLevelSelect();
  }

  // fill the tier select according to the essence typed in the add field
  function syncLevelSelect(){
    const inp = byId('inv-ess'), sel = byId('inv-lvl');
    if (!inp || !sel) return;
    const e = essByNorm[norm(inp.value)];
    sel.innerHTML = e ? lvlOptions(e.name, levelsOf(e.name)[0].lvl) : `<option value="1">${ROMAN[0]}</option>`;
  }

  function addItem(){
    const inp = byId('inv-ess');
    const e = essByNorm[norm(inp && inp.value)];
    if (!e) return;
    const lvls = levelsOf(e.name).map(l => l.lvl);
    let lvl = +(byId('inv-lvl').value) || lvls[0];
    if (!lvls.includes(lvl)) lvl = lvls[0];
    const ex = items.find(it => norm(it.name) === norm(e.name) && it.level === lvl);
    if (ex) ex.qty = Math.min(999, ex.qty + 1);
    else items.push({ name: e.name, level: lvl, qty: 1 });
    save(); render();
    const again = byId('inv-ess');
    if (again) again.focus();
  }

  // ---- events ----
  invView.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('#inv-add-btn')){ addItem(); return; }
    const inc = t.closest('[data-inv-inc]');
    if (inc){ const it = items[+inc.getAttribute('data-inv-inc')]; if (it){ it.qty = Math.min(999, it.qty + 1); save(); render(); } return; }
    const dec = t.closest('[data-inv-dec]');
    if (dec){ const it = items[+dec.getAttribute('data-inv-dec')]; if (it && it.qty > 1){ it.qty--; save(); render(); } return; }
    const rm = t.closest('[data-inv-rm]');
    if (rm){ items.splice(+rm.getAttribute('data-inv-rm'), 1); save(); render(); return; }
  });
  invView.addEventListener('input', (ev) => {
    if (ev.target.id === 'inv-ess') syncLevelSelect();
  });
  invView.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'inv-ess'){ ev.preventDefault(); addItem(); }
  });

  // ---- lazy render when the tab is shown (tabs are managed by build.js) ----
  let built = false;
  document.addEventListener('tabchange', (ev) => {
    if (ev.detail === 'inv' && !built){ built = true; render(); }
  });
  if (!invView.hidden && !built){ built = true; render(); }

  document.addEventListener('codexlang', (ev) => {
    const code = ev.detail;
    if (I18N.strings[code]){ lang = code; S = I18N.strings[code]; }
    if (built) render();
  });
})();
