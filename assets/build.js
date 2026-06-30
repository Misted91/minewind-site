(function(){
  const DATA = window.__MINEWIND_DATA__;
  const I18N = window.__I18N__;
  const essences = DATA.essences;
  const tierLegend = DATA.tierLegend;

  // ---- i18n (mirrors app.js, kept in sync via the 'codexlang' event) ----
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
    const dig = (obj) => key.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : undefined, obj);
    const v = dig(S);
    if (v != null) return v;
    const f = dig(I18N.strings.fr);
    return f != null ? f : key;
  }
  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function norm(s){
    return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  }

  // ---- data helpers ----
  const ROMAN = ['I','II','III','IV','V'];
  const tierValue = {};
  tierLegend.forEach(r => { tierValue[r.tier] = r.value; });
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
  // available levels (non-empty price) for an essence; always at least level 1
  function levelsOf(name){
    const e = essByNorm[norm(name)];
    if (!e) return [{lvl:1, raw:''}];
    const out = (e.prices||[]).map((raw,i) => ({lvl:i+1, raw:(raw||'').trim()})).filter(x => x.raw);
    return out.length ? out : [{lvl:1, raw:''}];
  }

  // ---- souls (game terms kept in English across all languages) ----
  const SOULS = [
    {key:'fire',        label:'Fire',        color:'#ff7a45'},
    {key:'ice',         label:'Ice',         color:'#5fc7ff'},
    {key:'shadow',      label:'Shadow',      color:'#9b8cff'},
    {key:'dragon',      label:'Dragon',      color:'#7ed957'},
    {key:'orc',         label:'Orc',         color:'#b5c25a'},
    {key:'nature',      label:'Nature',      color:'#54c98b'},
    {key:'dimensional', label:'Dimensional', color:'#c879ff'},
    {key:'blood',       label:'Blood',       color:'#e0454a'},
    {key:'undead',      label:'Undead',      color:'#9fb3a6'}
  ];
  const soulByKey = {};
  SOULS.forEach(s => { soulByKey[s.key] = s; });

  // ---- state (persisted) ----
  const SLOTS = ['helmet','chestplate','leggings','boots','offhand'];
  const MAX_ESS = 3, MAX_SOULS = 4;
  const BUILD_KEY = 'minewind-build';

  function emptyState(){
    const s = { slots:{} };
    SLOTS.forEach(k => { s.slots[k] = { essences:[], soul:null }; });
    return s;
  }
  function loadState(){
    try {
      const raw = localStorage.getItem(BUILD_KEY);
      if (raw){
        const p = JSON.parse(raw);
        const s = emptyState();
        if (p && p.slots){
          SLOTS.forEach(k => {
            const src = p.slots[k];
            if (!src) return;
            s.slots[k].essences = (src.essences||[])
              .filter(e => e && e.name && essByNorm[norm(e.name)])
              .slice(0, MAX_ESS)
              .map(e => ({ name:e.name, level: Math.min(5, Math.max(1, e.level||1)), owned: !!e.owned }));
            // soul: one type, quantity 1-4 (convert legacy `souls` array if present)
            let soul = null;
            if (src.soul && soulByKey[src.soul.type]){
              soul = { type: src.soul.type, count: Math.min(MAX_SOULS, Math.max(1, src.soul.count||1)) };
            } else if (Array.isArray(src.souls) && src.souls.length && soulByKey[src.souls[0]]){
              soul = { type: src.souls[0], count: Math.min(MAX_SOULS, src.souls.length) };
            }
            s.slots[k].soul = soul;
          });
        }
        return s;
      }
    } catch(e){}
    return emptyState();
  }
  let state = loadState();
  function save(){ try { localStorage.setItem(BUILD_KEY, JSON.stringify(state)); } catch(e){} }

  // ---- DOM ----
  const buildView = document.getElementById('build-view');
  const buildInner = document.getElementById('build-inner');
  const datalist = document.getElementById('ess-datalist');
  const codexView = document.getElementById('codex-view');
  const tabs = document.getElementById('tabs');

  // fill datalist once (language-independent)
  datalist.innerHTML = essences.map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('');

  let openPicker = null; // { slot, type:'essence'|'soul' }

  // ---- render ----
  function slotMarkup(key){
    const slot = state.slots[key];
    const name = tr('build.slots.' + key);

    // essences
    let essChips = slot.essences.map((entry, i) => {
      const lvls = levelsOf(entry.name);
      if (!lvls.some(l => l.lvl === entry.level)) entry.level = lvls[0].lvl;
      const opts = lvls.map(l =>
        `<option value="${l.lvl}"${l.lvl===entry.level?' selected':''}>${ROMAN[l.lvl-1]} · ${escapeHtml(priceText(l.raw))}</option>`
      ).join('');
      return `<div class="ess-chip">
        <span class="ess-chip-name">${escapeHtml(entry.name)}</span>
        <select class="lvl-select" data-slot="${key}" data-idx="${i}" title="${escapeHtml(tr('build.level'))}">${opts}</select>
        <button class="chip-x" type="button" data-rm-ess="${key}" data-idx="${i}" aria-label="×">×</button>
      </div>`;
    }).join('');
    if (slot.essences.length < MAX_ESS){
      essChips += `<button class="add-chip" type="button" data-add-ess="${key}">+ ${escapeHtml(tr('build.addEssence'))}</button>`;
    }
    let essPicker = '';
    if (openPicker && openPicker.slot === key && openPicker.type === 'essence'){
      essPicker = `<input class="ess-input" type="text" data-slot="${key}" list="ess-datalist" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('build.searchEssence'))}">`;
    }

    // soul: a single type with a quantity (1-4)
    let soulChips = '';
    if (slot.soul){
      const s = soulByKey[slot.soul.type];
      const countOpts = [1,2,3,4].map(n => `<option value="${n}"${n===slot.soul.count?' selected':''}>×${n}</option>`).join('');
      soulChips = `<div class="soul-chip" style="--soul:${s.color}">
        <span class="soul-dot"></span>
        <span class="soul-chip-name">${escapeHtml(s.label)}</span>
        <select class="soul-count" data-slot="${key}">${countOpts}</select>
        <button class="chip-x" type="button" data-rm-soul="${key}" aria-label="×">×</button>
      </div>`;
    } else {
      soulChips = `<button class="add-chip" type="button" data-add-soul="${key}">+ ${escapeHtml(tr('build.addSoul'))}</button>`;
    }
    let soulPicker = '';
    if (openPicker && openPicker.slot === key && openPicker.type === 'soul'){
      soulPicker = `<div class="soul-picker">` + SOULS.map(s =>
        `<button class="soul-opt" type="button" data-soul-pick="${s.key}" data-slot="${key}" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)}</button>`
      ).join('') + `</div>`;
    }

    return `<div class="slot">
      <div class="slot-name">${escapeHtml(name)}</div>
      <div class="slot-block">
        <div class="slot-label">${escapeHtml(tr('build.essences'))} <span class="slot-count">${slot.essences.length}/${MAX_ESS}</span></div>
        <div class="ess-list">${essChips}</div>
        ${essPicker}
      </div>
      <div class="slot-block">
        <div class="slot-label">${escapeHtml(tr('build.souls'))} <span class="slot-count">${slot.soul ? slot.soul.count : 0}/${MAX_SOULS}</span></div>
        <div class="chips">${soulChips}</div>
        ${soulPicker}
      </div>
    </div>`;
  }

  function shoppingMarkup(){
    const items = [];
    SLOTS.forEach(key => {
      state.slots[key].essences.forEach((entry, idx) => {
        const lvls = levelsOf(entry.name);
        const cur = lvls.find(l => l.lvl === entry.level) || lvls[0];
        items.push({ slot:key, idx, name:entry.name, level:entry.level, raw:cur.raw, owned:!!entry.owned });
      });
    });

    if (!items.length){
      return `<div class="shopping">
        <div class="shopping-head"><h3>${escapeHtml(tr('build.shopping'))}</h3></div>
        <p class="shopping-empty">${escapeHtml(tr('build.shoppingEmpty'))}</p>
      </div>`;
    }

    const total = items.length;
    const owned = items.filter(i => i.owned).length;
    const remaining = total - owned;
    // remaining first, then owned
    items.sort((a,b) => (a.owned - b.owned));

    const rows = items.map(it => `
      <label class="buy-row${it.owned?' done':''}">
        <input type="checkbox" class="own-check" data-slot="${it.slot}" data-idx="${it.idx}"${it.owned?' checked':''}>
        <span class="buy-name">${escapeHtml(it.name)}</span>
        <span class="buy-slot">${escapeHtml(tr('build.slots.' + it.slot))}</span>
        <span class="buy-lvl">${ROMAN[it.level-1]}</span>
        <span class="buy-price">${escapeHtml(priceText(it.raw))}</span>
      </label>`).join('');

    return `<div class="shopping">
      <div class="shopping-head">
        <h3>${escapeHtml(tr('build.shopping'))}</h3>
        <div class="shopping-stats">
          <span class="stat-rem">${remaining} ${escapeHtml(tr('build.remaining'))}</span>
          <span class="stat-own">${owned}/${total} ${escapeHtml(tr('build.acquired'))}</span>
        </div>
      </div>
      <div class="buy-list">${rows}</div>
    </div>`;
  }

  function renderBuild(){
    const slotsHtml = SLOTS.map(slotMarkup).join('');
    buildInner.innerHTML = `
      <div class="build-head">
        <div>
          <h2 class="build-title">${escapeHtml(tr('build.heading'))}</h2>
          <p class="build-intro">${escapeHtml(tr('build.intro'))}</p>
        </div>
        <button class="build-reset" type="button" id="build-reset">${escapeHtml(tr('build.reset'))}</button>
      </div>
      <div class="slots">${slotsHtml}</div>
      ${shoppingMarkup()}
    `;
    // focus the essence picker if just opened
    if (openPicker && openPicker.type === 'essence'){
      const inp = buildInner.querySelector('.ess-input');
      if (inp) inp.focus();
    }
  }

  // ---- mutations ----
  function addEssence(slot, name){
    const e = essByNorm[norm(name)];
    if (!e) return false;
    const s = state.slots[slot];
    if (s.essences.length >= MAX_ESS) return false;
    s.essences.push({ name:e.name, level: levelsOf(e.name)[0].lvl, owned:false });
    save();
    return true;
  }

  // ---- events ----
  buildView.addEventListener('click', (ev) => {
    const t = ev.target;
    const addEss = t.closest('[data-add-ess]');
    if (addEss){ openPicker = { slot:addEss.getAttribute('data-add-ess'), type:'essence' }; renderBuild(); return; }
    const addSoul = t.closest('[data-add-soul]');
    if (addSoul){ openPicker = { slot:addSoul.getAttribute('data-add-soul'), type:'soul' }; renderBuild(); return; }
    const rmEss = t.closest('[data-rm-ess]');
    if (rmEss){
      const slot = rmEss.getAttribute('data-rm-ess'), idx = +rmEss.getAttribute('data-idx');
      state.slots[slot].essences.splice(idx, 1); openPicker = null; save(); renderBuild(); return;
    }
    const rmSoul = t.closest('[data-rm-soul]');
    if (rmSoul){
      const slot = rmSoul.getAttribute('data-rm-soul');
      state.slots[slot].soul = null; save(); renderBuild(); return;
    }
    const soulPick = t.closest('[data-soul-pick]');
    if (soulPick){
      const slot = soulPick.getAttribute('data-slot'), sk = soulPick.getAttribute('data-soul-pick');
      state.slots[slot].soul = { type: sk, count: 1 };
      openPicker = null; save(); renderBuild(); return;
    }
    if (t.closest('#build-reset')){
      if (confirm(tr('build.resetConfirm'))){ state = emptyState(); openPicker = null; save(); renderBuild(); }
      return;
    }
  });

  buildView.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.classList.contains('ess-input')){
      const slot = t.getAttribute('data-slot');
      if (addEssence(slot, t.value)){ openPicker = null; renderBuild(); }
      return;
    }
    if (t.classList.contains('lvl-select')){
      const slot = t.getAttribute('data-slot'), idx = +t.getAttribute('data-idx');
      state.slots[slot].essences[idx].level = +t.value; save(); renderBuild(); return;
    }
    if (t.classList.contains('own-check')){
      const slot = t.getAttribute('data-slot'), idx = +t.getAttribute('data-idx');
      state.slots[slot].essences[idx].owned = t.checked; save(); renderBuild(); return;
    }
    if (t.classList.contains('soul-count')){
      const slot = t.getAttribute('data-slot');
      if (state.slots[slot].soul) state.slots[slot].soul.count = +t.value; save(); renderBuild(); return;
    }
  });

  // Enter in the essence picker
  buildView.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.classList.contains('ess-input')){
      ev.preventDefault();
      const slot = ev.target.getAttribute('data-slot');
      if (addEssence(slot, ev.target.value)){ openPicker = null; renderBuild(); }
    } else if (ev.key === 'Escape' && openPicker){
      openPicker = null; renderBuild();
    }
  });

  // ---- tabs ----
  const TAB_KEY = 'minewind-tab';
  let built = false;
  function setTab(tab){
    const isBuild = tab === 'build';
    codexView.hidden = isBuild;
    buildView.hidden = !isBuild;
    tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    localStorage.setItem(TAB_KEY, tab);
    if (isBuild && !built){ built = true; renderBuild(); }
  }
  tabs.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab');
    if (b) setTab(b.getAttribute('data-tab'));
  });
  setTab(localStorage.getItem(TAB_KEY) === 'build' ? 'build' : 'codex');

  // ---- keep in sync with language switches from app.js ----
  document.addEventListener('codexlang', (ev) => {
    const code = ev.detail;
    if (I18N.strings[code]){ lang = code; S = I18N.strings[code]; }
    if (built) renderBuild();
  });
})();
